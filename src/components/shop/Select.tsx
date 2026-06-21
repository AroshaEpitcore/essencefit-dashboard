"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

export type SelectOption = { value: string; label: string };

/* Custom dropdown used across the storefront so the option list renders in the
   site font (native <select> option popups use the OS font on Windows and can't
   be styled). Keeps a value/onChange API close to a native <select>. */
export default function Select({
  value,
  onChange,
  options,
  placeholder = "Select",
  className = "",
  triggerClassName = "",
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const baseTrigger =
    "w-full flex items-center justify-between gap-2 bg-transparent border border-gray-300 px-3 py-2.5 text-sm text-left hover:border-gray-500 focus:outline-none focus:border-gray-900 transition-colors";

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={triggerClassName || baseTrigger}
      >
        <span className={selected ? "text-gray-900" : "text-gray-400"}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 w-full max-h-64 overflow-auto border border-gray-200 bg-white shadow-lg py-1"
        >
          {options.map((o) => {
            const isSel = o.value === value;
            return (
              <li
                key={o.value || "__placeholder__"}
                role="option"
                aria-selected={isSel}
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={`flex items-center justify-between gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 ${isSel ? "font-semibold text-gray-900" : "text-gray-700"}`}
              >
                {o.label}
                {isSel && <Check className="w-4 h-4 text-primary shrink-0" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
