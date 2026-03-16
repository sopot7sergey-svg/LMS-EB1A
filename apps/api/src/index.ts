import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import caseRoutes from './routes/cases';
import accountRoutes from './routes/account';
import billingRoutes, { webhookHandler } from './routes/billing';
import plansRoutes from './routes/plans';
import moduleRoutes from './routes/modules';
import lessonRoutes from './routes/lessons';
import progressRoutes from './routes/progress';
import documentRoutes from './routes/documents';
import chatRoutes from './routes/chat';
import adminRoutes from './routes/admin';
import aiRoutes from './routes/ai';
import eerRoutes from './routes/eer';
import advisorChatRoutes from './routes/advisor-chat';
import packetReviewRoutes from './routes/packet-review';

dotenv.config();

const app = express();
const prisma = new PrismaClient();

const PREFERRED_PORT = parseInt(process.env.PORT || '3001', 10);
const PORT_RANGE = [3001, 3002, 3003, 3004, 3005, 24601, 24602, 24603, 24604, 24605];

// Allow localhost on any port during development (web app may use 3000, 3001, 3002, 3003, 3004, etc.)
const baseOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map((u) => u.trim()).filter(Boolean)
  : [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:3003',
      'http://localhost:3004',
      'http://localhost:3005',
      'http://localhost:24601',
      'http://localhost:24602',
      'http://localhost:24603',
      'http://localhost:24604',
      'http://localhost:24605',
    ];

const productionWebOrigin = 'https://aipasweb-production.up.railway.app';
const productionCustomDomain = 'https://madeinaiusa.com';
const allowedOrigins = [...new Set([...baseOrigins, productionWebOrigin, productionCustomDomain])];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || /^http:\/\/localhost:\d+$/.test(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
}));
// Webhook needs raw body for Stripe signature verification (must be before express.json)
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }), webhookHandler);
app.use(express.json());

// Public health endpoints (must be before any auth-protected /api routes)
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/plans', plansRoutes);
app.use('/api/modules', moduleRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/eer', eerRoutes);
app.use('/api/advisor-chat', advisorChatRoutes);
app.use('/api', packetReviewRoutes);

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

function writeDevPortFile(port: number) {
  try {
    const projectRoot = path.resolve(process.cwd(), '..', '..');
    const portFile = path.join(projectRoot, '.dev-api-port');
    fs.writeFileSync(portFile, String(port), 'utf8');
  } catch {
    // Ignore if we can't write (e.g. production)
  }
}

function tryListen(ports: number[], index: number): void {
  const port = ports[index];
  if (port === undefined) {
    // Last resort: let OS assign a free port (port 0)
    const server = app.listen(0, () => {
      const actualPort = (server.address() as { port: number }).port;
      console.log(`API server running on port ${actualPort} (all preferred ports in use)`);
      writeDevPortFile(actualPort);
    });
    server.on('error', (err: NodeJS.ErrnoException) => {
      console.error('Server error:', err);
      process.exit(1);
    });
    return;
  }
  const server = app.listen(port, () => {
    const actualPort = (server.address() as { port: number }).port;
    console.log(`API server running on port ${actualPort}`);
    writeDevPortFile(actualPort);
  });
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      server.close();
      setImmediate(() => tryListen(ports, index + 1));
    } else {
      console.error('Server error:', err);
      process.exit(1);
    }
  });
}

async function main() {
  try {
    await prisma.$connect();
    console.log('Connected to database');

    const { AIGateway } = await import('./services/ai/gateway');
    AIGateway.logStartupDiagnostics();

    const portsToTry = [
      PREFERRED_PORT,
      ...PORT_RANGE.filter((p) => p !== PREFERRED_PORT),
    ];
    tryListen(portsToTry, 0);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();

export { prisma };
