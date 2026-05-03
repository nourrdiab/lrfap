import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/**
 * Password input with an optional leading icon (e.g. <Lock/>) and a trailing
 * show/hide toggle. Mirrors FormField's accessibility wiring and visual
 * treatment — same leading-icon pattern (left: 14 px, peer-focus color
 * transition), same border state ladder (ghost → slate-300 on hover →
 * lrfap-sky on focus; red-500 wins when errored).
 *
 * When a leading icon is supplied the input's left padding grows to 44 px
 * so placeholder text never overlaps the glyph. The show/hide toggle is
 * absolutely positioned on the right, and the input reserves 44 px on the
 * right so placeholder text never overlaps the eye button either.
 */

interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  icon?: ReactNode;
  hideRequiredMarker?: boolean;
}

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  function PasswordField(
    { id, label, error, hint, required, icon, className, hideRequiredMarker, ...rest },
    ref,
  ) {
    const [visible, setVisible] = useState(false);
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
          {required && !hideRequiredMarker ? (
            <span aria-hidden="true" className="ml-1 text-lrfap-sky">*</span>
          ) : null}
        </label>
        <div
          className={`relative flex h-[40.67px] w-full items-center border-2 bg-white transition-colors duration-150 ${borderClasses}`}
        >
          <input
            ref={ref}
            id={id}
            type={visible ? 'text' : 'password'}
            required={required}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={describedBy}
            className={`peer h-full w-full border-0 bg-transparent font-sans text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none ${
              icon ? 'pl-[44px]' : 'pl-[14px]'
            } pr-[44px] ${className ?? ''}`}
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
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Hide password' : 'Show password'}
            aria-pressed={visible}
            className="absolute inset-y-0 right-0 flex w-[44px] items-center justify-center text-slate-500 hover:text-lrfap-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky"
          >
            {visible ? (
              <EyeOff aria-hidden="true" className="h-4 w-4" />
            ) : (
              <Eye aria-hidden="true" className="h-4 w-4" />
            )}
          </button>
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
