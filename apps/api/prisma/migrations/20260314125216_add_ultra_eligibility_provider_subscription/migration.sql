-- AlterTable
ALTER TABLE "AppAccess" ADD COLUMN     "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "providerSubscriptionId" TEXT;

-- CreateTable
CREATE TABLE "UltraEligibilityRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,

    CONSTRAINT "UltraEligibilityRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UltraEligibilityRequest_userId_idx" ON "UltraEligibilityRequest"("userId");

-- CreateIndex
CREATE INDEX "UltraEligibilityRequest_status_idx" ON "UltraEligibilityRequest"("status");

-- AddForeignKey
ALTER TABLE "UltraEligibilityRequest" ADD CONSTRAINT "UltraEligibilityRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
