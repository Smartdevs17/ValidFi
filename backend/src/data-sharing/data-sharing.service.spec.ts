import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DataSharingService } from './data-sharing.service';
import { SharedData } from './data-sharing.entity';

describe('DataSharingService', () => {
  let service: DataSharingService;
  let repo: Repository<SharedData>;

  const mockSharedData = {
    id: 'uuid-1',
    ownerAddress: 'GOWNER...',
    recipientAddress: 'GRECIPIENT...',
    documentHash: '0xdoc...',
    encryptedKey: '0xenc...',
    accessExpiry: Math.floor(Date.now() / 1000) + 86400,
    isActive: true,
    sharedAt: new Date(),
    metadata: null,
  };

  const mockRepo = {
    create: jest.fn().mockReturnValue(mockSharedData),
    save: jest.fn().mockResolvedValue(mockSharedData),
    find: jest.fn().mockResolvedValue([mockSharedData]),
    findOne: jest.fn().mockResolvedValue(mockSharedData),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataSharingService,
        { provide: getRepositoryToken(SharedData), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<DataSharingService>(DataSharingService);
    repo = module.get<Repository<SharedData>>(getRepositoryToken(SharedData));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create shared data record', async () => {
      const dto = {
        ownerAddress: 'GOWNER...',
        recipientAddress: 'GRECIPIENT...',
        documentHash: '0xdoc...',
        encryptedKey: '0xenc...',
        accessExpiry: Math.floor(Date.now() / 1000) + 86400,
      };
      const result = await service.create(dto as any);
      expect(result).toEqual(mockSharedData);
    });
  });

  describe('findAll', () => {
    it('should return all shared data', async () => {
      const result = await service.findAll();
      expect(result).toEqual([mockSharedData]);
    });
  });

  describe('findOne', () => {
    it('should return shared data by id', async () => {
      const result = await service.findOne('uuid-1');
      expect(result).toEqual(mockSharedData);
    });

    it('should throw on missing shared data', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValueOnce(null);
      await expect(service.findOne('missing')).rejects.toThrow();
    });
  });

  describe('revoke', () => {
    it('should set isActive to false', async () => {
      const result = await service.revoke('uuid-1');
      expect(result.isActive).toBe(false);
    });
  });

  describe('isShareActive', () => {
    it('should return true for active share within expiry', async () => {
      const result = await service.isShareActive('uuid-1');
      expect(result).toBe(true);
    });
  });

  describe('extendShare', () => {
    it('should extend the access expiry', async () => {
      const result = await service.extendShare('uuid-1', 3600);
      expect(result.accessExpiry).toBe(
        mockSharedData.accessExpiry + 3600,
      );
    });
  });

  describe('findByOwner', () => {
    it('should find by owner address', async () => {
      const result = await service.findByOwner('GOWNER...');
      expect(result).toEqual([mockSharedData]);
    });
  });

  describe('findByRecipient', () => {
    it('should find by recipient address', async () => {
      const result = await service.findByRecipient('GRECIPIENT...');
      expect(result).toEqual([mockSharedData]);
    });
  });
});
