import * as fs from "fs";
import * as path from "path";

function resetAll() {
  console.log("================================================================================");
  console.log("              MEDICHAIN SYSTEM-WIDE COMPLETE RESET ENGINE                      ");
  console.log("================================================================================\n");

  const storageDir = path.resolve(process.cwd(), "storage");
  let removedCount = 0;

  if (fs.existsSync(storageDir)) {
    const files = fs.readdirSync(storageDir);
    for (const file of files) {
      const fullPath = path.join(storageDir, file);
      try {
        if (fs.statSync(fullPath).isFile()) {
          fs.unlinkSync(fullPath);
          console.log(`  [PURGED] ${file}`);
          removedCount++;
        }
      } catch (err: any) {
        console.warn(`  [SKIP] Could not delete ${file}: ${err.message}`);
      }
    }
  } else {
    fs.mkdirSync(storageDir, { recursive: true });
  }

  // Also clean deployed cache in contracts if present
  const deployedChainsContracts = path.resolve(process.cwd(), "contracts/deployed-chains.json");
  if (fs.existsSync(deployedChainsContracts)) {
    try {
      fs.unlinkSync(deployedChainsContracts);
      console.log(`  [PURGED] contracts/deployed-chains.json`);
      removedCount++;
    } catch {}
  }

  console.log(`\n✔ Clean reset completed successfully! ${removedCount} storage files and states purged.`);
  console.log("  To re-bootstrap a pristine system, run: npm run start:clean");
  console.log("  To launch with pre-seeded demo scenarios, run: npm run seed:demo\n");
}

resetAll();
