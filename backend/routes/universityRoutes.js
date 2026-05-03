const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  createUniversity, getUniversities, getUniversity, updateUniversity, deleteUniversity,
} = require('../controllers/universityController');

const router = express.Router();

/**
 * @openapi
 * /api/universities:
 *   get:
 *     tags: [Catalog]
 *     summary: List all universities
 *     responses:
 *       200: { description: Array of universities }
 */
router.get('/', getUniversities);

/**
 * @openapi
 * /api/universities/{id}:
 *   get:
 *     tags: [Catalog]
 *     summary: Get a single university by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: University object }
 */
router.get('/:id', getUniversity);

/**
 * @openapi
 * /api/universities:
 *   post:
 *     tags: [Catalog]
 *     summary: Create a new university (LGC only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201: { description: University created }
 */
router.post('/', protect, authorize('lgc'), createUniversity);

/**
 * @openapi
 * /api/universities/{id}:
 *   put:
 *     tags: [Catalog]
 *     summary: Update a university (LGC only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: University updated }
 */
router.put('/:id', protect, authorize('lgc'), updateUniversity);

/**
 * @openapi
 * /api/universities/{id}:
 *   delete:
 *     tags: [Catalog]
 *     summary: Delete a university (LGC only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: University deleted }
 */
router.delete('/:id', protect, authorize('lgc'), deleteUniversity);

module.exports = router;