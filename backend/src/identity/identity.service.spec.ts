import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IdentityService } from './identity.service';
import { Identity } from './identity.entity';

describe('IdentityService', () => {
  let service: IdentityService;
  let repo: Repository<Identity>;

  const mockIdentity = {
    id: 'uuid-1',
    walletAddress: 'GABCD...1234',
    documentHash: '0xabcd...',
    ipfsCid: 'QmTest123',
    verificationStatus: false,
    revoked: false,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRepo = {
    create: jest.fn().mockReturnValue(mockIdentity),
    save: jest.fn().mockResolvedValue(mockIdentity),
    find: jest.fn().mockResolvedValue([mockIdentity]),
    findOne: jest.fn().mockResolvedValue(mockIdentity),
    findAndCount: jest.fn().mockResolvedValue([[mockIdentity], 1]),
    remove: jest.fn().mockResolvedValue(mockIdentity),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdentityService,
        { provide: getRepositoryToken(Identity), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<IdentityService>(IdentityService);
    repo = module.get<Repository<Identity>>(getRepositoryToken(Identity));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create and return an identity', async () => {
      const dto = {
        walletAddress: 'GABCD...1234',
        documentHash: '0xabcd...',
        ipfsCid: 'QmTest123',
      };
      const result = await service.create(dto as any);
      expect(result).toEqual(mockIdentity);
      expect(repo.create).toHaveBeenCalledWith(dto);
      expect(repo.save).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      const result = await service.findAll();
      expect(result.data).toEqual([mockIdentity]);
      expect(result.total).toBe(1);
    });

    it('should filter by wallet address', async () => {
      await service.findAll('GABCD...1234');
      expect(repo.findAndCount).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return an identity by id', async () => {
      const result = await service.findOne('uuid-1');
      expect(result).toEqual(mockIdentity);
    });

    it('should throw NotFoundException if not found', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValueOnce(null);
      await expect(service.findOne('missing')).rejects.toThrow();
    });
  });

  describe('update', () => {
    it('should update and return identity', async () => {
      const dto = { ipfsCid: 'QmUpdated' };
      const result = await service.update('uuid-1', dto as any);
      expect(result).toEqual(mockIdentity);
    });
  });

  describe('revoke', () => {
    it('should set revoked to true', async () => {
      const result = await service.revoke('uuid-1');
      expect(result.revoked).toBe(true);
    });
  });

  describe('remove', () => {
    it('should delete identity', async () => {
      await service.remove('uuid-1');
      expect(repo.remove).toHaveBeenCalled();
    });
  });

  describe('findByDocumentHash', () => {
    it('should find by document hash', async () => {
      const result = await service.findByDocumentHash('0xabcd...');
      expect(result).toEqual(mockIdentity);
    });
  });
});
