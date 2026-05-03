const OpenAI = require('openai');
const { SYSTEM_PROMPT } = require('../utils/chatbot-knowledge');

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const REFUSAL_MESSAGE =
  "I can only help with questions about the LRFAP platform and the Lebanese residency and fellowship application process. Is there something about LRFAP I can help you with?";

const OFF_TOPIC_INDICATORS = [
  'i cannot provide', 'as an ai', 'i am an ai', 'language model',
  'i don\'t have real-time', 'i\'m not able to', 'weather forecast', 'stock price',
];

exports.ask = async (req, res) => {
  try {
    if (!openai) {
      return res.status(503).json({ error: 'Chatbot is not configured' });
    }

    const { message, history = [] } = req.body;
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }
    if (message.length > 2000) {
      return res.status(400).json({ error: 'Message is too long (max 2000 characters)' });
    }

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.slice(-10).map((h) => ({
        role: h.role === 'user' ? 'user' : 'assistant',
        content: h.text || '',
      })),
      { role: 'user', content: message },
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.2,
      max_tokens: 500,
    });

    let responseText = completion.choices[0]?.message?.content?.trim() || REFUSAL_MESSAGE;

    const lowerResponse = responseText.toLowerCase();
    const looksOffTopic = OFF_TOPIC_INDICATORS.some((indicator) => lowerResponse.includes(indicator));
    if (looksOffTopic && !lowerResponse.includes('lrfap')) {
      responseText = REFUSAL_MESSAGE;
    }

    res.json({ response: responseText });
  } catch (error) {
    console.error('Chatbot error:', error);
    res.status(500).json({ error: 'Chatbot is temporarily unavailable. Please try again later.' });
  }
};