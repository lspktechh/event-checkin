-- Credenciamento por dia (COPOL): o mesmo QR Code vale nos 3 dias e cada dia
-- tem a sua presença. Eventos comuns não mudam: dayIndex = 0 para eles, então
-- a regra continua sendo "um check-in por participante no evento".

ALTER TABLE "events" ADD COLUMN "multiDayCheckIn" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "checkins" ADD COLUMN "dayIndex" INTEGER NOT NULL DEFAULT 0;

-- Liga o modo por dia apenas nos eventos do COPOL.
UPDATE "events"
SET "multiDayCheckIn" = true
WHERE lower("name") LIKE '%copol%' OR lower(coalesce("slug", '')) LIKE '%copol%';

-- Classifica os check-ins que já existem nesses eventos pelo dia em que
-- aconteceram, sem apagar nada. As colunas são `timestamp` sem fuso (UTC),
-- então converte para UTC primeiro e depois para o fuso do evento. O dia é
-- limitado a [1, total] para um check-in de teste feito antes do início (ou
-- depois do fim) não ficar com dia inválido.
UPDATE "checkins" c
SET "dayIndex" = GREATEST(1, LEAST(d.total, d.dia))
FROM (
  SELECT
    ch."id" AS id,
    ((ch."checkedInAt" AT TIME ZONE 'UTC') AT TIME ZONE e."timezone")::date
      - ((e."startDate" AT TIME ZONE 'UTC') AT TIME ZONE e."timezone")::date + 1 AS dia,
    ((e."endDate" AT TIME ZONE 'UTC') AT TIME ZONE e."timezone")::date
      - ((e."startDate" AT TIME ZONE 'UTC') AT TIME ZONE e."timezone")::date + 1 AS total
  FROM "checkins" ch
  JOIN "events" e ON e."id" = ch."eventId"
  WHERE e."multiDayCheckIn"
) d
WHERE c."id" = d.id;

-- Um check-in por participante POR DIA (antes: um por participante no evento).
DROP INDEX "checkins_eventId_participantId_key";
CREATE UNIQUE INDEX "checkins_eventId_participantId_dayIndex_key" ON "checkins"("eventId", "participantId", "dayIndex");
