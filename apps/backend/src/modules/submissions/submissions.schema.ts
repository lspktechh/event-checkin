import { z } from "zod";

export const eventIdParams = z.object({ eventId: z.string().uuid() });
export const submissionIdParams = z.object({
  eventId: z.string().uuid(),
  submissionId: z.string().uuid(),
});
export const submissionFileParams = z.object({
  eventId: z.string().uuid(),
  submissionId: z.string().uuid(),
  fileId: z.string().uuid(),
});
export const catalogIdParams = z.object({
  eventId: z.string().uuid(),
  id: z.string().uuid(),
});

/** Modalidade e área usam a mesma forma — nome, ordem e ativo. */
const catalogItem = {
  name: z.string().trim().min(2, "Dê um nome com pelo menos 2 letras").max(80),
  active: z.boolean().optional(),
  position: z.number().int().min(0).max(999).optional(),
};

export const createModalitySchema = z.object({
  ...catalogItem,
  description: z.string().trim().max(500).nullable().optional(),
});
export const updateModalitySchema = createModalitySchema.partial();

export const createTopicSchema = z.object(catalogItem);
export const updateTopicSchema = createTopicSchema.partial();

export const submissionSettingsSchema = z
  .object({
    opensAt: z.coerce.date().nullable().optional(),
    closesAt: z.coerce.date().nullable().optional(),
    authorFeeRequired: z.boolean().optional(),
    authorFeeAmount: z.number().nonnegative().nullable().optional(),
    maxFileSizeMb: z.number().int().min(1).max(100).optional(),
    minReviewsToDecide: z.number().int().min(1).max(10).optional(),
  })
  .refine(
    (v) => !v.opensAt || !v.closesAt || v.opensAt < v.closesAt,
    // Sem esta checagem dá para gravar uma janela que nunca abre, e o
    // sintoma seria "ninguém consegue submeter" sem nada na tela explicando.
    { message: "A abertura precisa ser antes do fechamento", path: ["closesAt"] }
  );

const authorSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do autor (pelo menos 2 letras).").max(150, "O nome do autor ficou muito longo (máximo de 150 caracteres)."),
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido para o autor, no formato nome@dominio.com."),
  institution: z.string().trim().max(150, "O nome da instituição ficou muito longo (máximo de 150 caracteres).").nullable().optional(),
  isPresenter: z.boolean().optional(),
});

export const createSubmissionSchema = z.object({
  // Opcionais aqui porque o evento pode não ter catálogo nenhum. Quando
  // tem, o service exige a escolha — ver createSubmission.
  modalityId: z.string().uuid("Escolha uma modalidade na lista.").nullable().optional(),
  topicId: z.string().uuid("Escolha uma área temática na lista.").nullable().optional(),
  title: z.string().trim().min(5, "O título está curto demais — escreva pelo menos 5 caracteres.").max(300, "O título ficou longo demais — use no máximo 300 caracteres."),
  abstract: z.string().trim().min(50, "O resumo precisa de pelo menos 50 caracteres.").max(10000, "O resumo ficou longo demais — use no máximo 10.000 caracteres."),
  keywords: z
    .array(
      z
        .string()
        .trim()
        .min(2, "Cada palavra-chave precisa de pelo menos 2 letras.")
        .max(50, "Cada palavra-chave pode ter no máximo 50 caracteres. Parece que você escreveu uma frase inteira — separe as palavras-chave por vírgula (ex.: periodontia, saúde coletiva).")
    )
    .min(1, "Informe pelo menos uma palavra-chave, separando por vírgula.")
    .max(10, "Informe no máximo 10 palavras-chave."),
  // Pelo menos um autor, e a regra de "exatamente um apresentador" é
  // verificada no service — aqui só garante que a lista não vem vazia.
  authors: z.array(authorSchema).min(1, "Informe pelo menos um autor.").max(20, "Informe no máximo 20 autores por trabalho."),
});

export const updateSubmissionSchema = createSubmissionSchema.partial();

export const decideSubmissionSchema = z
  .object({
    decision: z.enum(["APPROVED", "APPROVED_WITH_RESERVATIONS", "REJECTED"]),
    reason: z.string().trim().max(2000).optional(),
  })
  .refine(
    (data) =>
      data.decision !== "APPROVED_WITH_RESERVATIONS" ||
      Boolean(data.reason && data.reason.trim().length > 0),
    {
      message:
        "Informe o que está errado e o que precisa ser corrigido pelo autor para aprovar com ressalva.",
      path: ["reason"],
    }
  );

export const listSubmissionsQuery = z.object({
  status: z
    .enum(["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "APPROVED_WITH_RESERVATIONS", "REJECTED", "WITHDRAWN"])
    .optional(),
  modalityId: z.string().uuid().optional(),
  topicId: z.string().uuid().optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;
export type SubmissionSettingsInput = z.infer<typeof submissionSettingsSchema>;

const fileNameSchema = z
  .string()
  .trim()
  .min(1, "Informe o nome do arquivo.")
  .max(200, "O nome do arquivo ficou muito longo (máximo de 200 caracteres).")
  // Só metadado: o caminho no disco é montado pelo servidor. Ainda assim
  // recusa separador de diretório, para o nome não virar caminho se um
  // dia alguém usá-lo para montar um.
  .refine((v) => !v.includes("/") && !v.includes("\\") && !v.includes(".."), {
    message: "O nome do arquivo tem caracteres inválidos. Evite barras ( / \\ ) e \"..\" no nome.",
  });

/**
 * Upload do arquivo do trabalho (PDF, DOCX ou PPTX), em base64.
 *
 * Base64 e não multipart porque é assim que o resto do sistema já recebe
 * arquivo (ver a imagem de assinatura em certificates.routes.ts) — e uma
 * dependência a menos.
 */
export const uploadFileSchema = z.object({
  fileName: fileNameSchema,
  dataBase64: z.string().min(1, "O arquivo está vazio. Selecione um arquivo válido (PDF, DOCX ou PPTX)."),
});

/**
 * Envio pelo site, pelo próprio autor: dados do trabalho e o arquivo numa
 * requisição só. Separar em "cria rascunho" + "anexa" deixaria rascunhos
 * órfãos sem dono no banco toda vez que alguém desistisse no meio — no
 * painel isso não acontece porque quem cadastra é o organizador.
 *
 * O arquivo vem inteiro em `dataBase64` ou, se é grande, já foi mandado em
 * partes e vem só o `uploadId` delas (ver submissions.parts.ts).
 */
/** Teto de arquivos por trabalho. O tamanho é somado e limitado pelo
 *  maxFileSizeMb do evento (o total, não cada arquivo). */
export const MAX_ARQUIVOS_POR_TRABALHO = 5;

/** Um arquivo: nome + o conteúdo (inteiro em base64 ou já em partes). */
const submissionFileInputSchema = z
  .object({
    fileName: fileNameSchema,
    dataBase64: z.string().min(1, "O arquivo está vazio. Selecione um arquivo válido (PDF, DOCX ou PPTX).").optional(),
    uploadId: z.string().uuid("Houve uma falha ao enviar o arquivo. Anexe novamente.").optional(),
  })
  .refine((v) => Boolean(v.dataBase64) !== Boolean(v.uploadId), {
    message: "Anexe o arquivo do trabalho (PDF, DOCX ou PPTX).",
    path: ["dataBase64"],
  });

export const publicCreateSubmissionSchema = createSubmissionSchema
  .extend({
    // Formato novo: lista de arquivos (1 a 5).
    files: z
      .array(submissionFileInputSchema)
      .min(1, "Anexe pelo menos um arquivo do trabalho.")
      .max(MAX_ARQUIVOS_POR_TRABALHO, `Você pode anexar no máximo ${MAX_ARQUIVOS_POR_TRABALHO} arquivos por trabalho.`)
      .optional(),
    // Formato antigo (um arquivo só). Mantido para o site não quebrar
    // enquanto a versão nova não está no ar na Vercel. O service normaliza
    // os dois para uma lista.
    fileName: fileNameSchema.optional(),
    dataBase64: z.string().min(1, "O arquivo está vazio. Selecione um arquivo válido (PDF, DOCX ou PPTX).").optional(),
    uploadId: z.string().uuid("Houve uma falha ao enviar o arquivo. Anexe novamente.").optional(),
  })
  .refine(
    (v) => {
      const temLista = Array.isArray(v.files) && v.files.length > 0;
      const temUnico = Boolean(v.fileName) && Boolean(v.dataBase64) !== Boolean(v.uploadId);
      // Exatamente um dos formatos: ou a lista, ou o arquivo único.
      return temLista !== temUnico;
    },
    { message: "Anexe o arquivo do trabalho (PDF, DOCX ou PPTX) para concluir o envio.", path: ["files"] }
  );

/**
 * Uma parte do arquivo. ~700 mil caracteres de base64 por parte no site;
 * o teto aqui é o corpo que o proxy da frente deixa passar.
 */
export const publicUploadPartSchema = z
  .object({
    uploadId: z.string().uuid("Houve uma falha no envio do arquivo. Recomece o anexo."),
    index: z.number().int().min(0, "Houve uma falha no envio do arquivo. Tente anexar novamente."),
    total: z.number().int().min(1).max(200, "O arquivo é grande demais para o envio. Reduza o tamanho e tente de novo."),
    dataBase64: z.string().min(1, "Parte do arquivo vazia. Tente anexar novamente.").max(1_000_000, "O arquivo é grande demais para o envio. Reduza o tamanho e tente de novo."),
  })
  .refine((v) => v.index < v.total, { message: "Houve uma falha no envio do arquivo. Tente anexar novamente.", path: ["index"] });

export const publicSubmissionIdParams = z.object({ submissionId: z.string().uuid() });

export type PublicCreateSubmissionInput = z.infer<typeof publicCreateSubmissionSchema>;
export type PublicUploadPartInput = z.infer<typeof publicUploadPartSchema>;
