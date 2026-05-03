const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  createProgram, getPrograms, getProgram, updateProgram, deleteProgram,
} = require('../controllers/programController');

const router = express.Router();

/**
 * @openapi
 * /api/programs:
 *   get:
 *     tags: [Catalog]
 *     summary: List programs (filterable by cycle, track, university, specialty)
 *     parameters:
 *       - in: query
 *         name: cycle
 *         schema: { type: string }
 *       - in: query
 *         name: track
 *         schema: { type: string, enum: [residency, fellowship] }
 *       - in: query
 *         name: university
 *         schema: { type: string }
 *       - in: query
 *         name: specialty
 *         schema: { type: string }
 *     responses:
 *       200: { description: Array of programs }
 */
router.get('/', getPrograms);

/**
 * @openapi
 * /api/programs/{id}:
 *   get:
 *     tags: [Catalog]
 *     summary: Get a single program by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Program object }
 */
router.get('/:id', getProgram);

/**
 * @openapi
 * /api/programs:
 *   post:
 *     tags: [Catalog]
 *     summary: Create a new program (LGC or university)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201: { description: Program created }
 */
router.post('/', protect, authorize('lgc', 'university'), createProgram);

/**
 * @openapi
 * /api/programs/{id}:
 *   put:
 *     tags: [Catalog]
 *     summary: Update a program (LGC or university)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Program updated }
 */
router.put('/:id', protect, authorize('lgc', 'university'), updateProgram);

/**
 * @openapi
 * /api/programs/{id}:
 *   delete:
 *     tags: [Catalog]
 *     summary: Delete a program (LGC only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Program deleted }
 */
router.delete('/:id', protect, authorize('lgc'), deleteProgram);

module.exports = router;