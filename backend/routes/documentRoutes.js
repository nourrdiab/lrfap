const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  uploadMiddleware,
  uploadDocument,
  getMyDocuments,
  getApplicationDocuments,
  getDocumentDownloadUrl,
  getDocumentViewUrl,
  deleteDocument,
  reviewDocument,
} = require('../controllers/documentController');

const router = express.Router();

router.use(protect);

/**
 * @openapi
 * /api/documents:
 *   post:
 *     tags: [Documents]
 *     summary: Upload a document (PDF, images, DOC/DOCX, max 10MB)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file: { type: string, format: binary }
 *               type: { type: string, enum: [transcript, cv, recommendation_letter, id_document, medical_license, usmle_score, other] }
 *               applicationId: { type: string }
 *     responses:
 *       201: { description: Document uploaded }
 */
router.post('/', authorize('applicant'), uploadMiddleware, uploadDocument);

/**
 * @openapi
 * /api/documents:
 *   get:
 *     tags: [Documents]
 *     summary: List the authenticated user's documents
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Array of documents }
 */
router.get('/', getMyDocuments);

/**
 * @openapi
 * /api/documents/application/{applicationId}:
 *   get:
 *     tags: [Documents]
 *     summary: List documents attached to an application (university or LGC)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Array of documents }
 */
router.get('/application/:applicationId', getApplicationDocuments);

/**
 * @openapi
 * /api/documents/{id}/download:
 *   get:
 *     tags: [Documents]
 *     summary: Get a signed download URL for a document (1-hour expiry)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Signed URL returned }
 */
router.get('/:id/download', getDocumentDownloadUrl);

/**
 * @openapi
 * /api/documents/{id}/view:
 *   get:
 *     tags: [Documents]
 *     summary: Get a signed URL that opens inline in the browser (1-hour expiry)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Signed URL returned }
 */
router.get('/:id/view', getDocumentViewUrl);

/**
 * @openapi
 * /api/documents/{id}:
 *   delete:
 *     tags: [Documents]
 *     summary: Delete a document
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Document deleted }
 */
router.delete('/:id', authorize('applicant'), deleteDocument);

/**
 * @openapi
 * /api/documents/{id}/status:
 *   patch:
 *     tags: [Documents]
 *     summary: Review a document (university or LGC) - verify, reject, or require replacement
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [verified, rejected, replacement_required] }
 *               reviewNotes: { type: string }
 *     responses:
 *       200: { description: Document status updated }
 *       403: { description: Not authorized to review this document }
 *       404: { description: Document not found }
 */
router.patch('/:id/status', authorize('university', 'lgc'), reviewDocument);

module.exports = router;