import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '../../../../hooks/useAuth';
import { applicantProfileApi } from '../../../../api/applicantProfile';
import { getApiErrorMessage } from '../../../../utils/apiError';
import type { LanguageLevel } from '../../../../types';
import { FormField } from '../../../auth/FormField';
import { FormErrorBanner } from '../../../auth/FormErrorBanner';
import { FormTextarea } from '../../forms/FormTextarea';
import { FormSelect } from '../../forms/FormSelect';
import { FormSection } from '../../forms/FormSection';
import { useWizard } from '../WizardContext';
import {
  DEFAULT_SECTIONS_OPEN,
  GENDER_OPTIONS,
  LANGUAGE_LEVEL_OPTIONS,
  MEDICAL_SCHOOL_OTHER,
  type ProfileSectionId,
} from './profileSchema';
import {
  EMPTY_PROFILE_FORM,
  hydrateProfileForm,
  serializeProfileForm,
  validateProfileForm,
  type FieldErrors,
  type ProfileForm,
} from '../../profile/profileFormHelpers';

/**
 * Profile step (step 1 of the application wizard).
 *
 * Editing surface for the reusable ApplicantProfile — the same record is
 * also managed on the standalone /applicant/profile page. Save target is
 * `PUT /api/applicant-profile/me` with the full object; GET on mount is
 * already performed by WizardProvider and cached in context, so this
 * component reads from that cache and only hits the network on save.
 *
 * The backend stores languages as an array of {language, level}; we
 * flatten to three top-level form fields for the UI and rebuild the array
 * before POSTing.
 */

export default function ProfileStep() {
  const { user } = useAuth();
  const {
    profile,
    profileStatus,
    updateProfileCache,
    universities,
    universitiesStatus,
    registerStepSave,
    notifySaved,
    goNext,
  } = useWizard();

  const [form, setForm] = useState<ProfileForm>(EMPTY_PROFILE_FORM);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sectionsOpen, setSectionsOpen] = useState<Record<ProfileSectionId, boolean>>(
    DEFAULT_SECTIONS_OPEN,
  );

  // Hydrate form when profile cache loads.
  useEffect(() => {
    if (profile) setForm(hydrateProfileForm(profile));
  }, [profile]);

  function setField<K extends keyof ProfileForm>(name: K, value: ProfileForm[K]) {
    setForm((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
  }

  function toggleSection(id: ProfileSectionId) {
    setSectionsOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const handleSave = useMemo(() => {
    return async () => {
      const errors = validateProfileForm(form);
      setFieldErrors(errors);
      if (Object.keys(errors).length > 0) {
        // Open any section containing an error so the user can see it.
        setSectionsOpen((prev) => {
          const next = { ...prev };
          if (
            errors.dateOfBirth ||
            errors.gender ||
            errors.nationality ||
            errors.phone
          )
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
        setSubmitError('Please fill in the highlighted required fields.');
        throw new Error('Validation failed');
      }
      try {
        const updated = await applicantProfileApi.updateMe(serializeProfileForm(form));
        updateProfileCache(updated);
        notifySaved();
        setSubmitError(null);
      } catch (err) {
        setSubmitError(getApiErrorMessage(err, 'Unable to save profile.'));
        throw err;
      }
    };
  }, [form, updateProfileCache, notifySaved]);

  useEffect(() => {
    registerStepSave(handleSave);
    return () => registerStepSave(null);
  }, [registerStepSave, handleSave]);

  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void goNext();
  }

  if (profileStatus === 'loading') {
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
  const fullName =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : '';

  return (
    <form
      onSubmit={handleFormSubmit}
      noValidate
      className="flex flex-col gap-[20px] pt-[16px] pb-[24px]"
    >
      <FormErrorBanner message={submitError} />

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
            value={form.dateOfBirth}
            onChange={(e) => setField('dateOfBirth', e.target.value)}
            error={fieldErrors.dateOfBirth}
          />
          <FormSelect
            id="profile-gender"
            label="Gender"
            required
            value={form.gender}
            onChange={(e) =>
              setField('gender', e.target.value as ProfileForm['gender'])
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
            value={form.phone}
            onChange={(e) => setField('phone', e.target.value)}
            placeholder="+961 ..."
            error={fieldErrors.phone}
          />
        </div>
        {/* Keep the read-only full-name string around for screen readers
            that collapse the two disabled inputs (no harm if visible). */}
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
              value={form.address}
              onChange={(e) => setField('address', e.target.value)}
              error={fieldErrors.address}
            />
          </div>
          <FormField
            id="profile-city"
            label="City"
            required
            value={form.city}
            onChange={(e) => setField('city', e.target.value)}
            error={fieldErrors.city}
          />
          <FormField
            id="profile-nationalId"
            label="National ID"
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
            disabled={universitiesStatus !== 'loaded'}
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
            value={form.graduationYear}
            onChange={(e) => setField('graduationYear', e.target.value)}
            placeholder="2024"
            error={fieldErrors.graduationYear}
          />
          <FormField
            id="profile-classRank"
            label="Class Rank"
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
            value={form.languageEnglish}
            onChange={(e) => setField('languageEnglish', e.target.value as LanguageLevel)}
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
            value={form.languageFrench}
            onChange={(e) => setField('languageFrench', e.target.value as LanguageLevel)}
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
            value={form.languageArabic}
            onChange={(e) => setField('languageArabic', e.target.value as LanguageLevel)}
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
            value={form.usmleStep1}
            onChange={(e) => setField('usmleStep1', e.target.value)}
            placeholder="0 – 100"
            hint="Optional"
          />
          <FormField
            id="profile-usmleStep2"
            label="IFOM 2"
            type="number"
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
            value={form.research}
            onChange={(e) => setField('research', e.target.value)}
            placeholder="Research projects, roles, publications-in-progress…"
          />
          <FormTextarea
            id="profile-publications"
            label="Publications"
            value={form.publications}
            onChange={(e) => setField('publications', e.target.value)}
            placeholder="Citations, journals, year…"
          />
          <FormTextarea
            id="profile-workExperience"
            label="Work Experience"
            value={form.workExperience}
            onChange={(e) => setField('workExperience', e.target.value)}
          />
          <FormTextarea
            id="profile-extracurriculars"
            label="Extracurriculars"
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
            value={form.emergencyContactName}
            onChange={(e) => setField('emergencyContactName', e.target.value)}
            error={fieldErrors.emergencyContactName}
          />
          <FormField
            id="profile-emergencyContactPhone"
            label="Phone"
            type="tel"
            required
            value={form.emergencyContactPhone}
            onChange={(e) => setField('emergencyContactPhone', e.target.value)}
            error={fieldErrors.emergencyContactPhone}
          />
          <FormField
            id="profile-emergencyContactRelation"
            label="Relation"
            required
            value={form.emergencyContactRelation}
            onChange={(e) => setField('emergencyContactRelation', e.target.value)}
            placeholder="e.g. Parent, Sibling, Spouse"
            error={fieldErrors.emergencyContactRelation}
          />
        </div>
      </FormSection>

      {/* Hidden submit so Enter-in-field submits the form; navigation uses
          the shell's NEXT button which also calls goNext. */}
      <button type="submit" className="sr-only" aria-hidden="true">
        Save and continue
      </button>
    </form>
  );
}
