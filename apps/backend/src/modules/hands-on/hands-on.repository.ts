import { prisma } from "../../database/prisma.js";

export interface CreateHandsOnData {
  eventId: string;
  handsOnId: string;
  title: string;
  speaker: string;
  date: string;
  time: string;
  location?: string | null;
  sponsor?: string | null;
  amount: number;
  name: string;
  email: string;
  document: string;
  phone?: string | null;
  category?: string | null;
  institution?: string | null;
  status?: string;
  qrToken: string;
  notes?: string | null;
}

export const handsOnRepository = {
  async create(data: CreateHandsOnData) {
    return prisma.handsOnRegistration.create({
      data: {
        eventId: data.eventId,
        handsOnId: data.handsOnId,
        title: data.title,
        speaker: data.speaker,
        date: data.date,
        time: data.time,
        location: data.location ?? null,
        sponsor: data.sponsor ?? null,
        amount: data.amount,
        name: data.name,
        email: data.email,
        document: data.document,
        phone: data.phone ?? null,
        category: data.category ?? null,
        institution: data.institution ?? null,
        status: data.status ?? (data.amount === 0 ? "CONFIRMED" : "PENDING"),
        qrToken: data.qrToken,
        notes: data.notes ?? null,
      },
    });
  },

  async findById(id: string) {
    return prisma.handsOnRegistration.findUnique({
      where: { id },
    });
  },

  async findByQrToken(qrToken: string) {
    return prisma.handsOnRegistration.findUnique({
      where: { qrToken },
    });
  },

  async listByEvent(eventId: string, handsOnId?: string) {
    return prisma.handsOnRegistration.findMany({
      where: {
        eventId,
        ...(handsOnId ? { handsOnId } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async countByWorkshop(eventId: string) {
    const list = await prisma.handsOnRegistration.groupBy({
      by: ["handsOnId", "status"],
      where: { eventId },
      _count: { id: true },
    });
    return list;
  },

  async findByAttendee(document: string, email: string, eventId?: string) {
    const cleanDoc = (document || "").replace(/\D/g, "");
    const cleanEmail = (email || "").trim().toLowerCase();

    const orConditions: Array<{ document?: { contains: string }; email?: { equals: string; mode: "insensitive" } }> = [];
    if (cleanDoc.length >= 6) {
      orConditions.push({ document: { contains: cleanDoc } });
    }
    if (cleanEmail.includes("@")) {
      orConditions.push({ email: { equals: cleanEmail, mode: "insensitive" } });
    }

    if (orConditions.length === 0) {
      return [];
    }

    return prisma.handsOnRegistration.findMany({
      where: {
        ...(eventId ? { eventId } : {}),
        OR: orConditions,
      },
      orderBy: { date: "asc" },
    });
  },

  async updateStatus(id: string, status: string, notes?: string | null) {
    return prisma.handsOnRegistration.update({
      where: { id },
      data: {
        status,
        ...(status === "CONFIRMED" ? { paidAt: new Date() } : {}),
        ...(notes !== undefined ? { notes } : {}),
      },
    });
  },

  async updatePaymentInfo(
    id: string,
    data: {
      paymentId?: string | null;
      paymentQrCodeContent?: string | null;
      paymentQrCodeBase64?: string | null;
      paymentExpiresAt?: Date | null;
      paymentUrl?: string | null;
    }
  ) {
    return prisma.handsOnRegistration.update({
      where: { id },
      data,
    });
  },

  async confirmPaid(id: string, paymentId?: string, notes?: string | null) {
    return prisma.handsOnRegistration.update({
      where: { id },
      data: {
        status: "CONFIRMED",
        paidAt: new Date(),
        ...(paymentId ? { paymentId } : {}),
        ...(notes !== undefined ? { notes } : {}),
      },
    });
  },

  async recordCheckin(id: string, checkedInBy?: string) {
    return prisma.handsOnRegistration.update({
      where: { id },
      data: {
        checkedInAt: new Date(),
        checkedInBy: checkedInBy ?? "ADMIN",
        status: "CONFIRMED",
      },
    });
  },
};
