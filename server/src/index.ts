import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { initDb, serverRoot } from './db.js';
import { trafficLogger } from './middleware/auth.js';
import { authRouter } from './routes/auth.js';
import { serverAdminRouter } from './routes/serverAdmin.js';
import { headAdminRouter } from './routes/headAdmin.js';
import { lobbyRouter } from './routes/lobby.js';
import { clubsRouter } from './routes/clubs.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Database
initDb();

// Upload directory setup
const uploadsDir = path.join(serverRoot, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}


// Middleware
app.use(cors({
  origin: '*',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(trafficLogger); // Log all requests for Server Admin dashboard

// Serve static uploads
app.use('/uploads', express.static(uploadsDir));

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/server-admin', serverAdminRouter);
app.use('/api/head-admin', headAdminRouter);
app.use('/api/lobby', lobbyRouter);
app.use('/api/clubs', clubsRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Serve client production build if available
const clientDistDir = path.join(serverRoot, '..', 'client', 'dist');
const altClientDistDir = path.join(process.cwd(), 'client', 'dist');
const targetDist = fs.existsSync(clientDistDir) ? clientDistDir : fs.existsSync(altClientDistDir) ? altClientDistDir : null;


if (targetDist) {
  app.use(express.static(targetDist, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    }
  }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(targetDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`🚀 DFMC Moyoung Server running on http://localhost:${PORT}`);
});
