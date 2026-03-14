-- CreateTable
CREATE TABLE "DocumentBuilderState" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL DEFAULT 's1',
    "slotType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "inputModes" TEXT[],
    "answers" JSONB NOT NULL DEFAULT '{}',
    "sourceDocumentIds" TEXT[],
    "draftJson" JSONB,
    "draftText" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "lastGeneratedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentBuilderState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentBuilderState_caseId_idx" ON "DocumentBuilderState"("caseId");

-- CreateIndex
CREATE INDEX "DocumentBuilderState_userId_idx" ON "DocumentBuilderState"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentBuilderState_caseId_slotType_key" ON "DocumentBuilderState"("caseId", "slotType");

-- AddForeignKey
ALTER TABLE "DocumentBuilderState" ADD CONSTRAINT "DocumentBuilderState_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentBuilderState" ADD CONSTRAINT "DocumentBuilderState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
