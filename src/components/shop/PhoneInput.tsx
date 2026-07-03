"use client";

import { FloatingInput } from "./FloatingInput";

/** Formats digits as a Sri Lankan phone number: "076 294 6381". */
export function formatLkPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 10)].filter(Boolean).join(" ");
}

function SriLankaFlag() {
  return (
    <svg width="22" height="16" viewBox="0 0 20 15" className="rounded-[2px] shadow-sm shrink-0" aria-hidden>
      <rect width="20" height="15" rx="1.5" fill="#FDB912" />
      <rect x="1" y="1" width="3" height="13" fill="#00863D" />
      <rect x="4.3" y="1" width="3" height="13" fill="#FF7A00" />
      <rect x="7.6" y="1" width="11.4" height="13" rx="0.5" fill="#8D1531" />
      <circle cx="13.3" cy="7.5" r="2.1" fill="#FDB912" opacity="0.92" />
      <rect x="12.9" y="4.3" width="0.8" height="6.4" fill="#FDB912" opacity="0.92" />
    </svg>
  );
}

type PhoneInputProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  name?: string;
  containerClassName?: string;
};

/** Sri Lanka phone field: flag prefix, live "076 294 6381" formatting as the user types. */
export default function PhoneInput({ id, label, value, onChange, required, name, containerClassName }: PhoneInputProps) {
  return (
    <FloatingInput
      id={id}
      name={name}
      label={label}
      type="tel"
      inputMode="numeric"
      autoComplete="tel"
      required={required}
      value={value}
      onChange={(e) => onChange(formatLkPhone(e.target.value))}
      leftAdornment={<SriLankaFlag />}
      containerClassName={containerClassName}
    />
  );
}
