import { z } from "zod";

export const eventsSummaryBodySchema = z.object({
  // Os eventos que entram no relatório: quem escolhe é a pessoa, na tela.
  eventIds: z.array(z.string().uuid("eventId inválido")).min(1, "Escolha ao menos um evento").max(200),
});
