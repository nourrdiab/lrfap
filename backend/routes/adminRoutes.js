/**
 * TODO: Remove this router before production deployment.
 * For dev/demo reset only.
 */

const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  resetCycle,
  bulkSubmitRankings,
} = require('../controllers/adminController');

const router = express.Router();

/**
 * @openapi
 * /api/admin/reset-cycle/{cycleId}:
 *   post:
 *     tags: [Admin]
 *     summary: (DEV ONLY) Reset a cycle to pre-matching state
 *     description: >
 *       Rewinds applications from matched/unmatched → submitted, clears
 *       offer state, deletes all MatchRun documents for the cycle. Does
 *       not touch Program.availableSeats or Cycle.status.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cycleId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Reset summary }
 *       400: { description: Invalid cycle ID }
 *       404: { description: Cycle not found }
 */
router.post('/reset-cycle/:cycleId', protect, authorize('lgc'), resetCycle);

/**
 * @openapi
 * /api/admin/bulk-submit-rankings/{cycleId}:
 *   post:
 *     tags: [Admin]
 *     summary: (DEV ONLY) Create submitted rankings for all un-ranked programs in a cycle
 *     description: >
 *       For every program in the cycle without a ProgramRanking document,
 *       creates one in status='submitted' with rankedApplicants built
 *       from that program's applications (sorted by submittedAt ASC).
 *       Programs that already have a ranking (draft or submitted) are
 *       skipped.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cycleId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Bulk submission summary }
 *       400: { description: Invalid cycle ID }
 *       404: { description: Cycle not found }
 */
router.post(
  '/bulk-submit-rankings/:cycleId',
  protect,
  authorize('lgc'),
  bulkSubmitRankings
);

module.exports = router;
