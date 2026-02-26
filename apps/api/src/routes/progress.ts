import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.get('/overall', authenticate, async (req: AuthRequest, res) => {
  try {
    const totalLessons = await prisma.lesson.count({
      where: { isActive: true },
    });

    const completedLessons = await prisma.lessonProgress.count({
      where: {
        userId: req.user!.id,
        completed: true,
      },
    });

    const moduleProgress = await prisma.moduleProgress.findMany({
      where: { userId: req.user!.id },
      include: {
        module: { select: { id: true, title: true, order: true } },
      },
      orderBy: { module: { order: 'asc' } },
    });

    res.json({
      totalLessons,
      completedLessons,
      percentage: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
      moduleProgress,
    });
  } catch (error) {
    console.error('Get overall progress error:', error);
    res.status(500).json({ error: 'Failed to get overall progress' });
  }
});

router.get('/modules', authenticate, async (req: AuthRequest, res) => {
  try {
    const modules = await prisma.module.findMany({
      where: { isActive: true },
      include: {
        lessons: {
          where: { isActive: true },
          select: { id: true },
        },
        progress: {
          where: { userId: req.user!.id },
        },
      },
      orderBy: { order: 'asc' },
    });

    const progressData = modules.map((module) => {
      const progress = module.progress[0];
      const totalLessons = module.lessons.length;
      const completedLessons = progress?.lessonsCompleted.length || 0;

      return {
        moduleId: module.id,
        moduleTitle: module.title,
        moduleOrder: module.order,
        totalLessons,
        completedLessons,
        percentage: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
        artifactGenerated: progress?.artifactGenerated || false,
        completedAt: progress?.completedAt,
      };
    });

    res.json(progressData);
  } catch (error) {
    console.error('Get modules progress error:', error);
    res.status(500).json({ error: 'Failed to get modules progress' });
  }
});

router.get('/lessons', authenticate, async (req: AuthRequest, res) => {
  try {
    const { moduleId } = req.query;

    const lessonProgress = await prisma.lessonProgress.findMany({
      where: { userId: req.user!.id },
      select: { lessonId: true, completed: true, completedAt: true },
    });

    // Build a fast lookup map: lessonId -> { completed, completedAt }
    const completionMap: Record<string, { completed: boolean; completedAt: Date | null }> = {};
    for (const lp of lessonProgress) {
      completionMap[lp.lessonId] = { completed: lp.completed, completedAt: lp.completedAt };
    }

    // If moduleId filter requested, return lessons for that module with completion status
    if (moduleId) {
      const lessons = await prisma.lesson.findMany({
        where: { moduleId: moduleId as string, isActive: true },
        orderBy: { order: 'asc' },
      });

      const result = lessons.map((lesson) => ({
        ...lesson,
        completed: completionMap[lesson.id]?.completed ?? false,
        completedAt: completionMap[lesson.id]?.completedAt ?? null,
      }));

      return res.json(result);
    }

    res.json(lessonProgress);
  } catch (error) {
    console.error('Get lessons progress error:', error);
    res.status(500).json({ error: 'Failed to get lessons progress' });
  }
});

export default router;
