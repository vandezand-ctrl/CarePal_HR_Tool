import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { healthRouter } from './routes/health.js';
import { requisitionsRouter } from './routes/requisitions.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use(healthRouter);
app.use(requisitionsRouter);

app.listen(config.port, () => {
  console.log(`[carepal-backend] listening on http://localhost:${config.port}`);
  console.log(`[carepal-backend] env: ${config.nodeEnv}`);
});
