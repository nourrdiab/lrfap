const mongoose = require('mongoose');

const cycleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Cycle name is required'],
      unique: true,
      trim: true,
      maxlength: 100,
    },
    year: {
      type: Number,
      required: [true, 'Cycle year is required'],
      min: 2024,
    },
    status: {
      type: String,
      enum: ['draft', 'open', 'review', 'ranking', 'matching', 'published', 'closed'],
      default: 'draft',
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    submissionDeadline: {
      type: Date,
      required: true,
    },
    rankingDeadline: {
      type: Date,
      required: true,
    },
    resultPublicationDate: {
      type: Date,
      required: true,
    },
    acceptanceWindowHours: {
      type: Number,
      default: 48,
      min: 1,
    },
  },
  { timestamps: true }
);

cycleSchema.pre('validate', function () {
  if (this.endDate <= this.startDate) {
    this.invalidate('endDate', 'End date must be after start date');
  }
  if (this.submissionDeadline > this.endDate) {
    this.invalidate('submissionDeadline', 'Submission deadline must be before end date');
  }
});

module.exports = mongoose.model('Cycle', cycleSchema);