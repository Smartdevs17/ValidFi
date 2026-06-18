import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VerificationService } from './verification.service';
import { Verification, VerificationStatus } from './verification.entity';

describe('VerificationService', () => {
  let service: VerificationService;
  let repo: Repository<Verification>;

  const mockVerification = {
    id: 'uuid-1',
    identityId: 'identity-1',
    walletAddress: 'GVERIFIER...',
    proofHash: '0xproof...',
    verificationCommitment: '0xcommit...',
    status: VerificationStatus.PENDING,
    reason: null,
    expiresAt: new Date(Date.now() + 86400000),
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRepo = {
    create: jest.fn().mockReturnValue(mockVerification),
    save: jest.fn().mockResolvedValue(mockVerification),
    find: jest.fn().mockResolvedValue([mockVerification]),
    findOne: jest.fn().mockResolvedValue(mockVerification),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    findAndCount: jest.fn().mockResolvedValue([[mockVerification], 1]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerificationService,
        { provide: getRepositoryToken(Verification), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<VerificationService>(VerificationService);
    repo = module.get<Repository<Verification>>(getRepositoryToken(Verification));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a verification record', async () => {
      const dto = {
        identityId: 'identity-1',
        walletAddress: 'GVERIFIER...',
        proofHash: '0xproof...',
        verificationCommitment: '0xcommit...',
      };
      const result = await service.create(dto as any);
      expect(result).toEqual(mockVerification);
      expect(repo.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('findAll', () => {
    it('should return all verifications', async () => {
      const result = await service.findAll();
      expect(result).toEqual([mockVerification]);
    });
  });

  describe('findOne', () => {
    it('should return verification by id', async () => {
      const result = await service.findOne('uuid-1');
      expect(result).toEqual(mockVerification);
    });

    it('should throw on missing verification', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValueOnce(null);
      await expect(service.findOne('missing')).rejects.toThrow();
    });
  });

  describe('approve', () => {
    it('should set status to approved', async () => {
      const result = await service.approve('uuid-1');
      expect(result.status).toBe(VerificationStatus.APPROVED);
    });
  });

  describe('reject', () => {
    it('should set status to rejected with reason', async () => {
      const result = await service.reject('uuid-1', 'invalid proof');
      expect(result.status).toBe(VerificationStatus.REJECTED);
      expect(result.reason).toBe('invalid proof');
    });
  });

  describe('findByIdentityId', () => {
    it('should find verifications by identity id', async () => {
      const result = await service.findByIdentityId('identity-1');
      expect(result).toEqual([mockVerification]);
    });
  });

  describe('expireStale', () => {
    it('should expire stale verifications', async () => {
      const count = await service.expireStale();
      expect(count).toBe(1);
    });
  });

  describe('isExpired', () => {
    it('should return false for non-expired', async () => {
      const result = await service.isExpired('uuid-1');
      expect(result).toBe(false);
    });
  });
});
