/* Codemod: SQL Server `SELECT TOP n ...` -> PostgreSQL `SELECT ... LIMIT n`.
   Scans from each leftmost `SELECT TOP`, removes the TOP clause, and inserts
   `LIMIT n` at the end of that SELECT's scope — the closing `)` of its subquery
   or the closing backtick of the template literal. Re-scans from the start each
   pass, so nested TOP subqueries are handled too. */
import fs from "node:fs";

function transformOnce(s) {
  const re = /SELECT(\s+DISTINCT)?\s+TOP\s+(\(\s*@?\w+\s*\)|@?\w+)\s+/;
  const m = re.exec(s);
  if (!m) return null;
  const limit = m[2].replace(/[()\s]/g, "");
  const after = m.index + m[0].length;
  let depth = 0, end = s.length;
  for (let j = after; j < s.length; j++) {
    const ch = s[j];
    if (ch === "(") depth++;
    else if (ch === ")") { if (depth === 0) { end = j; break; } depth--; }
    else if (ch === "`") { end = j; break; }
  }
  const head = s.slice(0, m.index) + "SELECT" + (m[1] || "") + " ";
  const middle = s.slice(after, end);
  const trimmed = middle.replace(/\s+$/, "");
  const tail = middle.slice(trimmed.length) + s.slice(end);
  return head + trimmed + " LIMIT " + limit + tail;
}

let total = 0;
for (const file of process.argv.slice(2)) {
  let s = fs.readFileSync(file, "utf8");
  let n = 0, r;
  while ((r = transformOnce(s)) !== null) { s = r; n++; }
  if (n) { fs.writeFileSync(file, s); total += n; console.log(`${file}: ${n}`); }
}
console.log(`Total TOP->LIMIT: ${total}`);
