const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'LRFAP API',
      version: '1.0.0',
      description:
        'Lebanese Residency and Fellowship Application Program — REST API documentation. A centralized platform for medical residency and fellowship applications in Lebanon, featuring stable matching via the Gale-Shapley algorithm.',
      contact: {
        name: 'Nour Diab',
        email: 'nour.diab09@lau.edu',
      },
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Local development',
      },
      {
        url: 'https://lrfap-backend.vercel.app',
        description: 'Production',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    tags: [
      { name: 'Auth', description: 'Authentication and user management' },
      { name: 'Catalog', description: 'Specialties, universities, cycles, programs' },
      { name: 'Applicant Profile', description: 'Applicant personal and academic profile' },
      { name: 'Applications', description: 'Application lifecycle and offer management' },
      { name: 'University Review', description: 'University-side application review and program rankings' },
      { name: 'Matching', description: 'Gale-Shapley matching engine and results publication' },
      { name: 'Audit', description: 'Audit log inspection' },
      { name: 'Dashboards', description: 'Aggregated metrics and counts' },
      { name: 'Notifications', description: 'In-portal notification center' },
      { name: 'System', description: 'Health and system endpoints' },
      { name: 'Documents', description: 'Document upload, download, and management' },
      { name: 'Chatbot', description: 'AI-powered LRFAP assistant (OpenAI GPT-4o-mini)' },
    ],
  },
  apis: ['./routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;