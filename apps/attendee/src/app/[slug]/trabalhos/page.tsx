import { TrabalhosCliente } from "./TrabalhosCliente";

export const dynamic = "force-dynamic";

export default async function PaginaTrabalhos({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <TrabalhosCliente slug={slug} />;
}
