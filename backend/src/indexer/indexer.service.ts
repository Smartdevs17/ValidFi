import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { SorobanRpc } from '@stellar/stellar-sdk';
import {
  IndexedIdentity,
  IndexedVerification,
  IndexedAccessControl,
  IndexedDataSharing,
} from './entities';

@Injectable()
export class IndexerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IndexerService.name);
  private rpcServer: SorobanRpc.Server;
  private isIndexing = false;
  private lastLedgerSequence: number = 0;

  private static readonly LEDGER_CACHE_KEY = 'indexer:last_ledger_sequence';

  constructor(
    @InjectRepository(IndexedIdentity)
    private identityRepository: Repository<IndexedIdentity>,
    @InjectRepository(IndexedVerification)
    private verificationRepository: Repository<IndexedVerification>,
    @InjectRepository(IndexedAccessControl)
    private accessControlRepository: Repository<IndexedAccessControl>,
    @InjectRepository(IndexedDataSharing)
    private dataSharingRepository: Repository<IndexedDataSharing>,
    private configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async onModuleInit() {
    const sorobanNetworkUrl = this.configService.get<string>('SOROBAN_NETWORK_URL');
    this.rpcServer = new SorobanRpc.Server(sorobanNetworkUrl, {
      allowHttp: sorobanNetworkUrl?.startsWith('http://') ?? false,
    });

    // Get the last indexed ledger from database
    const lastIndexed = await this.getLastIndexedLedger();
    this.lastLedgerSequence = lastIndexed || 0;

    this.logger.log(
      `Indexer initialized. Starting from ledger sequence: ${this.lastLedgerSequence}`,
    );

    // Start initial indexing
    await this.indexNewBlocks();
  }

  async onModuleDestroy() {
    this.isIndexing = false;
    this.logger.log('Indexer stopped');
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async indexNewBlocks() {
    if (this.isIndexing) {
      return;
    }

    this.isIndexing = true;
    try {
      const latestLedger = await this.rpcServer.getLatestLedger();
      const currentSequence = Number(latestLedger.sequence);

      if (currentSequence <= this.lastLedgerSequence) {
        return;
      }

      this.logger.log(
        `Indexing from ledger ${this.lastLedgerSequence + 1} to ${currentSequence}`,
      );

      // Process new ledgers
      for (
        let seq = this.lastLedgerSequence + 1;
        seq <= currentSequence;
        seq++
      ) {
        await this.processLedger(seq);
      }

      this.lastLedgerSequence = currentSequence;
      await this.saveLastIndexedLedger(currentSequence);

      this.logger.log(
        `Successfully indexed up to ledger sequence ${currentSequence}`,
      );
    } catch (error) {
      this.logger.error('Error during indexing:', error);
    } finally {
      this.isIndexing = false;
    }
  }

  private async processLedger(ledgerSequence: number) {
    try {
      const ledger = await this.rpcServer.getLedger({
        sequence: ledgerSequence,
      });

      // Process transactions in the ledger
      for (const tx of ledger.transactions || []) {
        await this.processTransaction(tx, ledgerSequence, ledger.timestamp);
      }
    } catch (error) {
      this.logger.error(
        `Error processing ledger ${ledgerSequence}:`,
        error,
      );
    }
  }

  private async processTransaction(
    transaction: any,
    ledgerSequence: number,
    ledgerTimestamp: number,
  ) {
    try {
      // Check if transaction involves our contracts
      const operations = transaction.operations || [];

      for (const op of operations) {
        if (op.type === 'invoke_host_function') {
          await this.processContractInvocation(
            op,
            transaction.hash,
            ledgerSequence,
            ledgerTimestamp,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Error processing transaction ${transaction.hash}:`,
        error,
      );
    }
  }

  private async processContractInvocation(
    operation: any,
    txHash: string,
    ledgerSequence: number,
    ledgerTimestamp: number,
  ) {
    const contractId = operation.contractId || operation.source?.contractId;

    if (!contractId) {
      return;
    }

    const functionName = operation.functionName || operation.function;

    // Identity Registry Contract
    if (contractId === this.configService.get<string>('IDENTITY_REGISTRY_CONTRACT_ID')) {
      await this.processIdentityRegistryEvent(
        functionName,
        operation,
        txHash,
        ledgerSequence,
        ledgerTimestamp,
        contractId,
      );
    }

    // Verification Contract
    if (contractId === this.configService.get<string>('VERIFICATION_CONTRACT_ID')) {
      await this.processVerificationEvent(
        functionName,
        operation,
        txHash,
        ledgerSequence,
        ledgerTimestamp,
        contractId,
      );
    }

    // Access Control Contract
    if (contractId === this.configService.get<string>('ACCESS_CONTROL_CONTRACT_ID')) {
      await this.processAccessControlEvent(
        functionName,
        operation,
        txHash,
        ledgerSequence,
        ledgerTimestamp,
        contractId,
      );
    }

    // Data Sharing Contract
    if (contractId === this.configService.get<string>('DATA_SHARING_CONTRACT_ID')) {
      await this.processDataSharingEvent(
        functionName,
        operation,
        txHash,
        ledgerSequence,
        ledgerTimestamp,
        contractId,
      );
    }
  }

  private async processIdentityRegistryEvent(
    functionName: string,
    operation: any,
    txHash: string,
    ledgerSequence: number,
    ledgerTimestamp: number,
    contractId: string,
  ) {
    const args = operation.args || operation.parameters || [];

    switch (functionName) {
      case 'register_identity':
        const identity = new IndexedIdentity();
        identity.identityId = args[0]?.toString() || '0';
        identity.owner = args[1]?.toString() || '';
        identity.documentHash = args[2]?.toString() || '';
        identity.ipfsCid = args[3]?.toString() || '';
        identity.verificationStatus = false;
        identity.revoked = false;
        identity.createdAt = ledgerTimestamp;
        identity.ledgerTimestamp = ledgerTimestamp;
        identity.ledgerSequence = ledgerSequence;
        identity.transactionHash = txHash;
        identity.contractId = contractId;
        identity.metadata = { rawArgs: args };
        await this.identityRepository.save(identity);
        this.logger.log(`Indexed identity registration: ${identity.identityId}`);
        break;

      case 'update_identity':
        await this.identityRepository.update(
          { identityId: args[0]?.toString() },
          {
            documentHash: args[1]?.toString(),
            ipfsCid: args[2]?.toString(),
            ledgerSequence,
            ledgerTimestamp,
            transactionHash: txHash,
          },
        );
        this.logger.log(`Indexed identity update: ${args[0]?.toString()}`);
        break;

      case 'revoke_identity':
        await this.identityRepository.update(
          { identityId: args[0]?.toString() },
          {
            revoked: true,
            ledgerSequence,
            ledgerTimestamp,
            transactionHash: txHash,
          },
        );
        this.logger.log(`Indexed identity revocation: ${args[0]?.toString()}`);
        break;
    }
  }

  private async processVerificationEvent(
    functionName: string,
    operation: any,
    txHash: string,
    ledgerSequence: number,
    ledgerTimestamp: number,
    contractId: string,
  ) {
    const args = operation.args || operation.parameters || [];

    switch (functionName) {
      case 'verify_credential':
        const verification = new IndexedVerification();
        verification.verificationId = args[0]?.toString() || '0';
        verification.identityId = args[1]?.toString() || '0';
        verification.verifier = args[2]?.toString() || '';
        verification.subject = args[3]?.toString() || '';
        verification.verified = args[4] || false;
        verification.proofHash = args[5]?.toString() || '';
        verification.zkProof = args[6]?.toString() || '';
        verification.verifiedAt = ledgerTimestamp;
        verification.ledgerTimestamp = ledgerTimestamp;
        verification.ledgerSequence = ledgerSequence;
        verification.transactionHash = txHash;
        verification.contractId = contractId;
        verification.metadata = { rawArgs: args };
        await this.verificationRepository.save(verification);
        this.logger.log(`Indexed verification: ${verification.verificationId}`);
        break;
    }
  }

  private async processAccessControlEvent(
    functionName: string,
    operation: any,
    txHash: string,
    ledgerSequence: number,
    ledgerTimestamp: number,
    contractId: string,
  ) {
    const args = operation.args || operation.parameters || [];

    switch (functionName) {
      case 'grant_access':
        const accessControl = new IndexedAccessControl();
        accessControl.accessId = args[0]?.toString() || '0';
        accessControl.identityId = args[1]?.toString() || '0';
        accessControl.grantor = args[2]?.toString() || '';
        accessControl.grantee = args[3]?.toString() || '';
        accessControl.accessGranted = true;
        accessControl.expiresAt = args[4] ? Number(args[4]) : null;
        accessControl.grantedAt = ledgerTimestamp;
        accessControl.ledgerTimestamp = ledgerTimestamp;
        accessControl.ledgerSequence = ledgerSequence;
        accessControl.transactionHash = txHash;
        accessControl.contractId = contractId;
        accessControl.metadata = { rawArgs: args };
        await this.accessControlRepository.save(accessControl);
        this.logger.log(`Indexed access grant: ${accessControl.accessId}`);
        break;

      case 'revoke_access':
        await this.accessControlRepository.update(
          { accessId: args[0]?.toString() },
          {
            accessGranted: false,
            ledgerSequence,
            ledgerTimestamp,
            transactionHash: txHash,
          },
        );
        this.logger.log(`Indexed access revocation: ${args[0]?.toString()}`);
        break;
    }
  }

  private async processDataSharingEvent(
    functionName: string,
    operation: any,
    txHash: string,
    ledgerSequence: number,
    ledgerTimestamp: number,
    contractId: string,
  ) {
    const args = operation.args || operation.parameters || [];

    switch (functionName) {
      case 'share_data':
        const dataSharing = new IndexedDataSharing();
        dataSharing.sharingId = args[0]?.toString() || '0';
        dataSharing.identityId = args[1]?.toString() || '0';
        dataSharing.owner = args[2]?.toString() || '';
        dataSharing.recipient = args[3]?.toString() || '';
        dataSharing.encryptedData = args[4]?.toString() || '';
        dataSharing.encryptionKeyHash = args[5]?.toString() || '';
        dataSharing.accessRevoked = false;
        dataSharing.sharedAt = ledgerTimestamp;
        dataSharing.ledgerTimestamp = ledgerTimestamp;
        dataSharing.ledgerSequence = ledgerSequence;
        dataSharing.transactionHash = txHash;
        dataSharing.contractId = contractId;
        dataSharing.metadata = { rawArgs: args };
        await this.dataSharingRepository.save(dataSharing);
        this.logger.log(`Indexed data sharing: ${dataSharing.sharingId}`);
        break;

      case 'revoke_sharing':
        await this.dataSharingRepository.update(
          { sharingId: args[0]?.toString() },
          {
            accessRevoked: true,
            ledgerSequence,
            ledgerTimestamp,
            transactionHash: txHash,
          },
        );
        this.logger.log(`Indexed sharing revocation: ${args[0]?.toString()}`);
        break;
    }
  }

  private async getLastIndexedLedger(): Promise<number> {
    try {
      const cached = await this.cacheManager.get<number>(
        IndexerService.LEDGER_CACHE_KEY,
      );
      if (cached !== undefined && cached !== null) {
        return cached;
      }

      // Fall back to highest ledger in DB on first boot (cold start)
      const [identity] = await this.identityRepository.find({
        order: { ledgerSequence: 'DESC' },
        take: 1,
      });
      return identity?.ledgerSequence ?? 0;
    } catch (error) {
      this.logger.error('Error getting last indexed ledger:', error);
      return 0;
    }
  }

  private async saveLastIndexedLedger(ledgerSequence: number): Promise<void> {
    try {
      await this.cacheManager.set(
        IndexerService.LEDGER_CACHE_KEY,
        ledgerSequence,
        0, // no TTL — persists until evicted or restarted
      );
      this.logger.debug(`Checkpointed last ledger: ${ledgerSequence}`);
    } catch (error) {
      this.logger.error('Failed to checkpoint ledger sequence in Redis:', error);
    }
  }

  // Query methods for the indexed data
  async getIdentitiesByOwner(owner: string): Promise<IndexedIdentity[]> {
    return this.identityRepository.find({
      where: { owner },
      order: { createdAt: 'DESC' },
    });
  }

  async getVerificationsBySubject(subject: string): Promise<IndexedVerification[]> {
    return this.verificationRepository.find({
      where: { subject },
      order: { verifiedAt: 'DESC' },
    });
  }

  async getAccessControlsByGrantee(grantee: string): Promise<IndexedAccessControl[]> {
    return this.accessControlRepository.find({
      where: { grantee, accessGranted: true },
      order: { grantedAt: 'DESC' },
    });
  }

  async getDataSharingByRecipient(recipient: string): Promise<IndexedDataSharing[]> {
    return this.dataSharingRepository.find({
      where: { recipient, accessRevoked: false },
      order: { sharedAt: 'DESC' },
    });
  }

  async getIndexerStatus() {
    return {
      isIndexing: this.isIndexing,
      lastLedgerSequence: this.lastLedgerSequence,
      indexedIdentities: await this.identityRepository.count(),
      indexedVerifications: await this.verificationRepository.count(),
      indexedAccessControls: await this.accessControlRepository.count(),
      indexedDataSharing: await this.dataSharingRepository.count(),
    };
  }
}
