const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Application',
    },
    type: {
        type: String,
        enum: [
          'transcript',
          'cv',
          'recommendation_letter',
          'id_document',
          'medical_license',
          'usmle_score',
          'personal_statement',
          'degree_certificate',
          'language_test',
          'other'
        ],
        required: true,
      },
    r2Key: {
      type: String,
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'verified', 'rejected', 'replacement_required'],
      default: 'pending',
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: {
      type: Date,
    },
    reviewNotes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

documentSchema.index({ owner: 1, type: 1 });

module.exports = mongoose.model('Document', documentSchema);