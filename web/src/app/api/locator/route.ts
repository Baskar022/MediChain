import { NextRequest, NextResponse } from "next/server";
import {
  getPatientRecordLocations,
  setPatientLocatorVisibility,
  isPatientLocatorHidden,
  upsertRecordLocator,
} from "@/lib/locator/service";

/**
 * GET /api/locator?globalPatientId=0x...
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const globalPatientId = searchParams.get("globalPatientId");

    if (!globalPatientId) {
      return NextResponse.json({ error: "globalPatientId query parameter is required" }, { status: 400 });
    }

    if (isPatientLocatorHidden(globalPatientId)) {
      return NextResponse.json(
        {
          error: "PatientLocatorHidden",
          message: "Patient has opted out from cross-chain federated locator discovery.",
          locations: [],
          isHidden: true,
        },
        { status: 403 }
      );
    }

    const locations = getPatientRecordLocations(globalPatientId);
    return NextResponse.json({
      status: "ok",
      globalPatientId,
      locations,
      totalInstitutions: new Set(locations.map((l) => l.institutionId)).size,
      totalRecordCount: locations.reduce((sum, l) => sum + l.recordCount, 0),
      isHidden: false,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/locator
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      globalPatientId,
      institutionId,
      institutionName = "Hospital Node",
      chainIdentifier = "11155111",
      chainType = "EVM",
      recordType = "CARDIOLOGY",
      count = 1,
    } = body;

    if (!globalPatientId || !institutionId) {
      return NextResponse.json({ error: "globalPatientId and institutionId are required" }, { status: 400 });
    }

    upsertRecordLocator(
      globalPatientId,
      institutionId,
      institutionName,
      chainIdentifier,
      chainType,
      recordType,
      Number(count)
    );

    return NextResponse.json({
      status: "ok",
      message: "Record locator index updated without Protected Health Information.",
      entry: {
        globalPatientId,
        institutionId,
        recordType,
        count,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * PATCH /api/locator
 * Update patient privacy visibility / opt-out
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { globalPatientId, isVisible } = body;

    if (!globalPatientId || typeof isVisible !== "boolean") {
      return NextResponse.json(
        { error: "globalPatientId and boolean isVisible are required" },
        { status: 400 }
      );
    }

    setPatientLocatorVisibility(globalPatientId, isVisible);

    return NextResponse.json({
      status: "ok",
      globalPatientId,
      isVisible,
      message: isVisible
        ? "Locator index visible to authorized consortium search."
        : "Locator index hidden. Zero cross-chain discovery enabled.",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
