import type { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import { ConflictError, NotFoundError, ValidationError } from "../../shared/errors.js";
import { isAlreadyInEvent, normalizeEmail, onlyDigits } from "../participants/participants.identity.js";
import type { UpdateInscriptionInput } from "./inscriptions.schema.js";

type InscricaoAtual = Prisma.InscriptionGetPayload<{ include: { batch: true } }>;

interface PagamentoResolvido {
  isCourtesy: boolean;
  inscricao: Pick<Prisma.InscriptionUpdateInput, "amount" | "isCourtesy" | "paymentMethod" | "paymentProvider">;
}

/**
 * Traduz a forma escolhida no painel para o que vai no banco, ou recusa.
 *
 * Só inscrição CONFIRMADA: a pendente ainda não tem participante e tem
 * o próprio caminho (confirmar ou cancelar). E nunca uma paga pelo
 * gateway — o dinheiro está lá, e transformá-la em cortesia (ou mudar o
 * valor) faria o relatório contradizer o extrato.
 */
function resolverPagamento(atual: InscricaoAtual, pedido: NonNullable<UpdateInscriptionInput["pagamento"]>): PagamentoResolvido {
  if (atual.status !== "CONFIRMED") {
    throw new ConflictError(
      "PAGAMENTO_NAO_EDITAVEL",
      "Só é possível alterar a forma de pagamento de uma inscrição confirmada",
    );
  }
  if (atual.paymentProvider === "MERCADO_PAGO" || atual.paymentProvider === "PICPAY") {
    throw new ConflictError(
      "PAGAMENTO_GATEWAY",
      "Esta inscrição foi paga pelo gateway de pagamento; a forma de pagamento não pode ser alterada aqui",
    );
  }

  if (pedido.forma === "CORTESIA") {
    return {
      isCourtesy: true,
      inscricao: { amount: 0, isCourtesy: true, paymentMethod: null, paymentProvider: null },
    };
  }

  // Sem valor informado: mantém o que já foi cobrado (trocar Pix por
  // Cartão não pode apagar um desconto); era cortesia (valor 0), vale o
  // preço do lote.
  const jaCobrado = Number(atual.amount);
  const valor = pedido.valor ?? (jaCobrado > 0 ? jaCobrado : Number(atual.batch?.price ?? 0));
  if (!(valor > 0)) {
    throw new ValidationError("Informe o valor pago (maior que zero) ou use a forma Cortesia");
  }

  return {
    isCourtesy: false,
    inscricao: {
      amount: valor,
      isCourtesy: false,
      paymentMethod: pedido.forma === "PIX" ? "PIX" : pedido.forma === "CARD" ? "CARD" : null,
      paymentProvider: "MANUAL",
    },
  };
}

/**
 * Edita uma inscrição pelo painel: dados da pessoa e/ou forma de
 * pagamento, TUDO numa transação.
 *
 * Os dados valem para a inscrição E para o participante ligado a ela —
 * o portal entra pelo e-mail do participante, e o relatório lê a
 * inscrição; mudar só um deixaria os dois contando histórias diferentes.
 *
 * A vaga do lote não muda: continua ocupada, qualquer que seja a forma.
 */
export async function updateInscription(eventId: string, id: string, input: UpdateInscriptionInput) {
  const atual = await prisma.inscription.findUnique({ where: { id }, include: { batch: true } });
  if (!atual || atual.eventId !== eventId) {
    throw new NotFoundError("Inscrição não encontrada");
  }

  const pagamento = input.pagamento ? resolverPagamento(atual, input.pagamento) : null;

  // Só confere duplicado do que MUDOU: duplicado antigo, de um campo que
  // ninguém está mexendo, não pode impedir a correção de um telefone.
  const emailMudou = input.email !== undefined && normalizeEmail(input.email) !== normalizeEmail(atual.email);
  const documentoMudou = input.document !== undefined && onlyDigits(input.document) !== onlyDigits(atual.document);

  const dadosDaPessoa = {
    name: input.name,
    email: input.email,
    document: input.document,
    phone: input.phone,
  };

  return prisma.$transaction(async (tx) => {
    if (emailMudou || documentoMudou) {
      const duplicado = await isAlreadyInEvent(
        tx,
        eventId,
        { email: emailMudou ? input.email : undefined, document: documentoMudou ? input.document : undefined },
        { ignoreParticipantId: atual.participantId ?? undefined },
      );
      if (duplicado) {
        throw new ConflictError("JA_INSCRITO", "Já existe outra pessoa neste evento com esse e-mail ou CPF");
      }
    }

    const atualizada = await tx.inscription.update({
      where: { id },
      data: { ...dadosDaPessoa, institution: input.institution, ...(pagamento?.inscricao ?? {}) },
    });

    if (atual.participantId) {
      await tx.participant.updateMany({
        where: { id: atual.participantId },
        data: { ...dadosDaPessoa, ...(pagamento ? { isCourtesy: pagamento.isCourtesy } : {}) },
      });
    }

    return atualizada;
  });
}
