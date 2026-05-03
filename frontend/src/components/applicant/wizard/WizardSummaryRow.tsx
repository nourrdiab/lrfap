import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useWizard } from './WizardContext';

/**
 * Summary row above the profile row: SELECTED PROGRAMS count, PREFERENCE
 * STATUS, and a VIEW ALL button that opens a modal listing all selected
 * programs with a quick-remove per row (remove is stubbed until the
 * Programs step wires PUT /api/applications/:id/selections).
 *
 * Divider below the row matches the 0.91 px ghost stroke used throughout
 * the wizard chrome.
 */
export function WizardSummaryRow() {
  const {
    selectedPrograms,
    preferenceStatus,
    allProgramsModalOpen,
    openAllProgramsModal,
    closeAllProgramsModal,
  } = useWizard();

  return (
    <>
      <section className="mx-auto w-full max-w-[1366px] px-6 md:px-[58px]">
        <div className="flex flex-col gap-[16px] border-t border-b border-lrfap-ghost py-[24px] md:flex-row md:items-center md:justify-between md:gap-[32px]">
          <div className="flex flex-col gap-[16px] sm:flex-row sm:gap-[80px]">
            <div>
              <p className="font-sans text-[13px] font-medium uppercase tracking-wide text-slate-500">
                Selected Programs
              </p>
              <p className="mt-[4px] font-sans text-[15px] font-semibold text-lrfap-navy">
                {selectedPrograms.length} Program
                {selectedPrograms.length === 1 ? '' : 's'} Selected
              </p>
            </div>
            <div>
              <p className="font-sans text-[13px] font-medium uppercase tracking-wide text-slate-500">
                Preference Status
              </p>
              <p className="mt-[4px] font-sans text-[15px] font-semibold text-lrfap-navy">
                {preferenceStatus}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={openAllProgramsModal}
            className="inline-flex h-[40.67px] shrink-0 items-center justify-center border-[0.91px] border-lrfap-navy px-[22px] font-sans text-[14px] font-normal uppercase tracking-wide text-lrfap-navy transition-colors hover:bg-lrfap-navy/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-navy"
          >
            View All
          </button>
        </div>
      </section>

      <AllProgramsModal
        open={allProgramsModalOpen}
        onClose={closeAllProgramsModal}
      />
    </>
  );
}

interface AllProgramsModalProps {
  open: boolean;
  onClose: () => void;
}

function AllProgramsModal({ open, onClose }: AllProgramsModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const { selectedPrograms } = useWizard();

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeBtnRef.current?.focus();

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', handleKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/40"
        >
          <div className="flex min-h-full items-center justify-center p-6">
            <motion.div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-label="Selected programs"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[640px] border-[0.91px] border-lrfap-ghost bg-white shadow-[0_10px_40px_-12px_rgba(38,43,102,0.25)]"
            >
              <header className="flex items-center justify-between border-b border-lrfap-ghost px-[32px] py-[20px]">
                <h2 className="font-display text-[20px] font-bold uppercase tracking-wide text-lrfap-navy">
                  Selected Programs
                </h2>
                <button
                  ref={closeBtnRef}
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="inline-flex h-[36px] w-[36px] items-center justify-center text-slate-500 hover:text-lrfap-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-navy"
                >
                  <X aria-hidden="true" className="h-5 w-5" />
                </button>
              </header>
              <ul
                role="list"
                className="max-h-[60vh] divide-y divide-lrfap-ghost overflow-y-auto"
              >
                {selectedPrograms.length === 0 ? (
                  <li className="px-[32px] py-[32px] text-center font-sans text-[14px] text-slate-500">
                    No programs selected yet.
                  </li>
                ) : (
                  selectedPrograms.map((program) => (
                    <li
                      key={program.id}
                      className="flex items-center justify-between gap-[16px] px-[32px] py-[16px]"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-sans text-[15px] font-semibold text-lrfap-navy">
                          {program.name}
                        </p>
                        <p className="truncate font-sans text-[13px] text-slate-500">
                          {program.university}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          // TODO: wire to PUT /api/applications/:id/selections
                          // (debounced, optimistic) once the Programs step
                          // owns the selections state.
                        }}
                        className="shrink-0 font-sans text-[13px] font-medium uppercase tracking-wide text-red-600 transition-colors hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
                      >
                        Remove
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
