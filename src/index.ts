#!/usr/bin/env bun
import { Command } from "commander";
import { EscrowManager } from "./lib/escrow-manager";
import { EscrowStatus } from "./types";
import { Table } from "console-table-printer";

const manager = new EscrowManager();

const program = new Command();
program
  .name("agent-escrow")
  .description("CLI for managing secure agent-to-agent token escrows")
  .version("1.0.0");

program
  .command("create")
  .description("Create a new escrow")
  .requiredOption("-s, --sender <id>", "Sender ID")
  .requiredOption("-r, --recipient <id>", "Recipient ID")
  .option("-v, --verifier <id>", "Verifier ID")
  .requiredOption("-a, --amount <number>", "Amount to escrow", parseFloat)
  .option("-t, --token <symbol>", "Token symbol", "AI")
  .option("-e, --expiry <seconds>", "Expiry in seconds", "3600")
  .option("--hash <hash>", "Condition hash (sha256 of proof)")
  .action((opts) => {
    try {
      const condition = opts.hash 
        ? { type: "hash_match" as const, value: opts.hash }
        : { type: "manual_approval" as const, value: opts.verifier || opts.sender };

      const escrow = manager.createEscrow({
        sender: { id: opts.sender, name: `Agent ${opts.sender}` },
        recipient: { id: opts.recipient, name: `Agent ${opts.recipient}` },
        verifier: opts.verifier ? { id: opts.verifier, name: `Verifier ${opts.verifier}` } : undefined,
        amount: opts.amount,
        tokenSymbol: opts.token,
        condition,
        expiresInSeconds: parseInt(opts.expiry),
      });

      console.log("✅ Escrow created successfully!");
      console.log(`ID: ${escrow.id}`);
      console.log(`Status: ${escrow.status}`);
      console.log(`Deadline: ${new Date(escrow.deadline).toLocaleString()}`);
    } catch (err: any) {
      console.error(`❌ Error: ${err.message}`);
    }
  });

program
  .command("list")
  .description("List all escrows")
  .option("-u, --status <status>", "Filter by status")
  .option("-p, --participant <id>", "Filter by participant ID")
  .action((opts) => {
    manager.maintenance();
    const escrows = manager.listEscrows({
      status: opts.status as EscrowStatus,
      participantId: opts.participant,
    });

    if (escrows.length === 0) {
      console.log("No escrows found.");
      return;
    }

    const p = new Table({
      columns: [
        { name: "id", alignment: "left" },
        { name: "sender", alignment: "left" },
        { name: "recipient", alignment: "left" },
        { name: "amount", alignment: "right" },
        { name: "status", alignment: "left" },
        { name: "deadline", alignment: "left" },
      ],
    });

    escrows.forEach((e) => {
      p.addRow({
        id: e.id.slice(0, 8) + "...",
        sender: e.sender.id,
        recipient: e.recipient.id,
        amount: `${e.amount} ${e.tokenSymbol}`,
        status: e.status,
        deadline: new Date(e.deadline).toLocaleString(),
      });
    });

    p.printTable();
  });

program
  .command("fulfill <id>")
  .description("Fulfill an escrow with proof")
  .requiredOption("-p, --proof <string>", "Proof to release escrow")
  .action((id, opts) => {
    try {
      const escrow = manager.fulfillEscrow(id, opts.proof);
      console.log(`✅ Escrow ${id} fulfilled!`);
      console.log(`Status: ${escrow.status}`);
    } catch (err: any) {
      console.error(`❌ Error: ${err.message}`);
    }
  });

program
  .command("cancel <id>")
  .description("Cancel a pending escrow")
  .requiredOption("-u, --user <id>", "User ID performing the cancellation")
  .action((id, opts) => {
    try {
      const escrow = manager.cancelEscrow(id, opts.user);
      console.log(`✅ Escrow ${id} cancelled.`);
    } catch (err: any) {
      console.error(`❌ Error: ${err.message}`);
    }
  });

program
  .command("refund <id>")
  .description("Process a refund for an expired escrow")
  .action((id) => {
    try {
      const escrow = manager.processRefund(id);
      console.log(`✅ Escrow ${id} refunded.`);
    } catch (err: any) {
      console.error(`❌ Error: ${err.message}`);
    }
  });

program
  .command("inspect <id>")
  .description("View full details of an escrow")
  .action((id) => {
    const escrows = manager.listEscrows();
    const escrow = escrows.find(e => e.id === id || e.id.startsWith(id));
    if (!escrow) {
      console.error("❌ Escrow not found");
      return;
    }
    console.log(JSON.stringify(escrow, null, 2));
  });

program.parse(process.argv);
