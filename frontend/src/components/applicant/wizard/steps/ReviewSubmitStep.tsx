import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Copy,
  FileText,
  Loader2,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { applicationsApi } from '../../../../api/applications';
import { getApiErrorMessage } from '../../../../utils/apiError';
import { useAuth } from '../../../../hooks/useAuth';
import type {
  Application,
  ApplicationDocument,
  DocumentStatus,
  DocumentType,
  ID,
  Program,
  ProgramSelection,
  Specialty,
  University,
} from '../../../../types';
import { useWizard } from '../WizardContext';
import { DOCUMENT_TYPES } from './documentsSchema';
import { STEPS, type StepSlug, type StepStatus } from '../types';

/**
 * Review & Submit step (step 5 — Figma "LRFAP Application Summary").
 *
 * Consolidates the prior steps into a read-only view, presents the
 * invoice, collects three declaration acknowledgements, and fires
 * POST /api/applications/:id/submit on confirm.
 *
 * Designer-oversight corrections honoured:
 *   - Status box pills use "Complete" / "Incomplete" derived from our
 *     step-completion rules. Figma's "To be Reviewed" doesn't map to any
 *     backend state pre-submit and was dropped.
 *   - Typo "DECLAARATIONS" corrected to "DECLARATIONS".
 *
 * Payment summary is display-only with a hard-coded flat fee. When a real
 * payment service lands, swap APPLICATION_FEE_USD + the invoice number
 * derivation for backend values (TODO comment below).
 */

// TODO: replace with backend invoice service when payment integration is wired.
const APPLICATION_FEE_USD = 250;

function isValidObjectId(id: string): boolean {
  return /^[0-9a-fA-F]{24}$/.test(id);
}
function idOf(ref: ID | { _id: ID } | null | undefined): ID | null {
  if (!ref) return null;
  return typeof ref === 'string' ? ref : ref._id;
}
function populated<T extends { _id: ID }>(ref: ID | T | null | undefined): T | null {
  if (!ref || typeof ref === 'string') return null;
  return ref;
}

function formatInvoiceNumber(applicationId: string): string {
  const tail = applicationId.slice(-8).toUpperCase();
  return `INV${tail}`;
}

function formatInvoiceDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatSubmittedAt(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function headlineFor(program: Program | null): string {
  if (!program) return 'Unknown program';
  const uni = populated<University>(program.university);
  const spec = populated<Specialty>(program.specialty);
  const trackLabel = program.track === 'fellowship' ? 'Fellowship' : 'Residency';
  return [uni?.name, spec?.name, trackLabel]
    .filter(Boolean)
    .join(' ')
    .toUpperCase();
}

function docPill(
  hasDocument: boolean,
  status: DocumentStatus | undefined,
): { cls: string; label: string } {
  if (!hasDocument) {
    return { cls: 'bg-red-50 text-red-700 border-red-200', label: 'Pending' };
  }
  switch (status) {
    case 'verified':
      return { cls: 'bg-sky-50 text-sky-700 border-sky-200', label: 'Verified' };
    case 'replacement_required':
      return {
        cls: 'bg-orange-50 text-orange-700 border-orange-200',
        label: 'Replacement Required',
      };
    case 'rejected':
      return { cls: 'bg-red-100 text-red-800 border-red-300', label: 'Rejected' };
    case 'pending':
    default:
      return { cls: 'bg-green-50 text-green-700 border-green-200', label: 'Uploaded' };
  }
}

export default function ReviewSubmitStep() {
  const {
    draftId,
    application,
    applicationStatus,
    documents,
    programs,
    stepStatus,
    registerStepSave,
    updateApplicationCache,
    saveDraft,
    goToStep,
    notifySaved,
  } = useWizard();
  const navigate = useNavigate();

  const isDemoRoute = !isValidObjectId(draftId);
  const isSubmitted = application?.status === 'submitted';

  const [decl1, setDecl1] = useState(false);
  const [decl2, setDecl2] = useState(false);
  const [decl3, setDecl3] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [refCopied, setRefCopied] = useState(false);

  // No step-save handler — explicit button actions own persistence on
  // this step. NEXT doesn't exist (step 5 has no next).
  useEffect(() => {
    registerStepSave(null);
    return () => registerStepSave(null);
  }, [registerStepSave]);

  const documentsByType = useMemo(() => {
    const map: Partial<Record<DocumentType, ApplicationDocument>> = {};
    for (const doc of documents) {
      const existing = map[doc.type];
      if (
        !existing ||
        new Date(doc.createdAt).getTime() > new Date(existing.createdAt).getTime()
      ) {
        map[doc.type] = doc;
      }
    }
    return map;
  }, [documents]);

  const sortedSelections = useMemo<ProgramSelection[]>(() => {
    if (!application) return [];
    return application.selections.slice().sort((a, b) => a.rank - b.rank);
  }, [application]);

  const priorStepSlugs: StepSlug[] = ['profile', 'documents', 'programs', 'preference-ranking'];
  const incompleteSteps = priorStepSlugs.filter(
    (s) => stepStatus[s] !== 'complete',
  );
  const priorStepsComplete = incompleteSteps.length === 0;
  const allDeclarationsChecked = decl1 && decl2 && decl3;
  const canSubmit = priorStepsComplete && allDeclarationsChecked;

  async function handleConfirmSubmit() {
    if (!canSubmit || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      // Backend returns { message, submissionReference, application }.
      // Only `application` has the right shape for the cache; feeding the
      // whole wrapper in previously wiped status/_id/cycle and left the
      // Review step rendering nothing after submit.
      const { application: submitted } = await applicationsApi.submit(
        draftId,
        { declarationAccepted: true },
      );
      updateApplicationCache(submitted);
      notifySaved();
      setConfirmOpen(false);
    } catch (err) {
      setSubmitError(getApiErrorMessage(err, 'Couldn’t submit application.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  // Review-only behavior: save, then leave the wizard and return to the
  // applications list. The header SAVE DRAFT button on other steps still
  // just fires the chip (unchanged).
  async function handleSaveDraft() {
    setIsSavingDraft(true);
    try {
      await saveDraft();
      navigate('/applicant/applications');
    } finally {
      setIsSavingDraft(false);
    }
  }

  async function handleCopyRef() {
    if (!application?.submissionReference) return;
    try {
      await navigator.clipboard.writeText(application.submissionReference);
      setRefCopied(true);
      setTimeout(() => setRefCopied(false), 2000);
    } catch {
      // ignore — clipboard may be unavailable in some browsers/contexts
    }
  }

  // ---- Branches --------------------------------------------------------

  if (isDemoRoute) {
    return (
      <StepShell>
        <EmptyPanel
          title="Demo route — no application attached"
          body={
            <>
              Open a real draft application (via{' '}
              <span className="font-mono">/applicant/applications/:id/edit/review</span>)
              to submit.
            </>
          }
        />
      </StepShell>
    );
  }

  if (applicationStatus === 'loading') {
    return (
      <StepShell>
        <div className="h-[320px] animate-pulse border-[0.91px] border-lrfap-ghost bg-slate-50" />
      </StepShell>
    );
  }

  if (applicationStatus === 'error') {
    return (
      <StepShell>
        <Banner variant="error">
          Couldn&apos;t load your application. Refresh the page to try again.
        </Banner>
      </StepShell>
    );
  }

  // Success state: the backend has accepted the submission.
  if (isSubmitted && application) {
    return (
      <StepShell>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="flex flex-col items-center gap-[20px] border-[0.91px] border-lrfap-ghost bg-white px-[40px] py-[48px] text-center shadow-[0_4px_24px_-12px_rgba(38,43,102,0.1)]"
        >
          <CheckCircle
            aria-hidden="true"
            className="h-[80px] w-[80px] text-green-600"
            strokeWidth={1.5}
          />
          <h2 className="font-display text-[32px] font-extrabold leading-tight text-lrfap-navy">
            Application submitted!
          </h2>
          <p className="max-w-[560px] font-sans text-[15px] text-slate-600">
            Your application has been received and is now under review.
          </p>
          <div className="flex flex-col items-center gap-[8px] border-t border-lrfap-ghost pt-[20px]">
            <p className="font-sans text-[12px] font-medium uppercase tracking-wide text-slate-500">
              Reference
            </p>
            <div className="flex items-center gap-[8px]">
              <code className="font-mono text-[16px] font-semibold text-slate-700">
                {application.submissionReference ?? '—'}
              </code>
              {application.submissionReference ? (
                <button
                  type="button"
                  onClick={() => void handleCopyRef()}
                  aria-label="Copy reference"
                  className="inline-flex h-[30px] w-[30px] items-center justify-center border-[0.91px] border-lrfap-ghost text-slate-500 transition-colors hover:border-lrfap-navy hover:text-lrfap-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky"
                >
                  <Copy aria-hidden="true" className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
            {refCopied ? (
              <p
                role="status"
                aria-live="polite"
                className="font-sans text-[12px] text-green-600"
              >
                Copied to clipboard
              </p>
            ) : null}
          </div>
          <p className="font-sans text-[13px] text-slate-500">
            Submitted on {formatSubmittedAt(application.submittedAt)}
          </p>
          <Link
            to="/applicant/applications"
            className="mt-[8px] inline-flex h-[44px] items-center justify-center border-[0.91px] border-lrfap-navy bg-lrfap-navy px-[28px] font-sans text-[14px] font-medium uppercase tracking-wide text-white transition-colors hover:bg-lrfap-navy/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky"
          >
            View My Applications
          </Link>
        </motion.div>
      </StepShell>
    );
  }

  // Review form
  return (
    <StepShell>
      {!priorStepsComplete ? (
        <ReadinessBanner
          incompleteSteps={incompleteSteps}
          onGoToStep={goToStep}
        />
      ) : null}

      {submitError ? (
        <Banner variant="error">{submitError}</Banner>
      ) : null}

      <div className="grid grid-cols-1 gap-[24px] lg:grid-cols-[1fr_1fr]">
        {/* Left column — documents */}
        <section aria-labelledby="review-documents-heading" className="flex flex-col gap-[12px]">
          <h3
            id="review-documents-heading"
            className="font-display text-[16px] font-bold uppercase tracking-wide text-lrfap-navy"
          >
            Documents
          </h3>
          <ul role="list" className="flex flex-col gap-[12px]">
            {DOCUMENT_TYPES.map((def) => {
              const doc = documentsByType[def.type] ?? null;
              const pill = docPill(!!doc, doc?.status);
              return (
                <li
                  key={def.type}
                  className="flex items-center gap-[14px] border-[0.91px] border-lrfap-ghost bg-white p-[16px] shadow-[0_4px_24px_-12px_rgba(38,43,102,0.08)]"
                >
                  <span
                    aria-hidden="true"
                    className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full bg-lrfap-ghost text-lrfap-navy"
                  >
                    <FileText className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-sans text-[13px] font-semibold uppercase tracking-wide text-lrfap-navy">
                      {def.label}
                    </p>
                    {doc ? (
                      <p className="truncate font-sans text-[12px] text-slate-500">
                        {doc.originalName}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={`shrink-0 border px-[10px] py-[2px] font-sans text-[11px] font-medium uppercase tracking-wide ${pill.cls}`}
                  >
                    {pill.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Right column — status + ranked selections */}
        <div className="flex flex-col gap-[24px]">
          <section aria-labelledby="review-status-heading" className="flex flex-col gap-[12px]">
            <h3
              id="review-status-heading"
              className="font-display text-[16px] font-bold uppercase tracking-wide text-lrfap-navy"
            >
              Status
            </h3>
            <ul
              role="list"
              className="flex flex-col divide-y divide-lrfap-ghost border-[0.91px] border-lrfap-ghost bg-white shadow-[0_4px_24px_-12px_rgba(38,43,102,0.08)]"
            >
              {priorStepSlugs.map((slug) => {
                const def = STEPS.find((s) => s.slug === slug);
                if (!def) return null;
                return (
                  <li
                    key={slug}
                    className="flex items-center justify-between gap-[16px] px-[18px] py-[14px]"
                  >
                    <span className="font-sans text-[13px] font-semibold uppercase tracking-wide text-lrfap-navy">
                      {def.label}
                    </span>
                    <StepStatusPill status={stepStatus[slug]} />
                  </li>
                );
              })}
            </ul>
          </section>

          <section aria-labelledby="review-ranked-heading" className="flex flex-col gap-[12px]">
            <h3
              id="review-ranked-heading"
              className="font-display text-[16px] font-bold uppercase tracking-wide text-lrfap-navy"
            >
              Selected Programs &amp; Rankings
            </h3>
            {sortedSelections.length === 0 ? (
              <EmptyPanel
                title="No programs ranked"
                body="Go back to the Programs step to add programs, then rank them in the Preference Ranking step."
              />
            ) : (
              <ol role="list" className="flex flex-col gap-[8px]">
                {sortedSelections.map((sel) => {
                  const id = idOf(sel.program) ?? '';
                  const program =
                    populated<Program>(sel.program) ??
                    programs.find((p) => p._id === id) ??
                    null;
                  return (
                    <li key={id}>
                      <ReviewRankRow rank={sel.rank} program={program} />
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>
      </div>

      {/* Payment summary */}
      <PaymentSummary application={application} />

      {/* Declarations */}
      <section
        aria-labelledby="review-declarations-heading"
        className="flex flex-col gap-[12px]"
      >
        <h3
          id="review-declarations-heading"
          className="font-display text-[16px] font-bold uppercase tracking-wide text-lrfap-navy"
        >
          Declarations
        </h3>
        <div className="flex flex-col gap-[12px] border-[0.91px] border-lrfap-ghost bg-white p-[24px] shadow-[0_4px_24px_-12px_rgba(38,43,102,0.08)]">
          <DeclarationCheckbox
            id="decl-1"
            checked={decl1}
            onChange={setDecl1}
            label="I confirm that all information and documents submitted in this application are accurate, complete, and true to the best of my knowledge."
          />
          <DeclarationCheckbox
            id="decl-2"
            checked={decl2}
            onChange={setDecl2}
            label="I understand that once submitted, my application and ranked preferences may become non-editable after the official deadline or preference lock."
          />
          <DeclarationCheckbox
            id="decl-3"
            checked={decl3}
            onChange={setDecl3}
            label="I acknowledge and agree to comply with the LRFAP application policies, timelines, verification procedures, and matching rules."
          />
        </div>
      </section>

      {/* Actions */}
      <div className="flex flex-col gap-[12px] pt-[8px]">
        <div className="flex flex-col gap-[16px] md:flex-row md:items-stretch">
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={!canSubmit || isSubmitting}
            className="flex h-[48px] flex-1 items-center justify-center gap-[8px] border-[0.91px] border-lrfap-sky bg-lrfap-sky font-sans text-[14px] font-medium uppercase tracking-wide text-white transition-colors hover:bg-[#3a86bd] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky disabled:cursor-not-allowed disabled:opacity-60"
          >
            Submit Application
          </button>
          <button
            type="button"
            onClick={() => void handleSaveDraft()}
            disabled={isSavingDraft}
            className="inline-flex h-[48px] shrink-0 items-center justify-center gap-[8px] border-[0.91px] border-lrfap-navy bg-lrfap-navy px-[28px] font-sans text-[14px] font-medium uppercase tracking-wide text-white transition-colors hover:bg-lrfap-navy/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSavingDraft ? (
              <>
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              'Save as Draft'
            )}
          </button>
        </div>
        {!canSubmit ? (
          <p
            role="status"
            className="font-sans text-[12px] text-slate-500"
          >
            {missingRequirementsMessage(
              incompleteSteps,
              allDeclarationsChecked,
            )}
          </p>
        ) : null}
      </div>

      <ConfirmSubmitDialog
        open={confirmOpen}
        isSubmitting={isSubmitting}
        onConfirm={() => void handleConfirmSubmit()}
        onCancel={() => {
          if (isSubmitting) return;
          setConfirmOpen(false);
        }}
      />
    </StepShell>
  );
}

// ---- Presentational pieces -------------------------------------------

function StepShell({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-[24px] pt-[16px] pb-[24px]">{children}</section>
  );
}

function Banner({
  children,
  variant = 'error',
}: {
  children: React.ReactNode;
  variant?: 'error' | 'warning';
}) {
  const cls =
    variant === 'error'
      ? 'border-red-200 bg-red-50 text-red-800'
      : 'border-amber-200 bg-amber-50 text-amber-800';
  const Icon = variant === 'error' ? AlertCircle : AlertTriangle;
  return (
    <div
      role="alert"
      className={`flex items-start gap-[10px] border-[0.91px] px-[16px] py-[12px] font-sans text-[13px] ${cls}`}
    >
      <Icon aria-hidden="true" className="mt-[2px] h-4 w-4 shrink-0" />
      <div className="flex-1">{children}</div>
    </div>
  );
}

function ReadinessBanner({
  incompleteSteps,
  onGoToStep,
}: {
  incompleteSteps: StepSlug[];
  onGoToStep: (slug: StepSlug) => void;
}) {
  const labels = incompleteSteps
    .map((slug) => STEPS.find((s) => s.slug === slug))
    .filter((s): s is (typeof STEPS)[number] => !!s);
  return (
    <div
      role="alert"
      className="flex items-start gap-[10px] border-[0.91px] border-amber-200 bg-amber-50 px-[16px] py-[12px] font-sans text-[13px] text-amber-800"
    >
      <AlertTriangle aria-hidden="true" className="mt-[2px] h-4 w-4 shrink-0" />
      <div className="flex-1">
        <p className="font-medium">
          Please complete these steps before submitting:
        </p>
        <ul className="mt-[6px] flex flex-wrap gap-x-[14px] gap-y-[4px]">
          {labels.map((def) => (
            <li key={def.slug}>
              <button
                type="button"
                onClick={() => onGoToStep(def.slug)}
                className="font-sans text-[13px] font-medium text-amber-900 underline underline-offset-4 hover:text-amber-950"
              >
                {def.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function StepStatusPill({ status }: { status: StepStatus }) {
  const complete = status === 'complete';
  const cls = complete
    ? 'bg-green-50 text-green-700 border-green-200'
    : 'bg-red-50 text-red-700 border-red-200';
  return (
    <span
      className={`shrink-0 border px-[10px] py-[2px] font-sans text-[11px] font-medium uppercase tracking-wide ${cls}`}
    >
      {complete ? 'Complete' : 'Incomplete'}
    </span>
  );
}

function ReviewRankRow({
  rank,
  program,
}: {
  rank: number;
  program: Program | null;
}) {
  const uni = program ? populated<University>(program.university) : null;
  const rankLabel = rank.toString().padStart(2, '0');
  const isRankOne = rank === 1;
  return (
    <div className="flex items-stretch border-[0.91px] border-lrfap-ghost bg-white shadow-[0_4px_24px_-12px_rgba(38,43,102,0.08)]">
      <div
        className={`flex w-[72px] shrink-0 items-center justify-center ${
          isRankOne ? 'bg-lrfap-navy text-white' : 'border-r border-lrfap-ghost bg-white text-lrfap-navy'
        }`}
      >
        <span
          aria-hidden="true"
          className={`font-display font-extrabold leading-none ${
            isRankOne ? 'text-[36px]' : 'text-[32px] opacity-30'
          }`}
        >
          {rankLabel}
        </span>
      </div>
      <div className="min-w-0 flex-1 px-[16px] py-[14px]">
        <p className="truncate font-display text-[13px] font-bold uppercase tracking-wide text-lrfap-navy">
          {headlineFor(program)}
        </p>
        {uni?.name ? (
          <p className="mt-[2px] truncate font-sans text-[12px] text-slate-500">
            {uni.name}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function PaymentSummary({ application }: { application: Application | null }) {
  const { user } = useAuth();
  const invoiceNumber = application ? formatInvoiceNumber(application._id) : '—';
  const invoiceDate = formatInvoiceDate(new Date().toISOString());
  const billedTo =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : 'Applicant';
  return (
    <section
      aria-labelledby="review-payment-heading"
      className="flex flex-col gap-[12px]"
    >
      <h3
        id="review-payment-heading"
        className="font-display text-[16px] font-bold uppercase tracking-wide text-lrfap-navy"
      >
        Payment Summary
      </h3>
      <div className="flex flex-col gap-[20px] border-[0.91px] border-lrfap-ghost bg-white p-[24px] shadow-[0_4px_24px_-12px_rgba(38,43,102,0.08)]">
        <div className="grid grid-cols-1 gap-[16px] md:grid-cols-2">
          <dl className="grid grid-cols-[auto_1fr] gap-x-[16px] gap-y-[8px]">
            <dt className="font-sans text-[13px] text-slate-500">Billed to:</dt>
            <dd className="font-sans text-[13px] font-semibold text-lrfap-navy">
              {billedTo}
            </dd>
            <dt className="font-sans text-[13px] text-slate-500">Summary:</dt>
            <dd className="font-sans text-[13px] font-semibold text-lrfap-navy">
              LRFAP Application
            </dd>
          </dl>
          <dl className="grid grid-cols-[auto_1fr] gap-x-[16px] gap-y-[8px]">
            <dt className="font-sans text-[13px] text-slate-500">Invoice Number:</dt>
            <dd className="font-mono text-[13px] font-semibold text-lrfap-navy">
              {invoiceNumber}
            </dd>
            <dt className="font-sans text-[13px] text-slate-500">Subject:</dt>
            <dd className="font-sans text-[13px] font-semibold text-lrfap-navy">
              Application
            </dd>
            <dt className="font-sans text-[13px] text-slate-500">Currency:</dt>
            <dd className="font-sans text-[13px] font-semibold text-lrfap-navy">USD</dd>
            <dt className="font-sans text-[13px] text-slate-500">Date:</dt>
            <dd className="font-sans text-[13px] font-semibold text-lrfap-navy">
              {invoiceDate}
            </dd>
          </dl>
        </div>
        <div className="flex flex-col gap-[6px] border-t border-lrfap-ghost pt-[16px]">
          <div className="flex items-center justify-between font-sans text-[13px] text-slate-500">
            <span>Subtotal</span>
            <span>{APPLICATION_FEE_USD} USD</span>
          </div>
          <div className="flex items-center justify-between font-sans text-[15px] font-semibold text-lrfap-navy">
            <span>Total</span>
            <span>{APPLICATION_FEE_USD} USD</span>
          </div>
        </div>
        <p className="font-sans text-[12px] leading-relaxed text-slate-500">
          Please pay via bank transfer using the invoice reference. Payment
          instructions will be sent to your email after submission.
        </p>
      </div>
    </section>
  );
}

function DeclarationCheckbox({
  id,
  checked,
  onChange,
  label,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-[12px] font-sans text-[13px] leading-relaxed text-slate-700"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-[2px] h-[18px] w-[18px] shrink-0 cursor-pointer accent-lrfap-sky"
      />
      <span>{label}</span>
    </label>
  );
}

function EmptyPanel({
  title,
  body,
}: {
  title: string;
  body: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center border border-dashed border-lrfap-ghost bg-white/60 px-6 py-[40px] text-center">
      <p className="font-sans text-[14px] font-medium text-lrfap-navy">
        {title}
      </p>
      <p className="mt-[8px] max-w-[460px] font-sans text-[13px] text-slate-500">
        {body}
      </p>
    </div>
  );
}

function missingRequirementsMessage(
  incompleteSteps: StepSlug[],
  declarationsChecked: boolean,
): string {
  const pieces: string[] = [];
  if (incompleteSteps.length > 0) {
    const labels = incompleteSteps
      .map((slug) => STEPS.find((s) => s.slug === slug)?.label)
      .filter(Boolean);
    pieces.push(`Complete these steps first: ${labels.join(', ')}.`);
  }
  if (!declarationsChecked) {
    pieces.push('Check all three declarations above.');
  }
  return pieces.join(' ');
}

interface ConfirmSubmitDialogProps {
  open: boolean;
  isSubmitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmSubmitDialog({
  open,
  isSubmitting,
  onConfirm,
  onCancel,
}: ConfirmSubmitDialogProps) {
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    cancelBtnRef.current?.focus();
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isSubmitting) {
        e.preventDefault();
        onCancel();
      }
    }
    window.document.addEventListener('keydown', handleKey);
    const prevOverflow = window.document.body.style.overflow;
    window.document.body.style.overflow = 'hidden';
    return () => {
      window.document.removeEventListener('keydown', handleKey);
      window.document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, isSubmitting, onCancel]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="submit-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={isSubmitting ? undefined : onCancel}
          className="fixed inset-0 z-40 bg-black/40"
        >
          <div className="flex min-h-full items-center justify-center p-6">
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="submit-dialog-title"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[520px] border-[0.91px] border-lrfap-ghost bg-white shadow-[0_10px_40px_-12px_rgba(38,43,102,0.25)]"
            >
              <div className="px-[28px] py-[24px]">
                <h2
                  id="submit-dialog-title"
                  className="font-display text-[20px] font-bold uppercase tracking-wide text-lrfap-navy"
                >
                  Submit Application?
                </h2>
                <p className="mt-[12px] font-sans text-[14px] leading-relaxed text-slate-600">
                  Once submitted, you cannot edit your selections or documents.
                  Your application will enter review by LRFAP and the programs
                  you&apos;ve selected. This action cannot be undone.
                </p>
              </div>
              <div className="flex items-center justify-end gap-[12px] border-t border-lrfap-ghost bg-lrfap-ghost/30 px-[28px] py-[16px]">
                <button
                  ref={cancelBtnRef}
                  type="button"
                  disabled={isSubmitting}
                  onClick={onCancel}
                  className="inline-flex h-[40px] items-center justify-center border-[0.91px] border-lrfap-navy px-[18px] font-sans text-[13px] font-medium uppercase tracking-wide text-lrfap-navy transition-colors hover:bg-lrfap-navy/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-navy disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={onConfirm}
                  className="inline-flex h-[40px] items-center justify-center gap-[8px] border-[0.91px] border-lrfap-sky bg-lrfap-sky px-[18px] font-sans text-[13px] font-medium uppercase tracking-wide text-white transition-colors hover:bg-[#3a86bd] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                      Submitting…
                    </>
                  ) : (
                    'Submit'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
