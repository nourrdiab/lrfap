import { useCallback, useEffect, useMemo, useState } from 'react';
import { AxiosError } from 'axios';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ExternalLink,
  Mail,
  MapPin,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { universitiesApi } from '../../../api/universities';
import { getApiErrorMessage } from '../../../utils/apiError';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { ConfirmActionDialog } from '../../../components/lgc/ConfirmActionDialog';
import {
  UniversityFormModal,
  type UniversityFormValues,
  type UniversityFieldKey,
} from '../../../components/lgc/catalog/UniversityFormModal';
import type { University } from '../../../types';

/**
 * Universities tab of /lgc/catalog. Lists all active universities (the
 * backend's GET already filters isActive:true), with client-side search
 * across name/code/city and create/edit/deactivate actions.
 *
 * Deactivate is a soft-delete on the backend — the record remains in
 * the database with isActive:false and is hidden from subsequent GETs.
 * The confirm dialog makes that explicit.
 */

type FetchStatus = 'idle' | 'loading' | 'loaded' | 'error';

export default function UniversitiesTab() {
  const [universities, setUniversities] = useState<University[]>([]);
  const [status, setStatus] = useState<FetchStatus>('idle');
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 200);

  // Form modal.
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [formTarget, setFormTarget] = useState<University | null>(null);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formFieldErrors, setFormFieldErrors] = useState<
    Partial<Record<UniversityFieldKey, string>>
  >({});

  // Deactivate confirm.
  const [deactivateTarget, setDeactivateTarget] = useState<University | null>(
    null,
  );
  const [deactivateWorking, setDeactivateWorking] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);

  // Success chip.
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!successMessage) return;
    const t = setTimeout(() => setSuccessMessage(null), 3000);
    return () => clearTimeout(t);
  }, [successMessage]);

  const loadAll = useCallback(async () => {
    setStatus('loading');
    setLoadError(null);
    try {
      const rows = await universitiesApi.list();
      setUniversities(rows);
      setStatus('loaded');
    } catch (err) {
      setLoadError(getApiErrorMessage(err, 'Couldn’t load universities.'));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const filtered = useMemo(() => {
    const sorted = [...universities].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.code.toLowerCase().includes(q) ||
        (u.city ?? '').toLowerCase().includes(q),
    );
  }, [universities, debouncedSearch]);

  // ---- Handlers --------------------------------------------------------

  function openCreate() {
    setFormMode('create');
    setFormTarget(null);
    setFormError(null);
    setFormFieldErrors({});
    setFormOpen(true);
  }

  function openEdit(u: University) {
    setFormMode('edit');
    setFormTarget(u);
    setFormError(null);
    setFormFieldErrors({});
    setFormOpen(true);
  }

  function closeForm() {
    if (formSaving) return;
    setFormOpen(false);
    setFormError(null);
    setFormFieldErrors({});
  }

  const submitForm = useCallback(
    async (values: UniversityFormValues) => {
      setFormSaving(true);
      setFormError(null);
      setFormFieldErrors({});
      try {
        if (formMode === 'create') {
          const created = await universitiesApi.create(values);
          setUniversities((prev) => [...prev, created]);
          setSuccessMessage(`Added ${created.name}.`);
        } else if (formTarget) {
          const updated = await universitiesApi.update(formTarget._id, values);
          setUniversities((prev) =>
            prev.map((u) => (u._id === updated._id ? updated : u)),
          );
          setSuccessMessage(`Updated ${updated.name}.`);
        }
        setFormOpen(false);
      } catch (err) {
        if (err instanceof AxiosError && err.response?.status === 409) {
          // Backend doesn't tell us which field collided, so we re-check
          // the local list ourselves and put the error inline on the
          // offending field(s).
          const lowerName = values.name.toLowerCase();
          const lowerCode = values.code.toLowerCase();
          const nameDup = universities.find(
            (u) =>
              u.name.toLowerCase() === lowerName &&
              (formMode === 'create' || u._id !== formTarget?._id),
          );
          const codeDup = universities.find(
            (u) =>
              u.code.toLowerCase() === lowerCode &&
              (formMode === 'create' || u._id !== formTarget?._id),
          );
          if (nameDup || codeDup) {
            setFormFieldErrors({
              ...(nameDup
                ? { name: 'A university with this name already exists.' }
                : null),
              ...(codeDup
                ? { code: 'A university with this code already exists.' }
                : null),
            });
          } else {
            setFormError('This name or code is already used.');
          }
        } else {
          setFormError(getApiErrorMessage(err, 'Couldn’t save this university.'));
        }
      } finally {
        setFormSaving(false);
      }
    },
    [formMode, formTarget, universities],
  );

  function requestDeactivate(u: University) {
    setDeactivateError(null);
    setDeactivateTarget(u);
  }

  function cancelDeactivate() {
    if (deactivateWorking) return;
    setDeactivateTarget(null);
    setDeactivateError(null);
  }

  const confirmDeactivate = useCallback(async () => {
    if (!deactivateTarget) return;
    setDeactivateWorking(true);
    setDeactivateError(null);
    try {
      await universitiesApi.remove(deactivateTarget._id);
      setUniversities((prev) =>
        prev.filter((u) => u._id !== deactivateTarget._id),
      );
      setSuccessMessage(`Deactivated ${deactivateTarget.name}.`);
      setDeactivateTarget(null);
    } catch (err) {
      setDeactivateError(
        getApiErrorMessage(err, 'Couldn’t deactivate this university.'),
      );
    } finally {
      setDeactivateWorking(false);
    }
  }, [deactivateTarget]);

  // ---- Render ----------------------------------------------------------

  return (
    <div className="flex flex-col gap-[20px]">
      {successMessage ? (
        <div
          role="status"
          className="inline-flex max-w-fit items-center gap-[8px] border-[0.91px] border-emerald-200 bg-emerald-50 px-[12px] py-[8px] font-sans text-[12px] font-medium text-emerald-800"
        >
          <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
          {successMessage}
        </div>
      ) : null}

      <div className="flex flex-col gap-[12px] sm:flex-row sm:items-center sm:justify-between">
        <label htmlFor="uni-search" className="relative flex-1 max-w-[420px]">
          <span className="sr-only">Search universities</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-[12px] top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          />
          <input
            id="uni-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, code, or city"
            className="h-[40px] w-full border-[0.91px] border-lrfap-ghost bg-white pl-[36px] pr-[14px] font-sans text-[14px] text-slate-900 transition-colors placeholder:text-slate-400 hover:border-slate-300 focus:border-lrfap-sky focus:outline-none"
          />
        </label>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex h-[40px] shrink-0 items-center justify-center gap-[8px] border-[0.91px] border-lrfap-navy bg-lrfap-navy px-[18px] font-sans text-[12px] font-medium uppercase tracking-wide text-white transition-colors hover:bg-lrfap-navy/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky"
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          Add university
        </button>
      </div>

      {status === 'error' ? (
        <div
          role="alert"
          className="flex items-start gap-[10px] border-[0.91px] border-red-200 bg-red-50 px-[16px] py-[12px] font-sans text-[13px] text-red-800"
        >
          <AlertCircle aria-hidden="true" className="mt-[2px] h-4 w-4 shrink-0" />
          <span>{loadError ?? 'Couldn’t load universities.'}</span>
        </div>
      ) : null}

      {(status === 'loading' || status === 'idle') ? (
        <div className="flex flex-col gap-[8px]">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-[76px] animate-pulse border-[0.91px] border-lrfap-ghost bg-slate-50"
            />
          ))}
        </div>
      ) : null}

      {status === 'loaded' && universities.length === 0 ? (
        <EmptyState onCreate={openCreate} />
      ) : null}

      {status === 'loaded' && universities.length > 0 && filtered.length === 0 ? (
        <p className="border-[0.91px] border-dashed border-lrfap-ghost bg-white px-[16px] py-[24px] text-center font-sans text-[13px] text-slate-500">
          No universities match “{debouncedSearch}”.
        </p>
      ) : null}

      {status === 'loaded' && filtered.length > 0 ? (
        <ul role="list" className="flex flex-col gap-[8px]">
          {filtered.map((u) => (
            <li key={u._id}>
              <UniversityRow
                university={u}
                onEdit={() => openEdit(u)}
                onDeactivate={() => requestDeactivate(u)}
              />
            </li>
          ))}
        </ul>
      ) : null}

      <UniversityFormModal
        open={formOpen}
        mode={formMode}
        initial={formTarget}
        isSaving={formSaving}
        errorMessage={formError}
        fieldErrors={formFieldErrors}
        onCancel={closeForm}
        onSubmit={submitForm}
      />

      <ConfirmActionDialog
        open={!!deactivateTarget}
        title="Deactivate university?"
        body={
          deactivateTarget ? (
            <>
              <strong>{deactivateTarget.name}</strong> will be hidden but data
              is preserved. Existing programs and applications referencing
              this university remain active — deactivate those separately.
            </>
          ) : null
        }
        confirmLabel="Deactivate"
        tone="danger"
        isWorking={deactivateWorking}
        errorMessage={deactivateError}
        onCancel={cancelDeactivate}
        onConfirm={() => void confirmDeactivate()}
      />
    </div>
  );
}

// ---- Row & empty state -------------------------------------------------

interface UniversityRowProps {
  university: University;
  onEdit: () => void;
  onDeactivate: () => void;
}

function UniversityRow({ university, onEdit, onDeactivate }: UniversityRowProps) {
  return (
    <article className="flex flex-col gap-[12px] border-[0.91px] border-lrfap-ghost bg-white px-[18px] py-[14px] shadow-[0_2px_8px_rgba(38,43,102,0.04)] md:flex-row md:items-center md:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-[10px]">
          <h3 className="truncate font-display text-[15px] font-bold text-lrfap-navy">
            {university.name}
          </h3>
          <span className="inline-flex items-center border-[0.91px] border-lrfap-ghost bg-lrfap-ghost/40 px-[8px] py-[1px] font-sans text-[11px] font-medium uppercase tracking-wide text-slate-600">
            {university.code}
          </span>
        </div>
        <dl className="mt-[6px] flex flex-wrap items-center gap-x-[16px] gap-y-[4px] font-sans text-[12px] text-slate-600">
          {university.city ? (
            <div className="inline-flex items-center gap-[4px]">
              <MapPin aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" />
              <dt className="sr-only">City</dt>
              <dd>{university.city}</dd>
            </div>
          ) : null}
          {university.contactEmail ? (
            <div className="inline-flex items-center gap-[4px]">
              <Mail aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" />
              <dt className="sr-only">Contact</dt>
              <dd>
                <a
                  href={`mailto:${university.contactEmail}`}
                  className="text-lrfap-navy hover:underline"
                >
                  {university.contactEmail}
                </a>
              </dd>
            </div>
          ) : null}
          {university.website ? (
            <div className="inline-flex items-center gap-[4px]">
              <ExternalLink
                aria-hidden="true"
                className="h-3.5 w-3.5 text-slate-400"
              />
              <dt className="sr-only">Website</dt>
              <dd>
                <a
                  href={university.website}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-lrfap-navy hover:underline"
                >
                  Website
                </a>
              </dd>
            </div>
          ) : null}
        </dl>
      </div>
      <div className="flex items-center gap-[8px]">
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex h-[36px] items-center justify-center gap-[6px] border-[0.91px] border-lrfap-navy px-[14px] font-sans text-[12px] font-medium uppercase tracking-wide text-lrfap-navy transition-colors hover:bg-lrfap-navy/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-navy"
        >
          <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
          Edit
        </button>
        <button
          type="button"
          onClick={onDeactivate}
          className="inline-flex h-[36px] items-center justify-center gap-[6px] border-[0.91px] border-red-200 bg-white px-[14px] font-sans text-[12px] font-medium uppercase tracking-wide text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
        >
          <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
          Deactivate
        </button>
      </div>
    </article>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-xl border-[0.91px] border-dashed border-lrfap-ghost bg-white px-[24px] py-[40px] text-center">
      <Building2 aria-hidden="true" className="mx-auto h-6 w-6 text-slate-400" />
      <h3 className="mt-[12px] font-display text-[16px] font-bold text-lrfap-navy">
        No universities registered
      </h3>
      <p className="mx-auto mt-[6px] max-w-[420px] font-sans text-[13px] text-slate-600">
        Add your first one.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="mt-[18px] inline-flex h-[40px] items-center justify-center gap-[8px] border-[0.91px] border-lrfap-navy bg-lrfap-navy px-[20px] font-sans text-[12px] font-medium uppercase tracking-wide text-white transition-colors hover:bg-lrfap-navy/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky"
      >
        <Plus aria-hidden="true" className="h-4 w-4" />
        Add university
      </button>
    </div>
  );
}
