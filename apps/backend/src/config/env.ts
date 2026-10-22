import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatória"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET deve ter pelo menos 16 caracteres"),
  JWT_ADMIN_EXPIRES_IN: z.string().default("8h"),
  CORS_ORIGINS: z.string().optional().default(""),

  // Diretório onde certificados/comprovantes gerados são gravados (ver
  // certificate-storage.ts) — relativo ao cwd do processo se não for
  // absoluto. Trocar por storage externo no futuro não muda este env var,
  // só a implementação de CertificateStorage.
  STORAGE_DIR: z.string().min(1).default("./storage"),

  // Base pública do portal pre-copol, usada só para montar a URL de
  // validação embutida no QR Code do certificado (ex.:
  // "https://precopol.lspktecnology.com.br/certificados"). Sem barra no
  // final.
  CERTIFICATE_VALIDATION_BASE_URL: z.string().min(1).default("http://localhost:3002/certificados"),

  // Integração PicPay E-Commerce
  PICPAY_TOKEN: z.string().optional().default(""),
  PICPAY_SELLER_TOKEN: z.string().optional().default(""),

  // Integração Mercado Pago (Pix transparente).
  //
  // Em testes (NODE_ENV=test) sem MP_ACCESS_TOKEN o cliente entra em modo simulado.
  // Em produção, se não definido no ambiente, utiliza as credenciais ativas do COPOL.
  MP_ACCESS_TOKEN: z
    .string()
    .optional()
    .transform((val) =>
      val && val.trim() !== ""
        ? val
        : process.env.NODE_ENV === "test"
        ? ""
        : "APP_USR-1318704975177933-091811-25e6e8cb9dfd072f2949e9809459dcd8-672805558"
    ),
  MP_PUBLIC_KEY: z
    .string()
    .optional()
    .transform((val) =>
      val && val.trim() !== ""
        ? val
        : process.env.NODE_ENV === "test"
        ? ""
        : "APP_USR-8b30c67d-1554-4890-9c60-fdf294880b9d"
    ),
  // Chave secreta gerada ao cadastrar o webhook no painel do Mercado Pago.
  MP_WEBHOOK_SECRET: z
    .string()
    .optional()
    .transform((val) =>
      val && val.trim() !== ""
        ? val
        : process.env.NODE_ENV === "test"
        ? ""
        : "051f4620403982f83fe5e4521437275579351a423e7011caea64ba102637a3f5"
    ),

  // Envio de e-mails via Resend
  RESEND_API_KEY: z.string().optional().default(""),
  EMAIL_FROM: z.string().default("COPOL 2026 <contato@copol2026.com.br>"),

  // Envio de e-mails via SMTP (Gmail, etc.)
  SMTP_HOST: z.string().optional().default("smtp.gmail.com"),
  SMTP_PORT: z.coerce.number().int().positive().default(465),
  SMTP_SECURE: z.coerce.boolean().default(true),
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASS: z.string().optional().default(""),

  // URLs públicas do sistema
  PRE_COPOL_BASE_URL: z.string().default("https://copol2026.com.br"),
  BACKEND_PUBLIC_URL: z.string().default("http://137.131.233.254:3000"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Falha rápida e clara na inicialização — nunca subir o servidor com
  // configuração inválida ou secrets ausentes.
  console.error("Variáveis de ambiente inválidas:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
