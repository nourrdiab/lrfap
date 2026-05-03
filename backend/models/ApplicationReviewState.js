const mongoose = require('mongoose');

const REVIEW_STATES = ['new', 'under_review', 'reviewed', 'matched'];

const applicationReviewStateSchema = new mongoose.Schema(
  {
    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Application',
      required: true,
    },
    university: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'University',
      required: true,
    },
    state: {
      type: String,
      enum: REVIEW_STATES,
      default: 'new',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

applicationReviewStateSchema.index(
  { application: 1, university: 1 },
  { unique: true }
);

const ApplicationReviewState = mongoose.model(
  'ApplicationReviewState',
  applicationReviewStateSchema
);

ApplicationReviewState.STATES = REVIEW_STATES;

module.exports = ApplicationReviewState;
