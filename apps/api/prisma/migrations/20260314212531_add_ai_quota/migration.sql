-- CreateTable
CREATE TABLE "AIQuotaPolicy" (
    "id" TEXT NOT NULL,
    "plan" "AppPlan" NOT NULL,
    "advisorChatCallLimit" INTEGER NOT NULL DEFAULT 10,
    "documentReviewLimit" INTEGER NOT NULL DEFAULT 5,
    "finalAuditLimit" INTEGER NOT NULL DEFAULT 3,
    "coverLetterGenerateLimit" INTEGER NOT NULL DEFAULT 2,
    "monthlyCostLimitUsd" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIQuotaPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIUsagePeriod" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "advisorChatCalls" INTEGER NOT NULL DEFAULT 0,
    "documentReviewCalls" INTEGER NOT NULL DEFAULT 0,
    "finalAuditCalls" INTEGER NOT NULL DEFAULT 0,
    "coverLetterGenerates" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIUsagePeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIUsageLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "model" TEXT,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AIQuotaPolicy_plan_key" ON "AIQuotaPolicy"("plan");

-- CreateIndex
CREATE UNIQUE INDEX "AIUsagePeriod_userId_key" ON "AIUsagePeriod"("userId");

-- CreateIndex
CREATE INDEX "AIUsagePeriod_userId_idx" ON "AIUsagePeriod"("userId");

-- CreateIndex
CREATE INDEX "AIUsagePeriod_periodEnd_idx" ON "AIUsagePeriod"("periodEnd");

-- CreateIndex
CREATE INDEX "AIUsageLog_userId_idx" ON "AIUsageLog"("userId");

-- CreateIndex
CREATE INDEX "AIUsageLog_createdAt_idx" ON "AIUsageLog"("createdAt");

-- AddForeignKey
ALTER TABLE "AIUsagePeriod" ADD CONSTRAINT "AIUsagePeriod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIUsageLog" ADD CONSTRAINT "AIUsageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
