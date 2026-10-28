import { NextRequest, NextResponse } from "next/server";
import { cabecalhosDeOrigem, proxyRequest } from "@/app/api/proxy";

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ slug: string; submissionId: string }> }
) {
  const { slug, submissionId } = await ctx.params;
  const body = await request.json();

  const res = await proxyRequest(
    `/public/events/${encodeURIComponent(slug)}/submissions/${encodeURIComponent(submissionId)}/admin-edit`,
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: cabecalhosDeOrigem(request),
    }
  );

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
