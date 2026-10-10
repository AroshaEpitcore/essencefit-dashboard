"use client";

import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from "react";

const FIELD_BASE =
  "w-full bg-white border rounded-lg px-4 py-2.5 text-gray-900 " +
  "focus:outline-none focus:ring-2 transition-colors";
// Border + focus ring swap to red when the field has a validation error.
const fieldBorder = (error?: boolean) =>
  error
    ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
    : "border-gray-300 focus:border-primary focus:ring-primary/20";
const labelColor = (error?: boolean) => (error ? "text-red-600" : "text-gray-700");

type LabeledInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  containerClassName?: string;
  leftAdornment?: ReactNode;
  error?: string;
};

/** Standard field: a visible label above the input — no floating animation, no gimmicks. */
export const LabeledInput = forwardRef<HTMLInputElement, LabeledInputProps>(function LabeledInput(
  { label, id, className = "", containerClassName = "", leftAdornment, error, ...props },
  ref
) {
  const hasError = !!error;
  return (
    <div className={containerClassName}>
      <label htmlFor={id} className={`block text-sm font-medium mb-1.5 ${labelColor(hasError)}`}>
        {label}
      </label>
      <div className="relative">
        {leftAdornment && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
            {leftAdornment}
          </div>
        )}
        <input
          ref={ref}
          id={id}
          aria-invalid={hasError || undefined}
          className={`${FIELD_BASE} ${fieldBorder(hasError)} ${leftAdornment ? "pl-10" : ""} ${className}`}
          {...props}
        />
      </div>
      {hasError && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
});

type LabeledTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  containerClassName?: string;
  error?: string;
};

export const LabeledTextarea = forwardRef<HTMLTextAreaElement, LabeledTextareaProps>(function LabeledTextarea(
  { label, id, className = "", containerClassName = "", error, ...props },
  ref
) {
  const hasError = !!error;
  return (
    <div className={containerClassName}>
      <label htmlFor={id} className={`block text-sm font-medium mb-1.5 ${labelColor(hasError)}`}>
        {label}
      </label>
      <textarea
        ref={ref}
        id={id}
        aria-invalid={hasError || undefined}
        className={`${FIELD_BASE} ${fieldBorder(hasError)} resize-none ${className}`}
        {...props}
      />
      {hasError && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
});
