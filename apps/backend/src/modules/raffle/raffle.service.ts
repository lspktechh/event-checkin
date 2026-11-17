import { randomInt } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import { AppError, ConflictError, NotFoundError } from "../../shared/errors.js";

/** Números de 4 dígitos: fáceis de ler em voz alta e de conferir no celular. */
export const RAFFLE_MIN = 1000;
export const RAFFLE_MAX = 9999;
const MAX_ATTEMPTS = 25;

export interface RaffleEntryView {
  id: string;
  number: number;
  createdAt: Date;
  wins: number;
}

export interface RaffleDrawView {
  id: string;
  entryId: string;
  number: number;
  drawnBy: string | null;
  drawnAt: Date;
}

async function ensureEvent(eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true, name: true } });
  if (!event) throw new NotFoundError("Evento não encontrado");
  return event;
}

function isUniqueViolation(err: unknown): err is Prisma.PrismaClientKnownRequestError {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

export const raffleService = {
  /**
   * Chamado quando alguém abre o link do QR Code. Devolve o número desse
   * aparelho, criando um número aleatório e inédito no evento se ainda não
   * houver. Idempotente por aparelho: escanear de novo devolve o mesmo.
   */
  async claimNumber(eventId: string, deviceKey: string) {
    const event = await ensureEvent(eventId);

    const existing = await prisma.raffleEntry.findUnique({
      where: { eventId_deviceKey: { eventId, deviceKey } },
      select: { number: true, createdAt: true },
    });
    if (existing) return { ...existing, eventName: event.name };

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const number = randomInt(RAFFLE_MIN, RAFFLE_MAX + 1);
      try {
        const entry = await prisma.raffleEntry.create({
          data: { eventId, deviceKey, number },
          select: { number: true, createdAt: true },
        });
        return { ...entry, eventName: event.name };
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
        // Corrida com o mesmo aparelho (dois toques seguidos): devolve o que ganhou.
        const mine = await prisma.raffleEntry.findUnique({
          where: { eventId_deviceKey: { eventId, deviceKey } },
          select: { number: true, createdAt: true },
        });
        if (mine) return { ...mine, eventName: event.name };
        // Senão, o número já era de outra pessoa: tenta outro.
      }
    }
    throw new AppError("RAFFLE_FULL", "Não foi possível gerar um número agora. Tente de novo.", 503);
  },

  async getState(eventId: string): Promise<{ entries: RaffleEntryView[]; draws: RaffleDrawView[] }> {
    await ensureEvent(eventId);
    const [entries, draws] = await Promise.all([
      prisma.raffleEntry.findMany({
        where: { eventId },
        orderBy: { createdAt: "desc" },
        select: { id: true, number: true, createdAt: true, _count: { select: { draws: true } } },
      }),
      prisma.raffleDraw.findMany({
        where: { eventId },
        orderBy: { drawnAt: "desc" },
        select: { id: true, entryId: true, number: true, drawnBy: true, drawnAt: true },
      }),
    ]);
    return {
      entries: entries.map((e) => ({ id: e.id, number: e.number, createdAt: e.createdAt, wins: e._count.draws })),
      draws,
    };
  },

  /**
   * Sorteia um dos números cadastrados. O aleatório é gerado no servidor
   * (crypto.randomInt), nunca no navegador, para o resultado não depender
   * de quem está com o painel aberto.
   */
  async draw(eventId: string, opts: { excludeWinners: boolean; drawnBy: string | null }): Promise<RaffleDrawView> {
    await ensureEvent(eventId);
    const pool = await prisma.raffleEntry.findMany({
      where: { eventId, ...(opts.excludeWinners ? { draws: { none: {} } } : {}) },
      orderBy: { createdAt: "asc" },
      select: { id: true, number: true },
    });
    if (pool.length === 0) {
      throw new ConflictError(
        "RAFFLE_EMPTY",
        opts.excludeWinners ? "Todos os números já foram sorteados." : "Nenhum número gerado ainda."
      );
    }
    const winner = pool[randomInt(pool.length)];
    return prisma.raffleDraw.create({
      data: { eventId, entryId: winner.id, number: winner.number, drawnBy: opts.drawnBy },
      select: { id: true, entryId: true, number: true, drawnBy: true, drawnAt: true },
    });
  },

  /** Desfaz um sorteio (ex.: o dono do número não estava presente). */
  async deleteDraw(eventId: string, drawId: string) {
    const result = await prisma.raffleDraw.deleteMany({ where: { id: drawId, eventId } });
    if (result.count === 0) throw new NotFoundError("Sorteio não encontrado");
  },

  /** Apaga todos os números e sorteios do evento. */
  async reset(eventId: string) {
    await ensureEvent(eventId);
    await prisma.$transaction([
      prisma.raffleDraw.deleteMany({ where: { eventId } }),
      prisma.raffleEntry.deleteMany({ where: { eventId } }),
    ]);
  },
};
