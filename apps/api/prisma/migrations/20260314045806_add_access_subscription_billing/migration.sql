-- CreateEnum
CREATE TYPE "AppPlan" AS ENUM ('none', 'start', 'pro', 'ultra');

-- CreateEnum
CREATE TYPE "AppPlanStatus" AS ENUM ('active', 'expired', 'canceled', 'grace');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('monthly', 'annual');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "suspended" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "CourseEntitlement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseEntitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "AppPlan" NOT NULL DEFAULT 'none',
    "status" "AppPlanStatus" NOT NULL DEFAULT 'expired',
    "startedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "billingCycle" "BillingCycle",
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "maxCases" INTEGER NOT NULL DEFAULT 3,
    "uploadEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "providerName" TEXT,
    "externalCustomerId" TEXT,
    "externalSubscriptionId" TEXT,
    "productType" TEXT,
    "planType" TEXT,
    "status" TEXT,
    "nextBillingDate" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "label" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourseEntitlement_userId_key" ON "CourseEntitlement"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AppAccess_userId_key" ON "AppAccess"("userId");

-- CreateIndex
CREATE INDEX "SubscriptionRecord_userId_idx" ON "SubscriptionRecord"("userId");

-- CreateIndex
CREATE INDEX "DeviceAccess_userId_idx" ON "DeviceAccess"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceAccess_userId_deviceId_key" ON "DeviceAccess"("userId", "deviceId");

-- AddForeignKey
ALTER TABLE "CourseEntitlement" ADD CONSTRAINT "CourseEntitlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppAccess" ADD CONSTRAINT "AppAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionRecord" ADD CONSTRAINT "SubscriptionRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceAccess" ADD CONSTRAINT "DeviceAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
