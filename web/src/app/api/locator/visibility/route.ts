import { NextRequest, NextResponse } from "next/server";
import { setPatientLocatorVisibility, isPatientLocatorHidden } from "@/lib/locator/service";

/**
 * POST /api/locator/visibility
 * Allows patient to toggle whether their cross-chain record locator entries are visible to consortium queries.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { globalPatientId, isVisible } = body;

    if (!globalPatientId || typeof isVisible !== "boolean") {
      return NextResponse.json({ error: "globalPatientId and boolean isVisible are required" }, { status: 400 });
    }

    setPatientLocatorVisibility(globalPatientId, isVisible);

    return NextResponse.json({
      status: "ok",
      globalPatientId,
      isVisible,
      message: isVisible
        ? "Record locator index is now visible for cross-chain queries."
        : "Record locator index is now hidden (opted out).",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * GET /api/locator/visibility?globalPatientId=0x...
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const globalPatientId = searchParams.get("globalPatientId");

    if (!globalPatientId) {
      return NextResponse.json({ error: "globalPatientId is required" }, { status: 400 });
    }

    const isHidden = isPatientLocatorHidden(globalPatientId);
    return NextResponse.json({
      globalPatientId,
      isVisible: !isHidden,
      isHidden,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
