import { AlertCircle } from 'lucide-react';

/**
 * Top-of-form error banner used to surface backend error messages
 * (e.g. "Invalid email or password", "Email is already registered").
 *
 * Uses role="alert" so screen readers announce the message immediately
 * when it appears after a failed submission.
 */

interface FormErrorBannerProps {
  message: string | null | undefined;
}

export function FormErrorBanner({ message }: FormErrorBannerProps) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2 border-[0.91px] border-red-300 bg-red-50 px-[14px] py-[10px] font-sans text-[13px] text-red-800"
    >
      <AlertCircle aria-hidden="true" className="mt-[1px] h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
