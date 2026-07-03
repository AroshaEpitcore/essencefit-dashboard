"use client";

import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from "react";

const FIELD_CLASS =
  "peer w-full bg-white border border-gray-300 rounded-lg px-4 pt-5 pb-2 text-gray-900 " +
  "placeholder-transparent focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors";

const LABEL_CLASS =
  "pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-[15px] transition-all duration-150 " +
  "peer-focus:top-3 peer-focus:translate-y-0 peer-focus:text-xs peer-focus:text-primary " +
  "peer-[:not(:placeholder-shown)]:top-3 peer-[:not(:placeholder-shown)]:translate-y-0 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:text-gray-500";

type FloatingInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  containerClassName?: string;
  leftAdornment?: ReactNode;
};

/** Text input whose label sits inside the field at rest and floats above it once focused or filled. */
export const FloatingInput = forwardRef<HTMLInputElement, FloatingInputProps>(function FloatingInput(
  { label, id, className = "", containerClassName = "", leftAdornment, ...props },
  ref
) {
  return (
    <div className={`relative ${containerClassName}`}>
      <input
        ref={ref}
        id={id}
        placeholder=" "
        className={`${FIELD_CLASS} ${leftAdornment ? "pl-[4.25rem]" : ""} ${className}`}
        {...props}
      />
      <label htmlFor={id} className={`${LABEL_CLASS} ${leftAdornment ? "left-[4.25rem]" : ""}`}>
        {label}
      </label>
      {leftAdornment && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
          {leftAdornment}
        </div>
      )}
    </div>
  );
});

type FloatingTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  containerClassName?: string;
};

export const FloatingTextarea = forwardRef<HTMLTextAreaElement, FloatingTextareaProps>(function FloatingTextarea(
  { label, id, className = "", containerClassName = "", ...props },
  ref
) {
  return (
    <div className={`relative ${containerClassName}`}>
      <textarea
        ref={ref}
        id={id}
        placeholder=" "
        className={`${FIELD_CLASS} resize-none ${className}`}
        {...props}
      />
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
      </label>
    </div>
  );
});
