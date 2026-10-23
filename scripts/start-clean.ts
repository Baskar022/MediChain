import { spawn, ChildProcess } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as http from "http";

const processes: { name: string; proc: ChildProcess }[] = [];

function wipeStorage() {
  console.log("================================================================================");
  console.log("       MEDICHAIN CLEAN START: PURGING ALL OFF-CHAIN STORAGE & STATE             ");
  console.log("================================================================================\n");

  const storageDir = path.resolve(process.cwd(), "storage");
  if (fs.existsSync(storageDir)) {
    const files = fs.readdirSync(storageDir);
    for (const f of files) {
      if (f.endsWith(".enc") || f.endsWith(".db") || f.endsWith(".db-journal") || f.endsWith(".json")) {
        try {
          fs.unlinkSync(path.join(storageDir, f));
          console.log(`  [CLEAN] Removed ${f}`);
        } catch {
          // Ignore if locked
        }
      }
    }
  } else {
    fs.mkdirSync(storageDir, { recursive: true });
  }
  console.log("✔ Storage directory purged. Ready for clean start with ZERO records or users.\n");
}

function startProcess(name: string, command: string, args: string[], cwd?: string): ChildProcess {
  console.log(`[STARTING] ${name}...`);
  const proc = spawn(command, args, {
    cwd: cwd || process.cwd(),
    shell: true,
    stdio: "inherit",
    env: { ...process.env, FORCE_COLOR: "1", CLEAN_START: "true" },
  });

  proc.on("error", (err) => {
    console.error(`[ERROR] ${name}:`, err.message);
  });

  proc.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.warn(`[EXIT] ${name} exited with code ${code}`);
    }
  });

  processes.push({ name, proc });
  return proc;
}

async function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}`, () => resolve(true));
    req.on("error", () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForPort(port: number, maxTries = 20): Promise<boolean> {
  for (let i = 0; i < maxTries; i++) {
    const open = await isPortOpen(port);
    if (open) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function main() {
  wipeStorage();

  const contractsDir = path.resolve(process.cwd(), "contracts");
  const interopDir = path.resolve(process.cwd(), "interop");
  const webDir = path.resolve(process.cwd(), "web");

  // 1. Network A Node (Port 8545)
  startProcess("Network A Node (Port 8545)", "npx", ["hardhat", "node", "--port", "8545"], contractsDir);

  // 2. Network B Node (Port 8546)
  startProcess("Network B Node (Port 8546)", "npx", ["hardhat", "node", "--port", "8546"], contractsDir);

  // 3. Federation Chain Node (Port 8547)
  startProcess("Federation Node (Port 8547)", "npx", ["hardhat", "node", "--port", "8547"], contractsDir);

  // 4. Network C Fabric-Style Permissioned Ledger (Port 9000)
  startProcess("Network C Ledger (Port 9000)", "npx", ["ts-node", "ledger/server.ts"], interopDir);

  // 5. Next.js Web App
  startProcess("MediChain Web App (Port 3000)", "npm", ["run", "dev"], webDir);

  console.log("\n[WAITING] Awaiting local EVM nodes...");
  const ready = await waitForPort(8545, 15);
  if (ready) {
    console.log("[DEPLOY] Deploying fresh, unseeded smart contracts across all chains...");
    const deployProc = spawn("npx", ["ts-node", "scripts/deploy-all-chains.ts"], {
      cwd: contractsDir,
      shell: true,
      stdio: "inherit",
    });
    deployProc.on("exit", () => {
      console.log("[DEPLOY] Clean contracts deployed. System is 100% empty and ready for UI creation.");
    });
  }

  console.log("\n================================================================================");
  console.log(" SYSTEM BOOTED IN CLEAN START MODE (ZERO PRE-SEEDED RECORDS OR INSTITUTIONS)");
  console.log(" Access UI at: http://localhost:3000");
  console.log(" Register new hospitals at: http://localhost:3000/admin/federation");
  console.log(" Register new patients at: http://localhost:3000/patient/register");
  console.log("================================================================================\n");
}

function shutdown() {
  console.log("\n[SHUTDOWN] Stopping all processes...");
  for (const { proc } of processes) {
    try {
      if (process.platform === "win32" && proc.pid) {
        spawn("taskkill", ["/pid", proc.pid.toString(), "/f", "/t"]);
      } else {
        proc.kill("SIGINT");
      }
    } catch {
      // Ignore
    }
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

main().catch((err) => {
  console.error("Clean start error:", err);
  shutdown();
});
