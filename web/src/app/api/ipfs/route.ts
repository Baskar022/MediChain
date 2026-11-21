import { NextRequest, NextResponse } from "next/server";
import { IpfsService } from "@/lib/ipfs/service";
import { rateLimit, applySecurityHeaders } from "@/lib/api/middleware";

export async function POST(req: NextRequest) {
  const { allowed } = rateLimit(req, 60, 60 * 1000);
  if (!allowed) {
    return applySecurityHeaders(
      NextResponse.json({ error: "Too many IPFS upload requests. Please slow down." }, { status: 429 })
    );
  }

  try {
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const fileName = (formData.get("fileName") as string) || file?.name || `record-${Date.now()}.enc`;

      if (!file) {
        return applySecurityHeaders(
          NextResponse.json({ error: "No file provided in form data" }, { status: 400 })
        );
      }

      // Max 25 MB limit check
      if (file.size > 25 * 1024 * 1024) {
        return applySecurityHeaders(
          NextResponse.json({ error: "File exceeds 25 MB upload limit" }, { status: 413 })
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const pinResult = await IpfsService.pinFile(buffer, fileName);
      return applySecurityHeaders(NextResponse.json({ success: true, ...pinResult }));
    } else {
      // JSON upload with encrypted payload
      const body = await req.json();
      const { ciphertext, iv, fileName, recordId } = body;

      if (!ciphertext || !iv) {
        return applySecurityHeaders(
          NextResponse.json({ error: "Missing ciphertext or IV payload" }, { status: 400 })
        );
      }

      const payload = JSON.stringify({ ciphertext, iv });
      const buffer = Buffer.from(payload, "utf-8");
      const safeName = `${(recordId || `record-${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, "")}.enc`;

      const pinResult = await IpfsService.pinFile(buffer, safeName, { recordId: recordId || "" });
      return applySecurityHeaders(NextResponse.json({ success: true, ...pinResult }));
    }
  } catch (err: any) {
    return applySecurityHeaders(
      NextResponse.json({ error: err.message || "Failed to pin file to IPFS" }, { status: 500 })
    );
  }
}
