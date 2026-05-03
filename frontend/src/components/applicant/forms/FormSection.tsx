import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Collapsible card wrapping a group of related fields. Header is a button
 * (full-width, with uppercase title + optional hint caption + chevron
 * that rotates 180° on open). Body renders only when open — simpler and
 * cheaper than animating height, and acceptable UX for a profile form
 * where the user explicitly opens what they want to edit.
 *
 * Visual: white card, 0.91 px ghost border, square corners, navy-tinted
 * soft shadow (same family as AuthCard / user dropdown).
 */

interface FormSectionProps {
  id: string;
  title: string;
  caption?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export function FormSection({
  id,
  title,
  caption,
  open,
  onToggle,
  children,
}: FormSectionProps) {
  const panelId = `${id}-panel`;
  const headerId = `${id}-header`;

  return (
    <section
      aria-labelledby={headerId}
      className="border-[0.91px] border-lrfap-ghost bg-white shadow-[0_4px_24px_-12px_rgba(38,43,102,0.1)]"
    >
      <button
        id={headerId}
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-[16px] px-[28px] py-[20px] text-left transition-colors hover:bg-lrfap-ghost/40 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-lrfap-sky"
      >
        <div className="min-w-0">
          <h3 className="font-display text-[16px] font-bold uppercase tracking-wide text-lrfap-navy">
            {title}
          </h3>
          {caption ? (
            <p className="mt-[2px] font-sans text-[12px] text-slate-500">
              {caption}
            </p>
          ) : null}
        </div>
        <ChevronDown
          aria-hidden="true"
          className={`h-5 w-5 shrink-0 text-lrfap-navy transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      {open ? (
        <div
          id={panelId}
          role="region"
          aria-labelledby={headerId}
          className="border-t border-lrfap-ghost px-[28px] py-[24px]"
        >
          {children}
        </div>
      ) : null}
    </section>
  );
}
