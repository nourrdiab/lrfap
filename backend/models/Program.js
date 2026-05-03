const mongoose = require('mongoose');

const programSchema = new mongoose.Schema(
  {
    university: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'University',
      required: true,
    },
    specialty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Specialty',
      required: true,
    },
    cycle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cycle',
      required: true,
    },
    track: {
      type: String,
      enum: ['residency', 'fellowship'],
      required: true,
    },
    capacity: {
      type: Number,
      required: true,
      min: 0,
    },
    availableSeats: {
      type: Number,
      required: true,
      min: 0,
    },
    durationYears: {
      type: Number,
      required: true,
      min: 1,
      max: 10,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
    extraRequirements: {
      type: [String],
      default: [],
    },
    languageRequirement: {
      type: String,
      enum: ['english', 'french', 'arabic', 'none'],
      default: 'none',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

programSchema.index({ university: 1, specialty: 1, cycle: 1, track: 1 }, { unique: true });

module.exports = mongoose.model('Program', programSchema);