# SecureData DApp on Stellar Soroban

A decentralized identity and data verification platform built on the Stellar Soroban Smart Contract Platform.

## Architecture

### On-Chain (Soroban)
- **Identity Registry Contract**: Manages digital identities
- **Verification Contract**: Handles document verification and zk-proof validation
- **Access Control Contract**: Manages permissions and access rights
- **Data Sharing Contract**: Controls document sharing with encryption

### Off-Chain
- **IPFS**: Decentralized storage for encrypted documents
- **AI Layer**: Groq-powered document verification (Llama 4, DeepSeek R1, Mixtral)
- **zk Infrastructure**: Circom + SnarkJS + Groth16 for zero-knowledge proofs

### Tech Stack
- **Frontend**: Next.js 15, TypeScript, TailwindCSS, Shadcn UI, Framer Motion
- **Backend**: NestJS, PostgreSQL, Redis
- **Blockchain**: Stellar Soroban SDK (Rust)
- **Storage**: IPFS, Pinata
- **AI**: Groq API
- **Wallets**: Freighter, Albedo, Lobstr

## Project Structure

```
GuardZero/
├── contracts/          # Soroban smart contracts (Rust)
├── backend/            # NestJS backend
├── frontend/           # Next.js 15 frontend
└── README.md
```

## Getting Started

### Prerequisites
- Rust and Cargo
- Node.js 18+
- Soroban CLI
- PostgreSQL
- Redis

### Installation

1. **Smart Contracts**
   ```bash
   cd contracts
   cargo build
   ```

2. **Backend**
   ```bash
   cd backend
   npm install
   npm run start:dev
   ```

3. **Frontend**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Features

- Self-sovereign identity management
- AI-assisted document verification
- Privacy-preserving zk proofs
- Wallet-based authentication
- Decentralized storage
- User-controlled access permissions
- Instant credential sharing
- Tamper-proof verification records

## License

MIT
# SureData
