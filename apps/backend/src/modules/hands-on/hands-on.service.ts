import { handsOnRepository, type CreateHandsOnData } from "./hands-on.repository.js";
import { generateQrToken } from "../../shared/tokens.js";
import { NotFoundError } from "../../shared/errors.js";

export const handsOnService = {
  async register(eventId: string, input: Omit<CreateHandsOnData, "eventId" | "qrToken">) {
    const qrToken = `HO-${generateQrToken()}`;
    return handsOnRepository.create({
      ...input,
      eventId,
      qrToken,
    });
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
};
