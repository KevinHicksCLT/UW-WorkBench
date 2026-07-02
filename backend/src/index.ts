/**
 * Backend entry point — loads .env, then boots the Express app on PORT (:4000).
 */
import 'dotenv/config';
import app from './app.js';
import { logger } from './lib/logger.js';

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => {
  logger.info(`Cascade backend listening on http://localhost:${PORT}`);
});
