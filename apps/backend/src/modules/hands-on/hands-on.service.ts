import { handsOnRepository, type CreateHandsOnData } from "./hands-on.repository.js";
import { generateQrToken } from "../../shared/tokens.js";
import { NotFoundError, ConflictError, BadRequestError } from "../../shared/errors.js";
import { mercadoPagoClient } from "../../lib/mercadopago/mercadopago.client.js";
import { prisma } from "../../database/prisma.js";
import { env } from "../../config/env.js";
import { adminCheckInBus } from "../admin/adminMonitor.events.js";
import { emailService } from "../../lib/email/email.service.js";
import { resolveEmailSettings } from "../../lib/email/email-settings.js";
import type { Prisma } from "@prisma/client";

export const HANDS_ON_CAPACITY: Record<string, number> = {
  "clareamento-dental-caseiro": 10,
  "fechamento-diastema-manequim": 12,
  "preenchimento-labial": 12,
  "cirurgia-guiada-implantodontia": 12,
  "resina-injetada-dvo": 12,
  "radiotech-tomografia-visita": 12,
  "toxina-botulinica-hof": 14,
  "simplificando-resina-composta": 18,
  "fotografia-smartphone": 12,
  "integrale-cirurgia-implante-protetico": 20,
  "reabilitacao-resina-composta": 20,
  "cimentacao-pino-fibra": 20,
  "lprf-poder-regenerativo": 12,
};

function getRelatedHandsOnIds(handsOnId: string): string[] {
  if (
    handsOnId === "integrale-cirurgia-implante-protetico" ||
    handsOnId === "reabilitacao-resina-composta"
  ) {
    return [
      "integrale-cirurgia-implante-protetico",
      "reabilitacao-resina-composta",
    ];
  }
  return [handsOnId];
}

export const handsOnService = {
  async getCapacities(eventId: string): Promise<Record<string, number>> {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { siteContent: true },
    });
    const siteContent = (event?.siteContent as Record<string, any>) ?? {};
    const customCapacities: Record<string, number> =
      siteContent.handsOnCapacities && typeof siteContent.handsOnCapacities === "object"
        ? (siteContent.handsOnCapacities as Record<string, number>)
        : {};

    return {
      ...HANDS_ON_CAPACITY,
      ...customCapacities,
    };
  },

  async getWorkshopCapacity(eventId: string, handsOnId: string): Promise<number> {
    const targetId =
      handsOnId === "reabilitacao-resina-composta"
        ? "integrale-cirurgia-implante-protetico"
        : handsOnId;
    const capacities = await this.getCapacities(eventId);
    return capacities[targetId] ?? HANDS_ON_CAPACITY[targetId] ?? 12;
  },

  async updateCapacity(
    eventId: string,
    handsOnId: string,
    capacity: number
  ): Promise<{ handsOnId: string; capacity: number; allCapacities: Record<string, number> }> {
    if (!capacity || capacity < 1 || !Number.isInteger(capacity)) {
      throw new BadRequestError("A capacidade de vagas deve ser um número inteiro positivo maior que zero.");
    }
    const targetId =
      handsOnId === "reabilitacao-resina-composta"
        ? "integrale-cirurgia-implante-protetico"
        : handsOnId;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { siteContent: true },
    });
    const siteContent =
      typeof event?.siteContent === "object" && event?.siteContent !== null
        ? { ...(event.siteContent as Record<string, unknown>) }
        : {};
    const currentCustom: Record<string, number> =
      siteContent.handsOnCapacities && typeof siteContent.handsOnCapacities === "object"
        ? { ...(siteContent.handsOnCapacities as Record<string, number>) }
        : {};

    currentCustom[targetId] = capacity;
    if (targetId === "integrale-cirurgia-implante-protetico") {
      currentCustom["reabilitacao-resina-composta"] = capacity;
    }
    siteContent.handsOnCapacities = currentCustom;

    await prisma.event.update({
      where: { id: eventId },
      data: { siteContent: siteContent as Prisma.InputJsonValue },
    });

    const allCapacities = {
      ...HANDS_ON_CAPACITY,
      ...currentCustom,
    };

    try {
      adminCheckInBus.publish(eventId, {
        type: "hands_on_capacity_updated",
        eventId,
        handsOnId: targetId,
        capacity,
      });
    } catch (err) {
      console.warn("[HandsOn] Erro ao publicar atualização de capacidade:", err);
    }

    return { handsOnId: targetId, capacity, allCapacities };
  },

  async getSettings(eventId: string): Promise<{ open: boolean; capacities: Record<string, number> }> {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { siteContent: true },
    });
    const siteContent = (event?.siteContent as Record<string, unknown>) ?? {};
    const customCapacities: Record<string, number> =
      siteContent.handsOnCapacities && typeof siteContent.handsOnCapacities === "object"
        ? (siteContent.handsOnCapacities as Record<string, number>)
        : {};
    return {
      open: Boolean(siteContent.handsOnOpen ?? false),
      capacities: {
        ...HANDS_ON_CAPACITY,
        ...customCapacities,
      },
    };
  },

  async updateSettings(
    eventId: string,
    open: boolean,
    capacities?: Record<string, number>
  ): Promise<{ open: boolean; capacities: Record<string, number> }> {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { siteContent: true },
    });
    const siteContent =
      typeof event?.siteContent === "object" && event?.siteContent !== null
        ? { ...(event.siteContent as Record<string, unknown>) }
        : {};
    siteContent.handsOnOpen = open;
    if (capacities && typeof capacities === "object") {
      const currentCustom: Record<string, number> =
        siteContent.handsOnCapacities && typeof siteContent.handsOnCapacities === "object"
          ? { ...(siteContent.handsOnCapacities as Record<string, number>) }
          : {};
      Object.assign(currentCustom, capacities);
      siteContent.handsOnCapacities = currentCustom;
    }
    await prisma.event.update({
      where: { id: eventId },
      data: { siteContent: siteContent as Prisma.InputJsonValue },
    });
    const allCapacities = {
      ...HANDS_ON_CAPACITY,
      ...((siteContent.handsOnCapacities as Record<string, number>) || {}),
    };
    return { open, capacities: allCapacities };
  },

  async register(eventId: string, input: Omit<CreateHandsOnData, "eventId" | "qrToken">) {
    // 1. Verifica se as inscrições estão liberadas
    const settings = await handsOnService.getSettings(eventId);
    if (!settings.open) {
      throw new ConflictError(
        "HANDS_ON_CLOSED",
        "As inscrições para os Workshops Hands On estão temporariamente fechadas pela organização do COPOL."
      );
    }

    // 2. Verifica limite de vagas do workshop
    const targetId =
      input.handsOnId === "reabilitacao-resina-composta"
        ? "integrale-cirurgia-implante-protetico"
        : input.handsOnId;
    const maxVagas = await handsOnService.getWorkshopCapacity(eventId, targetId);

    const confirmedCount = await prisma.handsOnRegistration.count({
      where: {
        eventId,
        handsOnId: {
          in: [
            targetId,
            targetId === "integrale-cirurgia-implante-protetico"
              ? "reabilitacao-resina-composta"
              : targetId,
          ],
        },
        status: "CONFIRMED",
      },
    });

    if (confirmedCount >= maxVagas) {
      throw new ConflictError(
        "WORKSHOP_FULL",
        `As vagas para o workshop "${input.title}" estão esgotadas (${confirmedCount}/${maxVagas} confirmadas).`
      );
    }

    // 3. Verifica se a pessoa já possui inscrição neste workshop
    const cleanDoc = input.document.replace(/\D/g, "");
    const relatedIds = getRelatedHandsOnIds(input.handsOnId);

    const existingForSamePerson = await prisma.handsOnRegistration.findMany({
      where: {
        eventId,
        handsOnId: { in: relatedIds },
        OR: [
          { document: cleanDoc },
          { document: input.document },
        ],
      },
    });

    const alreadyConfirmed = existingForSamePerson.find((r) => r.status === "CONFIRMED");
    if (alreadyConfirmed) {
      throw new ConflictError(
        "ALREADY_REGISTERED",
        `Este CPF já possui inscrição confirmada para o workshop "${input.title}".`
      );
    }

    // Se já havia inscrição PENDING anterior dessa mesma pessoa, cancela Pix antigo no MP e remove duplicata
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { mpAccessToken: true },
    });
    const mpToken = event?.mpAccessToken || env.MP_ACCESS_TOKEN;

    for (const oldPending of existingForSamePerson) {
      if (oldPending.status === "PENDING") {
        if (oldPending.paymentId) {
          try {
            await mercadoPagoClient.cancelPayment(oldPending.paymentId, mpToken || undefined);
          } catch (mpErr) {
            console.warn(`[HandsOn] Erro ao cancelar Pix antigo ${oldPending.paymentId}:`, mpErr);
          }
        }
        await prisma.handsOnRegistration.delete({ where: { id: oldPending.id } });
      }
    }

    const qrToken = `HO-${generateQrToken()}`;
    const registration = await handsOnRepository.create({
      ...input,
      eventId,
      qrToken,
    });

    // Se o valor for maior que zero, gera a cobrança Pix via Mercado Pago
    if (Number(input.amount) > 0) {
      try {
        const event = await prisma.event.findUnique({
          where: { id: eventId },
          select: { mpAccessToken: true },
        });
        const mpToken = event?.mpAccessToken || env.MP_ACCESS_TOKEN;

        const [firstName, ...rest] = input.name.trim().split(" ");
        const lastName = rest.join(" ") || "Participante";
        const cleanDoc = input.document.replace(/\D/g, "");
        const formattedCpf =
          cleanDoc.length === 11
            ? `${cleanDoc.slice(0, 3)}.${cleanDoc.slice(3, 6)}.${cleanDoc.slice(6, 9)}-${cleanDoc.slice(9)}`
            : cleanDoc;

        const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos de validade do Pix

        let finalResult: any = registration;
        if (Number(input.amount) > 0) {
          try {
            const pixPayment = await mercadoPagoClient.createPixPayment({
              referenceId: `ho:${registration.id}`,
              amount: Number(input.amount),
              description: `${input.name} - CPF: ${formattedCpf} - ${input.title}`.slice(0, 120),
              expiresAt,
              accessToken: mpToken || undefined,
              payer: {
                firstName: firstName || "Participante",
                lastName,
                document: cleanDoc,
                email: input.email.trim(),
              },
            });

            const updated = await handsOnRepository.updatePaymentInfo(registration.id, {
              paymentId: pixPayment.paymentId,
              paymentQrCodeContent: pixPayment.qrCodeContent,
              paymentQrCodeBase64: pixPayment.qrCodeBase64,
              paymentExpiresAt: expiresAt,
            });

            finalResult = {
              ...updated,
              pixCode: pixPayment.qrCodeContent,
              pixQrCodeBase64: pixPayment.qrCodeBase64,
              pixExpiresAt: expiresAt.toISOString(),
            };
          } catch (mpErr) {
            console.error("[HandsOn] Erro ao gerar Pix no Mercado Pago:", mpErr);
          }
        }

        // Publica evento em tempo real para os administradores (som e notificação verde)
        try {
          adminCheckInBus.publish(eventId, {
            type: "new_inscription",
            eventId,
            inscription: {
              id: registration.id,
              name: registration.name,
              email: registration.email,
              phone: registration.phone,
              document: registration.document,
              category: `🧪 Hands On: ${registration.title}`,
              amount: Number(registration.amount),
              status: registration.status as "PENDING" | "CONFIRMED",
              paymentMethod: Number(input.amount) > 0 ? "PIX" : null,
              createdAt: registration.createdAt.toISOString(),
              gratuita: Number(input.amount) === 0,
            },
          });
        } catch (notifErr) {
          console.warn("[HandsOn] Falha ao notificar administradores em tempo real:", notifErr);
        }

        return finalResult;
      } catch (err) {
        console.error("[HandsOn] Erro no fluxo de criação de inscrição:", err);
        return registration;
      }
    }

    // Se o valor for 0 (gratuito)
    try {
      adminCheckInBus.publish(eventId, {
        type: "new_inscription",
        eventId,
        inscription: {
          id: registration.id,
          name: registration.name,
          email: registration.email,
          phone: registration.phone,
          document: registration.document,
          category: `🧪 Hands On: ${registration.title}`,
          amount: 0,
          status: registration.status as "PENDING" | "CONFIRMED",
          paymentMethod: null,
          createdAt: registration.createdAt.toISOString(),
          gratuita: true,
        },
      });
    } catch (notifErr) {
      console.warn("[HandsOn] Falha ao notificar administradores em tempo real:", notifErr);
    }

    return registration;
  },

  async cancelPendingWhenFull(
    eventId: string,
    handsOnId: string
  ): Promise<{ cancelledCount: number }> {
    const relatedIds = getRelatedHandsOnIds(handsOnId);
    const targetId = relatedIds[0];
    const maxVagas = await handsOnService.getWorkshopCapacity(eventId, targetId);

    const confirmedCount = await prisma.handsOnRegistration.count({
      where: {
        eventId,
        handsOnId: { in: relatedIds },
        status: "CONFIRMED",
      },
    });

    if (confirmedCount < maxVagas) {
      return { cancelledCount: 0 };
    }

    const pendentes = await prisma.handsOnRegistration.findMany({
      where: {
        eventId,
        handsOnId: { in: relatedIds },
        status: "PENDING",
      },
    });

    if (pendentes.length === 0) {
      return { cancelledCount: 0 };
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { mpAccessToken: true },
    });
    const mpToken = event?.mpAccessToken || env.MP_ACCESS_TOKEN;

    let cancelledCount = 0;
    for (const p of pendentes) {
      if (p.paymentId) {
        try {
          await mercadoPagoClient.cancelPayment(p.paymentId, mpToken || undefined);
        } catch (err) {
          console.warn(`[HandsOn] Erro ao cancelar cobrança ${p.paymentId} no Mercado Pago:`, err);
        }
      }

      await prisma.handsOnRegistration.update({
        where: { id: p.id },
        data: {
          status: "CANCELLED",
          notes: `Cancelado automaticamente: vagas esgotadas para este workshop (${confirmedCount}/${maxVagas} confirmadas).`,
        },
      });
      cancelledCount++;
    }

    console.log(
      `[HandsOn] ${cancelledCount} inscrições pendentes do workshop "${targetId}" foram canceladas no Mercado Pago e marcadas como CANCELLED.`
    );
    return { cancelledCount };
  },

  async syncAllSoldOutWorkshops(
    eventId: string
  ): Promise<{ cancelledTotal: number; details: Record<string, number> }> {
    let cancelledTotal = 0;
    const details: Record<string, number> = {};
    const capacities = await handsOnService.getCapacities(eventId);

    for (const [id] of Object.entries(capacities)) {
      const res = await handsOnService.cancelPendingWhenFull(eventId, id);
      if (res.cancelledCount > 0) {
        details[id] = res.cancelledCount;
        cancelledTotal += res.cancelledCount;
      }
    }

    return { cancelledTotal, details };
  },

  async cleanupDuplicatesForParticipant(
    eventId: string,
    handsOnId: string,
    document: string,
    keepRegistrationId: string
  ): Promise<number> {
    const cleanDoc = document.replace(/\D/g, "");
    const relatedIds = getRelatedHandsOnIds(handsOnId);

    const duplicates = await prisma.handsOnRegistration.findMany({
      where: {
        eventId,
        handsOnId: { in: relatedIds },
        id: { not: keepRegistrationId },
        status: "PENDING",
        OR: [
          { document: cleanDoc },
          { document: document },
        ],
      },
    });

    if (duplicates.length === 0) return 0;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { mpAccessToken: true },
    });
    const mpToken = event?.mpAccessToken || env.MP_ACCESS_TOKEN;

    let deletedCount = 0;
    for (const d of duplicates) {
      if (d.paymentId) {
        try {
          await mercadoPagoClient.cancelPayment(d.paymentId, mpToken || undefined);
        } catch (err) {
          console.warn(`[HandsOn] Erro ao cancelar Pix duplicado ${d.paymentId}:`, err);
        }
      }
      await prisma.handsOnRegistration.delete({ where: { id: d.id } });
      deletedCount++;
    }

    if (deletedCount > 0) {
      console.log(
        `[HandsOn] ${deletedCount} inscrição(ões) duplicada(s) pendente(s) do participante ${cleanDoc} no workshop "${handsOnId}" foram excluídas após confirmação.`
      );
    }
    return deletedCount;
  },

  async confirmMercadoPagoPayment(
    registrationId: string,
    pagamento: { paymentId: string; centavos: number }
  ): Promise<{ ok: boolean; motivo: string }> {
    const reg = await handsOnRepository.findById(registrationId);
    if (!reg) {
      return { ok: false, motivo: "inscricao_hands_on_inexistente" };
    }

    if (reg.status === "CONFIRMED") {
      return { ok: true, motivo: "ja_confirmada" };
    }

    const esperadoEmCentavos = Math.round(Number(reg.amount) * 100);
    if (mercadoPagoClient.configurado && pagamento.centavos < esperadoEmCentavos) {
      console.error(
        `[MercadoPago] valor abaixo do esperado no Hands On: pagou ${pagamento.centavos}, esperado ${esperadoEmCentavos}, registro ${reg.id}`
      );
      return { ok: false, motivo: "valor_insuficiente" };
    }

    const relatedIds = getRelatedHandsOnIds(reg.handsOnId);
    const targetId = relatedIds[0];
    const maxVagas = await handsOnService.getWorkshopCapacity(reg.eventId, targetId);

    const confirmedCount = await prisma.handsOnRegistration.count({
      where: {
        eventId: reg.eventId,
        handsOnId: { in: relatedIds },
        status: "CONFIRMED",
      },
    });

    const isExceeded = confirmedCount >= maxVagas;
    const note = isExceeded
      ? `Confirmado via Mercado Pago Pix (ID: ${pagamento.paymentId}) [ALÉM DO LIMITE: vaga excedente ${confirmedCount + 1}/${maxVagas}]`
      : `Confirmado automaticamente via Mercado Pago Pix (ID: ${pagamento.paymentId})`;

    await handsOnRepository.confirmPaid(reg.id, pagamento.paymentId, note);

    // Publica confirmação em tempo real para os administradores
    try {
      adminCheckInBus.publish(reg.eventId, {
        type: "inscription_confirmed",
        eventId: reg.eventId,
        inscriptionId: reg.id,
        name: reg.name,
        email: reg.email,
        category: `🧪 Hands On: ${reg.title}`,
        amount: Number(reg.amount),
        paymentMethod: "PIX",
        confirmedAt: new Date().toISOString(),
      });
    } catch (notifErr) {
      console.warn("[HandsOn] Erro ao publicar confirmação de inscrição:", notifErr);
    }

    // Envia comprovante por e-mail com QR Code se configurado no evento
    try {
      const event = await prisma.event.findUnique({
        where: { id: reg.eventId },
        select: { id: true, name: true, location: true, emailSettings: true },
      });
      if (event) {
        const configEmail = resolveEmailSettings(event.emailSettings);
        if (configEmail.autoSendReceipt) {
          emailService
            .sendRegistrationReceipt(event, {
              to: reg.email,
              participantName: reg.name,
              inscriptionId: reg.id,
              batchName: `Hands On: ${reg.title}`,
              amount: Number(reg.amount),
              qrToken: reg.qrToken,
              eventLocation: reg.location || event.location,
            })
            .catch((err: unknown) => console.error("[HandsOn] Falha ao enviar e-mail de comprovante:", err));
        }
      }
    } catch (emailErr) {
      console.warn("[HandsOn] Erro ao preparar envio de e-mail:", emailErr);
    }

    // Remove automaticamente qualquer inscrição duplicada pendente da mesma pessoa neste workshop
    await handsOnService.cleanupDuplicatesForParticipant(
      reg.eventId,
      reg.handsOnId,
      reg.document,
      reg.id
    );

    // Se o workshop acabou de atingir ou ultrapassar o limite de vagas,
    // cancela imediatamente todas as outras cobranças Pix pendentes no Mercado Pago
    await handsOnService.cancelPendingWhenFull(reg.eventId, reg.handsOnId);

    return { ok: true, motivo: isExceeded ? "confirmado_excedente" : "confirmado_com_sucesso" };
  },

  async getPublicRegistration(id: string) {
    let reg = await handsOnRepository.findById(id);
    if (!reg) throw new NotFoundError("Inscrição de Hands On não encontrada");

    // Se estiver pendente, primeiro checa se as vagas do workshop se esgotaram
    if (reg.status === "PENDING") {
      const relatedIds = getRelatedHandsOnIds(reg.handsOnId);
      const targetId = relatedIds[0];
      const maxVagas = await handsOnService.getWorkshopCapacity(reg.eventId, targetId);

      const confirmedCount = await prisma.handsOnRegistration.count({
        where: {
          eventId: reg.eventId,
          handsOnId: { in: relatedIds },
          status: "CONFIRMED",
        },
      });

      if (confirmedCount >= maxVagas) {
        // Workshop esgotou: cancela cobrança no MP e marca como CANCELLED
        try {
          const event = await prisma.event.findUnique({
            where: { id: reg.eventId },
            select: { mpAccessToken: true },
          });
          const mpToken = event?.mpAccessToken || env.MP_ACCESS_TOKEN;
          if (reg.paymentId) {
            await mercadoPagoClient.cancelPayment(reg.paymentId, mpToken || undefined);
          }
        } catch (mpErr) {
          console.warn("[HandsOn] Erro ao cancelar Pix esgotado no MP:", mpErr);
        }

        await prisma.handsOnRegistration.update({
          where: { id: reg.id },
          data: {
            status: "CANCELLED",
            notes: `Cancelado automaticamente: vagas esgotadas para este workshop (${confirmedCount}/${maxVagas} confirmadas).`,
          },
        });

        reg = (await handsOnRepository.findById(id)) || reg;
      }
    }

    // Se continuar pendente (workshop ainda com vagas), consulta status ativo no gateway Mercado Pago
    if (reg.status === "PENDING") {
      try {
        const event = await prisma.event.findUnique({
          where: { id: reg.eventId },
          select: { mpAccessToken: true },
        });
        const mpToken = event?.mpAccessToken || env.MP_ACCESS_TOKEN;

        let conferencia = reg.paymentId
          ? await mercadoPagoClient.conferirPagamento(reg.paymentId, mpToken || undefined)
          : null;

        // Se não tinha paymentId salvo, tenta localizar pela referência externa ho:<id>
        if (!conferencia || !conferencia.ok) {
          conferencia = await mercadoPagoClient.buscarPagamentoPorReferencia(
            `ho:${reg.id}`,
            mpToken || undefined
          );
          if (conferencia?.ok && conferencia.dados.paymentId && !reg.paymentId) {
            await handsOnRepository.updatePaymentInfo(reg.id, {
              paymentId: conferencia.dados.paymentId,
            });
            reg.paymentId = conferencia.dados.paymentId;
          }
        }

        if (conferencia?.ok && conferencia.dados.aprovado) {
          await handsOnService.confirmMercadoPagoPayment(reg.id, {
            paymentId: conferencia.dados.paymentId,
            centavos: conferencia.dados.centavos,
          });
          const reloaded = await handsOnRepository.findById(id);
          if (reloaded) reg = reloaded;
        }
      } catch (checkErr) {
        console.warn("[HandsOn] Falha ao conferir pagamento no Mercado Pago:", checkErr);
      }
    }

    return {
      id: reg.id,
      handsOnId: reg.handsOnId,
      title: reg.title,
      speaker: reg.speaker,
      date: reg.date,
      time: reg.time,
      location: reg.location,
      amount: Number(reg.amount),
      name: reg.name,
      document: reg.document,
      email: reg.email,
      status: reg.status,
      paidAt: reg.paidAt,
      qrToken: reg.qrToken,
      paymentId: reg.paymentId,
      pixCode: reg.paymentQrCodeContent,
      pixQrCodeBase64: reg.paymentQrCodeBase64,
      pixExpiresAt: reg.paymentExpiresAt,
      checkedInAt: reg.checkedInAt,
      notes: reg.notes,
    };
  },

  async listRegistrations(eventId: string, handsOnId?: string) {
    return handsOnRepository.listByEvent(eventId, handsOnId);
  },

  async getWorkshopStats(eventId: string) {
    const [grouped, capacities] = await Promise.all([
      handsOnRepository.countByWorkshop(eventId),
      this.getCapacities(eventId),
    ]);
    const stats: Record<string, { total: number; confirmed: number; pending: number; maxVagas: number }> = {};

    for (const [id, cap] of Object.entries(capacities)) {
      stats[id] = { total: 0, confirmed: 0, pending: 0, maxVagas: cap };
    }

    for (const item of grouped) {
      if (!stats[item.handsOnId]) {
        stats[item.handsOnId] = {
          total: 0,
          confirmed: 0,
          pending: 0,
          maxVagas: capacities[item.handsOnId] ?? 12,
        };
      }
      stats[item.handsOnId].total += item._count.id;
      if (item.status === "CONFIRMED") {
        stats[item.handsOnId].confirmed += item._count.id;
      } else if (item.status === "PENDING") {
        stats[item.handsOnId].pending += item._count.id;
      }
    }

    return stats;
  },

  async getAttendeeHandsOn(document: string, email: string, eventId?: string) {
    return handsOnRepository.findByAttendee(document, email, eventId);
  },

  async confirmPayment(id: string, notes?: string | null) {
    const reg = await handsOnRepository.findById(id);
    if (!reg) throw new NotFoundError("Inscrição de Hands On não encontrada");
    const updated = await handsOnRepository.updateStatus(id, "CONFIRMED", notes);
    await handsOnService.cleanupDuplicatesForParticipant(
      reg.eventId,
      reg.handsOnId,
      reg.document,
      reg.id
    );
    await handsOnService.cancelPendingWhenFull(reg.eventId, reg.handsOnId);

    // Publica confirmação em tempo real no admin
    try {
      adminCheckInBus.publish(reg.eventId, {
        type: "inscription_confirmed",
        eventId: reg.eventId,
        inscriptionId: reg.id,
        name: reg.name,
        email: reg.email,
        category: `🧪 Hands On: ${reg.title}`,
        amount: Number(reg.amount),
        paymentMethod: "MANUAL",
        confirmedAt: new Date().toISOString(),
      });
    } catch (notifErr) {
      console.warn("[HandsOn] Erro ao publicar confirmação de inscrição manual:", notifErr);
    }

    // Envia comprovante por e-mail com QR Code se configurado
    try {
      const event = await prisma.event.findUnique({
        where: { id: reg.eventId },
        select: { id: true, name: true, location: true, emailSettings: true },
      });
      if (event) {
        const configEmail = resolveEmailSettings(event.emailSettings);
        if (configEmail.autoSendReceipt) {
          emailService
            .sendRegistrationReceipt(event, {
              to: reg.email,
              participantName: reg.name,
              inscriptionId: reg.id,
              batchName: `Hands On: ${reg.title}`,
              amount: Number(reg.amount),
              qrToken: reg.qrToken,
              eventLocation: reg.location || event.location,
            })
            .catch((err: unknown) => console.error("[HandsOn] Falha ao enviar e-mail de comprovante:", err));
        }
      }
    } catch (emailErr) {
      console.warn("[HandsOn] Erro ao preparar envio de e-mail:", emailErr);
    }

    return updated;
  },

  async cancelRegistration(id: string, notes?: string | null) {
    const reg = await handsOnRepository.findById(id);
    if (!reg) throw new NotFoundError("Inscrição de Hands On não encontrada");
    return handsOnRepository.updateStatus(id, "CANCELLED", notes);
  },

  async checkIn(idOrToken: string, checkedInBy?: string) {
    let reg = await handsOnRepository.findById(idOrToken);
    if (!reg) {
      reg = await handsOnRepository.findByQrToken(idOrToken);
    }
    if (!reg) throw new NotFoundError("Inscrição de Hands On não encontrada");

    if (reg.checkedInAt) {
      return { registration: reg, alreadyCheckedIn: true };
    }

    const updated = await handsOnRepository.recordCheckin(reg.id, checkedInBy);

    // Publica check-in em tempo real no monitor
    try {
      adminCheckInBus.publish(reg.eventId, {
        type: "check_in",
        eventId: reg.eventId,
        participantId: reg.id,
        participantName: reg.name,
        participantEmail: reg.email,
        participantPhone: reg.phone,
        participantDocument: reg.document,
        status: "CONFIRMED",
        checkedInAt: updated.checkedInAt ? updated.checkedInAt.toISOString() : new Date().toISOString(),
        terminalName: "Porta Hands On",
        source: "hands-on",
      });
    } catch (checkinNotifErr) {
      console.warn("[HandsOn] Erro ao publicar evento de check-in:", checkinNotifErr);
    }

    return { registration: updated, alreadyCheckedIn: false };
  },

  async deleteRegistration(id: string) {
    const reg = await handsOnRepository.findById(id);
    if (!reg) throw new NotFoundError("Inscrição de Hands On não encontrada");
    return handsOnRepository.delete(id);
  },

  async deleteAllRegistrations(eventId: string) {
    return handsOnRepository.deleteAllByEvent(eventId);
  },

  async registerManual(
    eventId: string,
    input: Omit<CreateHandsOnData, "eventId" | "qrToken">
  ) {
    const qrToken = `HO-${generateQrToken()}`;
    const status = input.status || "CONFIRMED";
    const created = await handsOnRepository.create({
      ...input,
      eventId,
      qrToken,
      status,
      paidAt: status === "CONFIRMED" ? new Date() : undefined,
    });
    if (status === "CONFIRMED") {
      await handsOnService.cleanupDuplicatesForParticipant(
        eventId,
        input.handsOnId,
        input.document,
        created.id
      );
      await handsOnService.cancelPendingWhenFull(eventId, input.handsOnId);

      try {
        adminCheckInBus.publish(eventId, {
          type: "inscription_confirmed",
          eventId,
          inscriptionId: created.id,
          name: created.name,
          email: created.email,
          category: `🧪 Hands On: ${created.title}`,
          amount: Number(created.amount),
          paymentMethod: "MANUAL",
          confirmedAt: new Date().toISOString(),
        });
      } catch (notifErr) {
        console.warn("[HandsOn] Erro ao publicar confirmação de inscrição manual:", notifErr);
      }
    }
    return created;
  },
};
