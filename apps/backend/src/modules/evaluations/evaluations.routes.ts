import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { ok } from "../../shared/response.js";
import {
  submitEvaluation,
  adminLogin,
  getEvaluationsReport,
  deleteEvaluation,
} from "./evaluations.service.js";

const slugOrIdParamsSchema = z.object({
  slugOrId: z.string().min(1),
});

const submitEvaluationSchema = z.object({
  nome: z.string().min(1, "O nome completo é obrigatório"),
  email: z.string().email("E-mail inválido"),
  cursoPeriodo: z.string().min(1, "Curso e período são obrigatórios"),
  nps: z.coerce.number().min(0).max(10),
  oQueAjudou: z.array(z.string()).min(1, "Selecione ao menos 1 opção").max(3, "Máximo de 3 opções"),
  mentoriaNota: z.string().min(1, "Avaliação da mentoria é obrigatória"),
  aprendizado: z.string().min(1, "Conte o que aprendeu"),
  mudancas: z.string().optional().nullable(),
  continuarEcohub: z.string().min(1, "Informe seu interesse de continuidade"),
  depoimento: z.string().min(1, "Depoimento obrigatório"),
  autorizaDepoimento: z.string().min(1, "Autorização obrigatória"),
  esteveDemoday: z.boolean(),
  papelDemoday: z.string().optional().nullable(),
  demodayOrganizacao: z.coerce.number().min(1).max(5).optional().nullable(),
  demodayHorario: z.coerce.number().min(1).max(5).optional().nullable(),
  demodayFeedbackBanca: z.coerce.number().min(1).max(5).optional().nullable(),
  demodayApresentacao: z.string().optional().nullable(),
  demodayGravarVideo: z.string().optional().nullable(),
});

const adminLoginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "A senha é obrigatória"),
});

const deleteParamsSchema = z.object({
  slugOrId: z.string().min(1),
  id: z.string().uuid("ID inválido"),
});

export async function evaluationsRoutes(app: FastifyInstance) {
  // 1. Envio público da avaliação do participante
  app.post("/public/events/:slugOrId/avaliacao", async (request: FastifyRequest) => {
    const { slugOrId } = slugOrIdParamsSchema.parse(request.params);
    const body = submitEvaluationSchema.parse(request.body);

    const meta = {
      ip: request.ip,
      userAgent: request.headers["user-agent"] as string,
    };

    const result = await submitEvaluation(slugOrId, body as any, meta);
    return ok(result);
  });

  // 2. Login administrativo exclusivo para /admin do site de avaliação
  app.post("/public/events/:slugOrId/avaliacao/admin-login", async (request: FastifyRequest) => {
    const { email, password } = adminLoginSchema.parse(request.body);
    const result = await adminLogin(email, password);
    return ok(result);
  });

  // 3. Consulta de relatório completo de avaliações (protegido por token)
  app.get("/public/events/:slugOrId/avaliacao", async (request: FastifyRequest) => {
    const { slugOrId } = slugOrIdParamsSchema.parse(request.params);
    const authHeader = request.headers.authorization;
    const result = await getEvaluationsReport(slugOrId, authHeader);
    return ok(result);
  });

  // 4. Remoção de avaliação de teste (protegido por token)
  app.delete("/public/events/:slugOrId/avaliacao/:id", async (request: FastifyRequest) => {
    const { slugOrId, id } = deleteParamsSchema.parse(request.params);
    const authHeader = request.headers.authorization;
    const result = await deleteEvaluation(slugOrId, id, authHeader);
    return ok(result);
  });
}
