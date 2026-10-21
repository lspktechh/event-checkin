import { NextRequest, NextResponse } from "next/server";
import { cabecalhosDeOrigem, proxyRequest } from "@/app/api/proxy";

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ slug: string; submissionId: string }> }
) {
  const { slug, submissionId } = await ctx.params;
  const searchParams = request.nextUrl.searchParams;
  const email = searchParams.get("email") ?? "";

  const res = await proxyRequest(
    `/public/events/${encodeURIComponent(slug)}/submissions/${encodeURIComponent(submissionId)}/edit-details?email=${encodeURIComponent(email)}`,
    {
      method: "GET",
      headers: cabecalhosDeOrigem(request),
    }
  );

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ slug: string; submissionId: string }> }
) {
  const { slug, submissionId } = await ctx.params;
  const body = await request.json();

  const res = await proxyRequest(
    `/public/events/${encodeURIComponent(slug)}/submissions/${encodeURIComponent(submissionId)}/resubmit`,
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: cabecalhosDeOrigem(request),
    }
  );

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
