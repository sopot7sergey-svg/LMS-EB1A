import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import caseRoutes from './routes/cases';
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
const PORT = process.env.PORT || 3001;

// Allow localhost on any port during development (web app may use 3000, 3001, 3002, 3003, 3004, etc.)
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map((u) => u.trim())
  : [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:3003',
      'http://localhost:3004',
      'http://localhost:3005',
    ];

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
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/cases', caseRoutes);
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

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

async function main() {
  try {
    await prisma.$connect();
    console.log('Connected to database');

    const { AIGateway } = await import('./services/ai/gateway');
    AIGateway.logStartupDiagnostics();

    app.listen(PORT, () => {
      console.log(`API server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();

export { prisma };
