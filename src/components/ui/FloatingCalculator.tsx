"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Calculator, X, Delete } from "lucide-react";

interface CalcState {
  display: string;
  expression: string;
  justEvaluated: boolean;
  awaitingOperand: boolean;
}

export default function FloatingCalculator() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<CalcState>({
    display: "0",
    expression: "",
    justEvaluated: false,
    awaitingOperand: false,
  });

  // Ref so keyboard handler always reads latest state without re-subscribing
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; });

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  // Global shortcut: press Q to toggle calculator (ignored in inputs)
  useEffect(() => {
    function onToggleKey(e: KeyboardEvent) {
      if (e.key !== "q" && e.key !== "Q") return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      e.preventDefault();
      setOpen((o) => !o);
    }
    document.addEventListener("keydown", onToggleKey);
    return () => document.removeEventListener("keydown", onToggleKey);
  }, []);

  const set = useCallback((patch: Partial<CalcState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleClear = useCallback(() => {
    setState({ display: "0", expression: "", justEvaluated: false, awaitingOperand: false });
  }, []);

  const handleDigit = useCallback((val: string) => {
    const { display, expression, justEvaluated, awaitingOperand } = stateRef.current;

    if (justEvaluated) {
      const d = val === "." ? "0." : val;
      set({ display: d, expression: d, justEvaluated: false, awaitingOperand: false });
      return;
    }
    if (awaitingOperand) {
      const d = val === "." ? "0." : val;
      set({ display: d, expression: expression + d, awaitingOperand: false });
      return;
    }
    if (val === "." && display.includes(".")) return;
    const next = display === "0" && val !== "." ? val : display + val;
    const nextExp = expression === "" ? next : expression.slice(0, expression.length - display.length) + next;
    set({ display: next, expression: nextExp });
  }, [set]);

  const handleOperator = useCallback((op: string) => {
    const { expression } = stateRef.current;
    const last = expression.slice(-1);
    const nextExp = ["+", "-", "*", "/"].includes(last)
      ? expression.slice(0, -1) + op
      : expression + op;
    set({ expression: nextExp, justEvaluated: false, awaitingOperand: true });
  }, [set]);

  const handleEquals = useCallback(() => {
    const { expression } = stateRef.current;
    if (!expression) return;
    try {
      // eslint-disable-next-line no-new-func
      const result = Function('"use strict"; return (' + expression + ")")();
      const formatted = isFinite(result)
        ? parseFloat(result.toFixed(10)).toString()
        : "Error";
      set({ display: formatted, expression: formatted, justEvaluated: true, awaitingOperand: false });
    } catch {
      set({ display: "Error", expression: "", justEvaluated: false, awaitingOperand: false });
    }
  }, [set]);

  const handleBackspace = useCallback(() => {
    const { display, expression, justEvaluated, awaitingOperand } = stateRef.current;
    if (justEvaluated) { handleClear(); return; }
    if (awaitingOperand) {
      set({ expression: expression.slice(0, -1), awaitingOperand: false });
      return;
    }
    const nextDisplay = display.length > 1 ? display.slice(0, -1) : "0";
    const nextExp = expression.slice(0, -1);
    set({ display: nextDisplay, expression: nextExp });
  }, [set, handleClear]);

  const handlePercent = useCallback(() => {
    const { expression } = stateRef.current;
    if (!expression) return;
    try {
      // eslint-disable-next-line no-new-func
      const result = Function('"use strict"; return (' + expression + ")")();
      const pct = parseFloat((result / 100).toFixed(10)).toString();
      set({ display: pct, expression: pct, justEvaluated: true, awaitingOperand: false });
    } catch {
      set({ display: "Error", expression: "" });
    }
  }, [set]);

  const handleToggleSign = useCallback(() => {
    const { display, expression, awaitingOperand } = stateRef.current;
    if (awaitingOperand) return;
    const toggled = display.startsWith("-") ? display.slice(1) : "-" + display;
    const match = expression.match(/([\d.]+)$/);
    const nextExp = match
      ? expression.slice(0, -match[1].length) + toggled
      : toggled;
    set({ display: toggled, expression: nextExp });
  }, [set]);

  // Stable ref for keyboard handler
  const handlersRef = useRef({ handleDigit, handleOperator, handleEquals, handleBackspace, handleClear, handlePercent });
  useEffect(() => {
    handlersRef.current = { handleDigit, handleOperator, handleEquals, handleBackspace, handleClear, handlePercent };
  });

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const h = handlersRef.current;
      if (e.key >= "0" && e.key <= "9") { e.preventDefault(); h.handleDigit(e.key); }
      else if (e.key === ".") { e.preventDefault(); h.handleDigit("."); }
      else if (e.key === "+") { e.preventDefault(); h.handleOperator("+"); }
      else if (e.key === "-") { e.preventDefault(); h.handleOperator("-"); }
      else if (e.key === "*") { e.preventDefault(); h.handleOperator("*"); }
      else if (e.key === "/") { e.preventDefault(); h.handleOperator("/"); }
      else if (e.key === "Enter" || e.key === "=") { e.preventDefault(); h.handleEquals(); }
      else if (e.key === "Backspace") { e.preventDefault(); h.handleBackspace(); }
      else if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
      else if (e.key === "Delete") { e.preventDefault(); h.handleClear(); }
      else if (e.key === "%") { e.preventDefault(); h.handlePercent(); }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const btn =
    "flex items-center justify-center rounded-xl text-sm font-semibold h-11 w-full transition-all duration-150 active:scale-95 select-none cursor-pointer";

  const buttons: { label: string; action: () => void; style: string }[][] = [
    [
      { label: "AC",  action: handleClear,              style: `${btn} bg-zinc-600 text-white hover:bg-zinc-500` },
      { label: "+/-", action: handleToggleSign,          style: `${btn} bg-zinc-600 text-white hover:bg-zinc-500` },
      { label: "%",   action: handlePercent,             style: `${btn} bg-zinc-600 text-white hover:bg-zinc-500` },
      { label: "÷",   action: () => handleOperator("/"), style: `${btn} bg-orange-500 text-white hover:bg-orange-400` },
    ],
    [
      { label: "7", action: () => handleDigit("7"), style: `${btn} bg-zinc-700 text-white hover:bg-zinc-600` },
      { label: "8", action: () => handleDigit("8"), style: `${btn} bg-zinc-700 text-white hover:bg-zinc-600` },
      { label: "9", action: () => handleDigit("9"), style: `${btn} bg-zinc-700 text-white hover:bg-zinc-600` },
      { label: "×",  action: () => handleOperator("*"), style: `${btn} bg-orange-500 text-white hover:bg-orange-400` },
    ],
    [
      { label: "4", action: () => handleDigit("4"), style: `${btn} bg-zinc-700 text-white hover:bg-zinc-600` },
      { label: "5", action: () => handleDigit("5"), style: `${btn} bg-zinc-700 text-white hover:bg-zinc-600` },
      { label: "6", action: () => handleDigit("6"), style: `${btn} bg-zinc-700 text-white hover:bg-zinc-600` },
      { label: "−",  action: () => handleOperator("-"), style: `${btn} bg-orange-500 text-white hover:bg-orange-400` },
    ],
    [
      { label: "1", action: () => handleDigit("1"), style: `${btn} bg-zinc-700 text-white hover:bg-zinc-600` },
      { label: "2", action: () => handleDigit("2"), style: `${btn} bg-zinc-700 text-white hover:bg-zinc-600` },
      { label: "3", action: () => handleDigit("3"), style: `${btn} bg-zinc-700 text-white hover:bg-zinc-600` },
      { label: "+",  action: () => handleOperator("+"), style: `${btn} bg-orange-500 text-white hover:bg-orange-400` },
    ],
    [
      { label: "0", action: () => handleDigit("0"), style: `${btn} col-span-2 bg-zinc-700 text-white hover:bg-zinc-600` },
      { label: ".", action: () => handleDigit("."),  style: `${btn} bg-zinc-700 text-white hover:bg-zinc-600` },
      { label: "=", action: handleEquals,            style: `${btn} bg-orange-500 text-white hover:bg-orange-400` },
    ],
  ];

  const { display, expression } = state;

  return (
    <div ref={containerRef} className="fixed bottom-20 right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="w-64 rounded-2xl bg-zinc-800 shadow-2xl overflow-hidden border border-zinc-700">
          <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-700">
            <span className="text-xs text-zinc-400 font-medium">Calculator</span>
            <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-4 pt-3 pb-2">
            <div className="text-zinc-400 text-xs h-4 text-right truncate">{expression || " "}</div>
            <div className="text-white text-3xl font-light text-right truncate mt-1">{display}</div>
          </div>

          <div className="flex justify-end px-4 pb-1">
            <button onClick={handleBackspace} className="text-zinc-400 hover:text-white transition-colors" aria-label="Backspace">
              <Delete className="w-4 h-4" />
            </button>
          </div>

          <div className="px-3 pb-3 flex flex-col gap-2">
            {buttons.map((row, ri) => (
              <div key={ri} className="grid grid-cols-4 gap-2">
                {row.map((b, bi) => (
                  <button
                    key={bi}
                    onClick={b.action}
                    className={b.style + (b.label === "0" ? " col-span-2" : "")}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        className="p-3 rounded-full bg-primary text-white shadow-lg hover:bg-primary/90 transition-all active:scale-95"
        aria-label="Toggle calculator"
      >
        <Calculator className="w-5 h-5" />
      </button>
    </div>
  );
}
