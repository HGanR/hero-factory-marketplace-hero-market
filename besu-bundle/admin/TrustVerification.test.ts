import { expect } from "chai";
import { ethers } from "hardhat";
import { TrustVerification } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import crypto from "crypto";

/**
 * Comprehensive Unit Tests for TrustVerification Smart Contract
 * 
 * Tests cover:
 * - Issuer management (authorization, revocation)
 * - Instrument recording
 * - Instrument verification
 * - Instrument revocation
 * - Payment recording
 * - Payment history retrieval
 * - Event emission
 * - Access control
 * - Edge cases and error handling
 */

describe("TrustVerification", function () {
  let trustVerification: TrustVerification;
  let owner: SignerWithAddress;
  let issuer1: SignerWithAddress;
  let issuer2: SignerWithAddress;
  let nonIssuer: SignerWithAddress;

  // Helper function to create document hash
  function createDocumentHash(data: string): string {
    return crypto.createHash("sha256").update(data).digest("hex");
  }

  // Helper function to convert hex string to bytes32
  function stringToBytes32(str: string): string {
    const hash = crypto.createHash("sha256").update(str).digest();
    return "0x" + hash.toString("hex");
  }

  // ========================================================================
  // Setup
  // ========================================================================

  beforeEach(async function () {
    const [ownerSigner, issuer1Signer, issuer2Signer, nonIssuerSigner] =
      await ethers.getSigners();

    owner = ownerSigner;
    issuer1 = issuer1Signer;
    issuer2 = issuer2Signer;
    nonIssuer = nonIssuerSigner;

    const TrustVerificationFactory = await ethers.getContractFactory(
      "TrustVerification"
    );
    trustVerification = await TrustVerificationFactory.deploy();
    await trustVerification.waitForDeployment();
  });

  // ========================================================================
  // Issuer Management Tests
  // ========================================================================

  describe("Issuer Management", function () {
    describe("authorizeIssuer", function () {
      it("Should authorize an issuer", async function () {
        await trustVerification.authorizeIssuer(issuer1.address);
        const isAuthorized = await trustVerification.isIssuerAuthorized(
          issuer1.address
        );
        expect(isAuthorized).to.be.true;
      });

      it("Should emit IssuerAuthorized event", async function () {
        await expect(trustVerification.authorizeIssuer(issuer1.address))
          .to.emit(trustVerification, "IssuerAuthorized")
          .withArgs(issuer1.address);
      });

      it("Should only allow owner to authorize", async function () {
        await expect(
          trustVerification.connect(issuer1).authorizeIssuer(issuer2.address)
        ).to.be.revertedWith("Only owner can call this function");
      });

      it("Should not authorize zero address", async function () {
        await expect(
          trustVerification.authorizeIssuer(ethers.ZeroAddress)
        ).to.be.revertedWith("Invalid issuer address");
      });

      it("Should not authorize already authorized issuer", async function () {
        await trustVerification.authorizeIssuer(issuer1.address);
        await expect(
          trustVerification.authorizeIssuer(issuer1.address)
        ).to.be.revertedWith("Issuer already authorized");
      });

      it("Should authorize multiple issuers", async function () {
        await trustVerification.authorizeIssuer(issuer1.address);
        await trustVerification.authorizeIssuer(issuer2.address);

        expect(await trustVerification.isIssuerAuthorized(issuer1.address)).to
          .be.true;
        expect(await trustVerification.isIssuerAuthorized(issuer2.address)).to
          .be.true;
      });
    });

    describe("revokeIssuer", function () {
      beforeEach(async function () {
        await trustVerification.authorizeIssuer(issuer1.address);
      });

      it("Should revoke an issuer", async function () {
        await trustVerification.revokeIssuer(issuer1.address);
        const isAuthorized = await trustVerification.isIssuerAuthorized(
          issuer1.address
        );
        expect(isAuthorized).to.be.false;
      });

      it("Should emit IssuerRevoked event", async function () {
        await expect(trustVerification.revokeIssuer(issuer1.address))
          .to.emit(trustVerification, "IssuerRevoked")
          .withArgs(issuer1.address);
      });

      it("Should only allow owner to revoke", async function () {
        await expect(
          trustVerification.connect(issuer1).revokeIssuer(issuer1.address)
        ).to.be.revertedWith("Only owner can call this function");
      });

      it("Should not revoke non-authorized issuer", async function () {
        await expect(
          trustVerification.revokeIssuer(issuer2.address)
        ).to.be.revertedWith("Issuer not authorized");
      });
    });
  });

  // ========================================================================
  // Instrument Recording Tests
  // ========================================================================

  describe("recordInstrument", function () {
    beforeEach(async function () {
      await trustVerification.authorizeIssuer(issuer1.address);
    });

    it("Should record an instrument", async function () {
      const instrumentId = "trust-123";
      const amount = ethers.parseUnits("100000", 18);
      const maturityDate = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60; // 1 year from now
      const beneficiary = "John Smith";
      const documentHash = stringToBytes32("document-data");

      await trustVerification
        .connect(issuer1)
        .recordInstrument(
          instrumentId,
          amount,
          maturityDate,
          beneficiary,
          documentHash
        );

      const instrument = await trustVerification.getInstrument(instrumentId);
      expect(instrument.instrumentId).to.equal(instrumentId);
      expect(instrument.amount).to.equal(amount);
      expect(instrument.beneficiary).to.equal(beneficiary);
      expect(instrument.isRevoked).to.be.false;
    });

    it("Should emit InstrumentRecorded event", async function () {
      const instrumentId = "trust-123";
      const amount = ethers.parseUnits("100000", 18);
      const maturityDate = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;
      const beneficiary = "John Smith";
      const documentHash = stringToBytes32("document-data");

      await expect(
        trustVerification
          .connect(issuer1)
          .recordInstrument(
            instrumentId,
            amount,
            maturityDate,
            beneficiary,
            documentHash
          )
      )
        .to.emit(trustVerification, "InstrumentRecorded")
        .withArgs(instrumentId, issuer1.address, amount);
    });

    it("Should only allow authorized issuers to record", async function () {
      const instrumentId = "trust-123";
      const amount = ethers.parseUnits("100000", 18);
      const maturityDate = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;
      const beneficiary = "John Smith";
      const documentHash = stringToBytes32("document-data");

      await expect(
        trustVerification
          .connect(nonIssuer)
          .recordInstrument(
            instrumentId,
            amount,
            maturityDate,
            beneficiary,
            documentHash
          )
      ).to.be.revertedWith("Issuer not authorized");
    });

    it("Should not record with empty instrument ID", async function () {
      const amount = ethers.parseUnits("100000", 18);
      const maturityDate = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;
      const beneficiary = "John Smith";
      const documentHash = stringToBytes32("document-data");

      await expect(
        trustVerification
          .connect(issuer1)
          .recordInstrument("", amount, maturityDate, beneficiary, documentHash)
      ).to.be.revertedWith("Instrument ID cannot be empty");
    });

    it("Should not record with zero amount", async function () {
      const instrumentId = "trust-123";
      const maturityDate = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;
      const beneficiary = "John Smith";
      const documentHash = stringToBytes32("document-data");

      await expect(
        trustVerification
          .connect(issuer1)
          .recordInstrument(instrumentId, 0, maturityDate, beneficiary, documentHash)
      ).to.be.revertedWith("Amount must be greater than 0");
    });

    it("Should not record with past maturity date", async function () {
      const instrumentId = "trust-123";
      const amount = ethers.parseUnits("100000", 18);
      const maturityDate = Math.floor(Date.now() / 1000) - 1; // Past date
      const beneficiary = "John Smith";
      const documentHash = stringToBytes32("document-data");

      await expect(
        trustVerification
          .connect(issuer1)
          .recordInstrument(
            instrumentId,
            amount,
            maturityDate,
            beneficiary,
            documentHash
          )
      ).to.be.revertedWith("Maturity date must be in the future");
    });

    it("Should not record duplicate instrument", async function () {
      const instrumentId = "trust-123";
      const amount = ethers.parseUnits("100000", 18);
      const maturityDate = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;
      const beneficiary = "John Smith";
      const documentHash = stringToBytes32("document-data");

      // Record first time
      await trustVerification
        .connect(issuer1)
        .recordInstrument(
          instrumentId,
          amount,
          maturityDate,
          beneficiary,
          documentHash
        );

      // Try to record again
      await expect(
        trustVerification
          .connect(issuer1)
          .recordInstrument(
            instrumentId,
            amount,
            maturityDate,
            beneficiary,
            documentHash
          )
      ).to.be.revertedWith("Instrument already exists");
    });

    it("Should increment instrument count", async function () {
      const initialCount = await trustVerification.getInstrumentCount();

      const instrumentId = "trust-123";
      const amount = ethers.parseUnits("100000", 18);
      const maturityDate = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;
      const beneficiary = "John Smith";
      const documentHash = stringToBytes32("document-data");

      await trustVerification
        .connect(issuer1)
        .recordInstrument(
          instrumentId,
          amount,
          maturityDate,
          beneficiary,
          documentHash
        );

      const newCount = await trustVerification.getInstrumentCount();
      expect(newCount).to.equal(initialCount + 1n);
    });
  });

  // ========================================================================
  // Instrument Verification Tests
  // ========================================================================

  describe("verifyInstrument", function () {
    let instrumentId: string;
    let amount: bigint;
    let maturityDate: number;
    let beneficiary: string;
    let documentHash: string;
    let documentHashBytes32: string;

    beforeEach(async function () {
      await trustVerification.authorizeIssuer(issuer1.address);

      instrumentId = "trust-123";
      amount = ethers.parseUnits("100000", 18);
      maturityDate = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;
      beneficiary = "John Smith";
      documentHash = "document-data";
      documentHashBytes32 = stringToBytes32(documentHash);

      await trustVerification
        .connect(issuer1)
        .recordInstrument(
          instrumentId,
          amount,
          maturityDate,
          beneficiary,
          documentHashBytes32
        );
    });

    it("Should verify a valid instrument", async function () {
      const [exists, authorized, matches, timestamp, block] =
        await trustVerification.verifyInstrument(
          instrumentId,
          documentHashBytes32
        );

      expect(exists).to.be.true;
      expect(authorized).to.be.true;
      expect(matches).to.be.true;
      expect(timestamp).to.be.greaterThan(0);
      expect(block).to.be.greaterThan(0);
    });

    it("Should detect non-existent instrument", async function () {
      const [exists] = await trustVerification.verifyInstrument(
        "non-existent",
        documentHashBytes32
      );

      expect(exists).to.be.false;
    });

    it("Should detect hash mismatch", async function () {
      const wrongHash = stringToBytes32("wrong-data");
      const [exists, authorized, matches] =
        await trustVerification.verifyInstrument(instrumentId, wrongHash);

      expect(exists).to.be.true;
      expect(authorized).to.be.true;
      expect(matches).to.be.false;
    });

    it("Should detect unauthorized issuer", async function () {
      // Revoke issuer
      await trustVerification.revokeIssuer(issuer1.address);

      const [exists, authorized, matches] =
        await trustVerification.verifyInstrument(
          instrumentId,
          documentHashBytes32
        );

      expect(exists).to.be.true;
      expect(authorized).to.be.false;
      expect(matches).to.be.true;
    });
  });

  // ========================================================================
  // Instrument Revocation Tests
  // ========================================================================

  describe("revokeInstrument", function () {
    let instrumentId: string;
    let amount: bigint;
    let maturityDate: number;
    let beneficiary: string;
    let documentHashBytes32: string;

    beforeEach(async function () {
      await trustVerification.authorizeIssuer(issuer1.address);

      instrumentId = "trust-123";
      amount = ethers.parseUnits("100000", 18);
      maturityDate = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;
      beneficiary = "John Smith";
      documentHashBytes32 = stringToBytes32("document-data");

      await trustVerification
        .connect(issuer1)
        .recordInstrument(
          instrumentId,
          amount,
          maturityDate,
          beneficiary,
          documentHashBytes32
        );
    });

    it("Should revoke an instrument", async function () {
      await trustVerification.revokeInstrument(instrumentId);

      const instrument = await trustVerification.getInstrument(instrumentId);
      expect(instrument.isRevoked).to.be.true;
    });

    it("Should emit InstrumentRevoked event", async function () {
      await expect(trustVerification.revokeInstrument(instrumentId))
        .to.emit(trustVerification, "InstrumentRevoked")
        .withArgs(instrumentId);
    });

    it("Should allow issuer to revoke own instrument", async function () {
      await expect(
        trustVerification.connect(issuer1).revokeInstrument(instrumentId)
      ).to.not.be.reverted;
    });

    it("Should not allow non-issuer to revoke", async function () {
      await expect(
        trustVerification.connect(nonIssuer).revokeInstrument(instrumentId)
      ).to.be.revertedWith("Only owner or issuer can revoke");
    });

    it("Should not revoke non-existent instrument", async function () {
      await expect(
        trustVerification.revokeInstrument("non-existent")
      ).to.be.revertedWith("Instrument does not exist");
    });

    it("Should not revoke already revoked instrument", async function () {
      await trustVerification.revokeInstrument(instrumentId);

      await expect(
        trustVerification.revokeInstrument(instrumentId)
      ).to.be.revertedWith("Instrument already revoked");
    });
  });

  // ========================================================================
  // Payment Recording Tests
  // ========================================================================

  describe("recordPayment", function () {
    let instrumentId: string;

    beforeEach(async function () {
      await trustVerification.authorizeIssuer(issuer1.address);

      instrumentId = "trust-123";
      const amount = ethers.parseUnits("100000", 18);
      const maturityDate = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;
      const beneficiary = "John Smith";
      const documentHashBytes32 = stringToBytes32("document-data");

      await trustVerification
        .connect(issuer1)
        .recordInstrument(
          instrumentId,
          amount,
          maturityDate,
          beneficiary,
          documentHashBytes32
        );
    });

    it("Should record a payment", async function () {
      const paymentAmount = ethers.parseUnits("50000", 18);
      const timestamp = Math.floor(Date.now() / 1000);
      const reference = "PAY-001";
      const method = "bank_transfer";
      const notes = "First payment";

      await trustVerification.recordPayment(
        instrumentId,
        paymentAmount,
        timestamp,
        reference,
        method,
        notes
      );

      const history = await trustVerification.getPaymentHistory(instrumentId);
      expect(history.length).to.equal(1);
      expect(history[0].amount).to.equal(paymentAmount);
      expect(history[0].reference).to.equal(reference);
    });

    it("Should emit PaymentRecorded event", async function () {
      const paymentAmount = ethers.parseUnits("50000", 18);
      const timestamp = Math.floor(Date.now() / 1000);

      await expect(
        trustVerification.recordPayment(
          instrumentId,
          paymentAmount,
          timestamp,
          "PAY-001",
          "bank_transfer",
          "First payment"
        )
      )
        .to.emit(trustVerification, "PaymentRecorded")
        .withArgs(instrumentId, paymentAmount, timestamp);
    });

    it("Should not record payment with zero amount", async function () {
      const timestamp = Math.floor(Date.now() / 1000);

      await expect(
        trustVerification.recordPayment(
          instrumentId,
          0,
          timestamp,
          "PAY-001",
          "bank_transfer",
          "First payment"
        )
      ).to.be.revertedWith("Amount must be greater than 0");
    });

    it("Should record multiple payments", async function () {
      const paymentAmount = ethers.parseUnits("50000", 18);
      const timestamp = Math.floor(Date.now() / 1000);

      // Record first payment
      await trustVerification.recordPayment(
        instrumentId,
        paymentAmount,
        timestamp,
        "PAY-001",
        "bank_transfer",
        "First payment"
      );

      // Record second payment
      await trustVerification.recordPayment(
        instrumentId,
        paymentAmount,
        timestamp + 86400,
        "PAY-002",
        "bank_transfer",
        "Second payment"
      );

      const history = await trustVerification.getPaymentHistory(instrumentId);
      expect(history.length).to.equal(2);
    });
  });

  // ========================================================================
  // Payment Query Tests
  // ========================================================================

  describe("Payment Queries", function () {
    let instrumentId: string;

    beforeEach(async function () {
      await trustVerification.authorizeIssuer(issuer1.address);

      instrumentId = "trust-123";
      const amount = ethers.parseUnits("100000", 18);
      const maturityDate = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;
      const beneficiary = "John Smith";
      const documentHashBytes32 = stringToBytes32("document-data");

      await trustVerification
        .connect(issuer1)
        .recordInstrument(
          instrumentId,
          amount,
          maturityDate,
          beneficiary,
          documentHashBytes32
        );

      // Record payments
      const paymentAmount = ethers.parseUnits("50000", 18);
      const timestamp = Math.floor(Date.now() / 1000);

      for (let i = 0; i < 3; i++) {
        await trustVerification.recordPayment(
          instrumentId,
          paymentAmount,
          timestamp + i * 86400,
          `PAY-00${i + 1}`,
          "bank_transfer",
          `Payment ${i + 1}`
        );
      }
    });

    it("Should get payment count", async function () {
      const count = await trustVerification.getPaymentCount(instrumentId);
      expect(count).to.equal(3);
    });

    it("Should get payment history", async function () {
      const history = await trustVerification.getPaymentHistory(instrumentId);
      expect(history.length).to.equal(3);
    });

    it("Should get payment by index", async function () {
      const payment = await trustVerification.getPaymentByIndex(
        instrumentId,
        0
      );
      expect(payment.reference).to.equal("PAY-001");
    });

    it("Should not get payment with invalid index", async function () {
      await expect(
        trustVerification.getPaymentByIndex(instrumentId, 10)
      ).to.be.revertedWith("Payment index out of bounds");
    });
  });

  // ========================================================================
  // Statistics Tests
  // ========================================================================

  describe("Statistics", function () {
    it("Should get initial instrument count", async function () {
      const count = await trustVerification.getInstrumentCount();
      expect(count).to.equal(0);
    });

    it("Should get initial authorized issuer count", async function () {
      const count = await trustVerification.getAuthorizedIssuerCount();
      expect(count).to.equal(0);
    });

    it("Should get owner", async function () {
      const contractOwner = await trustVerification.getOwner();
      expect(contractOwner).to.equal(owner.address);
    });

    it("Should track issuer count correctly", async function () {
      await trustVerification.authorizeIssuer(issuer1.address);
      let count = await trustVerification.getAuthorizedIssuerCount();
      expect(count).to.equal(1);

      await trustVerification.authorizeIssuer(issuer2.address);
      count = await trustVerification.getAuthorizedIssuerCount();
      expect(count).to.equal(2);

      await trustVerification.revokeIssuer(issuer1.address);
      count = await trustVerification.getAuthorizedIssuerCount();
      expect(count).to.equal(1);
    });
  });

  // ========================================================================
  // Integration Tests
  // ========================================================================

  describe("Integration Tests", function () {
    it("Should complete full workflow", async function () {
      // Step 1: Authorize issuer
      await trustVerification.authorizeIssuer(issuer1.address);
      expect(await trustVerification.isIssuerAuthorized(issuer1.address)).to.be
        .true;

      // Step 2: Record instrument
      const instrumentId = "trust-123";
      const amount = ethers.parseUnits("100000", 18);
      const maturityDate = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;
      const beneficiary = "John Smith";
      const documentHashBytes32 = stringToBytes32("document-data");

      await trustVerification
        .connect(issuer1)
        .recordInstrument(
          instrumentId,
          amount,
          maturityDate,
          beneficiary,
          documentHashBytes32
        );

      // Step 3: Verify instrument
      const [exists, authorized, matches] =
        await trustVerification.verifyInstrument(
          instrumentId,
          documentHashBytes32
        );
      expect(exists).to.be.true;
      expect(authorized).to.be.true;
      expect(matches).to.be.true;

      // Step 4: Record payment
      const paymentAmount = ethers.parseUnits("50000", 18);
      const timestamp = Math.floor(Date.now() / 1000);

      await trustVerification.recordPayment(
        instrumentId,
        paymentAmount,
        timestamp,
        "PAY-001",
        "bank_transfer",
        "First payment"
      );

      // Step 5: Get payment history
      const history = await trustVerification.getPaymentHistory(instrumentId);
      expect(history.length).to.equal(1);
      expect(history[0].amount).to.equal(paymentAmount);

      // Step 6: Revoke instrument
      await trustVerification.revokeInstrument(instrumentId);
      const instrument = await trustVerification.getInstrument(instrumentId);
      expect(instrument.isRevoked).to.be.true;
    });
  });
});
