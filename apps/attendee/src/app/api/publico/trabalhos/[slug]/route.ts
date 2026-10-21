import { NextRequest, NextResponse } from "next/server";
import { cabecalhosDeOrigem, proxyRequest } from "@/app/api/proxy";

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;
  const searchParams = request.nextUrl.searchParams;
  const email = searchParams.get("email") ?? "";

  const res = await proxyRequest(
    `/public/events/${encodeURIComponent(slug)}/submissions?email=${encodeURIComponent(email)}`,
    {
      method: "GET",
      headers: cabecalhosDeOrigem(request),
    }
  );

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
