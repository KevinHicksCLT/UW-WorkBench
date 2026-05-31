// Vercel serverless entrypoint — serves the Express app behind /api/*.
// The `rewrites` rule in vercel.json sends every /api/(.*) request here, and
// Express mounts its routers under /api, so the URL Express sees matches dev.
import app from '../backend/src/app.js';

export default app;
