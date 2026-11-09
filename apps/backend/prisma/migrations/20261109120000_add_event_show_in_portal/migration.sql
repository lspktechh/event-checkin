-- Escolha, por evento, de quais vão para a aba "Realizados" do site LSPK Eventos.
-- Padrão falso: aplicar esta migração não divulga nenhum evento que já existia.
ALTER TABLE "events" ADD COLUMN "showInPortal" BOOLEAN NOT NULL DEFAULT false;
