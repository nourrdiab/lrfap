const mongoose = require('mongoose');

const applicantProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },

    dateOfBirth: { type: Date },
    gender: { type: String, enum: ['male', 'female', 'other', 'prefer_not_to_say'] },
    nationality: { type: String, trim: true, maxlength: 100 },
    nationalId: { type: String, trim: true, maxlength: 50 },
    phone: { type: String, trim: true, maxlength: 30 },
    address: { type: String, trim: true, maxlength: 300 },
    city: { type: String, trim: true, maxlength: 100 },

    medicalSchool: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'University',
    },
    medicalSchoolOther: { type: String, trim: true, maxlength: 200 },
    graduationYear: { type: Number, min: 1980, max: 2035 },
    gpa: { type: Number, min: 0, max: 4 },
    classRank: { type: String, trim: true, maxlength: 50 },

    languages: {
      english: { type: String, enum: ['none', 'basic', 'intermediate', 'fluent', 'native'], default: 'none' },
      french: { type: String, enum: ['none', 'basic', 'intermediate', 'fluent', 'native'], default: 'none' },
      arabic: { type: String, enum: ['none', 'basic', 'intermediate', 'fluent', 'native'], default: 'none' },
    },

    usmleStep1: { type: Number, min: 0, max: 100 },
    usmleStep2: { type: Number, min: 0, max: 100 },

    research: { type: String, trim: true, maxlength: 2000 },
    publications: { type: String, trim: true, maxlength: 2000 },
    workExperience: { type: String, trim: true, maxlength: 2000 },
    extracurriculars: { type: String, trim: true, maxlength: 2000 },

    emergencyContactName: { type: String, trim: true, maxlength: 200 },
    emergencyContactPhone: { type: String, trim: true, maxlength: 30 },
    emergencyContactRelation: { type: String, trim: true, maxlength: 100 },

    profileCompleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ApplicantProfile', applicantProfileSchema);