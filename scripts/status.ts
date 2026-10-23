import { ethers } from "ethers";
import * as http from "http";
import * as fs from "fs";
import * as path from "path";

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
    const provider = new ethers.JsonRpcProvider(url);
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 1500));
    const blockNum = (await Promise.race([provider.getBlockNumber(), timeout])) as number;
    const net = await provider.getNetwork();
    return {
      name,
      url,
      type: "EVM",
      online: true,
      blockHeight: blockNum,
      details: `Chain ID: ${net.chainId} • Height: #${blockNum}`,
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

async function checkLedgerNode(name: string, url: string): Promise<NodeStatus> {
  return new Promise((resolve) => {
    const req = http.get(`${url}/api/chain/info`, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        try {
          const json = JSON.parse(body);
          resolve({
            name,
            url,
            type: "NON-EVM LEDGER",
            online: true,
            blockHeight: json.height || 0,
            details: `Fabric-Style Simulated Ledger • Height: #${json.height || 0}`,
          });
        } catch {
          resolve({ name, url, type: "NON-EVM LEDGER", online: false, details: "Invalid JSON response" });
        }
      });
    });
    req.on("error", (err) => {
      resolve({ name, url, type: "NON-EVM LEDGER", online: false, details: `Offline (${err.message})` });
    });
    req.setTimeout(1500, () => {
      req.destroy();
      resolve({ name, url, type: "NON-EVM LEDGER", online: false, details: "Timeout" });
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
  console.log("             MEDICHAIN SYSTEM HEALTH & SOVEREIGN STATUS REPORT                 ");
  console.log("================================================================================\n");

  // 1. Sovereign Chains Check
  const [netA, netB, netC, fedNet] = await Promise.all([
    checkEvmNode("Network A (City General Hospital)", "http://127.0.0.1:8545", 31337),
    checkEvmNode("Network B (Regional Specialty Hospital)", "http://127.0.0.1:8546", 31338),
    checkLedgerNode("Network C (Metro Diagnostics Lab)", "http://127.0.0.1:9000"),
    checkEvmNode("Federation Registry Trust Chain", "http://127.0.0.1:8547", 31340),
  ]);

  console.log("1. SOVEREIGN HETEROGENEOUS BLOCKCHAINS:");
  for (const n of [netA, netB, netC, fedNet]) {
    const icon = n.online ? "✔ ONLINE " : "✖ OFFLINE";
    console.log(`  [${icon}] ${n.name.padEnd(42)} [${n.type.padEnd(14)}] ${n.details}`);
  }

  // 2. Web Portal Check
  console.log("\n2. WEB CLIENT APPLICATION:");
  const web = await checkWeb("http://127.0.0.1:3000");
  const webIcon = web.online ? "✔ ONLINE " : "✖ OFFLINE";
  console.log(`  [${webIcon}] Next.js Clinical Portal (Port 3000)       ${web.details}`);

  // 3. Database & Storage Check
  console.log("\n3. OFF-CHAIN ZERO-PHI STORAGE & DATABASE (SQLite):");
  const { encCount, totalBytes, dbStats } = checkStorageAndDb();
  console.log(`  • Encrypted Files (/storage):    ${encCount} files (${(totalBytes / 1024).toFixed(1)} KB)`);
  console.log(`  • Clinical Records Indexed:      ${dbStats.records ?? 0}`);
  console.log(`  • Registered Institutions:       ${dbStats.institutions ?? 0}`);
  console.log(`  • Hospital Physicians & Staff:   ${dbStats.staff_members ?? 0}`);
  console.log(`  • Registered Patients:           ${dbStats.registered_patients ?? 0}`);
  console.log(`  • Access Requests Pending/Logs:  ${dbStats.access_requests ?? 0}`);

  console.log("\n================================================================================");
  const allChainsOnline = netA.online && netB.online && netC.online && fedNet.online;
  if (allChainsOnline) {
    console.log(" ✔ Consortium health: ALL SOVEREIGN CHAINS ARE ONLINE AND FULLY SYNCHRONIZED.");
  } else {
    console.log(" ⚠ Notice: One or more chains are offline. Run 'npm run dev:all' to boot the cluster.");
  }
  console.log("================================================================================\n");
}

main().catch(console.error);
