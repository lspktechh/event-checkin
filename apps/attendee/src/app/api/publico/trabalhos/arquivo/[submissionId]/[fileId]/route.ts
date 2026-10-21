import { NextRequest, NextResponse } from "next/server";
import { cabecalhosDeOrigem, proxyRequest } from "@/app/api/proxy";

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ submissionId: string; fileId: string }> }
) {
  const { submissionId, fileId } = await ctx.params;
  const isDownload = request.nextUrl.searchParams.get("download") === "1";

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
  const upstreamDisposition = res.headers.get("content-disposition") || "";

  const match = upstreamDisposition.match(/filename="?([^";]+)"?/);
  const fname = match ? match[1] : "documento";

  const contentDisposition = isDownload
    ? `attachment; filename="${fname}"`
    : `inline; filename="${fname}"`;

  const buffer = await res.arrayBuffer();

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": contentDisposition,
    },
  });
}
