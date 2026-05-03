import { useCallback, useState } from 'react';
import { Download, ExternalLink, FileText, Loader2 } from 'lucide-react';
import type {
  ApplicationDocument,
  DocumentStatus,
  DocumentType,
  ID,
} from '../../../types';
import { documentsApi } from '../../../api/documents';
import { DOCUMENT_TYPES } from '../wizard/steps/documentsSchema';

/**
 * Read-only list of the 9 required document slots with status pills.
 * Consumed by the Application Detail page and by the wizard's Review &
 * Submit step. The wizard's Documents step itself has a heavier upload /
 * replace / delete UI — that stays in place until there's a reason to
 * consolidate; a `readOnly` prop is accepted to leave the door open.
 *
 * `showActions` opts into per-row View + Download buttons. The university
 * reviewer view passes it; the applicant pages don't (they already
 * managed uploads in the wizard).
 */

interface DocumentsListProps {
  documents: ApplicationDocument[];
  readOnly?: boolean;
  showActions?: boolean;
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

export function DocumentsList({ documents, showActions = false }: DocumentsListProps) {
  const [busyId, setBusyId] = useState<ID | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleView = useCallback(async (id: ID) => {
    setBusyId(id);
    setError(null);
    try {
      const { url } = await documentsApi.getViewUrl(id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      setError('Could not open this document. Try again.');
    } finally {
      setBusyId(null);
    }
  }, []);

  const handleDownload = useCallback(async (id: ID) => {
    setBusyId(id);
    setError(null);
    try {
      const { url } = await documentsApi.getDownloadUrl(id);
      // Navigate the top-level location: the response Content-Disposition
      // is `attachment` so the browser downloads instead of navigating.
      window.location.href = url;
    } catch {
      setError('Could not start the download. Try again.');
    } finally {
      setBusyId(null);
    }
  }, []);

  // Collapse to one doc per type, preferring the most recently created.
  const byType: Partial<Record<DocumentType, ApplicationDocument>> = {};
  for (const doc of documents) {
    const existing = byType[doc.type];
    if (
      !existing ||
      new Date(doc.createdAt).getTime() > new Date(existing.createdAt).getTime()
    ) {
      byType[doc.type] = doc;
    }
  }

  return (
    <div className="flex flex-col gap-[8px]">
      {error ? (
        <p
          role="alert"
          className="border-[0.91px] border-red-200 bg-red-50 px-[12px] py-[8px] font-sans text-[12px] text-red-800"
        >
          {error}
        </p>
      ) : null}
      <ul role="list" className="flex flex-col gap-[12px]">
        {DOCUMENT_TYPES.map((def) => {
          const doc = byType[def.type] ?? null;
          const pill = docPill(!!doc, doc?.status);
          const isBusy = doc != null && busyId === doc._id;
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
              {showActions && doc ? (
                <div className="flex shrink-0 items-center gap-[6px]">
                  <button
                    type="button"
                    onClick={() => void handleView(doc._id)}
                    disabled={isBusy}
                    className="inline-flex items-center gap-[4px] border-[0.91px] border-lrfap-ghost px-[10px] py-[4px] font-sans text-[11px] font-medium uppercase tracking-wide text-lrfap-navy transition-colors hover:border-lrfap-navy hover:bg-lrfap-navy hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isBusy ? (
                      <Loader2 aria-hidden="true" className="h-3 w-3 animate-spin" />
                    ) : (
                      <ExternalLink aria-hidden="true" className="h-3 w-3" />
                    )}
                    View
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDownload(doc._id)}
                    disabled={isBusy}
                    className="inline-flex items-center gap-[4px] border-[0.91px] border-lrfap-ghost px-[10px] py-[4px] font-sans text-[11px] font-medium uppercase tracking-wide text-lrfap-navy transition-colors hover:border-lrfap-navy hover:bg-lrfap-navy hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isBusy ? (
                      <Loader2 aria-hidden="true" className="h-3 w-3 animate-spin" />
                    ) : (
                      <Download aria-hidden="true" className="h-3 w-3" />
                    )}
                    Download
                  </button>
                </div>
              ) : null}
              <span
                className={`shrink-0 border px-[10px] py-[2px] font-sans text-[11px] font-medium uppercase tracking-wide ${pill.cls}`}
              >
                {pill.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
