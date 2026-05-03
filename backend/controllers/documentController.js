const multer = require('multer');
const Document = require('../models/Document');
const Application = require('../models/Application');
const Program = require('../models/Program');
const { uploadToR2, getDownloadUrl, deleteFromR2 } = require('../utils/r2');

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error('File type not allowed. Use PDF, JPEG, PNG, DOC, or DOCX.'));
    }
    cb(null, true);
  },
}).single('file');

exports.uploadMiddleware = (req, res, next) => {
  upload(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
};

exports.uploadDocument = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { type, applicationId } = req.body;
    if (!type) return res.status(400).json({ error: 'Document type is required' });

    const { key, originalName, mimeType, size } = await uploadToR2({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      folder: `users/${req.user._id}`,
      originalName: req.file.originalname,
    });

    const document = await Document.create({
      owner: req.user._id,
      application: applicationId || undefined,
      type,
      r2Key: key,
      originalName,
      mimeType,
      size,
    });

    res.status(201).json({ message: 'Document uploaded', document });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getMyDocuments = async (req, res) => {
  const documents = await Document.find({ owner: req.user._id }).sort('-createdAt');
  res.json(documents);
};

exports.getApplicationDocuments = async (req, res) => {
  try {
    const application = await Application.findById(req.params.applicationId).populate({
      path: 'selections.program',
      select: 'university',
    });
    if (!application) return res.status(404).json({ error: 'Application not found' });

    const isOwner = application.applicant.toString() === req.user._id.toString();
    const isLGC = req.user.role === 'lgc';
    let isAuthorizedUniversity = false;

    if (req.user.role === 'university') {
      isAuthorizedUniversity = application.selections.some(
        (s) => s.program?.university?.toString() === req.user.university?.toString()
      );
    }

    if (!isOwner && !isLGC && !isAuthorizedUniversity) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const documents = await Document.find({
      owner: application.applicant,
      application: application._id,
    }).sort('-createdAt');

    res.json(documents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

async function generateDocumentSignedUrl(req, res, disposition) {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    const isOwner = doc.owner.toString() === req.user._id.toString();
    const isLGC = req.user.role === 'lgc';
    let isAuthorizedUniversity = false;

    if (req.user.role === 'university' && doc.application) {
      const application = await Application.findById(doc.application).populate({
        path: 'selections.program',
        select: 'university',
      });
      if (application) {
        isAuthorizedUniversity = application.selections.some(
          (s) => s.program?.university?.toString() === req.user.university?.toString()
        );
      }
    }

    if (!isOwner && !isLGC && !isAuthorizedUniversity) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const url = await getDownloadUrl(doc.r2Key, 3600, {
      disposition,
      filename: doc.originalName,
    });
    res.json({ url, expiresIn: 3600, document: doc });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

exports.getDocumentDownloadUrl = (req, res) =>
  generateDocumentSignedUrl(req, res, 'attachment');

exports.getDocumentViewUrl = (req, res) =>
  generateDocumentSignedUrl(req, res, 'inline');

exports.deleteDocument = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    if (doc.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await deleteFromR2(doc.r2Key);
    await doc.deleteOne();
    res.json({ message: 'Document deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.reviewDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reviewNotes } = req.body;

    const allowedStatuses = ['verified', 'rejected', 'replacement_required'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: `status must be one of: ${allowedStatuses.join(', ')}`,
      });
    }

    const document = await Document.findById(id);
    if (!document) return res.status(404).json({ error: 'Document not found' });
    if (!document.application) {
      return res.status(400).json({ error: 'Document is not linked to an application' });
    }

    if (req.user.role === 'university') {
      const application = await Application.findById(document.application);
      if (!application) return res.status(404).json({ error: 'Application not found' });

      const programIds = application.selections.map((s) => s.program);
      const matchingProgram = await Program.findOne({
        _id: { $in: programIds },
        university: req.user.university,
      });

      if (!matchingProgram) {
        return res.status(403).json({
          error: 'You can only review documents for applications that selected your programs',
        });
      }
    }

    document.status = status;
    document.reviewedBy = req.user._id;
    document.reviewedAt = new Date();
    if (reviewNotes !== undefined) document.reviewNotes = reviewNotes;
    await document.save();

    res.json({ message: 'Document status updated', document });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};