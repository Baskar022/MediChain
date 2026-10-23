import { CustomLedger } from "./CustomLedger";

const port = Number(process.env.LEDGER_PORT || 9000);
const ledger = new CustomLedger({ autoPersist: true });
const server = ledger.startHttpServer(port);

console.log("==========================================================");
console.log(` Network C: Fabric-Style Permissioned Ledger Running`);
console.log(` Port: ${port}`);
console.log(` Technology: Non-EVM Append-Only Hash-Chained Merkle Ledger`);
console.log(` Honest Status: Simulated Fabric Ledger (Docker absent)`);
console.log("==========================================================");

process.on("SIGINT", () => {
  server.close(() => {
    console.log("Ledger server closed.");
    process.exit(0);
  });
});
