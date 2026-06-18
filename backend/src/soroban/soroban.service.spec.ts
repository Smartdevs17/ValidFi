import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SorobanService } from './soroban.service';

describe('SorobanService', () => {
  let service: SorobanService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config = {
        SOROBAN_NETWORK_URL: 'https://soroban-testnet.stellar.org',
        SOROBAN_NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
        IDENTITY_REGISTRY_CONTRACT_ID: 'CCX...identity',
        VERIFICATION_CONTRACT_ID: 'CCX...verification',
        ACCESS_CONTROL_CONTRACT_ID: 'CCX...access',
        DATA_SHARING_CONTRACT_ID: 'CCX...sharing',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SorobanService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<SorobanService>(SorobanService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('registerIdentity', () => {
    it('should throw if identity registry contract not initialized', async () => {
      const svc = new SorobanService({ get: () => undefined } as any);
      await expect(
        svc.registerIdentity('G...', '0xdoc', 'QmTest'),
      ).rejects.toThrow('Identity Registry contract not initialized');
    });
  });

  describe('submitVerification', () => {
    it('should throw if verification contract not initialized', async () => {
      const svc = new SorobanService({ get: () => undefined } as any);
      await expect(
        svc.submitVerification('1', 'G...', '0xproof', '0xcommit'),
      ).rejects.toThrow('Verification contract not initialized');
    });
  });

  describe('grantAccess', () => {
    it('should throw if access control contract not initialized', async () => {
      const svc = new SorobanService({ get: () => undefined } as any);
      await expect(
        svc.grantAccess('G...', 'G...', '1', 3600),
      ).rejects.toThrow('Access Control contract not initialized');
    });
  });

  describe('shareDocument', () => {
    it('should throw if data sharing contract not initialized', async () => {
      const svc = new SorobanService({ get: () => undefined } as any);
      await expect(
        svc.shareDocument('G...', 'G...', '0xdoc', '0xkey', 86400),
      ).rejects.toThrow('Data Sharing contract not initialized');
    });
  });

  describe('signAndSubmitTransaction', () => {
    it('should throw if server is not configured', async () => {
      const svc = new SorobanService({ get: () => undefined } as any);
      await expect(
        svc.signAndSubmitTransaction({} as any, 'secret'),
      ).rejects.toThrow();
    });
  });
});
