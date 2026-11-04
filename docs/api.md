# API — Backend (Fase 1)

Base URL: `http://<host>:<PORT>` (padrão `PORT=3000`).

Todas as respostas usam o envelope:

```json
// sucesso
{ "success": true, "data": { ... } }

// erro
{ "success": false, "error": { "code": "STRING_CODE", "message": "...", "details": null } }
```

Autenticação via header `Authorization: Bearer <token>`. Existem dois
tipos de token — veja [`security.md`](security.md) para o fluxo completo.

## Health check

### `GET /health`
Sem autenticação.

```json
{ "success": true, "data": { "status": "ok", "apiVersion": "0.1.0" } }
```

## Auth (admin)

### `POST /auth/login`
Body: `{ "email": string, "password": string }`
Resposta: `{ token, user: { id, name, email, role } }`

## Eventos (requer token de admin)

| Método | Path | Descrição |
|---|---|---|
| POST | `/events` | Cria evento. Body: `name, description?, location?, startDate, endDate` |
| GET | `/events` | Lista todos os eventos |
| GET | `/events/:eventId` | Detalhe de um evento |
| PATCH | `/events/:eventId` | Atualiza campos do evento, incl. `status` (`DRAFT`\|`ACTIVE`\|`CLOSED`) |

## Participantes (requer token de admin)

| Método | Path | Descrição |
|---|---|---|
| POST | `/events/:eventId/participants` | Cria participante. Body: `name, email?, phone?, document?, cortesia?` (`cortesia: true` só marca o participante como convidado da organização; participante não tem valor). **No COPOL**, `cortesia: true` cria uma inscrição de cortesia (ver "Cortesia no COPOL" abaixo) |
| GET | `/events/:eventId/participants` | Lista participantes do evento |
| PATCH | `/events/:eventId/participants/:participantId` | Atualiza dados/status (`ACTIVE`\|`CANCELLED`) |
| POST | `/events/:eventId/participants/:participantId/rotate-qr-token` | Revoga o QR atual e gera um novo |
| DELETE | `/events/:eventId/participants/:participantId` | Exclui o participante (204). Diferente de excluir terminal, aqui o histórico de check-ins dele é apagado junto (cascade) — não tem como preservar, o dono do registro deixou de existir |
| POST | `/events/:eventId/participants/import` | Importação em lote via CSV (ver abaixo) |
| POST | `/events/:eventId/participants/courtesies-to-inscriptions` | **Só COPOL** (`participants.create`). Inclui em Inscritos as cortesias que só existem como participante (ver "Cortesia no COPOL") |

### Importação CSV

Colunas esperadas (cabeçalho, case-insensitive): `nome,email,telefone,documento`.

Body: `{ "csv": "<conteúdo do arquivo>", "confirm": boolean, "cortesia"?: boolean }`
(`cortesia: true` marca todos os participantes gravados como convidados da
organização. **No COPOL**, `cortesia: true` grava cada linha como inscrição de
cortesia — ver "Cortesia no COPOL" abaixo).

- `confirm: false` (ou omitido) → **modo preview**: valida, normaliza e
  detecta duplicados (dentro do próprio arquivo e contra participantes já
  existentes no evento), mas **não grava nada**. Devolve o relatório linha
  a linha.
- `confirm: true` → grava as linhas válidas e não-duplicadas, e devolve o
  mesmo relatório mais `imported: <quantidade gravada>`.

```json
{
  "success": true,
  "data": {
    "totalRows": 3,
    "validCount": 2,
    "invalidCount": 0,
    "duplicateCount": 1,
    "imported": 2,
    "rows": [
      { "row": 2, "name": "João", "email": "joao@email.com", "status": "valid" },
      { "row": 3, "name": "Maria", "email": "maria@email.com", "status": "valid" },
      { "row": 4, "name": "João", "email": "joao@email.com", "status": "duplicate", "reason": "Duplicado dentro do próprio arquivo" }
    ]
  }
}
```

## Inscrições lançadas pelo painel (requer `participants.create`)

| Método | Path | Descrição |
|---|---|---|
| POST | `/events/:eventId/inscriptions/manual` | Lança uma inscrição já **confirmada**, com participante, QR e comprovante por e-mail. Body: `name, email, document, phone?, institution?, notes?, cortesia?` |
| POST | `/events/:eventId/inscriptions/import` | Importa inscritos por CSV (mesmas colunas e modo preview/confirm da importação de participantes). Body: `csv, confirm?, cortesia?` |
| POST | `/events/:eventId/inscriptions/confirm-courtesies` | **Só COPOL** (`participants.edit`). Gera o QR das cortesias que ficaram **pendentes** (ver abaixo) |

Ambas usam o **lote ativo** do evento e ocupam uma vaga dele:

- `cortesia: true` → valor zero (fora da receita), `Inscription.isCourtesy` e
  `Participant.isCourtesy` marcados.
- `cortesia: false` (padrão) → preço do lote, `paymentProvider: MANUAL` (pago
  por fora do sistema).
- Sem lote ativo (todos encerrados ou esgotados) → `409`/`403`, como na
  inscrição pública. Não exige "inscrições abertas" nem aceite de termo.
- Quem já é participante **ativo** no evento (mesmo e-mail ou CPF, ignorando
  máscara) é recusado: `409 JA_INSCRITO` na manual; `duplicate` no preview da
  importação.

Na importação, e-mail e CPF são obrigatórios e as vagas do lote são
distribuídas na ordem do arquivo: o que passa do limite aparece como
`invalid` ("Sem vaga no …") já no preview. A resposta inclui
`failed: [{ row, reason }]` com linhas aceitas no preview que falharam ao
gravar (ex.: o lote encheu no meio).

### Editar inscrição (requer `participants.edit`)

`PATCH /events/:eventId/inscriptions/:id` — corpo parcial, só muda o que vier:

```json
{
  "name": "…", "email": "…", "document": "…", "phone": "…" | null, "institution": "…" | null,
  "pagamento": { "forma": "CORTESIA" | "MANUAL" | "PIX" | "CARD", "valor": 120.5 }
}
```

Tudo numa **única transação**, e os dados valem para a inscrição **e** para o
participante ligado (o portal entra pelo e-mail do participante).

- E-mail/CPF que passam a ser de **outro participante ativo** → `409 JA_INSCRITO`
  (só se o campo mudou; duplicado antigo não bloqueia corrigir um telefone).
- `pagamento.forma`: `CORTESIA` zera o valor e marca `isCourtesy`; `MANUAL`,
  `PIX` e `CARD` são pagamento feito **fora do sistema** (`paymentProvider:
  MANUAL`; `PIX`/`CARD` dizem como). Sem `valor`: mantém o já cobrado ou, se
  era cortesia, o preço do lote. `valor` ≤ 0 → `422`.
- A forma de pagamento só muda em inscrição **confirmada** (`409
  PAGAMENTO_NAO_EDITAVEL`) e **nunca** em inscrição paga pelo gateway
  (`409 PAGAMENTO_GATEWAY`). A vaga do lote não muda.

### Editar participante

`PATCH /events/:eventId/participants/:participantId` agora também:

- atualiza a inscrição de origem (nome, e-mail, CPF, telefone), na mesma transação;
- confere duplicado de e-mail/CPF (`409 JA_INSCRITO`);
- aceita `cortesia` **só** para participante sem inscrição; com inscrição
  → `409 CORTESIA_PELA_INSCRICAO` (a cortesia vem da forma de pagamento).

`GET /events/:eventId/participants` devolve `hasInscription` em cada item.

## Terminais

| Método | Path | Auth | Descrição |
|---|---|---|---|
| POST | `/events/:eventId/terminals` | admin | Cria terminal, retorna `activationCode` (formato `XXXX-XXXX`, expira em 72h) |
| GET | `/events/:eventId/terminals` | admin | Lista terminais do evento |
| GET | `/terminals/:terminalId/status` | admin | Status/último `lastSeenAt` de um terminal |
| DELETE | `/events/:eventId/terminals/:terminalId` | admin | Exclui o terminal (204). Histórico de check-ins é preservado (`terminalId` vira `null`); qualquer requisição futura do aparelho excluído recebe 401 — o app do terminal detecta isso e se desconecta sozinho |
| POST | `/terminals/activate` | nenhuma (o código é a credencial) | Body: `{ activationCode }`. Retorna `{ token, terminal, event }` |

## Check-in (requer token de terminal)

### `POST /events/:eventId/checkins`
Body: `{ "qrToken": string }`

Respostas possíveis (todas HTTP 2xx — são desfechos de negócio válidos,
não erros):

```json
// 201 — primeira confirmação
{ "success": true, "data": { "status": "CONFIRMED", "participant": { "id": "...", "name": "..." }, "checkedInAt": "..." } }

// 200 — já tinha sido confirmado antes (por este ou outro terminal)
{ "success": true, "data": { "status": "ALREADY_CHECKED_IN", "participant": { "id": "...", "name": "..." }, "checkedInAt": "..." } }
```

Erros (HTTP 4xx, rejeições de fato):

| HTTP | `error.code` | Quando |
|---|---|---|
| 404 | `NOT_FOUND` | QR token não existe, não pertence a este evento, ou foi revogado |
| 403 | `FORBIDDEN` | Participante com status `CANCELLED` |
| 409 | `FORA_DO_PERIODO` | Só em evento por dia: leitura antes do 1º dia ou depois do último |

A leitura do painel (câmera ao vivo no navegador, `POST /events/:eventId/checkins/admin`)
usa a mesma regra e as mesmas respostas.

### Credenciamento por dia (`Event.multiDayCheckIn`, ligado só no COPOL)

Nesse modo o **mesmo QR Code vale em todos os dias** e cada dia tem a sua
presença. Em qualquer outro evento nada muda: um check-in por participante no
evento todo (`CheckIn.dayIndex = 0`).

- A regra do banco é `UNIQUE(eventId, participantId, dayIndex)`: a duplicidade é
  por **participante + dia**, e vale mesmo com duas câmeras lendo ao mesmo tempo.
- O dia (`dayIndex` 1, 2, 3…) é calculado **no servidor** pelo horário da leitura
  e pelas datas e fuso do evento (`Event.startDate/endDate/timezone`). O dia vira
  à meia-noite de **Brasília**, não de UTC. Na sincronização offline vale o
  horário da leitura, não o da sincronização.
- A resposta traz `day: { "index": 2, "total": 3, "date": "2026-11-06" }`
  (`null` em evento comum). Repetir no mesmo dia → `ALREADY_CHECKED_IN`; o dia
  seguinte não é bloqueado pelo anterior.
- Certificados e comprovante continuam liberados com presença em **qualquer** dia.

### `GET /events/:eventId/statistics`
Auth: admin.

```json
{
  "success": true,
  "data": {
    "totalRegistered": 2500,
    "totalCheckedIn": 1873,
    "totalAbsent": 627,
    "attendancePercentage": 74.92,
    "checkInsByTerminal": [{ "terminalId": "...", "count": 812 }]
  }
}
```

`totalCheckedIn` conta **pessoas** (em evento por dia, quem veio em 3 dias conta
uma vez). Só em evento por dia a resposta ganha:

```json
"multiDay": {
  "total": 3,
  "today": { "index": 2, "date": "2026-11-06", "checkedIn": 412 },   // null fora dos dias do evento
  "perDay": [{ "index": 1, "date": "2026-11-05", "checkedIn": 380 }, …]
}
```

`GET /events/:eventId/report` também conta pessoas em `totalCheckedIn` e cada
linha de `checkIns` traz `dayIndex` (0 em evento comum).

## Sincronização offline (requer token de terminal)

### `GET /terminals/sync/participants`
Retorna o roster completo do evento do terminal (id, nome, qrToken, status,
updatedAt) para cache local (SQLite) — permite validar leituras offline
sem contato com o backend. Chamado na ativação e periodicamente enquanto
online.

```json
{
  "success": true,
  "data": {
    "event": { "id": "...", "name": "...", "status": "ACTIVE" },
    "participants": [
      { "id": "...", "name": "João da Silva", "qrToken": "evt_...", "status": "ACTIVE", "updatedAt": "..." }
    ]
  }
}
```

### `POST /terminals/sync`
Body: `{ "checkIns": [{ "localCheckInId": string, "qrToken": string, "checkedInAt": ISO8601 }, ...] }` (máx. 500 itens por lote)

Processa cada item de forma independente — um item rejeitado não aborta o
lote. Resposta:

```json
{
  "success": true,
  "data": {
    "results": [
      { "localCheckInId": "local-001", "status": "CONFIRMED", "participant": {...}, "checkedInAt": "..." },
      { "localCheckInId": "local-002", "status": "ALREADY_CHECKED_IN", "participant": {...}, "checkedInAt": "..." },
      { "localCheckInId": "local-003", "status": "REJECTED", "code": "NOT_FOUND", "message": "Credencial inválida" }
    ]
  }
}
```

Reenviar o mesmo `localCheckInId` é idempotente: o backend identifica que
aquele registro específico já foi sincronizado por aquele terminal e
devolve o mesmo resultado, sem duplicar.

## Limitações conhecidas desta fase

- Não há endpoint para o admin recuperar/regenerar o `activationCode` de
  um terminal já criado — se perdido antes da ativação, é preciso criar
  um novo terminal.
- Rate limit é global (100 req/min por IP, `@fastify/rate-limit`), não
  diferenciado por endpoint.

### Cortesia no COPOL

Regras que valem **só para o evento do COPOL** (nome ou slug com "copol", ou
credenciamento por dia ligado). Os demais eventos seguem como antes.

- **Toda cortesia é credenciável e entra em Inscritos.** Cortesia lançada pela
  aba Participantes (`POST /participants` ou `/participants/import` com
  `cortesia: true`) passa pelo mesmo caminho da cortesia de Inscritos: cria a
  inscrição confirmada (valor zero, ocupa vaga do lote) **e** o participante
  com QR. Por isso exige e-mail e CPF (`422` no cadastro; `invalid` no preview
  da importação), recusa quem já está no evento (`409 JA_INSCRITO`) e respeita
  o teto do lote. Sem `cortesia`, o participante continua sendo criado solto.
- **`POST /inscriptions/confirm-courtesies`** confirma, pelo mesmo caminho do
  pagamento aprovado (participante + QR + comprovante por e-mail), as
  inscrições `PENDING` de **valor zero** sem participante, marcando-as como
  cortesia. Não toca em quem vai pagar (valor > 0), cancelados nem já
  confirmados; pula quem já é participante ativo (e-mail/CPF) e pode rodar de
  novo sem efeito. Resposta: `{ confirmed, skipped: [{ id, name, reason }] }`.
  Em evento que não é do COPOL: `409 SO_COPOL`.
- **`POST /participants/courtesies-to-inscriptions`** traz para Inscritos as
  cortesias que só existem como participante (criadas quando a aba
  Participantes não gerava inscrição). Cria, para cada participante `ACTIVE`
  com `isCourtesy` e sem inscrição, uma inscrição `CONFIRMED` de valor zero
  (`category: "Cortesia"`) **ligada ao mesmo participante** — o QR continua o
  mesmo. **Não ocupa vaga do lote** (`batchId` vazio): são pessoas que já
  estavam no evento e contá-las agora poderia esgotar o lote e fechar as
  vendas. Exige e-mail e CPF; quem não tem, ou já consta no evento por outra
  inscrição/participante, vem em `skipped` com o motivo. Idempotente.
  Resposta: `{ linked, skipped: [{ id, name, reason }] }`. Fora do COPOL:
  `409 SO_COPOL`.
- **QR de acesso (site de credenciamento e porta)**: "Aguardando Pix" (valor
  maior que zero) continua **sem** QR. Hands On pendente de **valor zero**
  (cortesia/gratuito) tem QR e entra na porta.
