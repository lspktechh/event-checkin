-- Cortesia: marca convidados da organização (valor zero, ocupa vaga do lote)
ALTER TABLE "participants" ADD COLUMN "isCourtesy" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "inscriptions" ADD COLUMN "isCourtesy" BOOLEAN NOT NULL DEFAULT false;
