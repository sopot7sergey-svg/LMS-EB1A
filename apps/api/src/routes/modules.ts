import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const modules = await prisma.module.findMany({
      where: { isActive: true },
      include: {
        lessons: {
          where: { isActive: true },
          orderBy: { order: 'asc' },
          select: {
            id: true,
            title: true,
            description: true,
            order: true,
            videoUrl: true,
          },
        },
        _count: { select: { lessons: true } },
      },
      orderBy: { order: 'asc' },
    });

    res.json(modules);
  } catch (error) {
    console.error('Get modules error:', error);
    res.status(500).json({ error: 'Failed to get modules' });
  }
});

router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const module = await prisma.module.findUnique({
      where: { id },
      include: {
        lessons: {
          where: { isActive: true },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!module) {
      return res.status(404).json({ error: 'Module not found' });
    }

    res.json(module);
  } catch (error) {
    console.error('Get module error:', error);
    res.status(500).json({ error: 'Failed to get module' });
  }
});

router.get('/:id/progress', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const progress = await prisma.moduleProgress.findUnique({
      where: {
        userId_moduleId: {
          userId: req.user!.id,
          moduleId: id,
        },
      },
    });

    const module = await prisma.module.findUnique({
      where: { id },
      include: {
        lessons: { where: { isActive: true }, select: { id: true } },
      },
    });

    if (!module) {
      return res.status(404).json({ error: 'Module not found' });
    }

    const totalLessons = module.lessons.length;
    const completedLessons = progress?.lessonsCompleted.length || 0;

    res.json({
      moduleId: id,
      totalLessons,
      completedLessons,
      percentage: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
      artifactGenerated: progress?.artifactGenerated || false,
      completedAt: progress?.completedAt,
    });
  } catch (error) {
    console.error('Get module progress error:', error);
    res.status(500).json({ error: 'Failed to get module progress' });
  }
});

export default router;
