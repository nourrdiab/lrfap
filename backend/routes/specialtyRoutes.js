const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  createSpecialty, getSpecialties, getSpecialty, updateSpecialty, deleteSpecialty,
} = require('../controllers/specialtyController');

const router = express.Router();

/**
 * @openapi
 * /api/specialties:
 *   get:
 *     tags: [Catalog]
 *     summary: List all medical specialties
 *     responses:
 *       200: { description: Array of specialties }
 */
router.get('/', getSpecialties);

/**
 * @openapi
 * /api/specialties/{id}:
 *   get:
 *     tags: [Catalog]
 *     summary: Get a single specialty by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Specialty object }
 *       404: { description: Not found }
 */
router.get('/:id', getSpecialty);

/**
 * @openapi
 * /api/specialties:
 *   post:
 *     tags: [Catalog]
 *     summary: Create a new specialty (LGC only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, code]
 *             properties:
 *               name: { type: string }
 *               code: { type: string }
 *               nationalQuota: { type: integer }
 *     responses:
 *       201: { description: Specialty created }
 *       403: { description: Forbidden }
 */
router.post('/', protect, authorize('lgc'), createSpecialty);

/**
 * @openapi
 * /api/specialties/{id}:
 *   put:
 *     tags: [Catalog]
 *     summary: Update a specialty (LGC only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Specialty updated }
 */
router.put('/:id', protect, authorize('lgc'), updateSpecialty);

/**
 * @openapi
 * /api/specialties/{id}:
 *   delete:
 *     tags: [Catalog]
 *     summary: Delete a specialty (LGC only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Specialty deleted }
 */
router.delete('/:id', protect, authorize('lgc'), deleteSpecialty);

module.exports = router;