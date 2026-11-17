-- Escolha, por evento, de quais oferecem inscrição pelo site LSPK Eventos
-- (aba "Inscrição" do portal). Padrão falso para evento novo.
ALTER TABLE "events" ADD COLUMN "registrationInPortal" BOOLEAN NOT NULL DEFAULT false;

-- Preserva o que já está no ar: até aqui, todo evento Ativo com endereço
-- (slug) aparecia na aba "Inscrição". Eles continuam aparecendo; o
-- organizador desliga o que não quiser, no painel.
UPDATE "events" SET "registrationInPortal" = true WHERE "status" = 'ACTIVE' AND "slug" IS NOT NULL;
