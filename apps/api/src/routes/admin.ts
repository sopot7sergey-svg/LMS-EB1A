import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.get('/dashboard', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [totalUsers, totalCases, totalLessons, recentActivity] = await Promise.all([
      prisma.user.count({ where: { role: 'student' } }),
      prisma.case.count(),
      prisma.lesson.count({ where: { isActive: true } }),
      prisma.lessonProgress.findMany({
        where: { completed: true },
        orderBy: { completedAt: 'desc' },
        take: 10,
        include: {
          user: { select: { id: true, name: true, email: true } },
          lesson: { select: { id: true, title: true } },
        },
      }),
    ]);

    res.json({
      stats: { totalUsers, totalCases, totalLessons },
      recentActivity,
    });
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({ error: 'Failed to get dashboard data' });
  }
});

router.get('/modules', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const modules = await prisma.module.findMany({
      include: {
        lessons: { orderBy: { order: 'asc' } },
        _count: { select: { lessons: true } },
      },
      orderBy: { order: 'asc' },
    });

    res.json(modules);
  } catch (error) {
    console.error('Get admin modules error:', error);
    res.status(500).json({ error: 'Failed to get modules' });
  }
});

router.post('/modules', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { title, description, order } = req.body;

    const module = await prisma.module.create({
      data: { title, description, order: order || 0 },
    });

    res.status(201).json(module);
  } catch (error) {
    console.error('Create module error:', error);
    res.status(500).json({ error: 'Failed to create module' });
  }
});

router.patch('/modules/:id', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { title, description, order, isActive } = req.body;

    const module = await prisma.module.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(order !== undefined && { order }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    res.json(module);
  } catch (error) {
    console.error('Update module error:', error);
    res.status(500).json({ error: 'Failed to update module' });
  }
});

router.delete('/modules/:id', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    await prisma.module.delete({ where: { id } });

    res.json({ message: 'Module deleted successfully' });
  } catch (error) {
    console.error('Delete module error:', error);
    res.status(500).json({ error: 'Failed to delete module' });
  }
});

router.get('/lessons', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { moduleId } = req.query;

    const where = moduleId ? { moduleId: moduleId as string } : {};

    const lessons = await prisma.lesson.findMany({
      where,
      include: {
        module: { select: { id: true, title: true } },
      },
      orderBy: [{ module: { order: 'asc' } }, { order: 'asc' }],
    });

    res.json(lessons);
  } catch (error) {
    console.error('Get admin lessons error:', error);
    res.status(500).json({ error: 'Failed to get lessons' });
  }
});

router.post('/lessons', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { moduleId, title, description, videoUrl, videoEmbed, order } = req.body;

    if (!moduleId || !title) {
      return res.status(400).json({ error: 'Module ID and title are required' });
    }

    const lesson = await prisma.lesson.create({
      data: {
        moduleId,
        title,
        description,
        videoUrl,
        videoEmbed,
        order: order || 0,
      },
    });

    res.status(201).json(lesson);
  } catch (error) {
    console.error('Create lesson error:', error);
    res.status(500).json({ error: 'Failed to create lesson' });
  }
});

router.patch('/lessons/:id', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { title, description, videoUrl, videoEmbed, order, isActive } = req.body;

    const lesson = await prisma.lesson.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(videoUrl !== undefined && { videoUrl }),
        ...(videoEmbed !== undefined && { videoEmbed }),
        ...(order !== undefined && { order }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    res.json(lesson);
  } catch (error) {
    console.error('Update lesson error:', error);
    res.status(500).json({ error: 'Failed to update lesson' });
  }
});

router.delete('/lessons/:id', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    await prisma.lesson.delete({ where: { id } });

    res.json({ message: 'Lesson deleted successfully' });
  } catch (error) {
    console.error('Delete lesson error:', error);
    res.status(500).json({ error: 'Failed to delete lesson' });
  }
});

router.patch('/lessons/:id/video', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { videoUrl, videoEmbed } = req.body;

    const lesson = await prisma.lesson.update({
      where: { id },
      data: { videoUrl, videoEmbed },
    });

    res.json(lesson);
  } catch (error) {
    console.error('Update video error:', error);
    res.status(500).json({ error: 'Failed to update video' });
  }
});

router.get('/users', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        uploadEnabled: true,
        createdAt: true,
        _count: {
          select: {
            cases: true,
            lessonProgress: { where: { completed: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(users);
  } catch (error) {
    console.error('Get admin users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

router.patch('/users/:id/upload-access', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { uploadEnabled } = req.body;

    if (typeof uploadEnabled !== 'boolean') {
      return res.status(400).json({ error: 'uploadEnabled must be a boolean' });
    }

    const user = await prisma.user.update({
      where: { id },
      data: { uploadEnabled },
      select: { id: true, email: true, name: true, role: true, uploadEnabled: true },
    });

    res.json(user);
  } catch (error) {
    console.error('Update user upload access error:', error);
    res.status(500).json({ error: 'Failed to update user upload access' });
  }
});

router.patch('/users/:id/role', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['student', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const user = await prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, email: true, name: true, role: true },
    });

    res.json(user);
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

export default router;
