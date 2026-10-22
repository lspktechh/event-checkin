-- CreateTable
CREATE TABLE "hands_on_registrations" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "handsOnId" VARCHAR(100) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "speaker" VARCHAR(150) NOT NULL,
    "date" VARCHAR(50) NOT NULL,
    "time" VARCHAR(50) NOT NULL,
    "location" VARCHAR(200),
    "sponsor" VARCHAR(100),
    "amount" DECIMAL(10,2) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "email" VARCHAR(200) NOT NULL,
    "document" VARCHAR(50) NOT NULL,
    "phone" VARCHAR(50),
    "category" VARCHAR(100),
    "institution" VARCHAR(200),
    "status" VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    "qrToken" VARCHAR(100) NOT NULL,
    "checkedInAt" TIMESTAMP(3),
    "checkedInBy" VARCHAR(100),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hands_on_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hands_on_registrations_qrToken_key" ON "hands_on_registrations"("qrToken");

-- CreateIndex
CREATE INDEX "hands_on_registrations_eventId_idx" ON "hands_on_registrations"("eventId");

-- CreateIndex
CREATE INDEX "hands_on_registrations_handsOnId_idx" ON "hands_on_registrations"("handsOnId");

-- CreateIndex
CREATE INDEX "hands_on_registrations_document_idx" ON "hands_on_registrations"("document");

-- CreateIndex
CREATE INDEX "hands_on_registrations_email_idx" ON "hands_on_registrations"("email");

-- CreateIndex
CREATE INDEX "hands_on_registrations_status_idx" ON "hands_on_registrations"("status");

-- AddForeignKey
ALTER TABLE "hands_on_registrations" ADD CONSTRAINT "hands_on_registrations_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
