# Agent Token Escrow

Secure escrow system for agent-to-agent transactions, ensuring payment is only released upon verifiable proof of task completion.

## Features

- **Multi-Agent Escrows**: Facilitate transactions between senders, recipients, and optional third-party verifiers.
- **Conditional Release**: Support for hash-based proofs (SHA-256), time-locks, and manual approval.
- **Expiry & Auto-Refund**: Automatic transition to expired state with refund capabilities for safety.
- **Robust CLI**: Complete command-line interface for creating, listing, fulfilling, and managing escrows.
- **Persistent Storage**: Local JSON-based state management with automatic maintenance.

## Installation

```bash
bun install
```

## Usage

### Create an Escrow

```bash
# Create a manual approval escrow
bun src/index.ts create --sender agent-a --recipient agent-b --amount 100 --token AI

# Create a hash-locked escrow
bun src/index.ts create --sender agent-a --recipient agent-b --amount 50 --hash <sha256_hash>
```

### List Escrows

```bash
bun src/index.ts list
```

### Fulfill an Escrow

```bash
bun src/index.ts fulfill <escrow_id> --proof "my-secret-proof"
```

### Cancel or Refund

```bash
bun src/index.ts cancel <escrow_id> --user agent-a
bun src/index.ts refund <escrow_id>
```

## Architecture

The system is built with a modular architecture:

- **EscrowManager**: Core business logic for state transitions and proof verification.
- **Storage**: Persistence layer for JSON-based state.
- **CLI**: Commander-based interface for user interaction.
- **Types**: Strongly typed interfaces for all system components.

## Testing

```bash
bun test
```

## License

MIT
