import { NextRequest, NextResponse } from "next/server";
import { dbManager } from "@/lib/db";
import { rateLimit, applySecurityHeaders } from "@/lib/api/middleware";

export async function GET(
  req: NextRequest,
  { params }: { params: { pseudonym: string } }
) {
  const { allowed } = rateLimit(req, 60, 60 * 1000);
  if (!allowed) {
    return applySecurityHeaders(
      NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
    );
  }

  const pseudonym = params.pseudonym;
  if (!pseudonym) {
    return applySecurityHeaders(
      NextResponse.json({ error: "Missing patient pseudonym parameter" }, { status: 400 })
    );
  }

  // Lookup if this is a registered patient wallet or global ID
  const registered = dbManager.getPatientByWallet(pseudonym) || dbManager.getPatientByGlobalId(pseudonym);

  let records = dbManager.getRecordsByPatient(pseudonym);
  if (records.length === 0 && registered) {
    records = [
      ...dbManager.getRecordsByPatient(registered.local_pseudonym),
      ...dbManager.getRecordsByPatient(registered.global_patient_id),
    ];
  }

  return applySecurityHeaders(
    NextResponse.json({
      success: true,
      patientPseudonym: pseudonym,
      count: records.length,
      records,
    })
  );
}
