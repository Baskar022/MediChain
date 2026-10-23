import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, applySecurityHeaders } from "@/lib/api/middleware";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.authenticated || !auth.user) {
    return applySecurityHeaders(
      NextResponse.json({ authenticated: false, error: auth.error }, { status: 401 })
    );
  }

  return applySecurityHeaders(
    NextResponse.json({
      authenticated: true,
      user: auth.user,
    })
  );
}
