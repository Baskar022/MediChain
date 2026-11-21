import fs from "fs";
import path from "path";
import crypto from "crypto";

export interface IpfsPinResult {
  cid: string;
  ipfsUri: string;
  gatewayUrl: string;
  sizeBytes: number;
  timestamp: string;
  provider: "PINATA" | "KUBO_LOCAL" | "LOCAL_STORE_FALLBACK";
}

export class IpfsService {
  public static getStorageDirs(): string[] {
    const candidates = [
      path.resolve(process.cwd(), "storage"),
      path.resolve(process.cwd(), "../storage"),
    ];
    return Array.from(new Set(candidates));
  }

  public static getPrimaryStorageDir(): string {
    const dirs = this.getStorageDirs();
    for (const d of dirs) {
      if (fs.existsSync(d)) return d;
    }
    const target = process.cwd().endsWith("web")
      ? path.resolve(process.cwd(), "../storage")
      : path.resolve(process.cwd(), "storage");
    fs.mkdirSync(target, { recursive: true });
    return target;
  }

  public static saveToLocalCache(fileBuffer: Buffer, fileName: string, cid: string): void {
    const primary = this.getPrimaryStorageDir();
    try {
      const safeDiskName = `${fileName.replace(/[^a-zA-Z0-9._-]/g, "")}`;
      fs.writeFileSync(path.join(primary, safeDiskName), fileBuffer);
      fs.writeFileSync(path.join(primary, `${cid}.enc`), fileBuffer);
    } catch (err: any) {
      console.warn("[IpfsService] Failed to cache locally:", err.message);
    }
  }

  private static getPinataJwt(): string | null {
    return process.env.PINATA_JWT?.trim() || null;
  }

  private static getPinataGateway(): string {
    const custom = process.env.PINATA_GATEWAY_URL?.trim();
    if (custom) {
      return custom.replace(/\/$/, "");
    }
    return "https://gateway.pinata.cloud/ipfs";
  }

  /**
   * Pins an encrypted file buffer to IPFS.
   * Priority:
   * 1. Pinata Cloud Free Tier (via server-side PINATA_JWT)
   * 2. Local Kubo Node (http://127.0.0.1:5001)
   * 3. Local Sovereign Off-Chain Store Fallback (/storage)
   */
  public static async pinFile(
    fileBuffer: Buffer,
    fileName: string,
    metadata: Record<string, string> = {}
  ): Promise<IpfsPinResult> {
    const timestamp = new Date().toISOString();
    const sizeBytes = fileBuffer.length;

    // 1. Try Pinata Cloud API if JWT is configured
    const pinataJwt = this.getPinataJwt();
    if (pinataJwt && !pinataJwt.startsWith("ey...")) {
      try {
        const formData = new FormData();
        const blob = new Blob([fileBuffer as any]);
        formData.append("file", blob, fileName);

        const pinataMeta = JSON.stringify({
          name: fileName,
          keyvalues: {
            app: "MediChain",
            environment: process.env.NODE_ENV || "production",
            ...metadata,
          },
        });
        formData.append("pinataMetadata", pinataMeta);

        const pinataOptions = JSON.stringify({
          cidVersion: 1,
        });
        formData.append("pinataOptions", pinataOptions);

        const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${pinataJwt}`,
          },
          body: formData,
        });

        if (response.ok) {
          const resJson = await response.json();
          const cid = resJson.IpfsHash;
          const gatewayUrl = `${this.getPinataGateway()}/${cid}`;
          this.saveToLocalCache(fileBuffer, fileName, cid);
          return {
            cid,
            ipfsUri: `ipfs://${cid}`,
            gatewayUrl,
            sizeBytes: resJson.PinSize || sizeBytes,
            timestamp,
            provider: "PINATA",
          };
        } else {
          const errText = await response.text();
          console.warn("[IpfsService] Pinata upload rejected:", errText);
        }
      } catch (err: any) {
        console.warn("[IpfsService] Pinata request error:", err.message);
      }
    }

    // 2. Try Local Kubo Node RPC (port 5001)
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 800);

      const formData = new FormData();
      const blob = new Blob([fileBuffer as any]);
      formData.append("file", blob, fileName);

      const kuboRes = await fetch("http://127.0.0.1:5001/api/v0/add?cid-version=1&pin=true", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      }).catch(() => null);
      clearTimeout(timer);

      if (kuboRes && kuboRes.ok) {
        const kuboJson = await kuboRes.json();
        const cid = kuboJson.Hash;
        this.saveToLocalCache(fileBuffer, fileName, cid);
        return {
          cid,
          ipfsUri: `ipfs://${cid}`,
          gatewayUrl: `http://127.0.0.1:8080/ipfs/${cid}`,
          sizeBytes: parseInt(kuboJson.Size || String(sizeBytes), 10),
          timestamp,
          provider: "KUBO_LOCAL",
        };
      }
    } catch {}

    // 3. Resilient Fallback: Local Encrypted Store with synthetic content CID
    const sha256Hex = crypto.createHash("sha256").update(fileBuffer).digest("hex");
    // Generate deterministic standard CIDv1-like identifier (0x01 + 0x55 (raw) + 0x12 (sha256) + 0x20 (len=32))
    const syntheticCid = `bafkrei${Buffer.from("01551220" + sha256Hex, "hex").toString("base64url").toLowerCase()}`;
    const safeDiskName = `${fileName.replace(/[^a-zA-Z0-9._-]/g, "")}`;
    this.saveToLocalCache(fileBuffer, safeDiskName, syntheticCid);

    return {
      cid: syntheticCid,
      ipfsUri: `ipfs://${syntheticCid}`,
      gatewayUrl: `/storage/${safeDiskName}`,
      sizeBytes,
      timestamp,
      provider: "LOCAL_STORE_FALLBACK",
    };
  }

  /**
   * Fetches content from IPFS or fallback store.
   */
  public static async fetchContent(cidOrUri: string): Promise<{ data: Buffer; provider: string }> {
    const cid = cidOrUri.replace(/^ipfs:\/\//, "").trim();
    const dirs = this.getStorageDirs();

    // 1. Check local storage folders first (fast local read-through cache)
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) continue;

      const directCidPath = path.join(dir, `${cid}.enc`);
      if (fs.existsSync(directCidPath)) {
        return { data: fs.readFileSync(directCidPath), provider: "LOCAL_STORE_CACHE" };
      }

      const rawCidPath = path.join(dir, cid);
      if (fs.existsSync(rawCidPath)) {
        return { data: fs.readFileSync(rawCidPath), provider: "LOCAL_STORE_CACHE" };
      }

      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (file.includes(cid) || (cid.length > 16 && file.includes(cid.slice(0, 16)))) {
          const content = fs.readFileSync(path.join(dir, file));
          return { data: content, provider: "LOCAL_STORE_CACHE" };
        }
      }
    }

    // 2. Fetch from Pinata Gateway or Public Gateway
    const gateways = [
      `${this.getPinataGateway()}/${cid}`,
      `https://ipfs.io/ipfs/${cid}`,
      `http://127.0.0.1:8080/ipfs/${cid}`,
    ];

    for (const url of gateways) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        if (res.ok) {
          const arrayBuf = await res.arrayBuffer();
          const buffer = Buffer.from(arrayBuf);
          // Cache locally for future queries
          this.saveToLocalCache(buffer, `${cid}.enc`, cid);
          return { data: buffer, provider: url };
        }
      } catch {}
    }

    throw new Error(`Unable to resolve IPFS content for CID: ${cid}`);
  }
}
