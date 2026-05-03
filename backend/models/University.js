const mongoose = require('mongoose');

const universitySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'University name is required'],
      unique: true,
      trim: true,
      maxlength: 200,
    },
    code: {
      type: String,
      required: [true, 'University code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: 10,
    },
    city: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    website: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    contactEmail: {
      type: String,
      lowercase: true,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('University', universitySchema);