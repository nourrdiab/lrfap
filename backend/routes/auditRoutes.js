const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const { getAuditLogs } = require('../controllers/auditController');

const router = express.Router();

router.use(protect, authorize('lgc'));

/**
 * @openapi
 * /api/audit:
 *   get:
 *     tags: [Audit]
 *     summary: List audit log entries (LGC only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: action
 *         schema: { type: string }
 *       - in: query
 *         name: actorRole
 *         schema: { type: string }
 *       - in: query
 *         name: targetType
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 100 }
 *       - in: query
 *         name: skip
 *         schema: { type: integer, default: 0 }
 *     responses:
 *       200: { description: Paginated audit logs }
 */
router.get('/', getAuditLogs);

module.exports = router;