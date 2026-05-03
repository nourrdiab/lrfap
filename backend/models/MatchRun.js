const mongoose = require('mongoose');

const matchRunSchema = new mongoose.Schema(
  {
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
    runType: {
      type: String,
      enum: ['dry_run', 'official'],
      required: true,
    },
    status: {
      type: String,
      enum: ['running', 'completed', 'failed'],
      default: 'running',
    },
    executedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    inputsSnapshot: {
      applicantCount: Number,
      programCount: Number,
      totalCapacity: Number,
    },
    tieBreakRule: {
      type: String,
      default: 'earliest submission time',
    },
    results: {
      totalMatched: Number,
      totalUnmatched: Number,
      matches: [
        {
          applicantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
          programId: { type: mongoose.Schema.Types.ObjectId, ref: 'Program' },
        },
      ],
      unmatchedApplicants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      programFillRates: [
        {
          programId: { type: mongoose.Schema.Types.ObjectId, ref: 'Program' },
          capacity: Number,
          filled: Number,
          unfilled: Number,
        },
      ],
      iterations: Number,
    },
    error: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('MatchRun', matchRunSchema);