# Lebanese Residency and Fellowship Application Program (LRFAP)

A centralized web platform for the Lebanese medical residency and fellowship application process, designed to replace fragmented, paper-based, and uncoordinated institutional workflows with a single governed system. LRFAP allows applicants to maintain one reusable profile, submit ranked program preferences, and receive results through a national stable-matching procedure based on the Gale–Shapley algorithm.

This repository contains the full source code for the platform, organized as a Node.js/Express REST API and a React/TypeScript single-page application, both deployed on Vercel and integrated with MongoDB Atlas and Cloudflare R2.

## Table of Contents

1. [Background](#background)
2. [Live Deployments](#live-deployments)
3. [System Architecture](#system-architecture)
4. [Technology Stack](#technology-stack)
5. [Repository Structure](#repository-structure)
6. [Core Modules](#core-modules)
7. [Matching Engine](#matching-engine)
8. [Security Design](#security-design)
9. [Getting Started](#getting-started)
10. [Environment Variables](#environment-variables)
11. [API Documentation](#api-documentation)
12. [Testing](#testing)
13. [Deployment](#deployment)
14. [Author and Supervision](#author-and-supervision)
15. [Disclaimer](#disclaimer)

## Background

The residency and fellowship application process in Lebanon is currently fragmented across institutions, with each university operating an independent and often paper-based intake. Applicants submit duplicated documents to multiple programs, track separate deadlines, and frequently make binding decisions on early offers before the full set of opportunities is known. There is no national mechanism for coordination, no central catalog of programs and capacities, and no aggregated data on supply and demand across specialties.

LRFAP addresses this gap by introducing a single platform shared by three distinct user roles:

- **Applicants** maintain one reusable profile, upload a single document set, browse the national program catalog, and submit a single ranked preference list per cycle.
- **University Programs** review applications submitted to their institution, mark review states, and produce ordered ranking lists used as input to the match.
- **The LRFAP Governance Committee (LGC)** maintains the master catalog (universities, specialties, programs, cycles), opens and closes cycle phases, executes the match, publishes results, and reviews audit logs and reports.

## Live Deployments

| Resource | URL |
| --- | --- |
| Frontend | https://lrfap-frontend.vercel.app |
| Backend API | https://lrfap-backend.vercel.app |
| API Documentation (Swagger UI) | https://lrfap-backend.vercel.app/api/docs |

## System Architecture

LRFAP is a two-tier web application split into independently deployable repositories:

- **`backend/`** — A stateless Node.js/Express REST API backed by MongoDB Atlas for application data and Cloudflare R2 for object storage. The API is deployed as a serverless function on Vercel and is documented through an OpenAPI 3.0 specification served at `/api/docs`.
- **`frontend/`** — A React 19 single-page application built with Vite and styled with Tailwind CSS v4. The client is also deployed on Vercel and communicates with the backend exclusively over HTTPS and JSON.

Authentication uses a split-token JWT scheme: a short-lived access token attached to the `Authorization` header, and a longer-lived refresh token delivered as an HTTP-only `Secure SameSite=None` cookie. The two tokens are signed with separate secrets and carry an explicit `type` claim to prevent confusion attacks. Role-based access control is enforced through dedicated middleware that runs after authentication on every protected route.

## Technology Stack

### Frontend

- **React 19** with **TypeScript** for type-safe component development
- **Vite** for the build pipeline and development server
- **React Router v7** for client-side routing across public, applicant, university, and LGC portals
- **Tailwind CSS v4** with a custom LRFAP brand token system
- **Framer Motion** for transitions and motion design
- **@dnd-kit** for drag-and-drop ranking interfaces (applicant preference list and university ranked list)
- **Axios** for HTTP, wrapped in a single client with an automatic 401-refresh interceptor
- **Lucide React** for iconography

### Backend

- **Node.js** with **Express** in a route → controller → model layering
- **MongoDB** via **Mongoose** for schema modeling, validation, and persistence
- **JSON Web Tokens** (`jsonwebtoken`) with separate access and refresh secrets
- **bcrypt** (cost factor 12) for password hashing
- **Helmet** for hardened HTTP response headers
- **express-rate-limit** for per-IP rate limiting (300 requests / 15 minutes globally; 10 requests / 15 minutes on authentication endpoints)
- **Multer** and **@aws-sdk/client-s3** for multipart file ingestion and Cloudflare R2 integration
- **swagger-jsdoc** and **swagger-ui-express** for API documentation
- **OpenAI Chat Completions API** (`gpt-4o-mini`) for the scoped LRFAP assistant chatbot
- **Resend** for transactional email delivery

### Infrastructure and External Services

- **Vercel** for frontend and backend hosting, with GitHub-based continuous deployment
- **MongoDB Atlas** for the managed database (AES-256 encryption at rest)
- **Cloudflare R2** for applicant document storage (S3-compatible, AES-256 at rest, zero-egress)
- **Cloudflare Registrar and DNS** for the `lrfap.com` domain and email-sender domain verification
- **Resend** for transactional email
- **k6** for load and performance testing
- **Postman** for API testing during development
- **Figma** for UI design

## Repository Structure

```
lrfap/
├── backend/                     Node.js/Express REST API
│   ├── server.js                Application entry — middleware, DB connection, route mounting
│   ├── controllers/             Route handlers (auth, application, match, cycle, document, ...)
│   ├── models/                  Mongoose schemas (User, Application, Program, MatchRun, AuditLog, ...)
│   ├── routes/                  Express routers, one per controller
│   ├── middleware/              JWT verification (protect) and RBAC (authorize)
│   └── utils/
│       ├── matching.js          Gale–Shapley stable matching implementation
│       ├── jwt.js               Access/refresh token signing and verification
│       ├── audit.js, notify.js  Audit log writer and notification dispatcher
│       ├── email.js             Resend templates and wrappers
│       ├── r2.js                Cloudflare R2 upload, download, and pre-signed URL helpers
│       ├── chatbot-knowledge.js System prompt for the OpenAI assistant
│       ├── swagger.js           Auto-generated OpenAPI 3.0 spec
│       └── seed.js              Development database seeder
│
└── frontend/                    React/TypeScript SPA bundled with Vite
    ├── index.html, vite.config.ts
    ├── public/                  Static marketing assets
    └── src/
        ├── api/                 Typed Axios modules per backend resource
        ├── context/             AuthContext, NotificationsContext
        ├── hooks/               Custom hooks (useAuth, useNotifications, ...)
        ├── layouts/             Per-portal layout shells
        ├── components/          Feature components grouped by portal (applicant, university, lgc)
        ├── pages/               One page per route, grouped by portal
        ├── types/               TypeScript types mirroring backend response shapes
        └── utils/               Cycle countdown, error formatting, audit-action humanization
```

## Core Modules

The backend is organized as a set of cohesive, loosely coupled modules. Each module owns one functional area of the platform and communicates with others only through controller invocations and shared Mongoose models.

- **Authentication and Authorization** — Registration, login, password reset, and session refresh for applicants, university users, and LGC users. Role-based access is enforced on every protected route through `protect` and `authorize(...roles)` middleware.

- **Applicant Module** — Profile management and a five-step application wizard (Profile → Documents → Programs → Preference Ranking → Review and Submit). Wizard state persists per step so applicants can resume; applications become immutable upon submission.

- **Document Management** — Multipart upload through Multer with type and size validation, persisted to Cloudflare R2 under randomly generated keys. Downloads are served through pre-signed URLs with a one-hour expiry. Document metadata is tracked in MongoDB and linked to the owning application.

- **Catalog and Cycle Management** — LGC-only management of universities, specialties, programs, and application cycles. Programs carry capacity (seats), track (residency or fellowship), and a one-to-one binding to a university, specialty, and cycle.

- **University Review and Ranking** — Reviewer-facing list of applications submitted to programs at the reviewer's institution, with per-applicant review states and an ordered ranking list per program. The ranking is editable until the LGC closes the ranking phase, at which point it becomes the authoritative input to the match.

- **Matching Engine** — Executes the Gale–Shapley deferred-acceptance algorithm against submitted applicant preferences and university rankings. Each run is persisted as a `MatchRun` record for auditability.

- **Notification and Email** — A single `notify()` helper writes an in-app notification to MongoDB and, for lifecycle events, dispatches a transactional email through Resend (account verification, password reset, application submission, match published, unmatched outcome).

- **Audit and Dashboard** — Every state-changing action is recorded in the `AuditLog` collection with actor, action type, target resource, and timestamp. The dashboard controller aggregates audit data and live counts into role-specific summary views.

- **AI Assistant** — A scoped chatbot backed by OpenAI `gpt-4o-mini`. A static knowledge file is injected as the system prompt and a fixed refusal message is returned for off-topic queries to keep the assistant focused on the LRFAP domain.

## Matching Engine

LRFAP implements the **applicant-proposing variant of the Gale–Shapley deferred-acceptance algorithm** (Gale & Shapley, 1962), which produces an applicant-optimal stable matching among all stable outcomes. The algorithm runs in O(n²) time and is well-suited to the expected scale of the Lebanese application process (fewer than one thousand applicants annually).

The implementation in `backend/utils/matching.js` accepts:

- The set of submitted applicant preference lists, ordered per applicant
- The set of program ranking lists submitted by university reviewers
- Per-program capacities (seats), modeled as a many-to-one matching with quotas

It produces:

- A set of applicant-to-program assignments
- A list of unmatched applicants
- Per-program fill rates and capacity utilization

Several practical edge cases are handled explicitly:

- **Incomplete preference lists.** The algorithm terminates correctly when applicants or programs submit partial lists, leaving some applicants unmatched or some seats unfilled rather than producing an unstable assignment.
- **Strict total order on program rankings.** The university ranking interface enforces strictly unique ranks from 1 to N within each program's submitted list, so the matching engine always receives a strict total order on each program's preferences. This guarantees a deterministic, reproducible match without requiring runtime tie-breaking.
- **Quotas.** Program and specialty quotas are modeled as capacities within the many-to-one stable matching framework, preserving stability while respecting institutional limits.

Each match invocation is persisted as a `MatchRun` document so historical runs remain inspectable through the LGC dashboard and audit log.

## Security Design

LRFAP processes sensitive applicant data including academic transcripts, identity documents, and match results. Security is treated as a cross-cutting requirement, applying defense-in-depth across transport, authentication, authorization, storage, and audit layers.

- **Password Storage.** Passwords are hashed with bcrypt at cost factor 12 and excluded from default Mongoose query projections (`select: false`), ensuring they cannot be returned in API responses.

- **Session Management.** Sessions use a split-token JWT scheme with a short-lived access token in the `Authorization` header and a longer-lived refresh token delivered as an `HttpOnly Secure SameSite=None` cookie that is inaccessible to client-side JavaScript. The two tokens are signed with separate secrets and carry an explicit `type` claim, preventing one from being substituted for the other.

- **Password Reset.** Reset tokens are single-use and time-limited; only their hash is persisted. The endpoint responds identically whether or not the supplied email is registered, preventing account enumeration.

- **Role-Based Access Control.** Authenticated users hold exactly one of three roles (`applicant`, `university`, `lgc`). Every protected route declares its accepted roles through the `authorize` middleware, which runs after authentication. Self-registration is restricted to the applicant role; university and LGC accounts are provisioned only by an existing LGC administrator.

- **Transport and HTTP Hardening.** TLS is terminated at Vercel's edge. Helmet applies standard hardening headers (Content-Security-Policy, Strict-Transport-Security, X-Content-Type-Options, X-Frame-Options, Referrer-Policy) on every API response. CORS is restricted to a strict allowlist read from the environment.

- **Rate Limiting and Input Validation.** A global limiter caps each client IP at 300 requests per fifteen-minute window; authentication endpoints are capped at 10 requests in the same window. Request bodies are bounded at 10 KB. All write paths flow through Mongoose schemas that enforce types, enumerated values, length bounds, and regular-expression patterns.

- **Data at Rest.** Application data is stored in MongoDB Atlas with AES-256 encryption at rest. Applicant documents are stored in Cloudflare R2 with server-side AES-256 encryption. R2 credentials are held only by the backend; uploads pass through the API and downloads are served through pre-signed URLs with a one-hour expiry. R2 keys are randomly generated UUIDs to prevent enumeration.

- **Auditability.** Every state-changing action is recorded in the `AuditLog` collection with actor, action type, target resource, and timestamp. Audit logs are immutable from application code and surfaced to the LGC through the governance dashboard.

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm 9 or higher
- A MongoDB instance (local or MongoDB Atlas)
- A Cloudflare R2 bucket and API credentials (required for document upload)
- A Resend API key (required for email delivery)
- An OpenAI API key (required for the assistant chatbot)

### Backend

```
cd backend
npm install
cp .env.example .env   # if a .env.example is present; otherwise see Environment Variables below
npm run dev
```

The API will start on the port specified by `PORT` (default 5000) and expose Swagger UI at `/api/docs`.

### Frontend

In a separate terminal:

```
cd frontend
npm install
cp .env.example .env   # configure VITE_API_URL to point at the backend
npm run dev
```

Vite will start the development server on `http://localhost:5173` by default.

## Environment Variables

The backend expects the following environment variables. Local development uses a `.env` file at the root of `backend/`; production values are configured directly in Vercel.

| Variable | Purpose |
| --- | --- |
| `PORT` | Port the API listens on |
| `MONGO_URI` | MongoDB connection string |
| `JWT_ACCESS_SECRET` | Signing secret for short-lived access tokens |
| `JWT_REFRESH_SECRET` | Signing secret for refresh tokens |
| `JWT_ACCESS_EXPIRES_IN` | Access token lifetime (e.g., `15m`) |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token lifetime (e.g., `7d`) |
| `CORS_ORIGIN` | Comma-separated list of allowed frontend origins |
| `R2_ACCOUNT_ID` | Cloudflare R2 account identifier |
| `R2_ACCESS_KEY_ID` | R2 access key ID |
| `R2_SECRET_ACCESS_KEY` | R2 secret access key |
| `R2_BUCKET_NAME` | Name of the R2 bucket holding applicant documents |
| `RESEND_API_KEY` | API key for transactional email |
| `RESEND_FROM_EMAIL` | Verified sender address (e.g., `no-reply@lrfap.com`) |
| `OPENAI_API_KEY` | API key for the assistant chatbot |
| `FRONTEND_URL` | Public URL of the frontend, used in email links |

The frontend expects:

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | Base URL of the backend API (e.g., `http://localhost:5000/api`) |

## API Documentation

Interactive OpenAPI documentation is generated from JSDoc annotations and served at:

```
GET /api/docs
```

In production: https://lrfap-backend.vercel.app/api/docs

The Swagger UI lists every endpoint grouped by resource (auth, applications, programs, match, etc.) with request and response schemas, parameter descriptions, and example payloads. Endpoints requiring authentication can be exercised directly from the UI by supplying a bearer token.

## Testing

Validation of the platform spans three complementary efforts:

- **Functional testing.** Each user story (account management, profile completion, document upload, application submission, university review, ranking, match execution, result publication, notifications) was exercised end to end across all three roles to confirm correct behavior under role-based access constraints.
- **API testing.** A Postman collection covering every endpoint was maintained alongside development to verify request and response shapes, status codes, and authentication flows.
- **Performance testing.** k6 load scripts simulate concurrent traffic against the most demanding endpoints (application submission, document upload, dashboard aggregation, match execution) to validate non-functional requirements around throughput and latency under peak conditions such as deadlines and result publication.

Test cases and execution evidence for both functional and non-functional requirements are documented in the project's final report.

## Deployment

Both the frontend and backend are deployed to Vercel and configured with GitHub-based continuous deployment: every push to `main` triggers a production build and rollout. The backend runs as serverless functions and lazily connects to MongoDB on cold start to remain compatible with serverless lifecycle constraints. TLS is terminated at Vercel's edge, and the production API is reachable at the URLs listed in [Live Deployments](#live-deployments).

The custom domain `lrfap.com` is registered and managed through Cloudflare; DNS records authorize the Resend sender domain so transactional email is delivered with verified DKIM and SPF.

## Author and Supervision

**Author:** Nour Diab — `nour.diab09@lau.edu`
Department of Computer Science and Mathematics, School of Arts and Sciences, Lebanese American University.

**Capstone Supervisor:** Dr. Ibrahim El Bitar.

This project was developed as the final capstone for **CSC 599** (Spring 2026).

## Disclaimer

LRFAP is an academic capstone project developed for the partial fulfillment of the Bachelor of Science in Computer Science degree at the Lebanese American University. The platform is not affiliated with, endorsed by, or officially connected to any university, governmental body, ministry, or institution referenced in the project documentation. It is presented strictly for academic and demonstration purposes and does not represent an officially deployed national system.
