-- Adiciona suporte a permissões customizadas por usuário
ALTER TABLE "users" ADD COLUMN "customPermissions" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "users" ADD COLUMN "useCustomPermissions" BOOLEAN NOT NULL DEFAULT false;
