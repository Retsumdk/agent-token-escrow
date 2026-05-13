/**
 * agent-token-escrow
 * Core types for the escrow system
 */

export enum EscrowStatus {
  PENDING = "PENDING",
  FULFILLED = "FULFILLED",
  CANCELLED = "CANCELLED",
  REFUNDED = "REFUNDED",
  EXPIRED = "EXPIRED",
}

export interface EscrowParticipant {
  id: string;
  name: string;
  publicKey?: string;
}

export interface EscrowCondition {
  type: "hash_match" | "time_lock" | "manual_approval";
  value: string; // The hash or timestamp or verifier ID
}

export interface Escrow {
  id: string;
  sender: EscrowParticipant;
  recipient: EscrowParticipant;
  verifier?: EscrowParticipant;
  amount: number;
  tokenSymbol: string;
  status: EscrowStatus;
  condition: EscrowCondition;
  deadline: number; // Unix timestamp
  createdAt: number;
  updatedAt: number;
  proof?: string;
  metadata?: Record<string, any>;
}

export interface EscrowCreationParams {
  sender: EscrowParticipant;
  recipient: EscrowParticipant;
  verifier?: EscrowParticipant;
  amount: number;
  tokenSymbol: string;
  condition: EscrowCondition;
  expiresInSeconds: number;
  metadata?: Record<string, any>;
}
