import { NextRequest, NextResponse } from "next/server";
import { dbManager } from "@/lib/db";
import { applySecurityHeaders } from "@/lib/api/middleware";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { recordId } = body;

    if (!recordId) {
      return applySecurityHeaders(
        NextResponse.json({ error: "recordId is required" }, { status: 400 })
      );
    }

    const result = dbManager.tamperRecordFile(recordId);

    return applySecurityHeaders(
      NextResponse.json({
        success: true,
        recordId,
        message: "DEMO: Stored file has been deliberately tampered with off-chain on disk.",
        ...result,
      })
    );
  } catch (err: any) {
    return applySecurityHeaders(
      NextResponse.json({ error: err.message || "Failed to tamper record" }, { status: 500 })
    );
  }
}
