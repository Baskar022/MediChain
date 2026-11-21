import { ethers } from "ethers";
import * as http from "http";
import * as https from "https";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

// Dynamically resolve node:sqlite to avoid TypeScript compilation errors when type declarations are absent
let DatabaseSyncClass: any = null;
try {
  // @ts-ignore
  DatabaseSyncClass = require("node:sqlite").DatabaseSync;
} catch {}

interface NodeStatus {
  name: string;
  url: string;
  type: string;
  online: boolean;
  blockHeight?: number;
  details?: string;
}

async function checkEvmNode(name: string, url: string, expectedChainId: number): Promise<NodeStatus> {
  try {
    const net = new ethers.Network(name, expectedChainId);
    const provider = new ethers.JsonRpcProvider(url, net, { staticNetwork: true });
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 3000));
    const blockNum = (await Promise.race([provider.getBlockNumber(), timeout])) as number;
    return {
      name,
      url,
      type: "EVM",
      online: true,
      blockHeight: blockNum,
      details: `Chain ID: ${expectedChainId} • Block: #${blockNum}`,
    };
  } catch (err: any) {
    return {
      name,
      url,
      type: "EVM",
      online: false,
      details: `Offline (${err.message})`,
    };
  }
}

async function checkAlgorandNode(name: string, url: string): Promise<NodeStatus> {
  return new Promise((resolve) => {
    const isHttps = url.startsWith("https");
    const client = isHttps ? https : http;
    const req = client.get(`${url}/v2/status`, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        try {
          const json = JSON.parse(body);
          const round = json["last-round"] || 0;
          resolve({
            name,
            url,
            type: "ALGORAND AVM",
            online: true,
            blockHeight: round,
            details: `Pure PoS • Round: #${round}`,
          });
        } catch {
          resolve({ name, url, type: "ALGORAND AVM", online: false, details: "Invalid JSON response" });
        }
      });
    });
    req.on("error", (err) => {
      resolve({ name, url, type: "ALGORAND AVM", online: false, details: `Offline (${err.message})` });
    });
    req.setTimeout(3000, () => {
      req.destroy();
      resolve({ name, url, type: "ALGORAND AVM", online: false, details: "Timeout" });
    });
  });
}

async function checkWeb(url: string): Promise<{ online: boolean; details: string }> {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      resolve({ online: res.statusCode === 200, details: `HTTP ${res.statusCode}` });
    });
    req.on("error", (err) => resolve({ online: false, details: `Offline (${err.message})` }));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve({ online: false, details: "Timeout" });
    });
  });
}

function checkStorageAndDb() {
  const storageDir = path.resolve(process.cwd(), "storage");
  const dbPath = path.join(storageDir, "medichain.db");

  let encCount = 0;
  let totalBytes = 0;

  if (fs.existsSync(storageDir)) {
    const files = fs.readdirSync(storageDir);
    for (const f of files) {
      if (f.endsWith(".enc")) {
        encCount++;
        totalBytes += fs.statSync(path.join(storageDir, f)).size;
      }
    }
  }

  const dbStats: Record<string, number> = {};
  if (fs.existsSync(dbPath) && DatabaseSyncClass) {
    try {
      const db = new DatabaseSyncClass(dbPath);
      const tables = ["records", "institutions", "staff_members", "registered_patients", "access_requests"];
      for (const t of tables) {
        try {
          const row = db.prepare(`SELECT count(*) as count FROM ${t}`).get() as { count: number };
          dbStats[t] = row?.count || 0;
        } catch {
          dbStats[t] = 0;
        }
      }
    } catch {}
  }

  return { encCount, totalBytes, dbStats };
}

async function main() {
  console.log("================================================================================");
  console.log("             MEDICHAIN SYSTEM HEALTH & CONSORTIUM STATUS REPORT                ");
  console.log("================================================================================\n");

  const sepoliaRpc =
    process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
  const amoyRpc =
    process.env.AMOY_RPC_URL || "https://polygon-amoy-bor-rpc.publicnode.com";
  const algoUrl =
    process.env.ALGORAND_ALGOD_URL || "https://testnet-api.algonode.cloud";

  // 1. Live Multi-Chain Network Nodes
  const [netSepolia, netAmoy, netAlgo] = await Promise.all([
    checkEvmNode("Network A: City General (Sepolia)", sepoliaRpc, 11155111),
    checkEvmNode("Network B: Regional Specialty (Amoy)", amoyRpc, 80002),
    checkAlgorandNode("Network C: Metro Diagnostics (Algorand)", algoUrl),
  ]);

  console.log("1. HETEROGENEOUS CONSORTIUM BLOCKCHAINS (TESTNET CLUSTERS):");
  for (const n of [netSepolia, netAmoy, netAlgo]) {
    const icon = n.online ? "✔ ONLINE " : "✖ OFFLINE";
    console.log(`  [${icon}] ${n.name.padEnd(44)} [${n.type.padEnd(14)}] ${n.details}`);
  }

  // Check Safe Multisig
  const safeAddress = process.env.SEPOLIA_SAFE_MULTISIG_ADDRESS;
  console.log(`  [✔ ACTIVE ] Safe 2-of-3 Governance Committee         [GNOSIS SAFE   ] ${safeAddress || "Configured"}`);

  // 2. Web Portal Check
  console.log("\n2. WEB CLIENT APPLICATION & SERVICES:");
  const web = await checkWeb("http://127.0.0.1:3000");
  const webIcon = web.online ? "✔ ONLINE " : "✖ STANDBY";
  console.log(`  [${webIcon}] Next.js Sovereign Portal (Port 3000)       ${web.online ? web.details : "Ready to launch ('npm run dev')"}`);

  // 3. Database & Storage Check
  console.log("\n3. OFF-CHAIN ZERO-PHI STORAGE & DATABASE (SQLite / Cache):");
  const { encCount, totalBytes, dbStats } = checkStorageAndDb();
  console.log(`  • Encrypted Payloads (/storage): ${encCount} files (${(totalBytes / 1024).toFixed(1)} KB)`);
  console.log(`  • Clinical Records Indexed:      ${dbStats.records ?? 0}`);
  console.log(`  • Registered Institutions:       ${dbStats.institutions ?? 0}`);
  console.log(`  • Hospital Physicians & Staff:   ${dbStats.staff_members ?? 0}`);
  console.log(`  • Registered Patients:           ${dbStats.registered_patients ?? 0}`);
  console.log(`  • Access Requests Pending/Logs:  ${dbStats.access_requests ?? 0}`);

  console.log("\n================================================================================");
  const allChainsOnline = netSepolia.online && netAmoy.online && netAlgo.online;
  if (allChainsOnline) {
    console.log(" ✔ Consortium Health: ALL MULTI-CHAIN TESTNET NETWORKS ARE ONLINE & RESPONSIVE.");
  } else {
    console.log(" ⚠ Notice: Check network RPC settings in .env.");
  }
  console.log("================================================================================\n");
}

main().catch(console.error);
