-- AlterEnum
ALTER TYPE "SubmissionStatus" ADD VALUE 'APPROVED_WITH_RESERVATIONS';

-- AlterTable
ALTER TABLE "submissions" ADD COLUMN     "decisionReason" TEXT;
