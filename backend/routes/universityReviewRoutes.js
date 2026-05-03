const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  getMyPrograms,
  getProgramApplications,
  getApplicationDetail,
  getProgramRanking,
  updateProgramRanking,
  submitProgramRanking,
  beginReview,
  markReviewed,
} = require('../controllers/universityReviewController');

const router = express.Router();

router.use(protect, authorize('university', 'lgc'));

/**
 * @openapi
 * /api/university-review/programs:
 *   get:
 *     tags: [University Review]
 *     summary: List programs belonging to the authenticated university
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Array of programs }
 */
router.get('/programs', getMyPrograms);

/**
 * @openapi
 * /api/university-review/programs/{programId}/applications:
 *   get:
 *     tags: [University Review]
 *     summary: List applications that selected a given program
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: programId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200: { description: Array of applications }
 */
router.get('/programs/:programId/applications', getProgramApplications);

/**
 * @openapi
 * /api/university-review/applications/{applicationId}:
 *   get:
 *     tags: [University Review]
 *     summary: Get full application detail (university-side view)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Application object }
 */
router.get('/applications/:applicationId', getApplicationDetail);

/**
 * @openapi
 * /api/university-review/applications/{applicationId}/begin-review:
 *   post:
 *     tags: [University Review]
 *     summary: Mark an application as under review for the caller's university
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Updated review state }
 */
router.post('/applications/:applicationId/begin-review', beginReview);

/**
 * @openapi
 * /api/university-review/applications/{applicationId}/mark-reviewed:
 *   post:
 *     tags: [University Review]
 *     summary: Mark an application as reviewed for the caller's university
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Updated review state }
 */
router.post('/applications/:applicationId/mark-reviewed', markReviewed);

/**
 * @openapi
 * /api/university-review/programs/{programId}/ranking:
 *   get:
 *     tags: [University Review]
 *     summary: Get the program's current ranking (auto-creates draft if none)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: programId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Ranking object }
 */
router.get('/programs/:programId/ranking', getProgramRanking);

/**
 * @openapi
 * /api/university-review/programs/{programId}/ranking:
 *   put:
 *     tags: [University Review]
 *     summary: Update a program's ranking (only if not yet submitted)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: programId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rankedApplicants:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     applicant: { type: string }
 *                     application: { type: string }
 *                     rank: { type: integer }
 *                     score: { type: number }
 *                     notes: { type: string }
 *     responses:
 *       200: { description: Ranking updated }
 */
router.put('/programs/:programId/ranking', updateProgramRanking);

/**
 * @openapi
 * /api/university-review/programs/{programId}/ranking/submit:
 *   post:
 *     tags: [University Review]
 *     summary: Submit and lock a program ranking
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: programId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Ranking submitted and locked }
 */
router.post('/programs/:programId/ranking/submit', submitProgramRanking);

module.exports = router;