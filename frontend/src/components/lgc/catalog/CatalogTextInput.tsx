import type { RefObject } from 'react';

/**
 * Labelled text/number/email input used across the three catalog form
 * modals. Same visual treatment as CycleFormModal's internal input so
 * all LGC admin forms share one ink — ghost 2px border, sky focus,
 * red-500 error, slate-50 when disabled.
 */

interface CatalogTextInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: 'text' | 'number' | 'email' | 'date';
  required?: boolean;
  disabled?: boolean;
  error?: string;
  hint?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  maxLength?: number;
  className?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
}

export function CatalogTextInput({
  id,
  label,
  value,
  onChange,
  type = 'text',
  required,
  disabled,
  error,
  hint,
  placeholder,
  min,
  max,
  maxLength,
  className,
  inputRef,
}: CatalogTextInputProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') ||
    undefined;
  const borderClasses = error
    ? 'border-red-500'
    : 'border-lrfap-ghost hover:border-slate-300 focus-within:border-lrfap-sky';
  return (
    <div className={`flex flex-col gap-[6px] ${className ?? ''}`}>
      <label
        htmlFor={id}
        className="font-sans text-[13px] font-medium uppercase tracking-wide text-lrfap-navy"
      >
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-1 text-lrfap-sky">
            *
          </span>
        ) : null}
      </label>
      <input
        ref={inputRef}
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        min={min}
        max={max}
        maxLength={maxLength}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
        className={`h-[40.67px] w-full border-2 bg-white px-[14px] font-sans text-[15px] text-slate-900 transition-colors duration-150 placeholder:text-slate-400 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 ${borderClasses}`}
      />
      {hint ? (
        <p id={hintId} className="font-sans text-[12px] text-slate-500">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="font-sans text-[12px] font-medium text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
