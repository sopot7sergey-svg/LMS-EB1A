import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { canAccessCourse, getAccess } from '../services/access';

const router = Router();
const prisma = new PrismaClient();

router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    if (req.user!.role !== 'admin') {
      const access = await getAccess(req.user!.id);
      if (!canAccessCourse(access)) {
        return res.status(403).json({ error: 'Course access required. Purchase the course to view lessons.' });
      }
    }

    const lesson = await prisma.lesson.findUnique({
      where: { id },
      include: {
        module: { select: { id: true, title: true } },
      },
    });

    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    const progress = await prisma.lessonProgress.findUnique({
      where: {
        userId_lessonId: {
          userId: req.user!.id,
          lessonId: id,
        },
      },
    });

    res.json({
      ...lesson,
      completed: progress?.completed || false,
      completedAt: progress?.completedAt,
    });
  } catch (error) {
    console.error('Get lesson error:', error);
    res.status(500).json({ error: 'Failed to get lesson' });
  }
});

router.post('/:id/complete', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    if (req.user!.role !== 'admin') {
      const access = await getAccess(req.user!.id);
      if (!canAccessCourse(access)) {
        return res.status(403).json({ error: 'Course access required.' });
      }
    }

    const lesson = await prisma.lesson.findUnique({
      where: { id },
      include: { module: true },
    });

    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    const lessonProgress = await prisma.lessonProgress.upsert({
      where: {
        userId_lessonId: {
          userId: req.user!.id,
          lessonId: id,
        },
      },
      update: {
        completed: true,
        completedAt: new Date(),
      },
      create: {
        userId: req.user!.id,
        lessonId: id,
        completed: true,
        completedAt: new Date(),
      },
    });

    const moduleProgress = await prisma.moduleProgress.upsert({
      where: {
        userId_moduleId: {
          userId: req.user!.id,
          moduleId: lesson.moduleId,
        },
      },
      update: {
        lessonsCompleted: {
          push: id,
        },
      },
      create: {
        userId: req.user!.id,
        moduleId: lesson.moduleId,
        lessonsCompleted: [id],
      },
    });

    const allLessons = await prisma.lesson.findMany({
      where: { moduleId: lesson.moduleId, isActive: true },
      select: { id: true },
    });

    const uniqueCompleted = [...new Set(moduleProgress.lessonsCompleted)];
    const allCompleted = allLessons.every((l) => uniqueCompleted.includes(l.id));

    if (allCompleted && !moduleProgress.completedAt) {
      await prisma.moduleProgress.update({
        where: { id: moduleProgress.id },
        data: { completedAt: new Date() },
      });
    }

    res.json({
      lessonProgress,
      moduleProgress: {
        ...moduleProgress,
        lessonsCompleted: uniqueCompleted,
      },
    });
  } catch (error) {
    console.error('Complete lesson error:', error);
    res.status(500).json({ error: 'Failed to complete lesson' });
  }
});

router.post('/:id/uncomplete', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    if (req.user!.role !== 'admin') {
      const access = await getAccess(req.user!.id);
      if (!canAccessCourse(access)) {
        return res.status(403).json({ error: 'Course access required.' });
      }
    }

    await prisma.lessonProgress.update({
      where: {
        userId_lessonId: {
          userId: req.user!.id,
          lessonId: id,
        },
      },
      data: {
        completed: false,
        completedAt: null,
      },
    });

    const lesson = await prisma.lesson.findUnique({ where: { id } });
    if (lesson) {
      const moduleProgress = await prisma.moduleProgress.findUnique({
        where: {
          userId_moduleId: {
            userId: req.user!.id,
            moduleId: lesson.moduleId,
          },
        },
      });

      if (moduleProgress) {
        await prisma.moduleProgress.update({
          where: { id: moduleProgress.id },
          data: {
            lessonsCompleted: moduleProgress.lessonsCompleted.filter((l) => l !== id),
            completedAt: null,
          },
        });
      }
    }

    res.json({ message: 'Lesson marked as incomplete' });
  } catch (error) {
    console.error('Uncomplete lesson error:', error);
    res.status(500).json({ error: 'Failed to uncomplete lesson' });
  }
});

export default router;
