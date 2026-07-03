"use client";

import { useState } from "react";
import PhoneInputLib, { type Value } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import "./phone-input.css";

/** App-facing values stay in the same local "0XXXXXXXXX" format the rest of the
    site (DB, WhatsApp links, admin display) already expects — only the widget
    itself talks E.164 internally. */
function toE164(local: string): Value | undefined {
  const digits = local.replace(/\D/g, "");
  if (!digits) return undefined;
  const national = digits.startsWith("0") ? digits.slice(1) : digits;
  return `+94${national}` as Value;
}

function toLocal(value: Value | string | undefined): string {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("94") ? "0" + digits.slice(2) : digits;
}

type PhoneInputProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  containerClassName?: string;
};

/** Sri Lanka phone field built on react-phone-number-input: flag, live formatting,
    correct cursor behaviour while typing — all handled by the library. */
export default function PhoneInput({ id, label, value, onChange, required, containerClassName }: PhoneInputProps) {
  const [focused, setFocused] = useState(false);
  const floated = focused || value.length > 0;

  return (
    <div className={`relative ${containerClassName ?? ""}`}>
      <div
        className={`flex items-center w-full bg-white border rounded-lg pt-5 pb-2 px-4 transition-colors focus-within:ring-2 ${
          focused ? "border-primary ring-2 ring-primary/20" : "border-gray-300 ring-0"
        }`}
      >
        <PhoneInputLib
          id={id}
          className="lk-phone-input"
          defaultCountry="LK"
          countries={["LK"]}
          international={false}
          required={required}
          value={toE164(value)}
          onChange={(v) => onChange(toLocal(v))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </div>
      <label
        htmlFor={id}
        className={`pointer-events-none absolute left-[4.5rem] transition-all duration-150 ${
          floated ? "top-2 -translate-y-0 text-xs text-primary" : "top-1/2 -translate-y-1/2 text-[15px] text-gray-400"
        }`}
      >
        {label}
      </label>
    </div>
  );
}
