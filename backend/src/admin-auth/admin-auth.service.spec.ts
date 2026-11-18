import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { AdminAuthService } from './admin-auth.service';
import { Admin, AdminRole } from '../entities/admin.entity';
import * as totpUtils from '../common/utils/totp';

describe('AdminAuthService', () => {
  let service: AdminAuthService;
  let mockAdminRepo: any;
  let mockJwtService: any;
  let mockConfigService: any;

  const testPassword = 'SuperSecretAdmin123!';
  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await bcrypt.hash(testPassword, 10);
  });

  beforeEach(async () => {
    mockAdminRepo = {
      findOne: jest.fn(),
      create: jest.fn((dto) => dto),
      save: jest.fn((entity) => Promise.resolve({ id: 'admin-1', ...entity })),
    };

    mockJwtService = {
      signAsync: jest.fn().mockResolvedValue('mock-admin-jwt-token'),
    };

    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'ADMIN_EMAIL') return 'admin@bazaarflow.com';
        if (key === 'ADMIN_PASSWORD_HASH') return passwordHash;
        if (key === 'JWT_SECRET') return 'secret-jwt-key';
        if (key === 'APP_NAME') return 'BazaarFlow LUXE';
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminAuthService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: getRepositoryToken(Admin), useValue: mockAdminRepo },
      ],
    }).compile();

    service = module.get<AdminAuthService>(AdminAuthService);
  });

  it('rejects login with unknown email', async () => {
    mockAdminRepo.findOne.mockResolvedValue(null);

    await expect(
      service.login({
        email: 'unknown@bazaarflow.com',
        password: testPassword,
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects login with invalid password', async () => {
    mockAdminRepo.findOne.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@bazaarflow.com',
      passwordHash,
      isActive: true,
      totpSecret: 'MOCKSECRET',
    });

    await expect(
      service.login({
        email: 'admin@bazaarflow.com',
        password: 'WrongPassword!',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('returns requiresTwoFactorSetup and qrCodeUrl if admin has no TOTP secret', async () => {
    mockAdminRepo.findOne.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@bazaarflow.com',
      passwordHash,
      isActive: true,
      totpSecret: null,
    });

    const res = await service.login({
      email: 'admin@bazaarflow.com',
      password: testPassword,
    });

    expect(res.requiresTwoFactorSetup).toBe(true);
    expect(res).toHaveProperty('qrCodeUrl');
    expect(mockAdminRepo.save).toHaveBeenCalled();
  });

  it('requires totpCode if admin already has TOTP setup', async () => {
    mockAdminRepo.findOne.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@bazaarflow.com',
      passwordHash,
      isActive: true,
      totpSecret: 'JBSWY3DPEHPK3PXP',
    });

    await expect(
      service.login({
        email: 'admin@bazaarflow.com',
        password: testPassword,
      }),
    ).rejects.toThrow('TOTP code is required');
  });

  it('rejects invalid TOTP code', async () => {
    mockAdminRepo.findOne.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@bazaarflow.com',
      passwordHash,
      isActive: true,
      totpSecret: 'JBSWY3DPEHPK3PXP',
    });

    jest.spyOn(totpUtils, 'verify').mockResolvedValue({ valid: false });

    await expect(
      service.login({
        email: 'admin@bazaarflow.com',
        password: testPassword,
        totpCode: '000000',
      }),
    ).rejects.toThrow('Invalid TOTP code');
  });

  it('successfully logs in with valid credentials and valid TOTP code', async () => {
    mockAdminRepo.findOne.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@bazaarflow.com',
      passwordHash,
      role: AdminRole.ADMIN,
      isActive: true,
      totpSecret: 'JBSWY3DPEHPK3PXP',
    });

    jest.spyOn(totpUtils, 'verify').mockResolvedValue({ valid: true });

    const res = await service.login({
      email: 'admin@bazaarflow.com',
      password: testPassword,
      totpCode: '123456',
    });

    expect(res.requiresTwoFactorSetup).toBe(false);
    expect(res.accessToken).toBe('mock-admin-jwt-token');
    expect(mockJwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 'admin@bazaarflow.com',
        id: 'admin-1',
        role: AdminRole.ADMIN,
      }),
      expect.anything(),
    );
  });
});
