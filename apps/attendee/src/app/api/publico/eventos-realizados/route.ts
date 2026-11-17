import { NextRequest, NextResponse } from "next/server";
import { cabecalhosDeOrigem, proxyRequest } from "../../proxy";

/**
 * Eventos Encerrados que o organizador escolheu mostrar no site (aba
 * "Realizados"). Público: sem token.
 */
export async function GET(request: NextRequest) {
  const res = await proxyRequest("/public/events/closed", {
    method: "GET",
    headers: cabecalhosDeOrigem(request),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
