-- CreateTable
CREATE TABLE "AccessCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "usedByUserId" TEXT,
    "usedAt" TIMESTAMP(3),
    "grantCourseAccess" BOOLEAN NOT NULL DEFAULT true,
    "grantStartAccess" BOOLEAN NOT NULL DEFAULT true,
    "startDurationDays" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccessCode_code_key" ON "AccessCode"("code");

-- CreateIndex
CREATE INDEX "AccessCode_code_idx" ON "AccessCode"("code");

-- CreateIndex
CREATE INDEX "AccessCode_status_idx" ON "AccessCode"("status");
