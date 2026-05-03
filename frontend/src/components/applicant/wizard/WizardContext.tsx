import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AxiosError } from 'axios';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { applicantProfileApi } from '../../../api/applicantProfile';
import { applicationsApi } from '../../../api/applications';
import { documentsApi } from '../../../api/documents';
import { programsApi } from '../../../api/programs';
import { specialtiesApi } from '../../../api/specialties';
import { universitiesApi } from '../../../api/universities';
import { getApiErrorMessage } from '../../../utils/apiError';
import type {
  ApplicantProfile,
  Application,
  ApplicationDocument,
  Cycle,
  DocumentType,
  ID,
  Program,
  ProgramSelection,
  Specialty,
  University,
} from '../../../types';
import { STEPS, isStepSlug, type StepSlug, type StepStatus } from './types';

/**
 * Wizard-wide state and actions. Step components read cached data
 * (profile, universities, selections) and dispatch mutations through
 * this context.
 *
 * On mount, the provider fetches everything the wizard depends on:
 *   - GET /api/applicant-profile/me          (Profile + Review steps)
 *   - GET /api/universities                  (medical-school dropdown +
 *                                             Programs university filter)
 *   - GET /api/specialties                   (Programs specialty filter)
 *   - GET /api/applications/:draftId         (cycle, track, selections)
 *   - GET /api/documents/application/:id     (Documents step)
 *   - GET /api/programs?cycle=X&track=Y      (Programs step — fires after
 *                                             the application fetch lands
 *                                             so we know the cycle + track
 *                                             query params)
 *
 * Application-scoped fetches are guarded by `isValidObjectId(draftId)` so
 * demo routes (e.g. /edit/demo123) don't 400 the backend.
 *
 * Selection mutations are optimistic + debounced: `addProgramSelection` /
 * `removeProgramSelection` update the cached application synchronously
 * and schedule a coalesced PUT /api/applications/:id/selections 400 ms
 * later. If the PUT rejects the selections revert to the last committed
 * server state and `selectionsError` is surfaced for the step to render.
 *
 * Save coordination: each step's save handler is registered via
 * registerStepSave. goNext / goPrevious / saveDraft from the shell call
 * the registered fn before navigating, so the shell stays agnostic of
 * step shape. A ref holds the handler so re-registering on every form
 * edit is cheap (no re-render).
 */

type FetchStatus = 'idle' | 'loading' | 'loaded' | 'error';

interface SelectedProgramSummary {
  id: string;
  name: string;
  university: string;
  rank: number;
}

interface ProfileSummary {
  fullName: string;
  applicantId: string;
  dob: string;
}

export interface WizardContextValue {
  // Routing / identity
  draftId: string;
  currentStep: StepSlug;

  // Chrome data
  pageTitle: string;
  stepStatus: Record<StepSlug, StepStatus>;
  completionPercentage: number;
  profileSummary: ProfileSummary;
  welcomeName: string;
  applicationCycle: string;
  applicationDeadline: string;
  preferenceStatus: string;
  selectedPrograms: SelectedProgramSummary[];

  // Cached bootstrap data
  profile: ApplicantProfile | null;
  profileStatus: FetchStatus;
  refetchProfile: () => Promise<void>;
  updateProfileCache: (next: ApplicantProfile) => void;
  universities: University[];
  universitiesStatus: FetchStatus;
  specialties: Specialty[];
  specialtiesStatus: FetchStatus;
  documents: ApplicationDocument[];
  documentsStatus: FetchStatus;
  refetchDocuments: () => Promise<void>;
  addDocumentToCache: (doc: ApplicationDocument) => void;
  removeDocumentFromCache: (id: string) => void;
  application: Application | null;
  applicationStatus: FetchStatus;
  applicationNotFound: boolean;
  refetchApplication: () => Promise<void>;
  updateApplicationCache: (next: Application) => void;
  programs: Program[];
  programsStatus: FetchStatus;
  refetchPrograms: () => Promise<void>;

  // Selection mutations (Programs + Preference Ranking steps)
  addProgramSelection: (programId: ID) => void;
  removeProgramSelection: (programId: ID) => void;
  replaceSelections: (next: ProgramSelection[]) => void;
  selectionsError: string | null;
  clearSelectionsError: () => void;

  // Save coordination
  isSaving: boolean;
  lastSavedAt: number | null;
  notifySaved: () => void;
  registerStepSave: (fn: (() => Promise<void>) | null) => void;
  saveDraft: () => Promise<void>;

  // Navigation
  goToStep: (step: StepSlug) => void;
  goNext: () => Promise<void>;
  goPrevious: () => Promise<void>;

  // Summary modal
  allProgramsModalOpen: boolean;
  openAllProgramsModal: () => void;
  closeAllProgramsModal: () => void;
}

// eslint-disable-next-line react-refresh/only-export-components
const WizardContext = createContext<WizardContextValue | null>(null);

interface WizardProviderProps {
  children: ReactNode;
}

const SELECTIONS_DEBOUNCE_MS = 400;

/**
 * Step-completion rules per project_wizard_api memory. A step is `complete`
 * when all its requirements are met, `inProgress` when it has partial data,
 * `pending` when it's untouched.
 *
 * Languages intentionally NOT required in the profile check — backend
 * defaults all three to `'none'`, so having values is implicit once the
 * profile record exists. Explicit language preference is optional UX.
 */
const REQUIRED_DOCUMENT_TYPES: DocumentType[] = [
  'cv',
  'personal_statement',
  'transcript',
  'degree_certificate',
  'recommendation_letter',
  'id_document',
  'medical_license',
  'language_test',
  'other',
];

function deriveProfileStatus(profile: ApplicantProfile | null): StepStatus {
  if (!profile) return 'pending';
  const required: unknown[] = [
    profile.dateOfBirth,
    profile.gender,
    profile.nationality?.trim(),
    profile.phone?.trim(),
    profile.address?.trim(),
    profile.city?.trim(),
    profile.medicalSchool || profile.medicalSchoolOther?.trim(),
    profile.graduationYear,
    profile.emergencyContactName?.trim(),
    profile.emergencyContactPhone?.trim(),
    profile.emergencyContactRelation?.trim(),
  ];
  const filled = required.filter(Boolean).length;
  if (filled === required.length) return 'complete';
  if (filled > 0) return 'inProgress';
  return 'pending';
}

function deriveDocumentsStatus(documents: ApplicationDocument[]): StepStatus {
  let filled = 0;
  for (const t of REQUIRED_DOCUMENT_TYPES) {
    const doc = documents.find(
      (d) => d.type === t && (d.status === 'pending' || d.status === 'verified'),
    );
    if (doc) filled++;
  }
  if (filled === REQUIRED_DOCUMENT_TYPES.length) return 'complete';
  if (filled > 0) return 'inProgress';
  return 'pending';
}

function deriveProgramsStatus(application: Application | null): StepStatus {
  if (!application) return 'pending';
  return application.selections.length >= 1 ? 'complete' : 'pending';
}

function deriveRankingStatus(application: Application | null): StepStatus {
  if (!application || application.selections.length === 0) return 'pending';
  const sorted = application.selections.slice().sort((a, b) => a.rank - b.rank);
  const consecutive = sorted.every((s, i) => s.rank === i + 1);
  return consecutive ? 'complete' : 'inProgress';
}

function deriveReviewStatus(application: Application | null): StepStatus {
  return application?.status === 'submitted' ? 'complete' : 'pending';
}

function deriveStepStatus(
  profile: ApplicantProfile | null,
  documents: ApplicationDocument[],
  application: Application | null,
): Record<StepSlug, StepStatus> {
  return {
    profile: deriveProfileStatus(profile),
    documents: deriveDocumentsStatus(documents),
    programs: deriveProgramsStatus(application),
    'preference-ranking': deriveRankingStatus(application),
    review: deriveReviewStatus(application),
  };
}

function deriveCurrentStep(pathname: string): StepSlug {
  const match = pathname.match(/\/edit\/([^/?#]+)/);
  const slug = match?.[1];
  return isStepSlug(slug) ? slug : 'profile';
}

/**
 * Mongo ObjectId check. Used to skip application-scoped fetches when the
 * URL carries a placeholder draftId (e.g. `demo123`) — the backend
 * rejects non-ObjectId strings with a 400/500, which would otherwise
 * trip the step's error banner on demo routes.
 */
function isValidObjectId(id: string): boolean {
  return /^[0-9a-fA-F]{24}$/.test(id);
}

/** Safely resolve the _id out of an ObjectId-or-populated-doc ref field. */
function idOf(ref: ID | { _id: ID } | null | undefined): ID | null {
  if (!ref) return null;
  return typeof ref === 'string' ? ref : ref._id;
}

function populated<T extends { _id: ID }>(ref: ID | T | null | undefined): T | null {
  if (!ref || typeof ref === 'string') return null;
  return ref;
}

/**
 * Merge a freshly-returned ref with the previously-cached one: if the
 * previous ref was populated and the new ref is a raw ObjectId string
 * pointing at the same entity, keep the populated object.
 *
 * Backend controllers populate different paths depending on the endpoint
 * (GET /applications/:id populates cycle + selections.program, but
 * PUT .../selections only populates selections.program). Without this
 * merge, any mutation would silently strip cycle / matchedProgram from
 * the cache until the next full refetch.
 */
function mergePopulatedRef<T extends { _id: ID }>(
  prev: ID | T | null | undefined,
  next: ID | T | null | undefined,
): ID | T | null | undefined {
  if (next == null) return next;
  if (typeof next !== 'string') return next; // next already populated
  if (prev == null || typeof prev === 'string') return next;
  return prev._id === next ? prev : next;
}

/** Format an ISO date as "April 20, 2026". Returns '—' for missing input. */
function formatLongDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Compose a one-line readable name for a program, e.g. "Emergency Medicine
 * — Residency". Falls back to "Unknown program" if both specialty and
 * track are missing.
 */
function programDisplayName(program: Program | null): string {
  if (!program) return 'Unknown program';
  const spec = populated(program.specialty);
  const specialtyName = spec?.name ?? '';
  const trackLabel = program.track === 'fellowship' ? 'Fellowship' : 'Residency';
  if (specialtyName) return `${specialtyName} — ${trackLabel}`;
  return trackLabel;
}

function buildSelectedProgramSummaries(
  application: Application | null,
  programsCache: Program[],
): SelectedProgramSummary[] {
  if (!application) return [];
  return application.selections
    .map((s): SelectedProgramSummary => {
      const id = idOf(s.program) ?? '';
      const program =
        populated<Program>(s.program) ??
        programsCache.find((p) => p._id === id) ??
        null;
      const uni = program ? populated(program.university) : null;
      return {
        id,
        name: programDisplayName(program),
        university: uni?.name ?? '—',
        rank: s.rank,
      };
    })
    .sort((a, b) => a.rank - b.rank);
}

function preferenceStatusLabel(application: Application | null): string {
  if (!application || application.selections.length === 0) {
    return 'Not Started';
  }
  const ranks = application.selections.map((s) => s.rank).sort((a, b) => a - b);
  const consecutive = ranks.every((r, i) => r === i + 1);
  return consecutive ? 'Ranking Finalized' : 'Ranking Not Finalized';
}

export function WizardProvider({ children }: WizardProviderProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ id: string }>();
  const draftId = params.id ?? 'draft';

  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [allProgramsModalOpen, setAllProgramsModalOpen] = useState(false);

  const [profile, setProfile] = useState<ApplicantProfile | null>(null);
  const [profileStatus, setProfileStatus] = useState<FetchStatus>('idle');
  const [universities, setUniversities] = useState<University[]>([]);
  const [universitiesStatus, setUniversitiesStatus] = useState<FetchStatus>('idle');
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [specialtiesStatus, setSpecialtiesStatus] = useState<FetchStatus>('idle');
  const [documents, setDocuments] = useState<ApplicationDocument[]>([]);
  const [documentsStatus, setDocumentsStatus] = useState<FetchStatus>('idle');
  const [application, setApplication] = useState<Application | null>(null);
  const [applicationStatus, setApplicationStatus] = useState<FetchStatus>('idle');
  const [applicationNotFound, setApplicationNotFound] = useState(false);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [programsStatus, setProgramsStatus] = useState<FetchStatus>('idle');
  const [selectionsError, setSelectionsError] = useState<string | null>(null);

  const stepSaveRef = useRef<(() => Promise<void>) | null>(null);
  const selectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Last server-confirmed selections — used to restore optimistic
  // mutations if the PUT fails. Seeded on every successful load/commit.
  const committedSelectionsRef = useRef<ProgramSelection[]>([]);

  const currentStep = deriveCurrentStep(location.pathname);

  // ---- Parallel bootstrap fetches ---------------------------------------

  useEffect(() => {
    let cancelled = false;
    setProfileStatus('loading');
    applicantProfileApi
      .getMe()
      .then((res) => {
        if (cancelled) return;
        setProfile(res);
        setProfileStatus('loaded');
      })
      .catch(() => {
        if (!cancelled) setProfileStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setUniversitiesStatus('loading');
    universitiesApi
      .list()
      .then((res) => {
        if (cancelled) return;
        setUniversities(res);
        setUniversitiesStatus('loaded');
      })
      .catch(() => {
        if (!cancelled) setUniversitiesStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setSpecialtiesStatus('loading');
    specialtiesApi
      .list()
      .then((res) => {
        if (cancelled) return;
        setSpecialties(res);
        setSpecialtiesStatus('loaded');
      })
      .catch(() => {
        if (!cancelled) setSpecialtiesStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Demo-route guard: no application fetch for placeholder draft IDs.
    if (!isValidObjectId(draftId)) return;
    let cancelled = false;
    setApplicationStatus('loading');
    setApplicationNotFound(false);
    applicationsApi
      .get(draftId)
      .then((res) => {
        if (cancelled) return;
        setApplication(res);
        committedSelectionsRef.current = res.selections;
        setApplicationStatus('loaded');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof AxiosError && err.response?.status === 404) {
          setApplicationNotFound(true);
        }
        setApplicationStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [draftId]);

  useEffect(() => {
    if (!isValidObjectId(draftId)) return;
    let cancelled = false;
    setDocumentsStatus('loading');
    documentsApi
      .listForApplication(draftId)
      .then((res) => {
        if (cancelled) return;
        setDocuments(res);
        setDocumentsStatus('loaded');
      })
      .catch(() => {
        if (!cancelled) setDocumentsStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [draftId]);

  // Programs fetch depends on the loaded application — we filter by its
  // cycle + track so the user only ever sees programs they can actually
  // select. Chains after the application fetch resolves successfully.
  const applicationCycleId = idOf(application?.cycle ?? null);
  const applicationTrack = application?.track;
  useEffect(() => {
    if (!isValidObjectId(draftId)) return;
    if (!applicationCycleId || !applicationTrack) return;
    let cancelled = false;
    setProgramsStatus('loading');
    programsApi
      .list({ cycle: applicationCycleId, track: applicationTrack })
      .then((res) => {
        if (cancelled) return;
        setPrograms(res);
        setProgramsStatus('loaded');
      })
      .catch(() => {
        if (!cancelled) setProgramsStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [draftId, applicationCycleId, applicationTrack]);

  // ---- Mutations & refetchers ------------------------------------------

  const refetchProfile = useCallback(async () => {
    setProfileStatus('loading');
    try {
      const res = await applicantProfileApi.getMe();
      setProfile(res);
      setProfileStatus('loaded');
    } catch {
      setProfileStatus('error');
    }
  }, []);

  const updateProfileCache = useCallback((next: ApplicantProfile) => {
    setProfile(next);
    setProfileStatus('loaded');
  }, []);

  const refetchDocuments = useCallback(async () => {
    if (!isValidObjectId(draftId)) return;
    setDocumentsStatus('loading');
    try {
      const res = await documentsApi.listForApplication(draftId);
      setDocuments(res);
      setDocumentsStatus('loaded');
    } catch {
      setDocumentsStatus('error');
    }
  }, [draftId]);

  const addDocumentToCache = useCallback((doc: ApplicationDocument) => {
    setDocuments((prev) => {
      const withoutSameType = prev.filter((d) => d.type !== doc.type);
      return [doc, ...withoutSameType];
    });
  }, []);

  const removeDocumentFromCache = useCallback((id: string) => {
    setDocuments((prev) => prev.filter((d) => d._id !== id));
  }, []);

  const refetchApplication = useCallback(async () => {
    if (!isValidObjectId(draftId)) return;
    setApplicationStatus('loading');
    setApplicationNotFound(false);
    try {
      const res = await applicationsApi.get(draftId);
      setApplication(res);
      committedSelectionsRef.current = res.selections;
      setApplicationStatus('loaded');
    } catch (err) {
      if (err instanceof AxiosError && err.response?.status === 404) {
        setApplicationNotFound(true);
      }
      setApplicationStatus('error');
    }
  }, [draftId]);

  /**
   * Merge a partial-populated response into the cache while preserving any
   * fields the new response didn't populate. See mergePopulatedRef.
   */
  const applyApplicationUpdate = useCallback((next: Application) => {
    setApplication((prev) => {
      if (!prev) return next;
      return {
        ...next,
        cycle: mergePopulatedRef(prev.cycle, next.cycle) as Application['cycle'],
        matchedProgram: mergePopulatedRef(
          prev.matchedProgram,
          next.matchedProgram,
        ) as Application['matchedProgram'],
      };
    });
    committedSelectionsRef.current = next.selections;
  }, []);

  const updateApplicationCache = useCallback(
    (next: Application) => {
      applyApplicationUpdate(next);
      setApplicationStatus('loaded');
    },
    [applyApplicationUpdate],
  );

  const refetchPrograms = useCallback(async () => {
    if (!isValidObjectId(draftId)) return;
    if (!applicationCycleId || !applicationTrack) return;
    setProgramsStatus('loading');
    try {
      const res = await programsApi.list({
        cycle: applicationCycleId,
        track: applicationTrack,
      });
      setPrograms(res);
      setProgramsStatus('loaded');
    } catch {
      setProgramsStatus('error');
    }
  }, [draftId, applicationCycleId, applicationTrack]);

  const clearSelectionsError = useCallback(() => setSelectionsError(null), []);

  // Commits whatever was last scheduled. Rolls back on server rejection.
  // Goes through applyApplicationUpdate so the selectively-populated
  // response (selections.program populated but NOT cycle) doesn't wipe
  // our cached cycle / matchedProgram.
  const commitSelections = useCallback(
    async (pending: ProgramSelection[]) => {
      if (!isValidObjectId(draftId)) return;
      try {
        const updated = await applicationsApi.updateSelections(draftId, {
          selections: pending.map((s) => ({
            program: idOf(s.program) ?? '',
            rank: s.rank,
            institutionSpecificFields: s.institutionSpecificFields,
          })),
        });
        applyApplicationUpdate(updated);
        setSelectionsError(null);
      } catch (err) {
        // Revert optimistic state to the last-known-good commit.
        setApplication((prev) =>
          prev ? { ...prev, selections: committedSelectionsRef.current } : prev,
        );
        setSelectionsError(
          getApiErrorMessage(err, 'Couldn’t save your program selections.'),
        );
      }
    },
    [draftId, applyApplicationUpdate],
  );

  // Optimistic UI update + coalesced PUT. All add/remove/replace entry
  // points go through here so rapid clicks never spawn racing requests.
  const scheduleSelectionsSave = useCallback(
    (next: ProgramSelection[]) => {
      setApplication((prev) =>
        prev ? { ...prev, selections: next } : prev,
      );
      if (selectionTimerRef.current) clearTimeout(selectionTimerRef.current);
      selectionTimerRef.current = setTimeout(() => {
        void commitSelections(next);
      }, SELECTIONS_DEBOUNCE_MS);
    },
    [commitSelections],
  );

  const addProgramSelection = useCallback(
    (programId: ID) => {
      setApplication((prev) => {
        if (!prev) return prev;
        // Ignore if already selected.
        if (prev.selections.some((s) => idOf(s.program) === programId)) {
          return prev;
        }
        const next: ProgramSelection[] = [
          ...prev.selections,
          { program: programId, rank: prev.selections.length + 1 },
        ];
        scheduleSelectionsSave(next);
        return { ...prev, selections: next };
      });
    },
    [scheduleSelectionsSave],
  );

  const removeProgramSelection = useCallback(
    (programId: ID) => {
      setApplication((prev) => {
        if (!prev) return prev;
        const kept = prev.selections.filter((s) => idOf(s.program) !== programId);
        if (kept.length === prev.selections.length) return prev; // no-op
        // Renumber ranks 1..N so the ranking step's consecutive-ranks
        // invariant always holds even when items are removed out of order.
        const renumbered = kept
          .slice()
          .sort((a, b) => a.rank - b.rank)
          .map((s, i) => ({ ...s, rank: i + 1 }));
        scheduleSelectionsSave(renumbered);
        return { ...prev, selections: renumbered };
      });
    },
    [scheduleSelectionsSave],
  );

  const replaceSelections = useCallback(
    (next: ProgramSelection[]) => {
      scheduleSelectionsSave(next);
    },
    [scheduleSelectionsSave],
  );

  const registerStepSave = useCallback((fn: (() => Promise<void>) | null) => {
    stepSaveRef.current = fn;
  }, []);

  const notifySaved = useCallback(() => {
    setLastSavedAt(Date.now());
  }, []);

  const runStepSave = useCallback(async (): Promise<boolean> => {
    const fn = stepSaveRef.current;
    if (!fn) return true;
    setIsSaving(true);
    try {
      await fn();
      return true;
    } catch {
      return false;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const saveDraft = useCallback(async () => {
    const ok = await runStepSave();
    // Always fire the "Saved just now" chip on success, even when the
    // current step registered no save handler (Documents, Programs,
    // Review — where mutations persist immediately on click). This makes
    // the SAVE DRAFT button feel like it did something. Profile and
    // Ranking steps also call notifySaved inside their own save handlers,
    // so this just resets their chip timer — harmless.
    if (ok) notifySaved();
  }, [runStepSave, notifySaved]);

  const goToStep = useCallback(
    (step: StepSlug) => {
      navigate(`/applicant/applications/${draftId}/edit/${step}`);
    },
    [draftId, navigate],
  );

  const goNext = useCallback(async () => {
    const idx = STEPS.findIndex((s) => s.slug === currentStep);
    if (idx >= STEPS.length - 1) return;
    const ok = await runStepSave();
    if (!ok) return;
    navigate(`/applicant/applications/${draftId}/edit/${STEPS[idx + 1].slug}`);
  }, [currentStep, draftId, navigate, runStepSave]);

  const goPrevious = useCallback(async () => {
    const idx = STEPS.findIndex((s) => s.slug === currentStep);
    if (idx <= 0) return;
    const ok = await runStepSave();
    if (!ok) return;
    navigate(`/applicant/applications/${draftId}/edit/${STEPS[idx - 1].slug}`);
  }, [currentStep, draftId, navigate, runStepSave]);

  const openAllProgramsModal = useCallback(() => setAllProgramsModalOpen(true), []);
  const closeAllProgramsModal = useCallback(() => setAllProgramsModalOpen(false), []);

  const welcomeName = user?.firstName?.trim() || 'there';

  // ---- Derived chrome values --------------------------------------------

  const cyclePopulated: Cycle | null = populated<Cycle>(
    application?.cycle ?? null,
  );
  const applicationCycleLabel = cyclePopulated
    ? String(cyclePopulated.year)
    : '—';
  const applicationDeadlineLabel = formatLongDate(
    cyclePopulated?.submissionDeadline,
  );
  const selectedProgramsSummaries = buildSelectedProgramSummaries(
    application,
    programs,
  );
  const preferenceStatus = preferenceStatusLabel(application);

  const stepStatus = useMemo(
    () => deriveStepStatus(profile, documents, application),
    [profile, documents, application],
  );
  const completionPercentage = useMemo(() => {
    const complete = Object.values(stepStatus).filter(
      (s) => s === 'complete',
    ).length;
    return Math.round((complete / STEPS.length) * 100);
  }, [stepStatus]);

  // Designer renamed the h1 on step 5 ("APPLICATION SUMMARY") — see Figma
  // frame "LRFAP Application Summary". Every other step keeps the chrome
  // default "APPLICANT DASHBOARD".
  const pageTitle =
    currentStep === 'review' ? 'APPLICATION SUMMARY' : 'APPLICANT DASHBOARD';

  const value = useMemo<WizardContextValue>(
    () => ({
      draftId,
      currentStep,
      pageTitle,
      stepStatus,
      completionPercentage,
      profileSummary: {
        fullName:
          user?.firstName && user?.lastName
            ? `${user.firstName} ${user.lastName}`
            : (user?.email ?? 'Applicant'),
        applicantId: profile?._id ?? '—',
        dob: profile?.dateOfBirth
          ? new Date(profile.dateOfBirth).toLocaleDateString('en-GB')
          : '—',
      },
      welcomeName,
      applicationCycle: applicationCycleLabel,
      applicationDeadline: applicationDeadlineLabel,
      preferenceStatus,
      selectedPrograms: selectedProgramsSummaries,
      profile,
      profileStatus,
      refetchProfile,
      updateProfileCache,
      universities,
      universitiesStatus,
      specialties,
      specialtiesStatus,
      documents,
      documentsStatus,
      refetchDocuments,
      addDocumentToCache,
      removeDocumentFromCache,
      application,
      applicationStatus,
      applicationNotFound,
      refetchApplication,
      updateApplicationCache,
      programs,
      programsStatus,
      refetchPrograms,
      addProgramSelection,
      removeProgramSelection,
      replaceSelections,
      selectionsError,
      clearSelectionsError,
      isSaving,
      lastSavedAt,
      notifySaved,
      registerStepSave,
      saveDraft,
      goToStep,
      goNext,
      goPrevious,
      allProgramsModalOpen,
      openAllProgramsModal,
      closeAllProgramsModal,
    }),
    [
      draftId,
      currentStep,
      user,
      welcomeName,
      profile,
      profileStatus,
      refetchProfile,
      updateProfileCache,
      universities,
      universitiesStatus,
      specialties,
      specialtiesStatus,
      documents,
      documentsStatus,
      refetchDocuments,
      addDocumentToCache,
      removeDocumentFromCache,
      application,
      applicationStatus,
      applicationNotFound,
      refetchApplication,
      updateApplicationCache,
      programs,
      programsStatus,
      refetchPrograms,
      addProgramSelection,
      removeProgramSelection,
      replaceSelections,
      selectionsError,
      clearSelectionsError,
      applicationCycleLabel,
      applicationDeadlineLabel,
      preferenceStatus,
      selectedProgramsSummaries,
      pageTitle,
      stepStatus,
      completionPercentage,
      isSaving,
      lastSavedAt,
      notifySaved,
      registerStepSave,
      saveDraft,
      goToStep,
      goNext,
      goPrevious,
      allProgramsModalOpen,
      openAllProgramsModal,
      closeAllProgramsModal,
    ],
  );

  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWizard(): WizardContextValue {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error('useWizard must be used inside <WizardProvider>');
  return ctx;
}
