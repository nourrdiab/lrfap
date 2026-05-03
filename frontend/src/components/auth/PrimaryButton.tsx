import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Full-width filled action button for auth forms.
 *
 * Geometry mirrors the navbar's GET STARTED pill (h 40.67, 0.91 px border,
 * square corners) but swaps the stroke-only treatment for a navy fill to
 * signal "primary submit". When `loading` is true, shows a spinner and
 * disables the button (also sets aria-busy).
 */

interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingLabel?: string;
  children: ReactNode;
}

export function PrimaryButton({
  loading = false,
  loadingLabel,
  disabled,
  children,
  className,
  type = 'submit',
  ...rest
}: PrimaryButtonProps) {
  const isDisabled = loading || disabled;
  return (
    <button
      type={type}
      aria-busy={loading || undefined}
      disabled={isDisabled}
      className={`inline-flex h-[40.67px] w-full items-center justify-center gap-2 border-[0.91px] border-lrfap-navy bg-lrfap-navy font-sans text-[15px] font-medium uppercase tracking-wide text-white transition-colors hover:bg-lrfap-navy/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky disabled:cursor-not-allowed disabled:opacity-60 ${
        className ?? ''
      }`}
      {...rest}
    >
      {loading ? (
        <>
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          <span>{loadingLabel ?? 'Please wait…'}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
