const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  dryRun,
  executeMatch,
  getMatchRuns,
  getMatchRun,
  publishResults,
} = require('../controllers/matchController');

const router = express.Router();

router.use(protect, authorize('lgc'));

/**
 * @openapi
 * /api/match/dry-run:
 *   post:
 *     tags: [Matching]
 *     summary: Run Gale-Shapley matching in simulation mode (no persistence)
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
 *       200: { description: Match results (not persisted) }
 */
router.post('/dry-run', dryRun);

/**
 * @openapi
 * /api/match/execute:
 *   post:
 *     tags: [Matching]
 *     summary: Run the official Gale-Shapley match and persist results
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
 *       200: { description: Match executed, applications updated }
 *       400: { description: Match already exists or no eligible inputs }
 */
router.post('/execute', executeMatch);

/**
 * @openapi
 * /api/match/publish:
 *   post:
 *     tags: [Matching]
 *     summary: Publish match results (transitions cycle to published)
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
 *       200: { description: Results published }
 */
router.post('/publish', publishResults);

/**
 * @openapi
 * /api/match/runs:
 *   get:
 *     tags: [Matching]
 *     summary: List all match runs (dry runs and official)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Array of match runs }
 */
router.get('/runs', getMatchRuns);

/**
 * @openapi
 * /api/match/runs/{id}:
 *   get:
 *     tags: [Matching]
 *     summary: Get a single match run by ID with full results
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Match run with populated matches }
 */
router.get('/runs/:id', getMatchRun);

module.exports = router;