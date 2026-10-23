import { NextRequest, NextResponse } from "next/server";
import { dbManager } from "@/lib/db";
import { applySecurityHeaders } from "@/lib/api/middleware";

export async function GET(req: NextRequest) {
  try {
    const records = dbManager.getAllRecords();

    // Map records with tampered state flag
    const mapped = records.map((r) => ({
      ...r,
      is_tampered: dbManager.isRecordTampered(r.record_id),
    }));

    return applySecurityHeaders(NextResponse.json({ success: true, records: mapped }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return applySecurityHeaders(
      NextResponse.json({ error: message || "Failed to fetch records" }, { status: 500 })
    );
  }
}
