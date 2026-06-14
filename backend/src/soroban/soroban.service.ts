import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SorobanRpc,
  Contract,
  TransactionBuilder,
  Address,
  Keypair,
  Networks,
} from '@stellar/stellar-sdk';

@Injectable()
export class SorobanService {
  private server: SorobanRpc.Server;
  private networkPassphrase: string;
  private contracts: {
    identityRegistry?: Contract;
    verification?: Contract;
    accessControl?: Contract;
    dataSharing?: Contract;
  } = {};

  constructor(private readonly configService: ConfigService) {
    const networkUrl = this.configService.get<string>('SOROBAN_NETWORK_URL');
    this.networkPassphrase =
      this.configService.get<string>('SOROBAN_NETWORK_PASSPHRASE') ??
      Networks.TESTNET;

    if (networkUrl) {
      this.server = new SorobanRpc.Server(networkUrl, { allowHttp: false });
    }

    this.initializeContracts();
  }

  private initializeContracts() {
    const identityRegistryId = this.configService.get<string>('IDENTITY_REGISTRY_CONTRACT_ID');
    const verificationId = this.configService.get<string>('VERIFICATION_CONTRACT_ID');
    const accessControlId = this.configService.get<string>('ACCESS_CONTROL_CONTRACT_ID');
    const dataSharingId = this.configService.get<string>('DATA_SHARING_CONTRACT_ID');

    if (identityRegistryId) {
      this.contracts.identityRegistry = new Contract(identityRegistryId);
    }
    if (verificationId) {
      this.contracts.verification = new Contract(verificationId);
    }
    if (accessControlId) {
      this.contracts.accessControl = new Contract(accessControlId);
    }
    if (dataSharingId) {
      this.contracts.dataSharing = new Contract(dataSharingId);
    }
  }

  async registerIdentity(
    walletAddress: string,
    documentHash: string,
    ipfsCid: string,
  ): Promise<any> {
    try {
      if (!this.contracts.identityRegistry) {
        throw new Error('Identity Registry contract not initialized');
      }

      const account = await this.server.getAccount(walletAddress);
      const transaction = new TransactionBuilder(account, {
        fee: '100',
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(
          this.contracts.identityRegistry.call('register_identity', {
            owner: new Address(walletAddress),
            document_hash: Buffer.from(documentHash, 'hex'),
            ipfs_cid: ipfsCid,
          }),
        )
        .setTimeout(30)
        .build();

      return transaction;
    } catch (error) {
      throw new Error(`Failed to register identity: ${error.message}`);
    }
  }

  async submitVerification(
    identityId: string,
    verifierAddress: string,
    proofHash: string,
    verificationCommitment: string,
  ): Promise<any> {
    try {
      if (!this.contracts.verification) {
        throw new Error('Verification contract not initialized');
      }

      const account = await this.server.getAccount(verifierAddress);
      const transaction = new TransactionBuilder(account, {
        fee: '100',
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(
          this.contracts.verification.call('submit_proof', {
            identity_id: identityId,
            verifier: new Address(verifierAddress),
            proof_hash: Buffer.from(proofHash, 'hex'),
            verification_commitment: Buffer.from(verificationCommitment, 'hex'),
          }),
        )
        .setTimeout(30)
        .build();

      return transaction;
    } catch (error) {
      throw new Error(`Failed to submit verification: ${error.message}`);
    }
  }

  async grantAccess(
    grantorAddress: string,
    granteeAddress: string,
    resourceId: string,
    durationSeconds: number,
  ): Promise<any> {
    try {
      if (!this.contracts.accessControl) {
        throw new Error('Access Control contract not initialized');
      }

      const account = await this.server.getAccount(grantorAddress);
      const transaction = new TransactionBuilder(account, {
        fee: '100',
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(
          this.contracts.accessControl.call('grant_access', {
            grantor: new Address(grantorAddress),
            grantee: new Address(granteeAddress),
            resource_id: resourceId,
            duration_seconds: durationSeconds,
          }),
        )
        .setTimeout(30)
        .build();

      return transaction;
    } catch (error) {
      throw new Error(`Failed to grant access: ${error.message}`);
    }
  }

  async shareDocument(
    ownerAddress: string,
    recipientAddress: string,
    documentHash: string,
    encryptedKey: string,
    durationSeconds: number,
  ): Promise<any> {
    try {
      if (!this.contracts.dataSharing) {
        throw new Error('Data Sharing contract not initialized');
      }

      const account = await this.server.getAccount(ownerAddress);
      const transaction = new TransactionBuilder(account, {
        fee: '100',
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(
          this.contracts.dataSharing.call('share_document', {
            owner: new Address(ownerAddress),
            recipient: new Address(recipientAddress),
            document_hash: Buffer.from(documentHash, 'hex'),
            encrypted_key: Buffer.from(encryptedKey, 'hex'),
            duration_seconds: durationSeconds,
          }),
        )
        .setTimeout(30)
        .build();

      return transaction;
    } catch (error) {
      throw new Error(`Failed to share document: ${error.message}`);
    }
  }

  async signAndSubmitTransaction(transaction: any, secretKey: string): Promise<any> {
    try {
      const keypair = Keypair.fromSecret(secretKey);
      transaction.sign(keypair);
      const result = await this.server.sendTransaction(transaction);
      return result;
    } catch (error) {
      throw new Error(`Failed to submit transaction: ${error.message}`);
    }
  }
}
