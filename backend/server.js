require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');

const authRoutes = require('./routes/authRoutes');
const specialtyRoutes = require('./routes/specialtyRoutes');
const universityRoutes = require('./routes/universityRoutes');
const cycleRoutes = require('./routes/cycleRoutes');
const programRoutes = require('./routes/programRoutes');
const applicantProfileRoutes = require('./routes/applicantProfileRoutes');
const applicationRoutes = require('./routes/applicationRoutes');
const universityReviewRoutes = require('./routes/universityReviewRoutes');
const matchRoutes = require('./routes/matchRoutes');
const auditRoutes = require('./routes/auditRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./utils/swagger');
const documentRoutes = require('./routes/documentRoutes');
const chatbotRoutes = require('./routes/chatbotRoutes');
// TODO: Remove this import before production deployment. Dev/demo reset only.
const adminRoutes = require('./routes/adminRoutes');

const app = express();

let dbReady = null;
const connectDB = () => {
  if (dbReady) return dbReady;
  dbReady = mongoose
    .connect(process.env.MONGODB_URI)
    .then((conn) => {
      console.log(`MongoDB connected: ${conn.connection.host}`);
      return conn;
    })
    .catch((err) => {
      dbReady = null;
      console.error('MongoDB connection error:', err.message);
      throw err;
    });
  return dbReady;
};

app.use(helmet());

// CORS allowlist. `CORS_ORIGIN` is a comma-separated list of exact
// origins (e.g. "https://lrfap-frontend.vercel.app,http://localhost:5173").
// When CORS_ALLOW_VERCEL_PREVIEWS=1, any *.vercel.app origin is also
// accepted — handy for branch/preview deploys without having to
// redeploy the backend every time the preview URL changes.
//
// Requests with no Origin header (server-to-server, curl, same-origin)
// are allowed through. Unlisted browser origins get a CORS error,
// which is what we want — credentials: true means we can't wildcard.
const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const ALLOW_VERCEL_PREVIEWS = process.env.CORS_ALLOW_VERCEL_PREVIEWS === '1';
const VERCEL_PREVIEW_RE = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i;

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      if (ALLOW_VERCEL_PREVIEWS && VERCEL_PREVIEW_RE.test(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});
app.use(globalLimiter);

app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    res.status(503).json({ error: 'Database unavailable' });
  }
});

// Swagger docs route — relaxed CSP to allow loading assets from cdnjs CDN
app.use(
  '/api/docs',
  (req, res, next) => {
    res.removeHeader('Content-Security-Policy');
    res.removeHeader('Content-Security-Policy-Report-Only');
    next();
  },
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'],
        imgSrc: ["'self'", 'data:', 'https://cdnjs.cloudflare.com'],
        fontSrc: ["'self'", 'https://cdnjs.cloudflare.com'],
      },
    },
  }),
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'LRFAP API Docs',
    customCss: '.swagger-ui .topbar { display: none }',
    customCssUrl: 'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.17.14/swagger-ui.min.css',
    customJs: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.17.14/swagger-ui-bundle.js',
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.17.14/swagger-ui-standalone-preset.js',
    ],
  })
);

app.get('/api/docs.json', (req, res) => {
  res.json(swaggerSpec);
});

app.use('/api/auth', authRoutes);
app.use('/api/specialties', specialtyRoutes);
app.use('/api/universities', universityRoutes);
app.use('/api/cycles', cycleRoutes);
app.use('/api/programs', programRoutes);
app.use('/api/applicant-profile', applicantProfileRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/university-review', universityReviewRoutes);
app.use('/api/match', matchRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/chatbot', chatbotRoutes);
// TODO: Remove this route before production deployment. Dev/demo reset only.
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'LRFAP backend is running',
    timestamp: new Date().toISOString(),
  });
});

app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Welcome to the LRFAP API',
    docs: '/api/docs (coming soon)',
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

const PORT = process.env.PORT || 5000;

if (require.main === module) {
  connectDB().then(() => {
    app.listen(PORT, () => {
      console.log(`LRFAP backend running on http://localhost:${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  });
}

module.exports = app;