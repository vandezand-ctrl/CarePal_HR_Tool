import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import swaggerUi from 'swagger-ui-express';

const here = path.dirname(fileURLToPath(import.meta.url));
// openapi.yaml lives next to this file in src/. In production build, we ship
// it with the dist/ output via a copy step; for dev, tsx resolves from src/.
const specPath = fs.existsSync(path.join(here, 'openapi.yaml'))
  ? path.join(here, 'openapi.yaml')
  : path.join(here, '..', 'openapi.yaml');

const specText = fs.readFileSync(specPath, 'utf8');
const spec = YAML.parse(specText) as Record<string, unknown>;

export const docsRouter = Router();

// Raw JSON — for external tools (Postman import, etc.)
docsRouter.get('/api/docs.json', (_req, res) => {
  res.json(spec);
});

// Swagger UI — public, no auth needed
docsRouter.use('/api/docs', swaggerUi.serve, swaggerUi.setup(spec, {
  customSiteTitle: 'CarePal HR Admin — API docs',
}));
