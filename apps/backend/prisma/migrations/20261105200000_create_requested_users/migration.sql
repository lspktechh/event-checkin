-- Garante que o perfil ADMINISTRADOR existe
INSERT INTO "roles" ("id", "key", "name", "description", "isSystem", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, 'ADMINISTRADOR', 'Administrador', 'Acesso completo ao sistema.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

-- 1. Cria ou atualiza o Admin Global com senha 12345678 (admin@admin.com)
INSERT INTO "users" (
    "id",
    "name",
    "email",
    "passwordHash",
    "roleId",
    "isActive",
    "allowedEventIds",
    "customPermissions",
    "useCustomPermissions",
    "createdAt",
    "updatedAt"
)
VALUES (
    gen_random_uuid()::text,
    'Admin Global',
    'admin@admin.com',
    '$2a$12$.BUcnEgO3J5qjjs93BzupekZGjwF4o04B385PC4E3WtH4AdW5lAhy',
    (SELECT "id" FROM "roles" WHERE "key" = 'ADMINISTRADOR' LIMIT 1),
    true,
    ARRAY[]::text[],
    ARRAY[]::text[],
    false,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("email") DO UPDATE SET
    "passwordHash" = '$2a$12$.BUcnEgO3J5qjjs93BzupekZGjwF4o04B385PC4E3WtH4AdW5lAhy',
    "isActive" = true,
    "roleId" = (SELECT "id" FROM "roles" WHERE "key" = 'ADMINISTRADOR' LIMIT 1),
    "allowedEventIds" = ARRAY[]::text[],
    "useCustomPermissions" = false,
    "updatedAt" = CURRENT_TIMESTAMP;

-- 2. Também cria/atualiza admin@lspk.com como Admin Global
INSERT INTO "users" (
    "id",
    "name",
    "email",
    "passwordHash",
    "roleId",
    "isActive",
    "allowedEventIds",
    "customPermissions",
    "useCustomPermissions",
    "createdAt",
    "updatedAt"
)
VALUES (
    gen_random_uuid()::text,
    'Admin LSPK',
    'admin@lspk.com',
    '$2a$12$.BUcnEgO3J5qjjs93BzupekZGjwF4o04B385PC4E3WtH4AdW5lAhy',
    (SELECT "id" FROM "roles" WHERE "key" = 'ADMINISTRADOR' LIMIT 1),
    true,
    ARRAY[]::text[],
    ARRAY[]::text[],
    false,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("email") DO UPDATE SET
    "passwordHash" = '$2a$12$.BUcnEgO3J5qjjs93BzupekZGjwF4o04B385PC4E3WtH4AdW5lAhy',
    "isActive" = true,
    "roleId" = (SELECT "id" FROM "roles" WHERE "key" = 'ADMINISTRADOR' LIMIT 1),
    "allowedEventIds" = ARRAY[]::text[],
    "useCustomPermissions" = false,
    "updatedAt" = CURRENT_TIMESTAMP;

-- 3. Cria ou atualiza a usuária Janaina (jcsantilli@gmail.com) restrita para avaliação
INSERT INTO "users" (
    "id",
    "name",
    "email",
    "passwordHash",
    "roleId",
    "isActive",
    "allowedEventIds",
    "customPermissions",
    "useCustomPermissions",
    "createdAt",
    "updatedAt"
)
VALUES (
    gen_random_uuid()::text,
    'Janaina',
    'jcsantilli@gmail.com',
    '$2a$12$.BUcnEgO3J5qjjs93BzupekZGjwF4o04B385PC4E3WtH4AdW5lAhy',
    (SELECT "id" FROM "roles" WHERE "key" = 'ADMINISTRADOR' LIMIT 1),
    true,
    COALESCE(
        (SELECT ARRAY_AGG(id::text) FROM "events" WHERE lower("name") LIKE '%inova%' OR "id" = 'e7b5f120-4a81-4993-9c5e-85a265da4168' OR "id" = 'db2d17ca-6034-46af-9bf6-dd145130518b'),
        ARRAY[]::text[]
    ),
    ARRAY['events.view', 'participants.view', 'participants.edit']::text[],
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("email") DO UPDATE SET
    "passwordHash" = '$2a$12$.BUcnEgO3J5qjjs93BzupekZGjwF4o04B385PC4E3WtH4AdW5lAhy',
    "isActive" = true,
    "allowedEventIds" = COALESCE(
        (SELECT ARRAY_AGG(id::text) FROM "events" WHERE lower("name") LIKE '%inova%' OR "id" = 'e7b5f120-4a81-4993-9c5e-85a265da4168' OR "id" = 'db2d17ca-6034-46af-9bf6-dd145130518b'),
        "users"."allowedEventIds"
    ),
    "customPermissions" = ARRAY['events.view', 'participants.view', 'participants.edit']::text[],
    "useCustomPermissions" = true,
    "updatedAt" = CURRENT_TIMESTAMP;
