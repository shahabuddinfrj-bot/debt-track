import express from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  app.use(express.json({ limit: '10mb' }));

  const dataDir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const dbFile = path.join(dataDir, 'db.json');

  // API endpoints for centralized cross-origin and cross-tab sync
  app.get('/api/sync', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');

    if (fs.existsSync(dbFile)) {
      try {
        const content = fs.readFileSync(dbFile, 'utf-8');
        return res.json(JSON.parse(content));
      } catch (e) {
        return res.json({});
      }
    }
    return res.json({});
  });

  app.post('/api/sync', (req, res) => {
    try {
      fs.writeFileSync(dbFile, JSON.stringify(req.body, null, 2), 'utf-8');
      return res.json({ success: true });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // Health check endpoint for Cloud Run container liveness probe
  app.get('/healthz', (req, res) => {
    res.status(200).send('OK');
  });

  // Serve static assets from public folder
  const publicDir = path.resolve(process.cwd(), 'public');
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
  }

  const distDir = path.resolve(process.cwd(), 'dist');
  const distIndex = path.join(distDir, 'index.html');

  if (process.env.NODE_ENV === 'production' && fs.existsSync(distIndex)) {
    app.use(express.static(distDir));
    app.get('*', (req, res) => {
      res.sendFile(distIndex);
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
