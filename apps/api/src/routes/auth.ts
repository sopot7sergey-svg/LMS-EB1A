import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getAccess, grantAccessFromCode, registerDevice } from '../services/access';

const router = Router();
const prisma = new PrismaClient();

router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('name').trim().notEmpty(),
    body('accessCode').optional().trim(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, name, accessCode } = req.body;

      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return res.status(400).json({ error: 'Этот email уже зарегистрирован' });
      }

      let codeRecord: { grantCourseAccess: boolean; grantStartAccess: boolean; startDurationDays: number } | null = null;

      if (accessCode && typeof accessCode === 'string' && accessCode.trim()) {
        const trimmed = accessCode.trim();
        const found = await prisma.accessCode.findUnique({
          where: { code: trimmed },
        });
        if (!found) {
          return res.status(400).json({ error: 'Неверный код доступа. Проверьте код и попробуйте снова.' });
        }
        if (found.status !== 'active') {
          return res.status(400).json({ error: `Этот код доступа уже использован или недействителен (статус: ${found.status}).` });
        }
        codeRecord = {
          grantCourseAccess: found.grantCourseAccess,
          grantStartAccess: found.grantStartAccess,
          startDurationDays: found.startDurationDays,
        };
      }

      const hashedPassword = await bcrypt.hash(password, 12);
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          role: 'student',
        },
        select: { id: true, email: true, name: true, role: true, uploadEnabled: true },
      });

      if (codeRecord) {
        const updated = await prisma.accessCode.updateMany({
          where: { code: accessCode.trim(), status: 'active' },
          data: { status: 'used', usedByUserId: user.id, usedAt: new Date() },
        });
        if (updated.count === 0) {
          await prisma.user.delete({ where: { id: user.id } });
          return res.status(400).json({ error: 'Этот код доступа уже использован.' });
        }
        await grantAccessFromCode(user.id, {
          courseAccess: codeRecord.grantCourseAccess,
          startAccess: codeRecord.grantStartAccess,
          startDurationDays: codeRecord.startDurationDays,
        });
      }

      const access = await getAccess(user.id);
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '7d' }
      );

      res.status(201).json({
        user: {
          ...user,
          appAccessActive: access.appAccessActive,
          plan: access.plan,
          planStatus: access.planStatus,
          expiresAt: access.expiresAt,
          maxCases: access.maxCases,
          caseCount: access.caseCount,
          courseAccess: access.courseAccess,
        },
        token,
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Ошибка регистрации' });
    }
  }
);

router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return res.status(401).json({ error: 'Неверный email или пароль' });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Неверный email или пароль' });
      }

      if (user.suspended) {
        return res.status(403).json({ error: 'Аккаунт приостановлен. Обратитесь к администратору.' });
      }

      const deviceId = req.body.deviceId as string | undefined;
      if (deviceId) {
        const deviceResult = await registerDevice(user.id, deviceId);
        if (!deviceResult.allowed) {
          return res.status(403).json({ error: deviceResult.message ?? 'Достигнут лимит устройств' });
        }
      }

      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '7d' }
      );

      const access = user.role === 'admin' ? null : await getAccess(user.id);
      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          uploadEnabled: user.uploadEnabled,
          ...(access && {
            appAccessActive: access.appAccessActive,
            courseAccess: access.courseAccess,
            plan: access.plan,
            planStatus: access.planStatus,
            expiresAt: access.expiresAt,
            maxCases: access.maxCases,
            caseCount: access.caseCount,
          }),
        },
        token,
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Ошибка входа' });
    }
  }
);

router.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        uploadEnabled: true,
        suspended: true,
        createdAt: true,
        courseEntitlement: true,
        appAccess: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const access = await getAccess(req.user!.id);
    res.json({
      ...user,
      appAccessActive: access.appAccessActive,
      courseAccess: access.courseAccess,
      plan: access.plan,
      planStatus: access.planStatus,
      expiresAt: access.expiresAt,
      maxCases: access.maxCases,
      caseCount: access.caseCount,
      deviceCount: access.deviceCount,
      deviceLimit: access.deviceLimit,
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Не удалось получить данные пользователя' });
  }
});

router.post('/logout', authenticate, (req, res) => {
  res.json({ message: 'Выход выполнен' });
});

export default router;
