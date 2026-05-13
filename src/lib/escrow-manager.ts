import crypto from "node:crypto";
import { 
  Escrow, 
  EscrowCreationParams, 
  EscrowStatus, 
  EscrowCondition 
} from "../types";
import { Storage } from "./storage";

export class EscrowError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "EscrowError";
  }
}

export class EscrowManager {
  private storage: Storage;

  constructor(storage?: Storage) {
    this.storage = storage || new Storage();
  }

  createEscrow(params: EscrowCreationParams): Escrow {
    this.validateCreationParams(params);

    const now = Date.now();
    const escrow: Escrow = {
      id: crypto.randomUUID(),
      sender: params.sender,
      recipient: params.recipient,
      verifier: params.verifier,
      amount: params.amount,
      tokenSymbol: params.tokenSymbol,
      status: EscrowStatus.PENDING,
      condition: params.condition,
      deadline: now + params.expiresInSeconds * 1000,
      createdAt: now,
      updatedAt: now,
      metadata: params.metadata,
    };

    this.storage.add(escrow);
    return escrow;
  }

  fulfillEscrow(id: string, proof: string): Escrow {
    const escrow = this.storage.findById(id);
    if (!escrow) {
      throw new EscrowError(`Escrow ${id} not found`, "NOT_FOUND");
    }

    if (escrow.status !== EscrowStatus.PENDING) {
      throw new EscrowError(`Escrow is already ${escrow.status}`, "INVALID_STATUS");
    }

    if (this.isExpired(escrow)) {
      this.markAsExpired(escrow);
      throw new EscrowError("Escrow has expired", "EXPIRED");
    }

    if (!this.verifyProof(escrow.condition, proof)) {
      throw new EscrowError("Invalid proof provided for escrow condition", "INVALID_PROOF");
    }

    escrow.status = EscrowStatus.FULFILLED;
    escrow.proof = proof;
    this.storage.update(escrow);

    return escrow;
  }

  cancelEscrow(id: string, actorId: string): Escrow {
    const escrow = this.storage.findById(id);
    if (!escrow) {
      throw new EscrowError(`Escrow ${id} not found`, "NOT_FOUND");
    }

    if (escrow.status !== EscrowStatus.PENDING) {
      throw new EscrowError("Only pending escrows can be cancelled", "INVALID_STATUS");
    }

    // Only sender or verifier can cancel before expiry
    if (actorId !== escrow.sender.id && (!escrow.verifier || actorId !== escrow.verifier.id)) {
      throw new EscrowError("Unauthorized to cancel this escrow", "UNAUTHORIZED");
    }

    escrow.status = EscrowStatus.CANCELLED;
    this.storage.update(escrow);

    return escrow;
  }

  processRefund(id: string): Escrow {
    const escrow = this.storage.findById(id);
    if (!escrow) {
      throw new EscrowError(`Escrow ${id} not found`, "NOT_FOUND");
    }

    if (escrow.status !== EscrowStatus.PENDING && escrow.status !== EscrowStatus.EXPIRED) {
      throw new EscrowError("Escrow cannot be refunded in its current state", "INVALID_STATUS");
    }

    if (escrow.status === EscrowStatus.PENDING && !this.isExpired(escrow)) {
      throw new EscrowError("Escrow has not yet expired for auto-refund", "NOT_EXPIRED");
    }

    escrow.status = EscrowStatus.REFUNDED;
    this.storage.update(escrow);

    return escrow;
  }

  listEscrows(filter?: { status?: EscrowStatus; participantId?: string }): Escrow[] {
    let escrows = this.storage.load();

    if (filter?.status) {
      escrows = escrows.filter((e) => e.status === filter.status);
    }

    if (filter?.participantId) {
      const pid = filter.participantId;
      escrows = escrows.filter(
        (e) => e.sender.id === pid || e.recipient.id === pid || e.verifier?.id === pid
      );
    }

    return escrows;
  }

  private validateCreationParams(params: EscrowCreationParams) {
    if (params.amount <= 0) {
      throw new EscrowError("Amount must be greater than zero", "INVALID_AMOUNT");
    }
    // Allow negative expiry for testing purposes, but block extremely old ones
    if (params.expiresInSeconds < -86400) {
      throw new EscrowError("Escrow expiry is too far in the past", "INVALID_EXPIRY");
    }
    if (params.sender.id === params.recipient.id) {
      throw new EscrowError("Sender and recipient cannot be the same", "INVALID_PARTICIPANTS");
    }
  }

  private isExpired(escrow: Escrow): boolean {
    return Date.now() > escrow.deadline;
  }

  private markAsExpired(escrow: Escrow) {
    escrow.status = EscrowStatus.EXPIRED;
    this.storage.update(escrow);
  }

  private verifyProof(condition: EscrowCondition, proof: string): boolean {
    switch (condition.type) {
      case "hash_match":
        const hash = crypto.createHash("sha256").update(proof).digest("hex");
        return hash === condition.value;
      case "time_lock":
        return Date.now() >= parseInt(condition.value);
      case "manual_approval":
        // In a real system, this might check a signature
        return proof === "APPROVED";
      default:
        return false;
    }
  }

  /**
   * Utility to check all pending escrows and mark expired ones
   */
  maintenance() {
    const escrows = this.storage.load();
    let updated = false;
    for (const escrow of escrows) {
      if (escrow.status === EscrowStatus.PENDING && this.isExpired(escrow)) {
        escrow.status = EscrowStatus.EXPIRED;
        updated = true;
      }
    }
    if (updated) {
      this.storage.save(escrows);
    }
  }
}
