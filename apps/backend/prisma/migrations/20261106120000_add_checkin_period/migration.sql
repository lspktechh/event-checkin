-- Credenciamento por período (COPOL): cada dia tem dois credenciamentos
-- independentes, Manhã (a partir das 07:30) e Noite (a partir das 18:00). O
-- mesmo QR entra uma vez em cada. Evento comum não muda: period = 0.

ALTER TABLE "checkins" ADD COLUMN "period" INTEGER NOT NULL DEFAULT 0;

-- Classifica os check-ins que já existem nos eventos por dia pela HORA LOCAL em
-- que aconteceram, sem apagar nada: 18:00 ou depois = Noite (2), antes = Manhã
-- (1). As colunas são `timestamp` sem fuso (UTC), então converte para UTC e
-- depois para o fuso do evento. Mesma regra de checkins/event-day.ts.
UPDATE "checkins" c
SET "period" = CASE
  WHEN (((c."checkedInAt" AT TIME ZONE 'UTC') AT TIME ZONE e."timezone")::time >= TIME '18:00') THEN 2
  ELSE 1
END
FROM "events" e
WHERE e."id" = c."eventId" AND e."multiDayCheckIn";

-- Um check-in por participante POR DIA E PERÍODO (antes: um por dia).
DROP INDEX "checkins_eventId_participantId_dayIndex_key";
CREATE UNIQUE INDEX "checkins_eventId_participantId_dayIndex_period_key" ON "checkins"("eventId", "participantId", "dayIndex", "period");
