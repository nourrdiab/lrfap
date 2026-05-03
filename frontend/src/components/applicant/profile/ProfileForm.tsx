import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { applicantProfileApi } from '../../../api/applicantProfile';
import { universitiesApi } from '../../../api/universities';
import { getApiErrorMessage } from '../../../utils/apiError';
import type {
  ApplicantProfile,
  LanguageLevel,
  University,
} from '../../../types';
import { FormField } from '../../auth/FormField';
import { FormErrorBanner } from '../../auth/FormErrorBanner';
import { FormTextarea } from '../forms/FormTextarea';
import { FormSelect } from '../forms/FormSelect';
import { FormSection } from '../forms/FormSection';
import {
  DEFAULT_SECTIONS_OPEN,
  GENDER_OPTIONS,
  LANGUAGE_LEVEL_OPTIONS,
  MEDICAL_SCHOOL_OTHER,
  type ProfileSectionId,
} from '../wizard/steps/profileSchema';
import {
  EMPTY_PROFILE_FORM,
  hydrateProfileForm,
  serializeProfileForm,
  validateProfileForm,
  type FieldErrors,
  type ProfileForm as ProfileFormShape,
} from './profileFormHelpers';

/**
 * Standalone profile editor for /applicant/profile (Profile tab).
 *
 * Owns its own fetch + save + dirty-state. Shape of the form, validation
 * rules, and round-trip helpers live in profileFormHelpers.ts and are
 * shared with the wizard's ProfileStep — keep both in sync there, not
 * here.
 *
 * Dirty-guard: a beforeunload listener covers tab close / reload /
 * typed-URL nav. Internal nav (tab switch, navbar link click) isn't
 * interceptable without the Data API router, so we expose `onDirtyChange`
 * to the parent — the tab switcher uses it to show a confirm dialog
 * before changing tabs. External nav via navbar links is uncaught; the
 * beforeunload prompt only fires at the browser level.
 */

interface ProfileFormProps {
  /**
   * Parent passes true once the applicant has any non-draft application.
   * When locked, every field becomes read-only / disabled, the Save
   * Changes button disappears entirely, and the beforeunload / dirty
   * plumbing goes dormant (nothing can be edited anyway). Sections can
   * still be collapsed so applicants browse their committed data.
   */
  locked?: boolean;
  /** Parent gets notified of dirty transitions. No-op when locked. */
  onDirtyChange?: (dirty: boolean) => void;
}

type FetchStatus = 'idle' | 'loading' | 'loaded' | 'error';

export function ProfileForm({ locked = false, onDirtyChange }: ProfileFormProps) {
  const { user } = useAuth();
  const [form, setForm] = useState<ProfileFormShape>(EMPTY_PROFILE_FORM);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [sectionsOpen, setSectionsOpen] =
    useState<Record<ProfileSectionId, boolean>>(DEFAULT_SECTIONS_OPEN);

  const [profile, setProfile] = useState<ApplicantProfile | null>(null);
  const [profileStatus, setProfileStatus] = useState<FetchStatus>('idle');

  const [universities, setUniversities] = useState<University[]>([]);
  const [universitiesStatus, setUniversitiesStatus] =
    useState<FetchStatus>('idle');

  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSavedChip, setShowSavedChip] = useState(false);

  // Snapshot of the last-saved (or initially-hydrated) form. Used for
  // dirty detection; compared via JSON.stringify since the form shape
  // is flat primitives.
  const savedSnapshotRef = useRef<ProfileFormShape>(EMPTY_PROFILE_FORM);

  // Fetch profile on mount.
  useEffect(() => {
    let cancelled = false;
    setProfileStatus('loading');
    applicantProfileApi
      .getMe()
      .then((p) => {
        if (cancelled) return;
        setProfile(p);
        const hydrated = hydrateProfileForm(p);
        setForm(hydrated);
        savedSnapshotRef.current = hydrated;
        setProfileStatus('loaded');
      })
      .catch(() => {
        if (!cancelled) setProfileStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch universities in parallel.
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

  // Dirty state derived from form vs snapshot. Forced to false when
  // locked so the tab-switch guard and beforeunload listener stay quiet.
  const isDirty = useMemo(
    () =>
      locked
        ? false
        : JSON.stringify(form) !== JSON.stringify(savedSnapshotRef.current),
    [form, locked],
  );

  // Bubble dirty changes to the parent for tab-switch guarding.
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // beforeunload guard for browser-level navigation / tab close / reload.
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Modern browsers ignore the returnValue string but require a set
      // property to show the native prompt.
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const setField = useCallback(
    <K extends keyof ProfileFormShape>(name: K, value: ProfileFormShape[K]) => {
      setForm((prev) => ({ ...prev, [name]: value }));
      setFieldErrors((prev) =>
        prev[name] ? { ...prev, [name]: undefined } : prev,
      );
    },
    [],
  );

  const toggleSection = useCallback(
    (id: ProfileSectionId) =>
      setSectionsOpen((prev) => ({ ...prev, [id]: !prev[id] })),
    [],
  );

  const handleSave = useCallback(async () => {
    const errors = validateProfileForm(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      // Open any section with an error so the user can see it.
      setSectionsOpen((prev) => {
        const next = { ...prev };
        if (errors.dateOfBirth || errors.gender || errors.nationality || errors.phone)
          next.personal = true;
        if (errors.address || errors.city) next.contact = true;
        if (
          errors.medicalSchool ||
          errors.medicalSchoolOther ||
          errors.graduationYear
        )
          next.academic = true;
        if (
          errors.emergencyContactName ||
          errors.emergencyContactPhone ||
          errors.emergencyContactRelation
        )
          next.emergency = true;
        return next;
      });
      setSaveError('Please fill in the highlighted required fields.');
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      const updated = await applicantProfileApi.updateMe(
        serializeProfileForm(form),
      );
      setProfile(updated);
      const hydrated = hydrateProfileForm(updated);
      setForm(hydrated);
      savedSnapshotRef.current = hydrated;
      setShowSavedChip(true);
      setTimeout(() => setShowSavedChip(false), 2000);
    } catch (err) {
      setSaveError(getApiErrorMessage(err, 'Unable to save profile.'));
    } finally {
      setIsSaving(false);
    }
  }, [form]);

  // ---- Render ----------------------------------------------------------

  if (profileStatus === 'loading' || profileStatus === 'idle') {
    return (
      <div className="flex min-h-[320px] items-center justify-center text-slate-500">
        Loading profile…
      </div>
    );
  }
  if (profileStatus === 'error') {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <FormErrorBanner message="Couldn't load your profile. Please refresh the page." />
      </div>
    );
  }

  const showOther = form.medicalSchool === MEDICAL_SCHOOL_OTHER;
  const isProfileEmpty = !profile?.dateOfBirth;
  const fullName =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : '';

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void handleSave();
      }}
      noValidate
      className="flex flex-col gap-[20px]"
    >
      {isProfileEmpty ? (
        <div className="flex items-start gap-[10px] border-[0.91px] border-sky-200 bg-sky-50 px-[16px] py-[12px] font-sans text-[13px] text-sky-900">
          <AlertCircle
            aria-hidden="true"
            className="mt-[2px] h-4 w-4 shrink-0 text-lrfap-sky"
          />
          <span>
            Complete your profile to strengthen your application.
          </span>
        </div>
      ) : null}

      <FormErrorBanner message={saveError} />

      <FormSection
        id="section-personal"
        title="Personal Information"
        open={sectionsOpen.personal}
        onToggle={() => toggleSection('personal')}
      >
        <div className="grid grid-cols-1 gap-[16px] md:grid-cols-3">
          <FormField
            id="profile-firstName"
            label="First Name"
            required
            readOnly
            value={user?.firstName ?? ''}
            className="bg-slate-50 text-slate-600"
            hint="Set at registration — contact support to change"
          />
          <FormField
            id="profile-lastName"
            label="Last Name"
            required
            readOnly
            value={user?.lastName ?? ''}
            className="bg-slate-50 text-slate-600"
            hint="Set at registration — contact support to change"
          />
          <FormField
            id="profile-dateOfBirth"
            label="Date of Birth"
            type="date"
            required
            readOnly={locked}
            value={form.dateOfBirth}
            onChange={(e) => setField('dateOfBirth', e.target.value)}
            error={fieldErrors.dateOfBirth}
          />
          <FormSelect
            id="profile-gender"
            label="Gender"
            required
            disabled={locked}
            value={form.gender}
            onChange={(e) =>
              setField('gender', e.target.value as ProfileFormShape['gender'])
            }
            placeholder="Select gender"
            error={fieldErrors.gender}
          >
            {GENDER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </FormSelect>
          <FormField
            id="profile-nationality"
            label="Nationality"
            required
            readOnly={locked}
            value={form.nationality}
            onChange={(e) => setField('nationality', e.target.value)}
            placeholder="e.g. Lebanese"
            error={fieldErrors.nationality}
          />
          <FormField
            id="profile-phone"
            label="Phone"
            type="tel"
            required
            readOnly={locked}
            value={form.phone}
            onChange={(e) => setField('phone', e.target.value)}
            placeholder="+961 ..."
            error={fieldErrors.phone}
          />
        </div>
        <p className="sr-only">Signed in as {fullName}</p>
      </FormSection>

      <FormSection
        id="section-contact"
        title="Contact & Address"
        open={sectionsOpen.contact}
        onToggle={() => toggleSection('contact')}
      >
        <div className="grid grid-cols-1 gap-[16px] md:grid-cols-3">
          <div className="md:col-span-2">
            <FormField
              id="profile-address"
              label="Address"
              required
              readOnly={locked}
              value={form.address}
              onChange={(e) => setField('address', e.target.value)}
              error={fieldErrors.address}
            />
          </div>
          <FormField
            id="profile-city"
            label="City"
            required
            readOnly={locked}
            value={form.city}
            onChange={(e) => setField('city', e.target.value)}
            error={fieldErrors.city}
          />
          <FormField
            id="profile-nationalId"
            label="National ID"
            readOnly={locked}
            value={form.nationalId}
            onChange={(e) => setField('nationalId', e.target.value)}
            hint="Optional"
          />
        </div>
      </FormSection>

      <FormSection
        id="section-academic"
        title="Academic Background"
        open={sectionsOpen.academic}
        onToggle={() => toggleSection('academic')}
      >
        <div className="grid grid-cols-1 gap-[16px] md:grid-cols-2">
          <FormSelect
            id="profile-medicalSchool"
            label="Medical School"
            required
            value={form.medicalSchool}
            onChange={(e) => setField('medicalSchool', e.target.value)}
            placeholder={
              universitiesStatus === 'loading'
                ? 'Loading universities…'
                : universitiesStatus === 'error'
                  ? 'Failed to load — refresh to retry'
                  : 'Select medical school'
            }
            disabled={locked || universitiesStatus !== 'loaded'}
            error={fieldErrors.medicalSchool}
          >
            {universities.map((u) => (
              <option key={u._id} value={u._id}>
                {u.name}
              </option>
            ))}
            <option value={MEDICAL_SCHOOL_OTHER}>Other</option>
          </FormSelect>
          {showOther ? (
            <FormField
              id="profile-medicalSchoolOther"
              label="Medical School (other)"
              required
              readOnly={locked}
              value={form.medicalSchoolOther}
              onChange={(e) => setField('medicalSchoolOther', e.target.value)}
              error={fieldErrors.medicalSchoolOther}
            />
          ) : (
            <div className="hidden md:block" aria-hidden="true" />
          )}
          <FormField
            id="profile-graduationYear"
            label="Graduation Year"
            type="number"
            required
            readOnly={locked}
            value={form.graduationYear}
            onChange={(e) => setField('graduationYear', e.target.value)}
            placeholder="2024"
            error={fieldErrors.graduationYear}
          />
          <FormField
            id="profile-classRank"
            label="Class Rank"
            readOnly={locked}
            value={form.classRank}
            onChange={(e) => setField('classRank', e.target.value)}
            placeholder="e.g. Top 10%"
            hint="Optional"
          />
        </div>
      </FormSection>

      <FormSection
        id="section-languages"
        title="Languages"
        open={sectionsOpen.languages}
        onToggle={() => toggleSection('languages')}
      >
        <div className="grid grid-cols-1 gap-[16px] md:grid-cols-3">
          <FormSelect
            id="profile-languageEnglish"
            label="English"
            required
            disabled={locked}
            value={form.languageEnglish}
            onChange={(e) =>
              setField('languageEnglish', e.target.value as LanguageLevel)
            }
          >
            {LANGUAGE_LEVEL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </FormSelect>
          <FormSelect
            id="profile-languageFrench"
            label="French"
            required
            disabled={locked}
            value={form.languageFrench}
            onChange={(e) =>
              setField('languageFrench', e.target.value as LanguageLevel)
            }
          >
            {LANGUAGE_LEVEL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </FormSelect>
          <FormSelect
            id="profile-languageArabic"
            label="Arabic"
            required
            disabled={locked}
            value={form.languageArabic}
            onChange={(e) =>
              setField('languageArabic', e.target.value as LanguageLevel)
            }
          >
            {LANGUAGE_LEVEL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </FormSelect>
        </div>
      </FormSection>

      <FormSection
        id="section-tests"
        title="Standardized Tests"
        caption="Optional"
        open={sectionsOpen.tests}
        onToggle={() => toggleSection('tests')}
      >
        <div className="grid grid-cols-1 gap-[16px] md:grid-cols-2">
          <FormField
            id="profile-usmleStep1"
            label="IFOM 1"
            type="number"
            readOnly={locked}
            value={form.usmleStep1}
            onChange={(e) => setField('usmleStep1', e.target.value)}
            placeholder="0 – 100"
            hint="Optional"
          />
          <FormField
            id="profile-usmleStep2"
            label="IFOM 2"
            type="number"
            readOnly={locked}
            value={form.usmleStep2}
            onChange={(e) => setField('usmleStep2', e.target.value)}
            placeholder="0 – 100"
            hint="Optional"
          />
        </div>
      </FormSection>

      <FormSection
        id="section-experience"
        title="Experience & Research"
        caption="Optional"
        open={sectionsOpen.experience}
        onToggle={() => toggleSection('experience')}
      >
        <div className="flex flex-col gap-[16px]">
          <FormTextarea
            id="profile-research"
            label="Research"
            readOnly={locked}
            value={form.research}
            onChange={(e) => setField('research', e.target.value)}
            placeholder="Research projects, roles, publications-in-progress…"
          />
          <FormTextarea
            id="profile-publications"
            label="Publications"
            readOnly={locked}
            value={form.publications}
            onChange={(e) => setField('publications', e.target.value)}
            placeholder="Citations, journals, year…"
          />
          <FormTextarea
            id="profile-workExperience"
            label="Work Experience"
            readOnly={locked}
            value={form.workExperience}
            onChange={(e) => setField('workExperience', e.target.value)}
          />
          <FormTextarea
            id="profile-extracurriculars"
            label="Extracurriculars"
            readOnly={locked}
            value={form.extracurriculars}
            onChange={(e) => setField('extracurriculars', e.target.value)}
          />
        </div>
      </FormSection>

      <FormSection
        id="section-emergency"
        title="Emergency Contact"
        open={sectionsOpen.emergency}
        onToggle={() => toggleSection('emergency')}
      >
        <div className="grid grid-cols-1 gap-[16px] md:grid-cols-3">
          <FormField
            id="profile-emergencyContactName"
            label="Name"
            required
            readOnly={locked}
            value={form.emergencyContactName}
            onChange={(e) => setField('emergencyContactName', e.target.value)}
            error={fieldErrors.emergencyContactName}
          />
          <FormField
            id="profile-emergencyContactPhone"
            label="Phone"
            type="tel"
            required
            readOnly={locked}
            value={form.emergencyContactPhone}
            onChange={(e) => setField('emergencyContactPhone', e.target.value)}
            error={fieldErrors.emergencyContactPhone}
          />
          <FormField
            id="profile-emergencyContactRelation"
            label="Relation"
            required
            readOnly={locked}
            value={form.emergencyContactRelation}
            onChange={(e) => setField('emergencyContactRelation', e.target.value)}
            placeholder="e.g. Parent, Sibling, Spouse"
            error={fieldErrors.emergencyContactRelation}
          />
        </div>
      </FormSection>

      {locked ? null : (
        <div className="mt-[8px] flex items-center gap-[14px] border-t border-lrfap-ghost pt-[20px]">
          <button
            type="submit"
            disabled={!isDirty || isSaving}
            className="inline-flex h-[44px] items-center justify-center gap-[8px] border-[0.91px] border-lrfap-sky bg-lrfap-sky px-[28px] font-sans text-[14px] font-medium uppercase tracking-wide text-white transition-colors hover:bg-[#3a86bd] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? (
              <>
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              'Save Changes'
            )}
          </button>
          {showSavedChip ? (
            <span
              role="status"
              aria-live="polite"
              className="inline-flex items-center gap-[6px] font-sans text-[13px] font-medium text-green-700"
            >
              <CheckCircle aria-hidden="true" className="h-4 w-4" />
              Saved
            </span>
          ) : !isDirty ? (
            <span className="font-sans text-[12px] text-slate-500">
              All changes saved.
            </span>
          ) : (
            <span className="font-sans text-[12px] text-slate-500">
              You have unsaved changes.
            </span>
          )}
        </div>
      )}
    </form>
  );
}
