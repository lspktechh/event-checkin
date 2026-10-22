-- AlterTable
ALTER TABLE "hands_on_registrations"
  ADD COLUMN "paymentId" VARCHAR(100),
  ADD COLUMN "paymentUrl" TEXT,
  ADD COLUMN "paymentQrCodeContent" TEXT,
  ADD COLUMN "paymentQrCodeBase64" TEXT,
  ADD COLUMN "paymentExpiresAt" TIMESTAMP(3),
  ADD COLUMN "paidAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "hands_on_registrations_paymentId_idx" ON "hands_on_registrations"("paymentId");

-- AlterTable
ALTER TABLE "events"
  ADD COLUMN "mpAccessToken" TEXT,
  ADD COLUMN "mpPublicKey" TEXT,
  ADD COLUMN "mpWebhookSecret" TEXT;
