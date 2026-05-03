import { forwardRef, type TextareaHTMLAttributes } from 'react';

/**
 * Multiline mirror of FormField. Same label / error / hint / aria-*
 * wiring, same border state ladder (ghost → slate-300 hover → sky focus,
 * red-500 for error), square corners, 2 px border.
 */

interface FormTextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  id: string;
  label: string;
  error?: string;
  hint?: string;
}

export const FormTextarea = forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  function FormTextarea({ id, label, error, hint, required, className, rows = 4, ...rest }, ref) {
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
          {required ? <span aria-hidden="true" className="ml-1 text-lrfap-sky">*</span> : null}
        </label>
        <textarea
          ref={ref}
          id={id}
          rows={rows}
          required={required}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          className={`w-full resize-y border-2 px-[14px] py-[10px] font-sans text-[15px] leading-relaxed text-slate-900 transition-colors duration-150 placeholder:text-slate-400 focus:outline-none ${borderClasses} ${className ?? ''}`}
          {...rest}
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
  },
);
