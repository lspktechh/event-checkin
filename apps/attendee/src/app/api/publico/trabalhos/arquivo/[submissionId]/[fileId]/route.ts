import { NextRequest, NextResponse } from "next/server";
import { cabecalhosDeOrigem, proxyRequest } from "@/app/api/proxy";

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ submissionId: string; fileId: string }> }
) {
  const { submissionId, fileId } = await ctx.params;

  const res = await proxyRequest(
    `/public/submissions/${encodeURIComponent(submissionId)}/files/${encodeURIComponent(fileId)}`,
    {
      method: "GET",
      headers: cabecalhosDeOrigem(request),
    }
  );

  if (!res.ok) {
    return new NextResponse("Arquivo não encontrado", { status: res.status });
  }

  const contentType = res.headers.get("content-type") || "application/octet-stream";
  const contentDisposition = res.headers.get("content-disposition") || "attachment";
  const buffer = await res.arrayBuffer();

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": contentDisposition,
    },
  });
}
