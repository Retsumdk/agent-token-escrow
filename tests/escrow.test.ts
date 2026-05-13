import { expect, test, describe, beforeEach } from "bun:test";
import { EscrowManager } from "../src/lib/escrow-manager";
import { Storage } from "../src/lib/storage";
import { EscrowStatus } from "../src/types";
import { rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import crypto from "node:crypto";

const TEST_DB = join(process.cwd(), "data", "test-escrows.json");

describe("EscrowManager", () => {
  let manager: EscrowManager;
  let storage: Storage;

  beforeEach(() => {
    if (existsSync(TEST_DB)) {
      rmSync(TEST_DB);
    }
    storage = new Storage(TEST_DB);
    manager = new EscrowManager(storage);
  });

  test("should create a new escrow", () => {
    const escrow = manager.createEscrow({
      sender: { id: "agent-1", name: "Sender" },
      recipient: { id: "agent-2", name: "Recipient" },
      amount: 100,
      tokenSymbol: "AI",
      condition: { type: "manual_approval", value: "agent-1" },
      expiresInSeconds: 3600,
    });

    expect(escrow.id).toBeDefined();
    expect(escrow.status).toBe(EscrowStatus.PENDING);
    expect(escrow.amount).toBe(100);
  });

  test("should fulfill an escrow with correct hash proof", () => {
    const proof = "secret-key-123";
    const hash = crypto.createHash("sha256").update(proof).digest("hex");

    const escrow = manager.createEscrow({
      sender: { id: "agent-1", name: "Sender" },
      recipient: { id: "agent-2", name: "Recipient" },
      amount: 50,
      tokenSymbol: "AI",
      condition: { type: "hash_match", value: hash },
      expiresInSeconds: 3600,
    });

    const fulfilled = manager.fulfillEscrow(escrow.id, proof);
    expect(fulfilled.status).toBe(EscrowStatus.FULFILLED);
    expect(fulfilled.proof).toBe(proof);
  });

  test("should throw error on invalid proof", () => {
    const escrow = manager.createEscrow({
      sender: { id: "agent-1", name: "Sender" },
      recipient: { id: "agent-2", name: "Recipient" },
      amount: 50,
      tokenSymbol: "AI",
      condition: { type: "hash_match", value: "wrong-hash" },
      expiresInSeconds: 3600,
    });

    expect(() => manager.fulfillEscrow(escrow.id, "wrong-proof")).toThrow();
  });

  test("should cancel a pending escrow", () => {
    const escrow = manager.createEscrow({
      sender: { id: "agent-1", name: "Sender" },
      recipient: { id: "agent-2", name: "Recipient" },
      amount: 10,
      tokenSymbol: "AI",
      condition: { type: "manual_approval", value: "agent-1" },
      expiresInSeconds: 3600,
    });

    const cancelled = manager.cancelEscrow(escrow.id, "agent-1");
    expect(cancelled.status).toBe(EscrowStatus.CANCELLED);
  });

  test("should prevent unauthorized cancellation", () => {
    const escrow = manager.createEscrow({
      sender: { id: "agent-1", name: "Sender" },
      recipient: { id: "agent-2", name: "Recipient" },
      amount: 10,
      tokenSymbol: "AI",
      condition: { type: "manual_approval", value: "agent-1" },
      expiresInSeconds: 3600,
    });

    expect(() => manager.cancelEscrow(escrow.id, "random-agent")).toThrow();
  });

  test("should handle expired escrows", async () => {
    const escrow = manager.createEscrow({
      sender: { id: "agent-1", name: "Sender" },
      recipient: { id: "agent-2", name: "Recipient" },
      amount: 10,
      tokenSymbol: "AI",
      condition: { type: "manual_approval", value: "agent-1" },
      expiresInSeconds: -10, // already expired
    });

    expect(() => manager.fulfillEscrow(escrow.id, "APPROVED")).toThrow();
    
    manager.maintenance();
    const list = manager.listEscrows({ status: EscrowStatus.EXPIRED });
    expect(list.length).toBe(1);
    expect(list[0].id).toBe(escrow.id);
  });
});
