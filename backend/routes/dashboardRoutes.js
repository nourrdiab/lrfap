const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  getLGCDashboard,
  getApplicantDashboard,
  getLGCRankingSummary,
  getUniversityProgramCounts,
} = require('../controllers/dashboardController');

const router = express.Router();

/**
 * @openapi
 * /api/dashboard/lgc:
 *   get:
 *     tags: [Dashboards]
 *     summary: LGC committee dashboard with system-wide metrics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Counts, capacity, applications by specialty, recent activity }
 */
router.get('/lgc', protect, authorize('lgc'), getLGCDashboard);

/**
 * @openapi
 * /api/dashboard/applicant:
 *   get:
 *     tags: [Dashboards]
 *     summary: Authenticated applicant's personal dashboard
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Profile completion, checklist, applications, active cycle }
 */
router.get('/applicant', protect, authorize('applicant'), getApplicantDashboard);

/**
 * @openapi
 * /api/dashboard/lgc/ranking-summary:
 *   get:
 *     tags: [Dashboards]
 *     summary: Aggregated ranking completion per university for one cycle
 *     description: >
 *       Single-query replacement for the per-program ranking fetch loop
 *       that used to drive the LGC dashboard Universities table and the
 *       per-track readiness checks. Returns per-university totals,
 *       per-track rollups, and an overall totals block. Universities
 *       with zero programs in the cycle are omitted — the caller is
 *       expected to merge them from its own universities list.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: cycle
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Aggregated ranking summary for the cycle }
 *       400: { description: Missing or invalid cycle parameter }
 *       404: { description: Cycle not found }
 */
router.get(
  '/lgc/ranking-summary',
  protect,
  authorize('lgc'),
  getLGCRankingSummary
);

/**
 * @openapi
 * /api/dashboard/university/program-counts:
 *   get:
 *     tags: [Dashboards]
 *     summary: Per-program applicant status counts for the caller's university
 *     description: >
 *       Aggregation replacement for the University dashboard's old
 *       per-program applications fetch. Returns status counts per
 *       program (submitted, under_review, matched, unmatched, withdrawn),
 *       the total count of unique applicants across those programs, and
 *       a `pendingReview` count derived from per-university review states
 *       (states 'new' or 'under_review' on non-withdrawn applications in
 *       the cycle). Scoped to the authenticated university reviewer's
 *       institution.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: cycle
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Counts per program plus unique applicant total }
 *       400: { description: Missing or invalid cycle parameter }
 *       404: { description: Cycle not found }
 */
router.get(
  '/university/program-counts',
  protect,
  authorize('university'),
  getUniversityProgramCounts
);

module.exports = router;