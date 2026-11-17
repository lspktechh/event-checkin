-- Auditoria por perfil: a organização escolhe quais perfis têm as ações
-- registradas em audit_logs. Desligada por padrão em todos os perfis, então
-- nada muda até alguém marcar um perfil na tela de Perfis.
ALTER TABLE "roles" ADD COLUMN "auditEnabled" BOOLEAN NOT NULL DEFAULT false;
