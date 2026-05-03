const mongoose = require('mongoose');

const rankedApplicantSchema = new mongoose.Schema(
  {
    applicant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Application',
      required: true,
    },
    rank: {
      type: Number,
      required: true,
      min: 1,
    },
    score: {
      type: Number,
      min: 0,
      max: 100,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
  },
  { _id: false }
);

const programRankingSchema = new mongoose.Schema(
  {
    program: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Program',
      required: true,
    },
    cycle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cycle',
      required: true,
    },
    rankedApplicants: {
      type: [rankedApplicantSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ['draft', 'submitted'],
      default: 'draft',
    },
    submittedAt: {
      type: Date,
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

programRankingSchema.index({ program: 1, cycle: 1 }, { unique: true });

programRankingSchema.pre('validate', function () {
  if (this.rankedApplicants && this.rankedApplicants.length > 0) {
    const ranks = this.rankedApplicants.map((r) => r.rank);
    const uniqueRanks = new Set(ranks);
    if (uniqueRanks.size !== ranks.length) {
      this.invalidate('rankedApplicants', 'Ranks must be unique');
    }
    const applicantIds = this.rankedApplicants.map((r) => r.applicant.toString());
    if (new Set(applicantIds).size !== applicantIds.length) {
      this.invalidate('rankedApplicants', 'Each applicant can appear only once in the ranking');
    }
  }
});

module.exports = mongoose.model('ProgramRanking', programRankingSchema);