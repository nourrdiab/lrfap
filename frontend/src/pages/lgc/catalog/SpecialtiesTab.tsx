import { useCallback, useEffect, useMemo, useState } from 'react';
import { AxiosError } from 'axios';
import {
  AlertCircle,
  CheckCircle2,
  Pencil,
  Plus,
  Search,
  Stethoscope,
  Trash2,
} from 'lucide-react';
import { specialtiesApi } from '../../../api/specialties';
import { getApiErrorMessage } from '../../../utils/apiError';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { ConfirmActionDialog } from '../../../components/lgc/ConfirmActionDialog';
import {
  SpecialtyFormModal,
  type SpecialtyFormValues,
  type SpecialtyFieldKey,
} from '../../../components/lgc/catalog/SpecialtyFormModal';
import type { Specialty } from '../../../types';

/**
 * Specialties tab of /lgc/catalog. Same shape as UniversitiesTab —
 * list / search / create / edit / deactivate — with fewer fields per
 * row (no city / email / website to show).
 */

type FetchStatus = 'idle' | 'loading' | 'loaded' | 'error';

export default function SpecialtiesTab() {
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [status, setStatus] = useState<FetchStatus>('idle');
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 200);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [formTarget, setFormTarget] = useState<Specialty | null>(null);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formFieldErrors, setFormFieldErrors] = useState<
    Partial<Record<SpecialtyFieldKey, string>>
  >({});

  const [deactivateTarget, setDeactivateTarget] = useState<Specialty | null>(
    null,
  );
  const [deactivateWorking, setDeactivateWorking] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);

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
      const rows = await specialtiesApi.list();
      setSpecialties(rows);
      setStatus('loaded');
    } catch (err) {
      setLoadError(getApiErrorMessage(err, 'Couldn’t load specialties.'));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const filtered = useMemo(() => {
    const sorted = [...specialties].sort((a, b) => a.name.localeCompare(b.name));
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (s) =>
        s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q),
    );
  }, [specialties, debouncedSearch]);

  // ---- Handlers --------------------------------------------------------

  function openCreate() {
    setFormMode('create');
    setFormTarget(null);
    setFormError(null);
    setFormFieldErrors({});
    setFormOpen(true);
  }
  function openEdit(s: Specialty) {
    setFormMode('edit');
    setFormTarget(s);
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
    async (values: SpecialtyFormValues) => {
      setFormSaving(true);
      setFormError(null);
      setFormFieldErrors({});
      try {
        if (formMode === 'create') {
          const created = await specialtiesApi.create(values);
          setSpecialties((prev) => [...prev, created]);
          setSuccessMessage(`Added ${created.name}.`);
        } else if (formTarget) {
          const updated = await specialtiesApi.update(formTarget._id, values);
          setSpecialties((prev) =>
            prev.map((s) => (s._id === updated._id ? updated : s)),
          );
          setSuccessMessage(`Updated ${updated.name}.`);
        }
        setFormOpen(false);
      } catch (err) {
        if (err instanceof AxiosError && err.response?.status === 409) {
          const lowerName = values.name.toLowerCase();
          const lowerCode = values.code.toLowerCase();
          const nameDup = specialties.find(
            (s) =>
              s.name.toLowerCase() === lowerName &&
              (formMode === 'create' || s._id !== formTarget?._id),
          );
          const codeDup = specialties.find(
            (s) =>
              s.code.toLowerCase() === lowerCode &&
              (formMode === 'create' || s._id !== formTarget?._id),
          );
          if (nameDup || codeDup) {
            setFormFieldErrors({
              ...(nameDup
                ? { name: 'A specialty with this name already exists.' }
                : null),
              ...(codeDup
                ? { code: 'A specialty with this code already exists.' }
                : null),
            });
          } else {
            setFormError('This name or code is already used.');
          }
        } else {
          setFormError(getApiErrorMessage(err, 'Couldn’t save this specialty.'));
        }
      } finally {
        setFormSaving(false);
      }
    },
    [formMode, formTarget, specialties],
  );

  function requestDeactivate(s: Specialty) {
    setDeactivateError(null);
    setDeactivateTarget(s);
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
      await specialtiesApi.remove(deactivateTarget._id);
      setSpecialties((prev) =>
        prev.filter((s) => s._id !== deactivateTarget._id),
      );
      setSuccessMessage(`Deactivated ${deactivateTarget.name}.`);
      setDeactivateTarget(null);
    } catch (err) {
      setDeactivateError(
        getApiErrorMessage(err, 'Couldn’t deactivate this specialty.'),
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
        <label htmlFor="spec-search" className="relative flex-1 max-w-[420px]">
          <span className="sr-only">Search specialties</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-[12px] top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          />
          <input
            id="spec-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or code"
            className="h-[40px] w-full border-[0.91px] border-lrfap-ghost bg-white pl-[36px] pr-[14px] font-sans text-[14px] text-slate-900 transition-colors placeholder:text-slate-400 hover:border-slate-300 focus:border-lrfap-sky focus:outline-none"
          />
        </label>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex h-[40px] shrink-0 items-center justify-center gap-[8px] border-[0.91px] border-lrfap-navy bg-lrfap-navy px-[18px] font-sans text-[12px] font-medium uppercase tracking-wide text-white transition-colors hover:bg-lrfap-navy/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky"
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          Add specialty
        </button>
      </div>

      {status === 'error' ? (
        <div
          role="alert"
          className="flex items-start gap-[10px] border-[0.91px] border-red-200 bg-red-50 px-[16px] py-[12px] font-sans text-[13px] text-red-800"
        >
          <AlertCircle aria-hidden="true" className="mt-[2px] h-4 w-4 shrink-0" />
          <span>{loadError ?? 'Couldn’t load specialties.'}</span>
        </div>
      ) : null}

      {(status === 'loading' || status === 'idle') ? (
        <div className="flex flex-col gap-[8px]">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-[64px] animate-pulse border-[0.91px] border-lrfap-ghost bg-slate-50"
            />
          ))}
        </div>
      ) : null}

      {status === 'loaded' && specialties.length === 0 ? (
        <EmptyState onCreate={openCreate} />
      ) : null}

      {status === 'loaded' && specialties.length > 0 && filtered.length === 0 ? (
        <p className="border-[0.91px] border-dashed border-lrfap-ghost bg-white px-[16px] py-[24px] text-center font-sans text-[13px] text-slate-500">
          No specialties match “{debouncedSearch}”.
        </p>
      ) : null}

      {status === 'loaded' && filtered.length > 0 ? (
        <ul role="list" className="flex flex-col gap-[8px]">
          {filtered.map((s) => (
            <li key={s._id}>
              <SpecialtyRow
                specialty={s}
                onEdit={() => openEdit(s)}
                onDeactivate={() => requestDeactivate(s)}
              />
            </li>
          ))}
        </ul>
      ) : null}

      <SpecialtyFormModal
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
        title="Deactivate specialty?"
        body={
          deactivateTarget ? (
            <>
              <strong>{deactivateTarget.name}</strong> will be hidden but data
              is preserved. Existing programs and applications referencing
              this specialty remain active — deactivate those separately.
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

interface SpecialtyRowProps {
  specialty: Specialty;
  onEdit: () => void;
  onDeactivate: () => void;
}

function SpecialtyRow({ specialty, onEdit, onDeactivate }: SpecialtyRowProps) {
  return (
    <article className="flex flex-col gap-[12px] border-[0.91px] border-lrfap-ghost bg-white px-[18px] py-[14px] shadow-[0_2px_8px_rgba(38,43,102,0.04)] md:flex-row md:items-center md:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-[10px]">
          <h3 className="truncate font-display text-[15px] font-bold text-lrfap-navy">
            {specialty.name}
          </h3>
          <span className="inline-flex items-center border-[0.91px] border-lrfap-ghost bg-lrfap-ghost/40 px-[8px] py-[1px] font-sans text-[11px] font-medium uppercase tracking-wide text-slate-600">
            {specialty.code}
          </span>
          {specialty.nationalQuota != null ? (
            <span className="inline-flex items-center border-[0.91px] border-lrfap-sky/30 bg-lrfap-sky/10 px-[8px] py-[1px] font-sans text-[11px] font-medium uppercase tracking-wide text-lrfap-navy">
              Quota: {specialty.nationalQuota}
            </span>
          ) : null}
        </div>
        {specialty.description ? (
          <p className="mt-[6px] line-clamp-2 font-sans text-[12px] text-slate-600">
            {specialty.description}
          </p>
        ) : null}
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
      <Stethoscope aria-hidden="true" className="mx-auto h-6 w-6 text-slate-400" />
      <h3 className="mt-[12px] font-display text-[16px] font-bold text-lrfap-navy">
        No specialties registered
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
        Add specialty
      </button>
    </div>
  );
}
