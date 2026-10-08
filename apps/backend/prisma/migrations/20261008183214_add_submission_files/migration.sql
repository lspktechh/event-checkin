-- CreateTable
CREATE TABLE "submission_files" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT,
    "fileSizeBytes" INTEGER,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submission_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "submission_files_submissionId_idx" ON "submission_files"("submissionId");

-- AddForeignKey
ALTER TABLE "submission_files" ADD CONSTRAINT "submission_files_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migracao de dados: copia o arquivo unico dos trabalhos ja existentes para
-- a nova tabela (position 0). Nao destrutivo — as colunas fileKey/fileName/
-- fileSizeBytes de "submissions" permanecem (legadas, so para rollback).
INSERT INTO "submission_files" ("id", "submissionId", "fileKey", "fileName", "fileSizeBytes", "position", "createdAt")
SELECT gen_random_uuid()::text, "id", "fileKey", "fileName", "fileSizeBytes", 0, CURRENT_TIMESTAMP
FROM "submissions"
WHERE "fileKey" IS NOT NULL;
