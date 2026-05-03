const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  createApplication,
  getMyApplications,
  getApplication,
  updateSelections,
  submitApplication,
  withdrawApplication,
  deleteApplication,
  acceptOffer,
  declineOffer,
} = require('../controllers/applicationController');

const router = express.Router();

router.use(protect, authorize('applicant'));

/**
 * @openapi
 * /api/applications:
 *   post:
 *     tags: [Applications]
 *     summary: Create a new draft application
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [cycleId, track]
 *             properties:
 *               cycleId: { type: string }
 *               track: { type: string, enum: [residency, fellowship] }
 *     responses:
 *       201: { description: Draft application created }
 */
router.post('/', createApplication);

/**
 * @openapi
 * /api/applications:
 *   get:
 *     tags: [Applications]
 *     summary: List the authenticated applicant's applications
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Array of applications }
 */
router.get('/', getMyApplications);

/**
 * @openapi
 * /api/applications/{id}:
 *   get:
 *     tags: [Applications]
 *     summary: Get a single application by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Application object }
 */
router.get('/:id', getApplication);

/**
 * @openapi
 * /api/applications/{id}:
 *   delete:
 *     tags: [Applications]
 *     summary: Delete a draft application (applicant-owned, draft status only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Application deleted }
 *       400: { description: Only drafts can be deleted }
 *       403: { description: Forbidden - not the owner }
 *       404: { description: Application not found }
 */
router.delete('/:id', deleteApplication);

/**
 * @openapi
 * /api/applications/{id}/selections:
 *   put:
 *     tags: [Applications]
 *     summary: Update program selections on a draft application
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
 *             properties:
 *               selections:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     program: { type: string }
 *                     rank: { type: integer }
 *     responses:
 *       200: { description: Selections updated }
 */
router.put('/:id/selections', updateSelections);

/**
 * @openapi
 * /api/applications/{id}/submit:
 *   post:
 *     tags: [Applications]
 *     summary: Submit a draft application (locks it)
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
 *             required: [declarationAccepted]
 *             properties:
 *               declarationAccepted: { type: boolean }
 *     responses:
 *       200: { description: Application submitted with reference number }
 */
router.post('/:id/submit', submitApplication);

/**
 * @openapi
 * /api/applications/{id}/withdraw:
 *   post:
 *     tags: [Applications]
 *     summary: Withdraw an application
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Application withdrawn }
 */
router.post('/:id/withdraw', withdrawApplication);

/**
 * @openapi
 * /api/applications/{id}/offer/accept:
 *   post:
 *     tags: [Applications]
 *     summary: Accept a pending match offer
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Offer accepted }
 *       400: { description: Offer not in pending state or expired }
 */
router.post('/:id/offer/accept', acceptOffer);

/**
 * @openapi
 * /api/applications/{id}/offer/decline:
 *   post:
 *     tags: [Applications]
 *     summary: Decline a pending match offer (releases seat)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Offer declined }
 */
router.post('/:id/offer/decline', declineOffer);

module.exports = router;