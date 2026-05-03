import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, FileText, Loader2, Upload, X } from 'lucide-react';
import { documentsApi } from '../../../../api/documents';
import { getApiErrorMessage } from '../../../../utils/apiError';
import type { ApplicationDocument, DocumentStatus } from '../../../../types';
import { useWizard } from '../WizardContext';
import {
  ALLOWED_UPLOAD_ACCEPT,
  ALLOWED_UPLOAD_MIME_TYPES,
  DOCUMENT_TYPES,
  MAX_UPLOAD_BYTES,
  type DocumentTypeDef,
} from './documentsSchema';

/**
 * Documents step (step 2 of the wizard).
 *
 * Renders one card per required type (DOCUMENT_TYPES, 9 rows). Each card
 * derives its status pill from the cached ApplicationDocument (or
 * "Pending" if no record exists) and shows the Browse File CTA, or — if
 * already uploaded — filename + Replace + Delete.
 *
 * Uploads go to POST /api/documents with { file, type, applicationId }
 * and the backend is responsible for the R2 transfer. "Replace" uploads
 * the new file first, then fires-and-forgets a delete on the old record:
 * this guarantees the new record lands before the old one is removed, so
 * the UI is never empty mid-replace. A background delete failure leaves
 * a duplicate in the DB — acceptable trade for safety.
 *
 * No step save registration needed — every mutation hits the server
 * immediately. NEXT / PREVIOUS skip straight through `runStepSave`
 * because no handler is registered (the wrapper resolves with ok=true).
 */

type TransientState = {
  uploading?: boolean;
  progress?: number;
  error?: string | null;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUploadedAt(iso: string): string {
  const d = new Date(iso);
  const diffMin = Math.round((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay === 1) return 'yesterday';
  if (diffDay < 30) return `${diffDay} days ago`;
  return d.toLocaleDateString();
}

function pillClasses(
  hasDocument: boolean,
  status: DocumentStatus | undefined,
): { cls: string; label: string } {
  if (!hasDocument) {
    return {
      cls: 'bg-red-50 text-red-700 border-red-200',
      label: 'Pending',
    };
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
      return {
        cls: 'bg-green-50 text-green-700 border-green-200',
        label: 'Uploaded',
      };
  }
}

export default function DocumentsStep() {
  const {
    draftId,
    documents,
    documentsStatus,
    addDocumentToCache,
    removeDocumentFromCache,
    registerStepSave,
  } = useWizard();

  const [transient, setTransient] = useState<Record<string, TransientState>>({});
  const [confirmDelete, setConfirmDelete] = useState<ApplicationDocument | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // No validation / pending state to persist on this step — uploads and
  // deletes hit the server immediately.
  useEffect(() => {
    registerStepSave(null);
    return () => registerStepSave(null);
  }, [registerStepSave]);

  const documentsByType = useMemo(() => {
    const map: Partial<Record<ApplicationDocument['type'], ApplicationDocument>> = {};
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

  function setRowTransient(type: string, patch: TransientState | null) {
    setTransient((prev) => {
      const next = { ...prev };
      if (patch === null) delete next[type];
      else next[type] = { ...next[type], ...patch };
      return next;
    });
  }

  async function handleUpload(def: DocumentTypeDef, file: File) {
    if (file.size > MAX_UPLOAD_BYTES) {
      setRowTransient(def.type, {
        error: `File is too large. Max 10 MB; this file is ${formatSize(file.size)}.`,
      });
      return;
    }
    if (!ALLOWED_UPLOAD_MIME_TYPES.includes(file.type)) {
      setRowTransient(def.type, {
        error: 'Unsupported file type. Use PDF, JPG, or PNG.',
      });
      return;
    }

    const previous = documentsByType[def.type];
    setRowTransient(def.type, { uploading: true, progress: 0, error: null });
    try {
      const uploaded = await documentsApi.upload({
        file,
        type: def.type,
        applicationId: draftId,
        onUploadProgress: (pct) =>
          setRowTransient(def.type, { uploading: true, progress: pct, error: null }),
      });
      addDocumentToCache(uploaded);
      // Fire-and-forget: drop the superseded record. If this fails the
      // display is still correct (cache points at the new record); worst
      // case the backend keeps an orphan for cleanup later.
      if (previous) {
        documentsApi.remove(previous._id).catch(() => undefined);
      }
      setRowTransient(def.type, null);
    } catch (err) {
      setRowTransient(def.type, {
        uploading: false,
        progress: 0,
        error: getApiErrorMessage(err, 'Upload failed. Please try again.'),
      });
    }
  }

  async function handleDeleteConfirmed() {
    if (!confirmDelete) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await documentsApi.remove(confirmDelete._id);
      removeDocumentFromCache(confirmDelete._id);
      setConfirmDelete(null);
    } catch (err) {
      setDeleteError(getApiErrorMessage(err, 'Could not delete. Please try again.'));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-[20px] pt-[16px] pb-[24px]">
      <header className="flex items-baseline justify-between">
        <h2 className="font-display text-[22px] font-bold text-lrfap-navy">
          Required Documents
        </h2>
        <p className="font-sans text-[13px] text-slate-500">
          PDF, JPG, or PNG · max 10 MB each
        </p>
      </header>

      {documentsStatus === 'loading' ? (
        <SkeletonList />
      ) : documentsStatus === 'error' ? (
        <div
          role="alert"
          className="flex items-start gap-[10px] border-[0.91px] border-red-200 bg-red-50 px-[16px] py-[12px] font-sans text-[13px] text-red-800"
        >
          <AlertCircle aria-hidden="true" className="mt-[2px] h-4 w-4 shrink-0" />
          <span>
            Couldn&apos;t load your documents. Refresh the page to try again.
          </span>
        </div>
      ) : (
        <ul role="list" className="flex flex-col gap-[16px]">
          {DOCUMENT_TYPES.map((def) => (
            <li key={def.type}>
              <DocumentCard
                def={def}
                document={documentsByType[def.type] ?? null}
                transient={transient[def.type] ?? {}}
                onUpload={(file) => handleUpload(def, file)}
                onRequestDelete={(doc) => setConfirmDelete(doc)}
              />
            </li>
          ))}
        </ul>
      )}

      <ConfirmDeleteDialog
        doc={confirmDelete}
        isDeleting={isDeleting}
        error={deleteError}
        onConfirm={() => void handleDeleteConfirmed()}
        onCancel={() => {
          if (isDeleting) return;
          setConfirmDelete(null);
          setDeleteError(null);
        }}
      />
    </div>
  );
}

interface DocumentCardProps {
  def: DocumentTypeDef;
  document: ApplicationDocument | null;
  transient: TransientState;
  onUpload: (file: File) => void;
  onRequestDelete: (doc: ApplicationDocument) => void;
}

function DocumentCard({
  def,
  document: doc,
  transient,
  onUpload,
  onRequestDelete,
}: DocumentCardProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pill = pillClasses(!!doc, doc?.status);
  const uploading = !!transient.uploading;

  function openPicker() {
    inputRef.current?.click();
  }

  return (
    <div className="border-[0.91px] border-lrfap-ghost bg-white p-[24px] shadow-[0_4px_24px_-12px_rgba(38,43,102,0.1)]">
      <div className="flex flex-col gap-[16px] md:flex-row md:items-center md:gap-[24px]">
        <div className="flex shrink-0 items-start gap-[14px] md:min-w-[320px]">
          <span
            aria-hidden="true"
            className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full bg-lrfap-ghost text-lrfap-navy"
          >
            <FileText className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <p className="font-sans text-[14px] font-semibold uppercase tracking-wide text-lrfap-navy">
              {def.label}
            </p>
            <span
              className={`mt-[6px] inline-flex items-center border px-[10px] py-[2px] font-sans text-[11px] font-medium uppercase tracking-wide ${pill.cls}`}
            >
              {pill.label}
            </span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {doc ? (
            <div className="min-w-0">
              <p className="truncate font-sans text-[14px] font-medium text-lrfap-navy">
                {doc.originalName}
              </p>
              <p className="mt-[2px] font-sans text-[12px] text-slate-500">
                {formatSize(doc.size)} · uploaded {formatUploadedAt(doc.createdAt)}
              </p>
            </div>
          ) : (
            <div>
              <p className="font-sans text-[14px] font-medium text-lrfap-navy">
                Upload file
              </p>
              <p className="mt-[2px] font-sans text-[12px] text-slate-500">
                {def.description}
              </p>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-[8px]">
          <input
            ref={inputRef}
            type="file"
            accept={ALLOWED_UPLOAD_ACCEPT}
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(file);
              // Reset so selecting the same file twice still fires change.
              e.target.value = '';
            }}
          />
          {uploading ? (
            <div className="inline-flex h-[40.67px] min-w-[160px] items-center justify-center gap-2 border-[0.91px] border-lrfap-navy bg-lrfap-navy px-[16px] font-sans text-[13px] font-medium uppercase tracking-wide text-white">
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              Uploading {transient.progress ?? 0}%
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={openPicker}
                className="inline-flex h-[40.67px] items-center justify-center gap-[8px] border-[0.91px] border-lrfap-navy bg-lrfap-navy px-[18px] font-sans text-[13px] font-medium uppercase tracking-wide text-white transition-colors hover:bg-lrfap-navy/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky"
              >
                <Upload aria-hidden="true" className="h-4 w-4" />
                {doc ? 'Replace' : 'Browse File'}
              </button>
              {doc ? (
                <button
                  type="button"
                  onClick={() => onRequestDelete(doc)}
                  aria-label={`Delete ${doc.originalName}`}
                  className="inline-flex h-[40.67px] w-[40.67px] items-center justify-center border-[0.91px] border-lrfap-ghost text-slate-500 transition-colors hover:border-red-300 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>

      {transient.error ? (
        <p
          role="alert"
          className="mt-[12px] flex items-center gap-[8px] font-sans text-[12px] font-medium text-red-600"
        >
          <AlertCircle aria-hidden="true" className="h-3.5 w-3.5" />
          {transient.error}
        </p>
      ) : null}
    </div>
  );
}

function SkeletonList() {
  return (
    <ul role="list" aria-busy="true" className="flex flex-col gap-[16px]">
      {DOCUMENT_TYPES.map((def) => (
        <li
          key={def.type}
          className="border-[0.91px] border-lrfap-ghost bg-white p-[24px] shadow-[0_4px_24px_-12px_rgba(38,43,102,0.1)]"
        >
          <div className="flex animate-pulse items-center gap-[24px]">
            <div className="h-10 w-10 shrink-0 rounded-full bg-slate-200" />
            <div className="flex-1 space-y-[8px]">
              <div className="h-[14px] w-[180px] bg-slate-200" />
              <div className="h-[11px] w-[80px] bg-slate-100" />
            </div>
            <div className="h-[40.67px] w-[140px] bg-slate-200" />
          </div>
        </li>
      ))}
    </ul>
  );
}

interface ConfirmDeleteDialogProps {
  doc: ApplicationDocument | null;
  isDeleting: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDeleteDialog({
  doc,
  isDeleting,
  error,
  onConfirm,
  onCancel,
}: ConfirmDeleteDialogProps) {
  const open = !!doc;
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    cancelBtnRef.current?.focus();
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isDeleting) {
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
  }, [open, isDeleting, onCancel]);

  return (
    <AnimatePresence>
      {open && doc ? (
        <motion.div
          key="delete-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={isDeleting ? undefined : onCancel}
          className="fixed inset-0 z-40 bg-black/40"
        >
          <div className="flex min-h-full items-center justify-center p-6">
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-dialog-title"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[480px] border-[0.91px] border-lrfap-ghost bg-white shadow-[0_10px_40px_-12px_rgba(38,43,102,0.25)]"
            >
              <div className="px-[28px] py-[24px]">
                <h2
                  id="delete-dialog-title"
                  className="font-display text-[18px] font-bold uppercase tracking-wide text-lrfap-navy"
                >
                  Delete document?
                </h2>
                <p className="mt-[10px] font-sans text-[14px] leading-relaxed text-slate-600">
                  This will permanently delete{' '}
                  <span className="font-semibold text-lrfap-navy">
                    {doc.originalName}
                  </span>
                  . You&apos;ll need to upload it again if it&apos;s still required.
                </p>
                {error ? (
                  <p
                    role="alert"
                    className="mt-[12px] flex items-center gap-[8px] font-sans text-[12px] font-medium text-red-600"
                  >
                    <AlertCircle aria-hidden="true" className="h-3.5 w-3.5" />
                    {error}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center justify-end gap-[12px] border-t border-lrfap-ghost bg-lrfap-ghost/30 px-[28px] py-[16px]">
                <button
                  ref={cancelBtnRef}
                  type="button"
                  disabled={isDeleting}
                  onClick={onCancel}
                  className="inline-flex h-[40px] items-center justify-center border-[0.91px] border-lrfap-navy px-[18px] font-sans text-[13px] font-medium uppercase tracking-wide text-lrfap-navy transition-colors hover:bg-lrfap-navy/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-navy disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={onConfirm}
                  className="inline-flex h-[40px] items-center justify-center gap-[8px] border-[0.91px] border-red-600 bg-red-600 px-[18px] font-sans text-[13px] font-medium uppercase tracking-wide text-white transition-colors hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                      Deleting…
                    </>
                  ) : (
                    'Delete'
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
