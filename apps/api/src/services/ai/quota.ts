/**
 * AI usage quota: plan limits, cost estimation, check before / record after.
 */

import { PrismaClient } from '@prisma/client';
import type { AppPlan } from '@prisma/client';

const prisma = new PrismaClient();

export type AIFeature = 'advisor_chat' | 'document_review' | 'final_audit' | 'cover_letter_generate';

// Cost per 1M tokens (USD). MVP defaults for common models.
const COST_PER_1M: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4': { input: 30, output: 60 },
  'gpt-4-turbo': { input: 10, output: 30 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
  'gpt-5.4': { input: 2.5, output: 10 },
  'gpt-5': { input: 2.5, output: 10 },
};

const DEFAULT_COST = { input: 2.5, output: 10 };

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const costs = COST_PER_1M[model] ?? DEFAULT_COST;
  const inputCost = (inputTokens / 1_000_000) * costs.input;
  const outputCost = (outputTokens / 1_000_000) * costs.output;
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000;
}

// Plan limits (MVP defaults)
const DEFAULT_POLICY = {
  start: {
    advisorChatCallLimit: 5,
    documentReviewLimit: 3,
    finalAuditLimit: 2,
    coverLetterGenerateLimit: 1,
    monthlyCostLimitUsd: 2.0,
  },
  pro: {
    advisorChatCallLimit: 25,
    documentReviewLimit: 15,
    finalAuditLimit: 10,
    coverLetterGenerateLimit: 5,
    monthlyCostLimitUsd: 15.0,
  },
  ultra: {
    advisorChatCallLimit: 100,
    documentReviewLimit: 50,
    finalAuditLimit: 30,
    coverLetterGenerateLimit: 20,
    monthlyCostLimitUsd: 50.0,
  },
  none: {
    advisorChatCallLimit: 0,
    documentReviewLimit: 0,
    finalAuditLimit: 0,
    coverLetterGenerateLimit: 0,
    monthlyCostLimitUsd: 0,
  },
};

async function getPolicyForPlan(plan: AppPlan) {
  const row = await prisma.aIQuotaPolicy.findUnique({ where: { plan } });
  if (row) {
    return {
      advisorChatCallLimit: row.advisorChatCallLimit,
      documentReviewLimit: row.documentReviewLimit,
      finalAuditLimit: row.finalAuditLimit,
      coverLetterGenerateLimit: row.coverLetterGenerateLimit,
      monthlyCostLimitUsd: row.monthlyCostLimitUsd,
    };
  }
  const def = DEFAULT_POLICY[plan === 'start' || plan === 'pro' || plan === 'ultra' ? plan : 'none'];
  return def;
}

function getPeriodBounds(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

export interface QuotaCheckResult {
  allowed: boolean;
  message?: string;
  policy?: Record<string, number>;
  usage?: Record<string, number>;
}

export async function checkQuota(
  userId: string,
  feature: AIFeature,
  plan: AppPlan,
  appAccessActive: boolean,
  options?: { increment?: number }
): Promise<QuotaCheckResult> {
  if (!appAccessActive) {
    return { allowed: false, message: 'App access is not active. Upgrade your plan to use AI features.' };
  }

  const policy = await getPolicyForPlan(plan);
  const limitKey =
    feature === 'advisor_chat'
      ? 'advisorChatCallLimit'
      : feature === 'document_review'
        ? 'documentReviewLimit'
        : feature === 'final_audit'
          ? 'finalAuditLimit'
          : 'coverLetterGenerateLimit';
  const limit = policy[limitKey as keyof typeof policy] ?? 0;
  const costLimit = policy.monthlyCostLimitUsd ?? 0;

  if (limit <= 0 || costLimit <= 0) {
    return { allowed: false, message: 'Your plan does not include AI features. Upgrade to Start, Pro, or Ultra.' };
  }

  const { start, end } = getPeriodBounds();
  let period = await prisma.aIUsagePeriod.findUnique({ where: { userId } });

  if (!period || period.periodEnd < new Date()) {
    period = await prisma.aIUsagePeriod.upsert({
      where: { userId },
      create: {
        userId,
        periodStart: start,
        periodEnd: end,
      },
      update: {
        periodStart: start,
        periodEnd: end,
        advisorChatCalls: 0,
        documentReviewCalls: 0,
        finalAuditCalls: 0,
        coverLetterGenerates: 0,
        estimatedCostUsd: 0,
      },
    });
  }

  const usageKey =
    feature === 'advisor_chat'
      ? 'advisorChatCalls'
      : feature === 'document_review'
        ? 'documentReviewCalls'
        : feature === 'final_audit'
          ? 'finalAuditCalls'
          : 'coverLetterGenerates';
  const currentCount = period[usageKey as keyof typeof period] as number;
  const currentCost = period.estimatedCostUsd;
  const increment = options?.increment ?? 1;

  if (currentCount + increment > limit) {
    return {
      allowed: false,
      message: increment > 1
        ? `Document review limit reached. You have ${limit - currentCount} reviews left this month, but requested ${increment}. Limits reset at the start of next month.`
        : `You have reached your ${feature.replace(/_/g, ' ')} limit for this month (${limit}). Limits reset at the start of next month.`,
      policy: { [limitKey]: limit },
      usage: { [usageKey]: currentCount },
    };
  }

  if (currentCost >= costLimit) {
    return {
      allowed: false,
      message: `You have reached your monthly AI cost limit ($${costLimit.toFixed(2)}). Limits reset at the start of next month.`,
      policy: { monthlyCostLimitUsd: costLimit },
      usage: { estimatedCostUsd: currentCost },
    };
  }

  return { allowed: true };
}

export async function recordUsage(
  userId: string,
  feature: AIFeature,
  model: string,
  inputTokens: number,
  outputTokens: number
): Promise<void> {
  const cost = estimateCostUsd(model, inputTokens, outputTokens);
  const { start, end } = getPeriodBounds();

  await prisma.aIUsageLog.create({
    data: {
      userId,
      feature,
      model,
      inputTokens,
      outputTokens,
      estimatedCostUsd: cost,
    },
  });

  const period = await prisma.aIUsagePeriod.findUnique({ where: { userId } });
  const isCurrentPeriod = period && period.periodEnd >= new Date();

  if (!period || !isCurrentPeriod) {
    await prisma.aIUsagePeriod.upsert({
      where: { userId },
      create: {
        userId,
        periodStart: start,
        periodEnd: end,
        advisorChatCalls: feature === 'advisor_chat' ? 1 : 0,
        documentReviewCalls: feature === 'document_review' ? 1 : 0,
        finalAuditCalls: feature === 'final_audit' ? 1 : 0,
        coverLetterGenerates: feature === 'cover_letter_generate' ? 1 : 0,
        estimatedCostUsd: cost,
      },
      update: {
        periodStart: start,
        periodEnd: end,
        advisorChatCalls: feature === 'advisor_chat' ? 1 : 0,
        documentReviewCalls: feature === 'document_review' ? 1 : 0,
        finalAuditCalls: feature === 'final_audit' ? 1 : 0,
        coverLetterGenerates: feature === 'cover_letter_generate' ? 1 : 0,
        estimatedCostUsd: cost,
      },
    });
  } else {
    const updates: Record<string, unknown> = { estimatedCostUsd: { increment: cost } };
    if (feature === 'advisor_chat') updates.advisorChatCalls = { increment: 1 };
    else if (feature === 'document_review') updates.documentReviewCalls = { increment: 1 };
    else if (feature === 'final_audit') updates.finalAuditCalls = { increment: 1 };
    else if (feature === 'cover_letter_generate') updates.coverLetterGenerates = { increment: 1 };
    await prisma.aIUsagePeriod.update({
      where: { userId },
      data: updates as any,
    });
  }
}

export interface UsageSummary {
  plan: string;
  periodStart: string;
  periodEnd: string;
  advisorChatCalls: number;
  documentReviewCalls: number;
  finalAuditCalls: number;
  coverLetterGenerates: number;
  estimatedCostUsd: number;
  limits: {
    advisorChatCallLimit: number;
    documentReviewLimit: number;
    finalAuditLimit: number;
    coverLetterGenerateLimit: number;
    monthlyCostLimitUsd: number;
  };
  nearOrAtLimit: boolean;
  blocked: boolean;
}

export async function getUsageSummary(userId: string, plan: AppPlan): Promise<UsageSummary> {
  const policy = await getPolicyForPlan(plan);
  const { start, end } = getPeriodBounds();

  let period = await prisma.aIUsagePeriod.findUnique({ where: { userId } });
  if (!period || period.periodEnd < new Date()) {
    period = {
      id: '',
      userId,
      periodStart: start,
      periodEnd: end,
      advisorChatCalls: 0,
      documentReviewCalls: 0,
      finalAuditCalls: 0,
      coverLetterGenerates: 0,
      estimatedCostUsd: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  const atChat = period.advisorChatCalls >= policy.advisorChatCallLimit;
  const atReview = period.documentReviewCalls >= policy.documentReviewLimit;
  const atAudit = period.finalAuditCalls >= policy.finalAuditLimit;
  const atCover = period.coverLetterGenerates >= policy.coverLetterGenerateLimit;
  const atCost = period.estimatedCostUsd >= policy.monthlyCostLimitUsd;
  const nearChat = period.advisorChatCalls >= policy.advisorChatCallLimit * 0.8;
  const nearCost = period.estimatedCostUsd >= policy.monthlyCostLimitUsd * 0.8;

  return {
    plan,
    periodStart: period.periodStart.toISOString(),
    periodEnd: period.periodEnd.toISOString(),
    advisorChatCalls: period.advisorChatCalls,
    documentReviewCalls: period.documentReviewCalls,
    finalAuditCalls: period.finalAuditCalls,
    coverLetterGenerates: period.coverLetterGenerates,
    estimatedCostUsd: period.estimatedCostUsd,
    limits: {
      advisorChatCallLimit: policy.advisorChatCallLimit,
      documentReviewLimit: policy.documentReviewLimit,
      finalAuditLimit: policy.finalAuditLimit,
      coverLetterGenerateLimit: policy.coverLetterGenerateLimit,
      monthlyCostLimitUsd: policy.monthlyCostLimitUsd,
    },
    nearOrAtLimit: atChat || atReview || atAudit || atCover || atCost || nearChat || nearCost,
    blocked: atChat || atReview || atAudit || atCover || atCost,
  };
}
