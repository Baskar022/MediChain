import { expect } from "chai";
import { ethers } from "ethers";
import {
  nonceStore,
  createSiweChallenge,
  verifySiweChallenge,
  issueAuthToken,
  verifyAuthToken,
} from "../index";

describe("Phase 2: MediChain Authentication & SIWE Challenge-Response", function () {
  let userWallet: ethers.HDNodeWallet;
  let attackerWallet: ethers.HDNodeWallet;

  beforeEach(function () {
    nonceStore.clear();
    userWallet = ethers.Wallet.createRandom();
    attackerWallet = ethers.Wallet.createRandom();
  });

  describe("1. Nonce Store & Replay Protection", function () {
    it("should generate a unique challenge nonce with 5-minute expiry", function () {
      const record = nonceStore.generateNonce(userWallet.address);
      expect(record.nonce).to.be.a("string");
      expect(record.nonce.length).to.equal(32); // 16 bytes hex
      expect(record.walletAddress).to.equal(userWallet.address.toLowerCase());
      expect(record.expiresAt).to.be.greaterThan(Date.now());
    });

    it("should consume nonce once and reject reuse (Replay Prevention)", function () {
      const record = nonceStore.generateNonce(userWallet.address);

      // First consumption succeeds
      const firstTry = nonceStore.consumeNonce(userWallet.address, record.nonce);
      expect(firstTry).to.be.true;

      // Replay attempt with same nonce fails immediately
      const replayTry = nonceStore.consumeNonce(userWallet.address, record.nonce);
      expect(replayTry).to.be.false;
    });

    it("should reject consumption for different wallet address", function () {
      const record = nonceStore.generateNonce(userWallet.address);
      const consumedByAttacker = nonceStore.consumeNonce(attackerWallet.address, record.nonce);
      expect(consumedByAttacker).to.be.false;
    });
  });

  describe("2. Sign-In with Ethereum (SIWE) Flow", function () {
    it("should create a valid SIWE challenge message conforming to EIP-4361 format", function () {
      const challenge = createSiweChallenge(userWallet.address, {
        domain: "medichain.local",
        chainId: 31337,
      });

      expect(challenge.message).to.include("medichain.local wants you to sign in with your Ethereum account:");
      expect(challenge.message).to.include(userWallet.address);
      expect(challenge.message).to.include(`Nonce: ${challenge.nonce}`);
      expect(challenge.message).to.include("Chain ID: 31337");
    });

    it("should verify valid signature against challenge and consume nonce", async function () {
      const challenge = createSiweChallenge(userWallet.address);
      const signature = await userWallet.signMessage(challenge.message);

      const verification = verifySiweChallenge(userWallet.address, challenge.message, signature);
      expect(verification.success).to.be.true;

      // Replay attack with same message & signature fails because nonce is consumed
      const replayVerification = verifySiweChallenge(userWallet.address, challenge.message, signature);
      expect(replayVerification.success).to.be.false;
      expect(replayVerification.error).to.include("replay protection triggered");
    });

    it("should reject signature created by an attacker wallet", async function () {
      const challenge = createSiweChallenge(userWallet.address);
      // Attacker signs the challenge message instead of the claimed user
      const attackerSignature = await attackerWallet.signMessage(challenge.message);

      const verification = verifySiweChallenge(
        userWallet.address,
        challenge.message,
        attackerSignature
      );
      expect(verification.success).to.be.false;
      expect(verification.error).to.include("Signature does not match the claimed wallet address");
    });

    it("should reject tampered challenge message", async function () {
      const challenge = createSiweChallenge(userWallet.address);
      const signature = await userWallet.signMessage(challenge.message);

      // Attacker alters URI or statement in message
      const tamperedMessage = challenge.message.replace("medichain.local", "evil-site.com");

      const verification = verifySiweChallenge(userWallet.address, tamperedMessage, signature);
      expect(verification.success).to.be.false;
    });
  });

  describe("3. JWT Session Issuance & Verification", function () {
    it("should issue a short-lived signed JWT and verify payload", async function () {
      const token = await issueAuthToken({
        walletAddress: userWallet.address,
        role: "DOCTOR",
        hospitalWallet: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      });

      expect(token).to.be.a("string");

      const result = await verifyAuthToken(token);
      expect(result.valid).to.be.true;
      expect(result.payload?.walletAddress).to.equal(userWallet.address.toLowerCase());
      expect(result.payload?.role).to.equal("DOCTOR");
      expect(result.payload?.hospitalWallet).to.equal(
        "0x70997970C51812dc3A010C7d01b50e0d17dc79C8".toLowerCase()
      );
    });

    it("should reject invalid or tampered JWT token", async function () {
      const token = await issueAuthToken({
        walletAddress: userWallet.address,
        role: "PATIENT",
      });

      // Tamper signature by flipping last characters
      const tamperedToken = token.slice(0, -5) + "abcde";
      const result = await verifyAuthToken(tamperedToken);

      expect(result.valid).to.be.false;
      expect(result.error).to.be.a("string");
    });
  });
});
