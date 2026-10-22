import { handsOnRepository, type CreateHandsOnData } from "./hands-on.repository.js";
import { generateQrToken } from "../../shared/tokens.js";
import { NotFoundError } from "../../shared/errors.js";
import { mercadoPagoClient } from "../../lib/mercadopago/mercadopago.client.js";
import { prisma } from "../../database/prisma.js";
import { env } from "../../config/env.js";

export const handsOnService = {
  async register(eventId: string, input: Omit<CreateHandsOnData, "eventId" | "qrToken">) {
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

        const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos de validade do Pix

        const pixPayment = await mercadoPagoClient.createPixPayment({
          referenceId: `ho:${registration.id}`,
          amount: Number(input.amount),
          description: `COPOL 2026 - Hands On: ${input.title.slice(0, 80)}`,
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
          paymentUrl: pixPayment.paymentUrl,
        });

        return {
          ...updated,
          pixCode: pixPayment.qrCodeContent,
          pixQrCodeBase64: pixPayment.qrCodeBase64,
          pixExpiresAt: expiresAt.toISOString(),
        };
      } catch (mpErr) {
        console.error("[HandsOn] Erro ao gerar Pix no Mercado Pago:", mpErr);
        return registration;
      }
    }

    return registration;
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

    await handsOnRepository.confirmPaid(
      reg.id,
      pagamento.paymentId,
      `Confirmado automaticamente via Mercado Pago Pix (ID: ${pagamento.paymentId})`
    );

    return { ok: true, motivo: "confirmado_com_sucesso" };
  },

  async getPublicRegistration(id: string) {
    let reg = await handsOnRepository.findById(id);
    if (!reg) throw new NotFoundError("Inscrição de Hands On não encontrada");

    // Se estiver pendente e possuir paymentId do Mercado Pago, consulta status ativo no gateway
    if (reg.status === "PENDING" && reg.paymentId) {
      try {
        const event = await prisma.event.findUnique({
          where: { id: reg.eventId },
          select: { mpAccessToken: true },
        });
        const mpToken = event?.mpAccessToken || env.MP_ACCESS_TOKEN;
        const conferencia = await mercadoPagoClient.conferirPagamento(
          reg.paymentId,
          mpToken || undefined
        );
        if (conferencia.ok && conferencia.dados.aprovado) {
          await handsOnService.confirmMercadoPagoPayment(reg.id, {
            paymentId: reg.paymentId,
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
    };
  },

  async listRegistrations(eventId: string, handsOnId?: string) {
    return handsOnRepository.listByEvent(eventId, handsOnId);
  },

  async getWorkshopStats(eventId: string) {
    const grouped = await handsOnRepository.countByWorkshop(eventId);
    const stats: Record<string, { total: number; confirmed: number; pending: number }> = {};

    for (const item of grouped) {
      if (!stats[item.handsOnId]) {
        stats[item.handsOnId] = { total: 0, confirmed: 0, pending: 0 };
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
    return handsOnRepository.updateStatus(id, "CONFIRMED", notes);
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
    return { registration: updated, alreadyCheckedIn: false };
  },

  async deleteRegistration(id: string) {
    const reg = await handsOnRepository.findById(id);
    if (!reg) throw new NotFoundError("Inscrição de Hands On não encontrada");
    return handsOnRepository.delete(id);
  },
};
