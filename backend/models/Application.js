const mongoose = require('mongoose');

const programSelectionSchema = new mongoose.Schema(
  {
    program: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Program',
      required: true,
    },
    rank: {
      type: Number,
      required: true,
      min: 1,
    },
    institutionSpecificFields: {
      type: Map,
      of: String,
      default: {},
    },
  },
  { _id: false }
);

const applicationSchema = new mongoose.Schema(
  {
    applicant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
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
    status: {
      type: String,
      enum: ['draft', 'submitted', 'under_review', 'matched', 'unmatched', 'withdrawn'],
      default: 'draft',
    },
    selections: {
      type: [programSelectionSchema],
      default: [],
    },
    declarationAccepted: {
      type: Boolean,
      default: false,
    },
    submittedAt: {
      type: Date,
    },
    submissionReference: {
      type: String,
      unique: true,
      sparse: true,
    },
    lockedAt: {
      type: Date,
    },
    matchedProgram: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Program',
      default: null,
    },
    offerStatus: {
      type: String,
      enum: ['none', 'pending', 'accepted', 'declined', 'expired'],
      default: 'none',
    },
    offerExpiresAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

applicationSchema.index({ applicant: 1, cycle: 1, track: 1 }, { unique: true });
// Dashboard aggregations filter + unwind on `selections.program`; without
// this index that becomes a collection scan on a busy dataset. See
// dashboardController.getUniversityProgramCounts.
applicationSchema.index({ 'selections.program': 1 });

applicationSchema.pre('validate', function () {
  if (this.selections && this.selections.length > 0) {
    const ranks = this.selections.map((s) => s.rank);
    const uniqueRanks = new Set(ranks);
    if (uniqueRanks.size !== ranks.length) {
      this.invalidate('selections', 'Ranks must be unique across selections');
    }
  }
});

module.exports = mongoose.model('Application', applicationSchema);