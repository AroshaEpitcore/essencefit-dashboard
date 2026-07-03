"use client";

import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from "react";

const FIELD_CLASS =
  "w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 " +
  "focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors";

type LabeledInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  containerClassName?: string;
  leftAdornment?: ReactNode;
};

/** Standard field: a visible label above the input — no floating animation, no gimmicks. */
export const LabeledInput = forwardRef<HTMLInputElement, LabeledInputProps>(function LabeledInput(
  { label, id, className = "", containerClassName = "", leftAdornment, ...props },
  ref
) {
  return (
    <div className={containerClassName}>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1.5">
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
          className={`${FIELD_CLASS} ${leftAdornment ? "pl-10" : ""} ${className}`}
          {...props}
        />
      </div>
    </div>
  );
});

type LabeledTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  containerClassName?: string;
};

export const LabeledTextarea = forwardRef<HTMLTextAreaElement, LabeledTextareaProps>(function LabeledTextarea(
  { label, id, className = "", containerClassName = "", ...props },
  ref
) {
  return (
    <div className={containerClassName}>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
      </label>
      <textarea ref={ref} id={id} className={`${FIELD_CLASS} resize-none ${className}`} {...props} />
    </div>
  );
});
