import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

/**
 * Labelled text input. Wires up <label htmlFor>, aria-invalid, and
 * aria-describedby so screen readers announce hint + error text correctly.
 *
 * Optional leading icon (e.g. <Mail/> on the email field) sits at x=14,
 * vertically centered; its color tracks the input's focus state via the
 * peer-focus modifier. When an icon is present, input left-padding grows
 * to 44 px so placeholder text never overlaps the glyph.
 *
 * Border states (error wins over all interactive states):
 *   - idle    : lrfap-ghost (2 px)
 *   - hover   : slate-300
 *   - focus   : lrfap-sky
 *   - error   : red-500
 */

interface FormFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  icon?: ReactNode;
  hideRequiredMarker?: boolean;
}

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  function FormField(
    { id, label, error, hint, required, icon, className, hideRequiredMarker, ...rest },
    ref,
  ) {
    const errorId = `${id}-error`;
    const hintId = `${id}-hint`;
    const describedBy =
      [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') ||
      undefined;

    const borderClasses = error
      ? 'border-red-500'
      : 'border-lrfap-ghost hover:border-slate-300 focus:border-lrfap-sky';

    return (
      <div className="flex flex-col gap-[6px]">
        <label
          htmlFor={id}
          className="font-sans text-[13px] font-medium uppercase tracking-wide text-lrfap-navy"
        >
          {label}
          {required && !hideRequiredMarker ? (
            <span aria-hidden="true" className="ml-1 text-lrfap-sky">*</span>
          ) : null}
        </label>
        <div className="relative">
          <input
            ref={ref}
            id={id}
            required={required}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={describedBy}
            className={`peer h-[40.67px] w-full border-2 font-sans text-[15px] text-slate-900 transition-colors duration-150 placeholder:text-slate-400 focus:outline-none ${
              icon ? 'pl-[44px] pr-[14px]' : 'px-[14px]'
            } ${borderClasses} ${className ?? ''}`}
            {...rest}
          />
          {icon ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-[14px] top-1/2 flex h-[18px] w-[18px] -translate-y-1/2 items-center justify-center text-slate-400 transition-colors duration-150 peer-focus:text-lrfap-sky"
            >
              {icon}
            </span>
          ) : null}
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
