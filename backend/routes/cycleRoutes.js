const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  createCycle, getCycles, getCycle, updateCycle, updateCycleStatus,
} = require('../controllers/cycleController');

const router = express.Router();

/**
 * @openapi
 * /api/cycles:
 *   get:
 *     tags: [Catalog]
 *     summary: List all application cycles
 *     responses:
 *       200: { description: Array of cycles }
 */
router.get('/', getCycles);

/**
 * @openapi
 * /api/cycles/{id}:
 *   get:
 *     tags: [Catalog]
 *     summary: Get a single cycle by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Cycle object }
 */
router.get('/:id', getCycle);

/**
 * @openapi
 * /api/cycles:
 *   post:
 *     tags: [Catalog]
 *     summary: Create a new cycle (LGC only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201: { description: Cycle created }
 */
router.post('/', protect, authorize('lgc'), createCycle);

/**
 * @openapi
 * /api/cycles/{id}:
 *   put:
 *     tags: [Catalog]
 *     summary: Update a cycle (LGC only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Cycle updated }
 */
router.put('/:id', protect, authorize('lgc'), updateCycle);

/**
 * @openapi
 * /api/cycles/{id}/status:
 *   patch:
 *     tags: [Catalog]
 *     summary: Update a cycle's status (LGC only)
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
 *               status:
 *                 type: string
 *                 enum: [draft, open, review, ranking, matching, published, closed]
 *     responses:
 *       200: { description: Cycle status updated }
 */
router.patch('/:id/status', protect, authorize('lgc'), updateCycleStatus);

module.exports = router;