import { spawn, ChildProcess } from "child_process";
import * as path from "path";
import * as http from "http";

const processes: { name: string; proc: ChildProcess }[] = [];

function startProcess(name: string, command: string, args: string[], cwd?: string): ChildProcess {
  console.log(`[STARTING] ${name}...`);
  const proc = spawn(command, args, {
    cwd: cwd || process.cwd(),
    shell: true,
    stdio: "inherit",
    env: { ...process.env, FORCE_COLOR: "1" },
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
  console.log("================================================================================");
  console.log("       MEDICHAIN SOVEREIGN MULTI-NETWORK SYSTEM LAUNCHER (dev:all)              ");
  console.log("================================================================================\n");

  console.log("Booting 4 Autonomous Sovereign Blockchains + Web Application:\n");
  console.log("  • Network A (City General Hospital):        Hardhat EVM (Port 8545 / Chain 31337)");
  console.log("  • Network B (Regional Specialty Hospital):  Hardhat EVM (Port 8546 / Chain 31338)");
  console.log("  • Federation Trust Chain:                   Hardhat EVM (Port 8547 / Chain 31340)");
  console.log("  • Network C (Metro Diagnostics Lab):        Fabric-Style Ledger (Port 9000)");
  console.log("  • Web UI Application:                       Next.js Clinical App (Port 3000)\n");

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

  console.log("\n[WAITING] Waiting for EVM nodes to initialize before running contract deployments...");
  const aReady = await waitForPort(8545, 15);
  if (aReady) {
    console.log("[DEPLOY] Running multi-chain contract deployment...");
    const deployProc = spawn("npx", ["ts-node", "scripts/deploy-all-chains.ts"], {
      cwd: contractsDir,
      shell: true,
      stdio: "inherit",
    });
    deployProc.on("exit", () => {
      console.log("[DEPLOY] Multi-chain deployment completed.");
    });
  }

  console.log("\n================================================================================");
  console.log(" System components running! Access portals at http://localhost:3000");
  console.log(" Explore all sovereign chains at http://localhost:3000/explorer");
  console.log(" Press Ctrl+C at any time to gracefully shutdown all sovereign networks.");
  console.log("================================================================================\n");
}

function shutdown() {
  console.log("\n[SHUTDOWN] Terminating all sovereign chain processes and servers...");
  for (const { name, proc } of processes) {
    try {
      if (process.platform === "win32" && proc.pid) {
        spawn("taskkill", ["/pid", proc.pid.toString(), "/f", "/t"]);
      } else {
        proc.kill("SIGINT");
      }
    } catch {
      // Ignore cleanup error
    }
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

main().catch((err) => {
  console.error("Launcher failure:", err);
  shutdown();
});
