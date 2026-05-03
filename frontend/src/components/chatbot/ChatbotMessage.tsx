import { AlertCircle, RotateCw } from 'lucide-react';
import type { ChatbotUIMessage } from '../../types';

/**
 * One chat bubble. Renders plain text (newlines preserved, no
 * Markdown) with bubble alignment and background driven by role +
 * status:
 *
 *   - user / sending → right-aligned, navy bubble, subtle opacity
 *   - user / sent    → right-aligned, navy bubble, full opacity
 *   - user / error   → right-aligned, red-ringed bubble with inline
 *                      error text and retry button underneath
 *   - model / sent   → left-aligned, ghost-gray bubble, navy text
 */

interface ChatbotMessageProps {
  message: ChatbotUIMessage;
  onRetry: (id: string) => void;
}

export function ChatbotMessage({ message, onRetry }: ChatbotMessageProps) {
  const isUser = message.role === 'user';
  const isError = message.status === 'error';
  const isSending = message.status === 'sending';

  return (
    <div className={`flex w-full flex-col ${isUser ? 'items-end' : 'items-start'}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap break-words rounded-xl px-[12px] py-[8px] font-sans text-[13px] leading-[1.5] ${
          isUser
            ? isError
              ? 'bg-red-50 text-red-800'
              : `bg-lrfap-navy text-white ${
                  isSending ? 'opacity-70' : ''
                }`
            : 'bg-lrfap-ghost/70 text-lrfap-navy'
        }`}
      >
        {message.text}
      </div>
      {isError ? (
        <div className="mt-[4px] flex max-w-[85%] items-center gap-[6px] font-sans text-[11px] text-red-700">
          <AlertCircle aria-hidden="true" className="h-3 w-3 shrink-0" />
          <span>{message.errorText ?? 'Couldn’t send.'}</span>
          <button
            type="button"
            onClick={() => onRetry(message.id)}
            className="inline-flex items-center gap-[3px] font-medium underline underline-offset-2 hover:text-red-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
          >
            <RotateCw aria-hidden="true" className="h-3 w-3" />
            Retry
          </button>
        </div>
      ) : null}
    </div>
  );
}
