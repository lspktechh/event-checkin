-- CreateTable
CREATE TABLE "raffle_entries" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "deviceKey" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raffle_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raffle_draws" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "drawnBy" VARCHAR(200),
    "drawnAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raffle_draws_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "raffle_entries_eventId_number_key" ON "raffle_entries"("eventId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "raffle_entries_eventId_deviceKey_key" ON "raffle_entries"("eventId", "deviceKey");

-- CreateIndex
CREATE INDEX "raffle_entries_eventId_createdAt_idx" ON "raffle_entries"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "raffle_draws_eventId_drawnAt_idx" ON "raffle_draws"("eventId", "drawnAt");

-- AddForeignKey
ALTER TABLE "raffle_entries" ADD CONSTRAINT "raffle_entries_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raffle_draws" ADD CONSTRAINT "raffle_draws_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raffle_draws" ADD CONSTRAINT "raffle_draws_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "raffle_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
