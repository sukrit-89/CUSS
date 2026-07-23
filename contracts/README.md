# ReRail Contracts

This workspace contains the contract layer for ReRail.

## Current Contract

`rerail_registry` is a Soroban/Stellar smart contract registry for campaign and recipient state. It does not replace Stellar native claimable balances or fee-bump transactions. Those remain protocol-level operations handled by the app/backend.

The registry tracks:

- campaign metadata and lifecycle
- recipient registration
- claim token hash uniqueness
- claimable balance hash recording
- claim transaction hash recording
- expiry state

## Commands

```bash
bun run contracts:test
bun run contracts:build
```

The contract is pinned to `soroban-sdk = 26.0.0-rc.1` to match the local `stellar 26.0.0` CLI available in this workspace.
