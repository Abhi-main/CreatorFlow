import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import pool from './config/db.js';
import { errorHandler } from './middleware/errorHandler.js';
import { verifyToken } from './middleware/auth.js';
import { upload } from './middleware/upload.js';
import { initSocket } from './socket/index.js';

import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import teamRoutes from './routes/team.routes.js';
import accountRoutes from './routes/account.routes.js';
import postRoutes from './routes/post.routes.js';
import scheduleRoutes from './routes/schedule.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import campaignRoutes from './routes/campaign.routes.js';
import hashtagRoutes from './routes/hashtag.routes.js';
import adminRoutes from './routes/admin.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import metaRoutes from './routes/meta.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const httpServer = createServer(app);
const PORT = parseInt(process.env.PORT, 10) || 5000;

const configuredOrigins = String(process.env.FRONTEND_URL || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const allowedOrigins = new Set([
  ...configuredOrigins,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
].filter(Boolean));

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;

  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== 'https:') return false;
    return hostname.endsWith('.vercel.app');
  } catch {
    return false;
  }
}

export const io = new Server(httpServer, {
  cors: {
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) return callback(null, true);
      return callback(new Error('Not allowed by Socket.io CORS'));
    },
    credentials: true,
  },
});

initSocket(io);

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use((req, res, next) => {
  req.io = io;
  next();
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

async function handleMediaUpload(req, res, next) {
  try {
    const teamId = req.user.team_id;
    const userId = req.user.user_id || req.user.sub || req.user.id;
    const files = req.files || [];
    const saved = [];

    if (!teamId || !userId) {
      return res.status(401).json({ success: false, error: 'Invalid upload session', code: 401 });
    }

    for (const file of files) {
      const publicUrl = `/uploads/${file.filename}`;
      const [result] = await pool.query(
        `INSERT INTO MediaFiles
           (team_id, uploaded_by, file_name, original_name, mime_type, size_bytes, public_url, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
        [teamId, userId, file.filename, file.originalname, file.mimetype, file.size, publicUrl]
      );
      saved.push({
        media_id: result.insertId,
        url: publicUrl,
        mime_type: file.mimetype,
        original_name: file.originalname,
      });
    }

    res.json({ success: true, data: saved, message: 'Media uploaded' });
  } catch (err) {
    next(err);
  }
}

app.post('/api/media', verifyToken, upload.array('files', 10), handleMediaUpload);
app.post('/api/uploads/media', verifyToken, upload.array('files', 10), handleMediaUpload);

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/hashtags', hashtagRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/meta', metaRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found', code: 404 });
});

app.use(errorHandler);

await import('./jobs/postPublisher.js');
await import('./jobs/weeklyRollup.js');

httpServer.listen(PORT, () => {
  console.log(`Server + Socket.io running on port ${PORT}`);
});
