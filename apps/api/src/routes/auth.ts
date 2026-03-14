import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getAccess, registerDevice } from '../services/access';

const router = Router();
const prisma = new PrismaClient();

router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('name').trim().notEmpty(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, name } = req.body;

      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return res.status(400).json({ error: 'Email already registered' });
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

      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '7d' }
      );

      res.status(201).json({ user, token });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
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
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      if (user.suspended) {
        return res.status(403).json({ error: 'Account suspended. Contact admin.' });
      }

      const deviceId = req.body.deviceId as string | undefined;
      if (deviceId) {
        const deviceResult = await registerDevice(user.id, deviceId);
        if (!deviceResult.allowed) {
          return res.status(403).json({ error: deviceResult.message ?? 'Device limit reached' });
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
      res.status(500).json({ error: 'Login failed' });
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
      return res.status(404).json({ error: 'User not found' });
    }

    const access = await getAccess(req.user!.id);
    res.json({
      ...user,
      appAccessActive: access.appAccessActive,
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
    res.status(500).json({ error: 'Failed to get user' });
  }
});

router.post('/logout', authenticate, (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

export default router;
