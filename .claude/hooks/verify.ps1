<#
  verify.ps1 — the deterministic gate (Layer 1 of Validate).

  Runs at the end of a turn (Stop hook). Detects which repo(s) changed via git,
  then runs the FAST, build-only gate for each:
    - maraebiz/        -> dotnet build Maraebiz.sln        (compile check)
    - maraebiz-app/    -> npm run lint  (expo lint)        (the app's only automated check)
    - maraebiz-public-site/ -> (no per-turn gate yet — see note below)

  There are NO test projects in this workspace yet, so this gate is intentionally
  build/lint only. The mobile app's Expo project lives in the nested subfolder
  maraebiz-mobile-app/, so lint runs there even though git tracks the parent repo.

  On failure it writes the output to stderr and exits 2, which feeds the failure
  back to Claude so it self-corrects. Keep this fast so it can run every turn.

  Escape hatch: set $env:MARAEBIZ_SKIP_VERIFY = '1' to skip (e.g. during noisy WIP).
#>

# NOTE: do NOT use $ErrorActionPreference='Stop' here. Under Windows PowerShell 5.1,
# capturing a native exe's stderr (dotnet/npm) via 2>&1 wraps each line in an
# ErrorRecord; with 'Stop' that becomes a terminating error and crashes the script
# before our verdict logic. We drive entirely off $LASTEXITCODE instead.
$ErrorActionPreference = 'Continue'

# --- read the Stop-hook payload from stdin (avoid infinite re-trigger loops) -----
$raw = [Console]::In.ReadToEnd()
if ($raw) {
    try {
        $payload = $raw | ConvertFrom-Json
        if ($payload.stop_hook_active -eq $true) { exit 0 }  # already in a stop loop — don't block again
    } catch { }
}

if ($env:MARAEBIZ_SKIP_VERIFY -eq '1') { exit 0 }

# Resolve the workspace root (the dir that holds this .claude/) regardless of cwd.
$root        = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$backend     = Join-Path $root 'maraebiz'
$app         = Join-Path $root 'maraebiz-app'
$appProj     = Join-Path $app  'maraebiz-mobile-app'   # the Expo project (nested inside the repo)
$publicSite  = Join-Path $root 'maraebiz-public-site'
$sln         = Join-Path $backend 'Maraebiz.sln'

$failures = @()
$warnings = @()

function Test-NeedsVerify([string]$repoPath) {
    # Returns $true only if a CODE/config file changed. Doc-only changes (*.md, docs/)
    # can't affect a build, so they must not trip the gate.
    if (-not (Test-Path (Join-Path $repoPath '.git'))) { return $false }
    $lines = & git -C $repoPath status --porcelain
    if (-not $lines) { return $false }
    foreach ($line in $lines) {
        if ($line.Length -lt 4) { continue }
        $path = $line.Substring(3).Trim()
        if ($path -match ' -> ') { $path = ($path -split ' -> ')[-1] }   # renames
        $path = $path.Trim('"')
        if ($path -match '\.md$' -or $path -match '(^|/)docs/') { continue }  # doc-only -> ignore
        return $true   # a code/config file changed -> run the gate
    }
    return $false      # only docs changed -> skip
}

# --- backend gate: dotnet build ---------------------------------------------------
if (Test-NeedsVerify $backend) {
    Write-Host "[verify] backend changed -> dotnet build Maraebiz.sln"
    Push-Location $backend
    try {
        $build = & dotnet build $sln --nologo -v quiet 2>&1 | Out-String
        if ($LASTEXITCODE -ne 0) {
            $failures += "BACKEND BUILD FAILED:`n$build"
        }
    } finally {
        Pop-Location
    }
}

# --- mobile app gate: expo lint ---------------------------------------------------
if (Test-NeedsVerify $app) {
    if (-not (Test-Path (Join-Path $appProj 'node_modules'))) {
        $warnings += "Mobile app changed but node_modules is missing in maraebiz-app/maraebiz-mobile-app/ - " +
                     "ran NO lint this turn. Run 'npm install' there to enable the lint gate."
    } else {
        Write-Host "[verify] app changed -> npm run lint (expo lint)"
        Push-Location $appProj
        try {
            $lint = & npm run lint 2>&1 | Out-String
            if ($LASTEXITCODE -ne 0) {
                $failures += "APP LINT FAILED (expo lint):`n$lint"
            }
        } finally {
            Pop-Location
        }
    }
}

# --- public site: no per-turn gate yet --------------------------------------------
# The public site has no tests; a full CRA `npm run build` every turn is too heavy
# for a Stop hook. Surface that it changed so it isn't silently un-checked.
if (Test-NeedsVerify $publicSite) {
    $warnings += "maraebiz-public-site changed - no automated per-turn gate is configured for it yet " +
                 "(no tests; CRA build is too slow for every turn). Verify it manually or run 'npm run build' there."
}

# --- warnings (non-blocking, but never silent) ------------------------------------
if ($warnings.Count -gt 0) {
    [Console]::Error.WriteLine("[verify] NOTE - degraded/absent coverage:`n" + ($warnings -join "`n`n"))
}

# --- verdict ----------------------------------------------------------------------
if ($failures.Count -gt 0) {
    $msg = "Deterministic gate FAILED. Fix these before finishing (do not mark the phase complete):`n`n"
    $msg += ($failures -join "`n`n----------------------------------------`n`n")
    [Console]::Error.WriteLine($msg)
    exit 2   # blocks the Stop and feeds $msg back to Claude
}

exit 0
