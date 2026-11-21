import algosdk from "algosdk";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

dotenv.config();

const englishWordlistPath = path.join(
  path.dirname(require.resolve("algosdk")),
  "mnemonic/wordlists/english.js"
);
const wordlist: string[] = require(englishWordlistPath).default;

function toUint8Array(buffer11: number[]): Uint8Array {
  const buffer8: number[] = [];
  let acc = 0;
  let accBits = 0;
  function add(ui11: number) {
    acc |= ui11 << accBits;
    accBits += 11;
    while (accBits >= 8) {
      buffer8.push(acc & 0xff);
      acc >>= 8;
      accBits -= 8;
    }
  }
  buffer11.forEach(add);
  return new Uint8Array(buffer8);
}

export function normalizeAlgorandMnemonic(inputMnemonic: string): { fullMnemonic: string; address: string; was24Words: boolean; checksumWord?: string } {
  const trimmed = inputMnemonic.trim();
  const words = trimmed.split(/\s+/);

  if (words.length === 25) {
    const account = algosdk.mnemonicToSecretKey(trimmed);
    return {
      fullMnemonic: trimmed,
      address: account.addr.toString(),
      was24Words: false,
    };
  }

  if (words.length === 24) {
    const buffer11 = words.map((w) => {
      const idx = wordlist.indexOf(w.toLowerCase());
      if (idx === -1) throw new Error(`Word "${w}" not found in Algorand dictionary`);
      return idx;
    });

    const uint8 = toUint8Array(buffer11);
    const seed = uint8.slice(0, 32);
    const fullMnemonic = algosdk.mnemonicFromSeed(seed);
    const checksumWord = fullMnemonic.split(" ")[24];
    const account = algosdk.mnemonicToSecretKey(fullMnemonic);

    return {
      fullMnemonic,
      address: account.addr.toString(),
      was24Words: true,
      checksumWord,
    };
  }

  throw new Error(`Expected 24 or 25 words, but received ${words.length} words.`);
}

async function main() {
  const action = (process.argv[2] || "FIX").toUpperCase();

  console.log("=================================================");
  console.log(" Algorand TestNet Account & Mnemonic Tool");
  console.log("=================================================\n");

  if (action === "GENERATE" || action === "NEW") {
    const newAcc = algosdk.generateAccount();
    const mn = algosdk.secretKeyToMnemonic(newAcc.sk);
    console.log("🎉 New Native 25-Word Algorand TestNet Account Generated:");
    console.log("---------------------------------------------------------");
    console.log("Public Address:", newAcc.addr.toString());
    console.log("25-Word Mnemonic:\n" + mn);
    console.log("---------------------------------------------------------");
    console.log("Free TestNet Dispenser Link:");
    console.log("👉 https://bank.testnet.algorand.network/");
    console.log("\nTo use this account, paste the 25 words into ALGORAND_DEPLOYER_MNEMONIC in your .env file.");
    return;
  }

  // FIX action: Reads .env and restores 25th word if 24 words were provided
  const envMnemonic = process.env.ALGORAND_DEPLOYER_MNEMONIC || "";
  if (!envMnemonic) {
    console.log("No ALGORAND_DEPLOYER_MNEMONIC found in .env.");
    console.log("Run 'npm run algo:new' to generate a brand new Algorand TestNet account.");
    return;
  }

  const words = envMnemonic.trim().split(/\s+/);
  console.log(`Found ${words.length} words in .env (ALGORAND_DEPLOYER_MNEMONIC).`);

  try {
    const res = normalizeAlgorandMnemonic(envMnemonic);
    if (res.was24Words) {
      console.log("\n✔ SUCCESS: Successfully computed the 25th checksum word!");
      console.log("---------------------------------------------------------");
      console.log("Computed 25th Word:", res.checksumWord);
      console.log("Algorand Public Address:", res.address);
      console.log("Full 25-Word Mnemonic:\n" + res.fullMnemonic);
      console.log("---------------------------------------------------------");
      
      // Auto-update .env if user requested or by default
      const envPath = path.resolve(process.cwd(), ".env");
      if (fs.existsSync(envPath)) {
        let envContent = fs.readFileSync(envPath, "utf8");
        envContent = envContent.replace(
          /ALGORAND_DEPLOYER_MNEMONIC=["'][^"']*["']/g,
          `ALGORAND_DEPLOYER_MNEMONIC="${res.fullMnemonic}"`
        );
        fs.writeFileSync(envPath, envContent, "utf8");
        console.log("✔ Automatically updated .env with the full 25-word mnemonic!");
      }
    } else {
      console.log("✔ The mnemonic in .env already has all 25 words and a valid checksum!");
      console.log("Algorand Public Address:", res.address);
    }

    console.log("\nFree TestNet Faucet Dispenser (Fund with 10 ALGO):");
    console.log(`👉 https://bank.testnet.algorand.network/?address=${res.address}`);
  } catch (err: any) {
    console.error("❌ Failed to process mnemonic:", err.message);
    console.log("\nIf your 24 words are from a different wallet format, run:");
    console.log("👉 npm run algo:new");
    console.log("to generate a clean 25-word Algorand TestNet account instantly.");
  }
}

if (require.main === module) {
  main().catch(console.error);
}
