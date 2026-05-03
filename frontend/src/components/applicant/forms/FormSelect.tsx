import { forwardRef, type ReactNode, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Native <select> with the same visual treatment as FormField. The arrow
 * glyph is rendered manually because we set `appearance: none` to kill
 * browser styling; this keeps the control accessible (keyboard navigation,
 * screen reader listbox semantics) without the inconsistent native look.
 *
 * Same border ladder as FormField / PasswordField: ghost → slate-300
 * hover → sky focus, red-500 on error.
 */

interface FormSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  placeholder?: string;
}

export const FormSelect = forwardRef<HTMLSelectElement, FormSelectProps>(
  function FormSelect(
    { id, label, error, hint, required, className, children, placeholder, value, ...rest },
    ref,
  ) {
    const errorId = `${id}-error`;
    const hintId = `${id}-hint`;
    const describedBy =
      [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') ||
      undefined;

    const borderClasses = error
      ? 'border-red-500'
      : 'border-lrfap-ghost hover:border-slate-300 focus-within:border-lrfap-sky';

    return (
      <div className="flex flex-col gap-[6px]">
        <label
          htmlFor={id}
          className="font-sans text-[13px] font-medium uppercase tracking-wide text-lrfap-navy"
        >
          {label}
          {required ? <span aria-hidden="true" className="ml-1 text-lrfap-sky">*</span> : null}
        </label>
        <div
          className={`relative flex h-[40.67px] w-full items-center border-2 bg-white transition-colors duration-150 ${borderClasses}`}
        >
          <select
            ref={ref}
            id={id}
            required={required}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={describedBy}
            value={value ?? ''}
            className={`h-full w-full appearance-none border-0 bg-transparent pr-[40px] pl-[14px] font-sans text-[15px] text-slate-900 focus:outline-none ${
              value === '' || value == null ? 'text-slate-400' : ''
            } ${className ?? ''}`}
            {...rest}
          >
            {placeholder ? (
              <option value="" disabled>
                {placeholder}
              </option>
            ) : null}
            {children}
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute right-[14px] h-4 w-4 text-slate-500"
          />
        </div>
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
  },
);
