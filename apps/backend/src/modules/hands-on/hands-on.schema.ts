import { z } from "zod";

export const createHandsOnInscriptionSchema = z.object({
  handsOnId: z.string().min(1, "handsOnId é obrigatório"),
  title: z.string().min(1, "Título é obrigatório"),
  speaker: z.string().min(1, "Ministrante é obrigatório"),
  date: z.string().min(1, "Data é obrigatória"),
  time: z.string().min(1, "Horário é obrigatório"),
  location: z.string().optional().nullable(),
  sponsor: z.string().optional().nullable(),
  amount: z.number().min(0, "Valor não pode ser negativo"),
  name: z.string().trim().min(1, "Nome é obrigatório"),
  email: z.string().trim().email("E-mail inválido"),
  document: z.string().trim().min(1, "CPF é obrigatório"),
  phone: z.string().trim().optional().nullable(),
  category: z.string().trim().optional().nullable(),
  institution: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

export const updateHandsOnStatusSchema = z.object({
  status: z.enum(["PENDING", "CONFIRMED", "CANCELLED"]),
  notes: z.string().optional().nullable(),
});

export const handsOnCheckinSchema = z.object({
  qrToken: z.string().optional(),
  checkedInBy: z.string().optional(),
});
