import type { FastifyInstance } from "fastify";
import { requirePermission } from "../../middleware/auth.js";
import { ok } from "../../shared/response.js";
import { eventsSummaryBodySchema } from "./reports.schema.js";
import * as reportsService from "./reports.service.js";

export async function reportsRoutes(app: FastifyInstance) {
  // POST (e não GET): a lista de eventos escolhidos vai no corpo — pode passar
  // de dezenas de ids, e isso não cabe bem em query string.
  app.post("/reports/events-summary", { preHandler: requirePermission("reports.view") }, async (request) => {
    const { eventIds } = eventsSummaryBodySchema.parse(request.body);
    return ok(await reportsService.getEventsSummary(eventIds, request.admin!.allowedEventIds));
  });
}
