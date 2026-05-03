import type {
  ApplicantLanguages,
  ApplicantProfile,
  LanguageLevel,
} from '../../../types';
import { MEDICAL_SCHOOL_OTHER } from '../wizard/steps/profileSchema';

/**
 * Pure logic shared between the wizard's ProfileStep and the standalone
 * /applicant/profile ProfileForm. No JSX, no context, no hooks — just
 * the form shape, empty defaults, validation rules, and round-trip
 * (hydrate / serialize) against the backend `ApplicantProfile` record.
 *
 * Any change here affects both surfaces; keep validation rules and
 * field names in sync with backend schema (models/ApplicantProfile.js).
 */

export interface ProfileForm {
  dateOfBirth: string;
  nationality: string;
  gender: '' | 'male' | 'female' | 'other' | 'prefer_not_to_say';
  phone: string;
  address: string;
  city: string;
  nationalId: string;
  medicalSchool: string;
  medicalSchoolOther: string;
  graduationYear: string;
  classRank: string;
  languageEnglish: LanguageLevel;
  languageFrench: LanguageLevel;
  languageArabic: LanguageLevel;
  usmleStep1: string;
  usmleStep2: string;
  research: string;
  publications: string;
  workExperience: string;
  extracurriculars: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
}

export type FieldErrors = Partial<Record<keyof ProfileForm, string>>;

export const EMPTY_PROFILE_FORM: ProfileForm = {
  dateOfBirth: '',
  nationality: '',
  gender: '',
  phone: '',
  address: '',
  city: '',
  nationalId: '',
  medicalSchool: '',
  medicalSchoolOther: '',
  graduationYear: '',
  classRank: '',
  languageEnglish: 'none',
  languageFrench: 'none',
  languageArabic: 'none',
  usmleStep1: '',
  usmleStep2: '',
  research: '',
  publications: '',
  workExperience: '',
  extracurriculars: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  emergencyContactRelation: '',
};

export function hydrateProfileForm(profile: ApplicantProfile): ProfileForm {
  const langs = profile.languages ?? {};
  return {
    dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.slice(0, 10) : '',
    nationality: profile.nationality ?? '',
    gender: profile.gender ?? '',
    phone: profile.phone ?? '',
    address: profile.address ?? '',
    city: profile.city ?? '',
    nationalId: profile.nationalId ?? '',
    medicalSchool:
      typeof profile.medicalSchool === 'object' && profile.medicalSchool
        ? profile.medicalSchool._id
        : (profile.medicalSchool ?? ''),
    medicalSchoolOther: profile.medicalSchoolOther ?? '',
    graduationYear: profile.graduationYear?.toString() ?? '',
    classRank: profile.classRank ?? '',
    languageEnglish: langs.english ?? 'none',
    languageFrench: langs.french ?? 'none',
    languageArabic: langs.arabic ?? 'none',
    usmleStep1: profile.usmleStep1?.toString() ?? '',
    usmleStep2: profile.usmleStep2?.toString() ?? '',
    research: profile.research ?? '',
    publications: profile.publications ?? '',
    workExperience: profile.workExperience ?? '',
    extracurriculars: profile.extracurriculars ?? '',
    emergencyContactName: profile.emergencyContactName ?? '',
    emergencyContactPhone: profile.emergencyContactPhone ?? '',
    emergencyContactRelation: profile.emergencyContactRelation ?? '',
  };
}

export function serializeProfileForm(
  form: ProfileForm,
): Partial<ApplicantProfile> {
  const languages: ApplicantLanguages = {
    english: form.languageEnglish,
    french: form.languageFrench,
    arabic: form.languageArabic,
  };
  const parseNumber = (s: string) => {
    if (!s.trim()) return undefined;
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
  };
  const medSchool =
    form.medicalSchool === MEDICAL_SCHOOL_OTHER
      ? undefined
      : form.medicalSchool || undefined;
  const medSchoolOther =
    form.medicalSchool === MEDICAL_SCHOOL_OTHER
      ? form.medicalSchoolOther.trim() || undefined
      : undefined;
  return {
    dateOfBirth: form.dateOfBirth || undefined,
    nationality: form.nationality.trim() || undefined,
    gender: form.gender || undefined,
    phone: form.phone.trim() || undefined,
    address: form.address.trim() || undefined,
    city: form.city.trim() || undefined,
    nationalId: form.nationalId.trim() || undefined,
    medicalSchool: medSchool,
    medicalSchoolOther: medSchoolOther,
    graduationYear: parseNumber(form.graduationYear),
    classRank: form.classRank.trim() || undefined,
    usmleStep1: parseNumber(form.usmleStep1),
    usmleStep2: parseNumber(form.usmleStep2),
    languages,
    research: form.research.trim() || undefined,
    publications: form.publications.trim() || undefined,
    workExperience: form.workExperience.trim() || undefined,
    extracurriculars: form.extracurriculars.trim() || undefined,
    emergencyContactName: form.emergencyContactName.trim() || undefined,
    emergencyContactPhone: form.emergencyContactPhone.trim() || undefined,
    emergencyContactRelation: form.emergencyContactRelation.trim() || undefined,
  };
}

export function validateProfileForm(form: ProfileForm): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.dateOfBirth) errors.dateOfBirth = 'Required';
  if (!form.gender) errors.gender = 'Required';
  if (!form.nationality.trim()) errors.nationality = 'Required';
  if (!form.phone.trim()) errors.phone = 'Required';
  if (!form.address.trim()) errors.address = 'Required';
  if (!form.city.trim()) errors.city = 'Required';
  if (!form.medicalSchool) errors.medicalSchool = 'Required';
  else if (
    form.medicalSchool === MEDICAL_SCHOOL_OTHER &&
    !form.medicalSchoolOther.trim()
  )
    errors.medicalSchoolOther = 'Required';
  if (!form.graduationYear.trim()) errors.graduationYear = 'Required';
  else if (!/^\d{4}$/.test(form.graduationYear.trim()))
    errors.graduationYear = 'Enter a 4-digit year';
  if (!form.emergencyContactName.trim()) errors.emergencyContactName = 'Required';
  if (!form.emergencyContactPhone.trim()) errors.emergencyContactPhone = 'Required';
  if (!form.emergencyContactRelation.trim())
    errors.emergencyContactRelation = 'Required';
  return errors;
}
