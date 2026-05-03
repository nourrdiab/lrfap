const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const { getMyProfile, updateMyProfile } = require('../controllers/applicantProfileController');

const router = express.Router();

/**
 * @openapi
 * /api/applicant-profile/me:
 *   get:
 *     tags: [Applicant Profile]
 *     summary: Get the authenticated applicant's profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Profile object (auto-created on first call) }
 */
router.get('/me', protect, authorize('applicant'), getMyProfile);

/**
 * @openapi
 * /api/applicant-profile/me:
 *   put:
 *     tags: [Applicant Profile]
 *     summary: Update the authenticated applicant's profile
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               dateOfBirth: { type: string, format: date }
 *               gender: { type: string }
 *               nationality: { type: string }
 *               phone: { type: string }
 *               medicalSchool: { type: string }
 *               graduationYear: { type: integer }
 *     responses:
 *       200: { description: Profile updated }
 */
router.put('/me', protect, authorize('applicant'), updateMyProfile);

module.exports = router;