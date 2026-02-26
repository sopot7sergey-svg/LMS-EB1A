import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.get('/threads', authenticate, async (req: AuthRequest, res) => {
  try {
    const where = req.user!.role === 'admin'
      ? {}
      : { studentId: req.user!.id };

    const threads = await prisma.chatThread.findMany({
      where,
      include: {
        student: { select: { id: true, name: true, email: true } },
        admin: { select: { id: true, name: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json(threads);
  } catch (error) {
    console.error('Get threads error:', error);
    res.status(500).json({ error: 'Failed to get threads' });
  }
});

router.post('/threads', authenticate, async (req: AuthRequest, res) => {
  try {
    const { subject } = req.body;

    const thread = await prisma.chatThread.create({
      data: {
        studentId: req.user!.id,
        subject,
        status: 'open',
      },
      include: {
        student: { select: { id: true, name: true, email: true } },
      },
    });

    res.status(201).json(thread);
  } catch (error) {
    console.error('Create thread error:', error);
    res.status(500).json({ error: 'Failed to create thread' });
  }
});

router.get('/threads/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const thread = await prisma.chatThread.findUnique({
      where: { id },
      include: {
        student: { select: { id: true, name: true, email: true } },
        admin: { select: { id: true, name: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            sender: { select: { id: true, name: true, role: true } },
          },
        },
      },
    });

    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    if (req.user!.role !== 'admin' && thread.studentId !== req.user!.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(thread);
  } catch (error) {
    console.error('Get thread error:', error);
    res.status(500).json({ error: 'Failed to get thread' });
  }
});

router.post('/threads/:id/messages', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    const thread = await prisma.chatThread.findUnique({ where: { id } });
    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    if (req.user!.role !== 'admin' && thread.studentId !== req.user!.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const message = await prisma.chatMessage.create({
      data: {
        threadId: id,
        senderId: req.user!.id,
        senderRole: req.user!.role,
        content: content.trim(),
      },
      include: {
        sender: { select: { id: true, name: true, role: true } },
      },
    });

    if (req.user!.role === 'admin' && !thread.adminId) {
      await prisma.chatThread.update({
        where: { id },
        data: { adminId: req.user!.id },
      });
    }

    await prisma.chatThread.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    res.status(201).json(message);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

router.patch('/threads/:id/close', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const thread = await prisma.chatThread.findUnique({ where: { id } });
    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    if (req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can close threads' });
    }

    const updated = await prisma.chatThread.update({
      where: { id },
      data: { status: 'closed' },
    });

    res.json(updated);
  } catch (error) {
    console.error('Close thread error:', error);
    res.status(500).json({ error: 'Failed to close thread' });
  }
});

router.patch('/threads/:id/reopen', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const thread = await prisma.chatThread.findUnique({ where: { id } });
    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    if (req.user!.role !== 'admin' && thread.studentId !== req.user!.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updated = await prisma.chatThread.update({
      where: { id },
      data: { status: 'open' },
    });

    res.json(updated);
  } catch (error) {
    console.error('Reopen thread error:', error);
    res.status(500).json({ error: 'Failed to reopen thread' });
  }
});

export default router;
