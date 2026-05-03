const express = require('express');
const rateLimit = require('express-rate-limit');
const { ask } = require('../controllers/chatbotController');

const router = express.Router();

const chatbotLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many chatbot requests. Please wait a moment.' },
});

/**
 * @openapi
 * /api/chatbot/ask:
 *   post:
 *     tags: [Chatbot]
 *     summary: Ask the LRFAP assistant a question (OpenAI-powered, scope-restricted)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message: { type: string, maxLength: 2000 }
 *               history:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     role: { type: string, enum: [user, model] }
 *                     text: { type: string }
 *     responses:
 *       200: { description: Chatbot response }
 *       400: { description: Invalid or missing message }
 *       503: { description: Chatbot not configured }
 */
router.post('/ask', chatbotLimiter, ask);

module.exports = router;