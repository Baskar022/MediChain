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

    const result = dbManager.restoreRecordFile(recordId);

    return applySecurityHeaders(
      NextResponse.json({
        success: true,
        recordId,
        message: "DEMO: Stored file has been restored to its original, verified cryptographic state.",
        ...result,
      })
    );
  } catch (err: any) {
    return applySecurityHeaders(
      NextResponse.json({ error: err.message || "Failed to restore record" }, { status: 500 })
    );
  }
}
