-- CreateTable
CREATE TABLE "CompileJob" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "options" JSONB NOT NULL DEFAULT '{}',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompileJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompileArtifact" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "filePath" TEXT NOT NULL,
    "optionsHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompileArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompileArtifact_jobId_key" ON "CompileArtifact"("jobId");

-- AddForeignKey
ALTER TABLE "CompileJob" ADD CONSTRAINT "CompileJob_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompileArtifact" ADD CONSTRAINT "CompileArtifact_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "CompileJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
