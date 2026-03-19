/**
 * Access service: course entitlement, app plan, upload, case limits, device limits.
 * Keeps concerns separate: identity, course, app subscription, upload, case limit, device.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type AppPlan = 'none' | 'start' | 'pro' | 'ultra';

export interface AccessResult {
  userId: string;
  role: string;
  suspended: boolean;
  courseAccess: boolean;
  appAccessActive: boolean;
  plan: AppPlan;
  planStatus: string;
  expiresAt: Date | null;
  maxCases: number;
  uploadEnabled: boolean;
  caseCount: number;
  deviceCount: number;
  deviceLimit: number;
}

const PLAN_MAX_CASES: Record<AppPlan, number> = {
  none: 0,
  start: 3,
  pro: 3,
  ultra: 5,
};

const PLAN_UPLOAD_DEFAULT: Record<AppPlan, boolean> = {
  none: false,
  start: false,
  pro: false,
  ultra: true,
};

export async function getAccess(userId: string): Promise<AccessResult> {
  const [user, activeDeviceCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: {
        courseEntitlement: true,
        appAccess: true,
        _count: { select: { cases: true } },
      },
    }),
    prisma.deviceAccess.count({ where: { userId, active: true } }),
  ]);

  if (!user) {
    throw new Error('User not found');
  }

  const courseAccess = !!user.courseEntitlement;
  const app = user.appAccess;
  const now = new Date();
  const isActive =
    app?.status === 'active' &&
    (!app.expiresAt || app.expiresAt > now);
  const plan = (app?.plan ?? 'none') as AppPlan;
  const maxCases = isActive ? PLAN_MAX_CASES[plan] : 0;
  const uploadEnabled = user.uploadEnabled;
  const deviceLimit = 2;

  return {
    userId: user.id,
    role: user.role,
    suspended: user.suspended,
    courseAccess,
    appAccessActive: isActive && !user.suspended,
    plan,
    planStatus: app?.status ?? 'expired',
    expiresAt: app?.expiresAt ?? null,
    maxCases,
    uploadEnabled,
    caseCount: user._count.cases,
    deviceCount: activeDeviceCount,
    deviceLimit,
  };
}

export function canCreateCase(access: AccessResult): boolean {
  if (!access.appAccessActive || access.suspended) return false;
  return access.caseCount < access.maxCases;
}

export function canUpload(access: AccessResult): boolean {
  return access.uploadEnabled && access.appAccessActive && !access.suspended;
}

export function canAccessApp(access: AccessResult): boolean {
  return access.appAccessActive && !access.suspended;
}

export function canAccessCourse(access: AccessResult): boolean {
  return access.courseAccess && !access.suspended;
}

/** Grant access from a valid access code (course + Start plan). */
export async function grantAccessFromCode(
  userId: string,
  options: { courseAccess: boolean; startAccess: boolean; startDurationDays: number }
): Promise<void> {
  const { courseAccess, startAccess, startDurationDays } = options;

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + startDurationDays);

  await prisma.$transaction(async (tx) => {
    if (courseAccess) {
      await tx.courseEntitlement.upsert({
        where: { userId },
        create: { userId, purchasedAt: new Date(), activatedAt: new Date() },
        update: {},
      });
    }
    if (startAccess) {
      await tx.appAccess.upsert({
        where: { userId },
        create: {
          userId,
          plan: 'start',
          status: 'active',
          startedAt: new Date(),
          expiresAt,
          maxCases: 3,
          uploadEnabled: false,
        },
        update: {
          plan: 'start',
          status: 'active',
          startedAt: new Date(),
          expiresAt,
          maxCases: 3,
          uploadEnabled: false,
        },
      });
    }
  });
}

/** Grant Start plan (30 days) after course purchase. */
export async function grantStartAfterCoursePurchase(userId: string): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  await prisma.$transaction(async (tx) => {
    await tx.courseEntitlement.upsert({
      where: { userId },
      create: { userId, purchasedAt: new Date(), activatedAt: new Date() },
      update: {},
    });
    await tx.appAccess.upsert({
      where: { userId },
      create: {
        userId,
        plan: 'start',
        status: 'active',
        startedAt: new Date(),
        expiresAt,
        maxCases: 3,
        uploadEnabled: false,
      },
      update: {
        plan: 'start',
        status: 'active',
        startedAt: new Date(),
        expiresAt,
        maxCases: 3,
        uploadEnabled: false,
      },
    });
  });
}

/** Set user to Pro plan (monthly). Upload off by default. */
export async function setProPlan(userId: string, billingCycle: 'monthly' | 'annual' = 'monthly'): Promise<void> {
  const now = new Date();
  const expiresAt = new Date();
  if (billingCycle === 'annual') {
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  } else {
    expiresAt.setMonth(expiresAt.getMonth() + 1);
  }

  await prisma.$transaction([
    prisma.appAccess.upsert({
      where: { userId },
      create: {
        userId,
        plan: 'pro',
        status: 'active',
        startedAt: now,
        expiresAt,
        billingCycle: billingCycle as any,
        autoRenew: true,
        maxCases: 3,
        uploadEnabled: false,
      },
      update: {
        plan: 'pro',
        status: 'active',
        startedAt: now,
        expiresAt,
        billingCycle: billingCycle as any,
        autoRenew: true,
        maxCases: 3,
        uploadEnabled: false,
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { uploadEnabled: false },
    }),
  ]);
}

/** Set user to Ultra plan (admin approval). */
export async function setUltraPlan(userId: string, billingCycle: 'monthly' | 'annual' = 'monthly'): Promise<void> {
  const now = new Date();
  const expiresAt = new Date();
  if (billingCycle === 'annual') {
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  } else {
    expiresAt.setMonth(expiresAt.getMonth() + 1);
  }

  await prisma.$transaction(async (tx) => {
    await tx.appAccess.upsert({
      where: { userId },
      create: {
        userId,
        plan: 'ultra',
        status: 'active',
        startedAt: now,
        expiresAt,
        billingCycle: billingCycle as any,
        autoRenew: true,
        maxCases: 5,
        uploadEnabled: true,
      },
      update: {
        plan: 'ultra',
        status: 'active',
        startedAt: now,
        expiresAt,
        billingCycle: billingCycle as any,
        autoRenew: true,
        maxCases: 5,
        uploadEnabled: true,
      },
    });
    await tx.user.update({
      where: { id: userId },
      data: { uploadEnabled: true },
    });
  });
}

/** Register or update device. Returns true if within limit. */
export async function registerDevice(
  userId: string,
  deviceId: string,
  label?: string
): Promise<{ allowed: boolean; message?: string }> {
  const access = await getAccess(userId);
  if (access.suspended) {
    return { allowed: false, message: 'Аккаунт приостановлен' };
  }

  const existing = await prisma.deviceAccess.findUnique({
    where: { userId_deviceId: { userId, deviceId } },
  });

  if (existing) {
    await prisma.deviceAccess.update({
      where: { id: existing.id },
      data: { lastSeenAt: new Date(), active: true },
    });
    return { allowed: true };
  }

  const activeCount = await prisma.deviceAccess.count({
    where: { userId, active: true },
  });

  if (activeCount >= access.deviceLimit) {
    return {
      allowed: false,
      message: `Достигнут лимит устройств (${access.deviceLimit}). Обратитесь к администратору для сброса.`,
    };
  }

  await prisma.deviceAccess.create({
    data: {
      userId,
      deviceId,
      label: label ?? `Device ${activeCount + 1}`,
    },
  });
  return { allowed: true };
}

/** Sync AppAccess and SubscriptionRecord from billing provider webhook. */
export interface SubscriptionSyncInput {
  userId: string;
  plan?: AppPlan;
  status?: string;
  expiresAt?: Date | null;
  providerSubscriptionId?: string | null;
  cancelAtPeriodEnd?: boolean;
  customerId?: string | null;
  billingCycle?: 'monthly' | 'annual';
}

export async function syncSubscriptionFromProvider(
  eventType: string,
  data: Record<string, unknown>
): Promise<void> {
  // Stripe-specific parsing (only provider we have)
  if (eventType === 'checkout.session.completed') {
    const session = data as { customer?: string; subscription?: string; metadata?: Record<string, string> };
    const userId = session.metadata?.userId;
    const plan = (session.metadata?.plan as AppPlan) || 'pro';
    const billingCycle = (session.metadata?.billingCycle as 'monthly' | 'annual') || 'monthly';
    if (!userId || !session.subscription) return;

    const subId = typeof session.subscription === 'string' ? session.subscription : (session.subscription as { id?: string })?.id;
    const customerId = typeof session.customer === 'string' ? session.customer : (session.customer as { id?: string } | undefined)?.id;
    if (!subId) return;

    const expiresAt = new Date();
    if (billingCycle === 'annual') {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    } else {
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    }

    await applySubscriptionSync({
      userId,
      plan,
      status: 'active',
      providerSubscriptionId: subId,
      customerId: customerId ?? undefined,
      billingCycle,
      expiresAt,
    });
    return;
  }

  if (eventType === 'customer.subscription.updated' || eventType === 'customer.subscription.deleted') {
    const sub = data as {
      id?: string;
      customer?: string;
      status?: string;
      cancel_at_period_end?: boolean;
      current_period_end?: number;
      metadata?: Record<string, string>;
    };
    const subId = sub.id;
    if (!subId) return;

    const record = await prisma.subscriptionRecord.findFirst({
      where: { externalSubscriptionId: subId },
    });
    const userId = record?.userId ?? sub.metadata?.userId;
    if (!userId) return;

    const expiresAt = sub.current_period_end ? new Date(sub.current_period_end * 1000) : undefined;
    const cancelAtPeriodEnd = sub.cancel_at_period_end ?? false;
    const status = eventType === 'customer.subscription.deleted' ? 'canceled' : mapStripeStatus(sub.status);

    await applySubscriptionSync({
      userId,
      status,
      expiresAt: expiresAt ?? null,
      providerSubscriptionId: subId,
      cancelAtPeriodEnd,
    });
    return;
  }
}

function mapStripeStatus(s: string | undefined): string {
  if (s === 'active') return 'active';
  if (s === 'canceled' || s === 'unpaid') return 'canceled';
  if (s === 'past_due') return 'grace';
  return s ?? 'expired';
}

async function applySubscriptionSync(input: SubscriptionSyncInput): Promise<void> {
  const now = new Date();
  const plan = input.plan ?? 'pro';
  const maxCases = plan === 'ultra' ? 5 : 3;
  const uploadEnabled = plan === 'ultra';

  await prisma.$transaction(async (tx) => {
    await tx.appAccess.upsert({
      where: { userId: input.userId },
      create: {
        userId: input.userId,
        plan,
        status: (input.status as any) ?? 'active',
        startedAt: now,
        expiresAt: input.expiresAt ?? undefined,
        billingCycle: input.billingCycle as any,
        autoRenew: input.status !== 'canceled',
        cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
        providerSubscriptionId: input.providerSubscriptionId ?? undefined,
        maxCases,
        uploadEnabled: plan === 'ultra',
      },
      update: {
        ...(input.plan !== undefined && { plan: input.plan }),
        ...(input.status !== undefined && { status: input.status as any }),
        ...(input.expiresAt !== undefined && { expiresAt: input.expiresAt }),
        ...(input.providerSubscriptionId !== undefined && { providerSubscriptionId: input.providerSubscriptionId }),
        ...(input.cancelAtPeriodEnd !== undefined && { cancelAtPeriodEnd: input.cancelAtPeriodEnd }),
        ...(input.status === 'canceled' && { autoRenew: false }),
        maxCases,
        uploadEnabled: plan === 'ultra',
      },
    });

    if (input.customerId || input.providerSubscriptionId) {
      const existing = input.providerSubscriptionId
        ? await tx.subscriptionRecord.findFirst({
            where: { externalSubscriptionId: input.providerSubscriptionId },
          })
        : await tx.subscriptionRecord.findFirst({
            where: { userId: input.userId },
            orderBy: { createdAt: 'desc' },
          });
      if (existing) {
        await tx.subscriptionRecord.update({
          where: { id: existing.id },
          data: {
            externalCustomerId: input.customerId ?? existing.externalCustomerId,
            externalSubscriptionId: input.providerSubscriptionId ?? existing.externalSubscriptionId,
            status: input.status ?? existing.status,
            nextBillingDate: input.expiresAt ?? existing.nextBillingDate,
            ...(input.status === 'canceled' && { canceledAt: new Date() }),
          },
        });
      } else {
        await tx.subscriptionRecord.create({
          data: {
            userId: input.userId,
            providerName: 'stripe',
            externalCustomerId: input.customerId ?? undefined,
            externalSubscriptionId: input.providerSubscriptionId ?? undefined,
            productType: 'subscription',
            planType: input.plan ?? 'pro',
            status: input.status ?? 'active',
            nextBillingDate: input.expiresAt ?? undefined,
          },
        });
      }
    }
  });

  if (plan === 'ultra') {
    await prisma.user.update({
      where: { id: input.userId },
      data: { uploadEnabled: true },
    });
  }
}

/** Admin: reset all devices for user. */
export async function resetDevices(userId: string): Promise<void> {
  await prisma.deviceAccess.updateMany({
    where: { userId },
    data: { active: false },
  });
}

/** Set user to Start plan (30 days, no upload). Admin manual control. */
export async function setStartPlan(userId: string): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  await prisma.appAccess.upsert({
    where: { userId },
    create: {
      userId,
      plan: 'start',
      status: 'active',
      startedAt: new Date(),
      expiresAt,
      maxCases: 3,
      uploadEnabled: false,
    },
    update: {
      plan: 'start',
      status: 'active',
      startedAt: new Date(),
      expiresAt,
      maxCases: 3,
      uploadEnabled: false,
    },
  });
  await prisma.user.update({
    where: { id: userId },
    data: { uploadEnabled: false },
  });
}

/** Lock app access: set status to expired. User cannot access My Case. */
export async function lockAppAccess(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.appAccess.upsert({
      where: { userId },
      create: {
        userId,
        plan: 'none',
        status: 'expired',
        maxCases: 0,
        uploadEnabled: false,
      },
      update: {
        status: 'expired',
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { uploadEnabled: false },
    }),
  ]);
}

/** Unlock app access: set status to active. Extends expiresAt if in the past. Creates Start plan if none exists. */
export async function unlockAppAccess(userId: string): Promise<void> {
  const app = await prisma.appAccess.findUnique({
    where: { userId },
  });
  const now = new Date();
  let expiresAt: Date;

  if (app) {
    expiresAt = app.expiresAt ?? new Date();
    if (expiresAt <= now) {
      expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    }
    await prisma.appAccess.update({
      where: { userId },
      data: { status: 'active', expiresAt },
    });
  } else {
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    await prisma.appAccess.create({
      data: {
        userId,
        plan: 'start',
        status: 'active',
        startedAt: now,
        expiresAt,
        maxCases: 3,
        uploadEnabled: false,
      },
    });
  }
}
