import { prisma } from "../database/prisma.js";

/**
 * O evento é do COPOL?
 *
 * Mesma regra que o resto do projeto já usa (batches.service, painel): nome
 * ou slug contém "copol". Também vale quem já está com o credenciamento por
 * dia ligado, que a migration só ligou nos eventos do COPOL — assim,
 * renomear o evento depois não faz ele deixar de ser tratado como COPOL.
 *
 * Existe para que comportamentos pedidos SÓ para o COPOL não vazem para os
 * outros eventos, que ficam exatamente como estão.
 */
export function isCopolEvent(event: { name: string; slug: string | null; multiDayCheckIn: boolean }): boolean {
  return event.multiDayCheckIn || /copol/i.test(`${event.name} ${event.slug ?? ""}`);
}

export async function eventIsCopol(eventId: string): Promise<boolean> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { name: true, slug: true, multiDayCheckIn: true },
  });
  return !!event && isCopolEvent(event);
}
