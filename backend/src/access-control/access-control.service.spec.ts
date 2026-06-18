import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessControlService } from './access-control.service';
import { AccessPermission } from './access-control.entity';

describe('AccessControlService', () => {
  let service: AccessControlService;
  let repo: Repository<AccessPermission>;

  const mockPermission = {
    id: 'uuid-1',
    grantorAddress: 'GGRANTOR...',
    granteeAddress: 'GGRANTEE...',
    resourceId: 'resource-1',
    accessExpiry: Math.floor(Date.now() / 1000) + 3600,
    isActive: true,
    grantedAt: new Date(),
    metadata: null,
  };

  const mockRepo = {
    create: jest.fn().mockReturnValue(mockPermission),
    save: jest.fn().mockResolvedValue(mockPermission),
    find: jest.fn().mockResolvedValue([mockPermission]),
    findOne: jest.fn().mockResolvedValue(mockPermission),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccessControlService,
        { provide: getRepositoryToken(AccessPermission), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<AccessControlService>(AccessControlService);
    repo = module.get<Repository<AccessPermission>>(getRepositoryToken(AccessPermission));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create an access permission', async () => {
      const dto = {
        grantorAddress: 'GGRANTOR...',
        granteeAddress: 'GGRANTEE...',
        resourceId: 'resource-1',
        accessExpiry: Math.floor(Date.now() / 1000) + 3600,
      };
      const result = await service.create(dto as any);
      expect(result).toEqual(mockPermission);
    });
  });

  describe('findAll', () => {
    it('should return all permissions', async () => {
      const result = await service.findAll();
      expect(result).toEqual([mockPermission]);
    });
  });

  describe('findOne', () => {
    it('should return permission by id', async () => {
      const result = await service.findOne('uuid-1');
      expect(result).toEqual(mockPermission);
    });

    it('should throw on missing permission', async () => {
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

  describe('checkAccess', () => {
    it('should return true for active permission within expiry', async () => {
      const result = await service.checkAccess('GGRANTEE...', 'resource-1');
      expect(result).toBe(true);
    });

    it('should return false when no permission exists', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValueOnce(null);
      const result = await service.checkAccess('GUNKNOWN...', 'resource-1');
      expect(result).toBe(false);
    });
  });

  describe('findByGrantee', () => {
    it('should find permissions by grantee', async () => {
      const result = await service.findByGrantee('GGRANTEE...');
      expect(result).toEqual([mockPermission]);
    });
  });

  describe('findByGrantor', () => {
    it('should find permissions by grantor', async () => {
      const result = await service.findByGrantor('GGRANTOR...');
      expect(result).toEqual([mockPermission]);
    });
  });
});
