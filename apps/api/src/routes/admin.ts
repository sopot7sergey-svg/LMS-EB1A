import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import {
  getAccess,
  grantStartAfterCoursePurchase,
  lockAppAccess,
  resetDevices,
  setProPlan,
  setStartPlan,
  setUltraPlan,
  unlockAppAccess,
} from '../services/access';

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
      include: {
        courseEntitlement: true,
        appAccess: true,
        _count: {
          select: {
            cases: true,
            lessonProgress: { where: { completed: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const withAccess = await Promise.all(
      users.map(async (u) => {
        const access = await getAccess(u.id);
        return {
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role,
          suspended: u.suspended,
          uploadEnabled: u.uploadEnabled,
          createdAt: u.createdAt,
          courseEntitlement: u.courseEntitlement,
          appAccess: u.appAccess,
          appAccessActive: access.appAccessActive,
          plan: access.plan,
          planStatus: access.planStatus,
          expiresAt: access.expiresAt,
          maxCases: access.maxCases,
          caseCount: access.caseCount,
          deviceCount: access.deviceCount,
          deviceLimit: access.deviceLimit,
          _count: u._count,
        };
      })
    );

    res.json(withAccess);
  } catch (error) {
    console.error('Get admin users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

router.get('/users/:id', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        courseEntitlement: true,
        appAccess: true,
        deviceAccesses: { where: { active: true } },
        _count: { select: { cases: true } },
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const access = await getAccess(user.id);
    res.json({
      ...user,
      appAccessActive: access.appAccessActive,
      plan: access.plan,
      planStatus: access.planStatus,
      expiresAt: access.expiresAt,
      maxCases: access.maxCases,
      uploadEnabled: user.uploadEnabled,
    });
  } catch (error) {
    console.error('Get admin user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
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

router.patch('/users/:id/suspend', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { suspended } = req.body;
    if (typeof suspended !== 'boolean') {
      return res.status(400).json({ error: 'suspended must be a boolean' });
    }
    const user = await prisma.user.update({
      where: { id },
      data: { suspended },
      select: { id: true, email: true, suspended: true },
    });
    res.json(user);
  } catch (error) {
    console.error('Suspend user error:', error);
    res.status(500).json({ error: 'Failed to update suspend status' });
  }
});

router.post('/users/:id/reset-devices', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    await resetDevices(id);
    res.json({ message: 'Devices reset. User can log in from new devices.' });
  } catch (error) {
    console.error('Reset devices error:', error);
    res.status(500).json({ error: 'Failed to reset devices' });
  }
});

router.post('/users/:id/grant-course', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    await grantStartAfterCoursePurchase(id);
    res.json({ message: 'Course + Start plan granted' });
  } catch (error) {
    console.error('Grant course error:', error);
    res.status(500).json({ error: 'Failed to grant course' });
  }
});

router.post('/users/:id/set-ultra', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { billingCycle } = req.body;
    await setUltraPlan(id, billingCycle === 'annual' ? 'annual' : 'monthly');
    const access = await getAccess(id);
    res.json({ message: 'User upgraded to Ultra', plan: access.plan });
  } catch (error) {
    console.error('Set Ultra error:', error);
    res.status(500).json({ error: 'Failed to set Ultra plan' });
  }
});

router.post('/users/:id/set-start', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    await setStartPlan(id);
    const access = await getAccess(id);
    res.json({ message: 'User set to Start plan', plan: access.plan });
  } catch (error) {
    console.error('Set Start error:', error);
    res.status(500).json({ error: 'Failed to set Start plan' });
  }
});

router.post('/users/:id/set-pro', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { billingCycle } = req.body;
    await setProPlan(id, billingCycle === 'annual' ? 'annual' : 'monthly');
    const access = await getAccess(id);
    res.json({ message: 'User set to Pro plan', plan: access.plan });
  } catch (error) {
    console.error('Set Pro error:', error);
    res.status(500).json({ error: 'Failed to set Pro plan' });
  }
});

router.post('/users/:id/lock-access', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    await lockAppAccess(id);
    const access = await getAccess(id);
    res.json({ message: 'App access locked', appAccessActive: access.appAccessActive });
  } catch (error) {
    console.error('Lock access error:', error);
    res.status(500).json({ error: 'Failed to lock app access' });
  }
});

router.post('/users/:id/unlock-access', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    await unlockAppAccess(id);
    const access = await getAccess(id);
    res.json({ message: 'App access unlocked', appAccessActive: access.appAccessActive });
  } catch (error) {
    console.error('Unlock access error:', error);
    res.status(500).json({ error: 'Failed to unlock app access' });
  }
});

/** GET /ultra-requests - list Ultra eligibility requests */
router.get('/ultra-requests', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const requests = await prisma.ultraEligibilityRequest.findMany({
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
      orderBy: { requestedAt: 'desc' },
    });
    res.json(requests);
  } catch (error) {
    console.error('Get ultra requests error:', error);
    res.status(500).json({ error: 'Failed to get Ultra requests' });
  }
});

/** PATCH /ultra-requests/:id/approve - approve Ultra request */
router.patch('/ultra-requests/:id/approve', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const request = await prisma.ultraEligibilityRequest.findUnique({ where: { id } });
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'pending') {
      return res.status(400).json({ error: `Request already ${request.status}` });
    }
    const adminId = req.user!.id;
    await prisma.ultraEligibilityRequest.update({
      where: { id },
      data: { status: 'approved', approvedAt: new Date(), approvedById: adminId },
    });
    await setUltraPlan(request.userId, 'monthly');
    res.json({ message: 'Ultra request approved', userId: request.userId });
  } catch (error) {
    console.error('Approve Ultra request error:', error);
    res.status(500).json({ error: 'Failed to approve Ultra request' });
  }
});

/** PATCH /ultra-requests/:id/reject - reject Ultra request */
router.patch('/ultra-requests/:id/reject', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const request = await prisma.ultraEligibilityRequest.findUnique({ where: { id } });
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'pending') {
      return res.status(400).json({ error: `Request already ${request.status}` });
    }
    const adminId = req.user!.id;
    await prisma.ultraEligibilityRequest.update({
      where: { id },
      data: { status: 'rejected', approvedAt: new Date(), approvedById: adminId },
    });
    res.json({ message: 'Ultra request rejected' });
  } catch (error) {
    console.error('Reject Ultra request error:', error);
    res.status(500).json({ error: 'Failed to reject Ultra request' });
  }
});

export default router;
