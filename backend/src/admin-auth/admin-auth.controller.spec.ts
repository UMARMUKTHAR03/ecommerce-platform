import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';

describe('AdminAuthController', () => {
  let controller: AdminAuthController;
  let mockAuthService: any;
  let mockConfigService: any;

  beforeEach(async () => {
    mockAuthService = {
      login: jest.fn(),
      me: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'COOKIE_DOMAIN') return null;
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminAuthController],
      providers: [
        { provide: AdminAuthService, useValue: mockAuthService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    controller = module.get<AdminAuthController>(AdminAuthController);
  });

  it('sets secure HttpOnly cookie upon login and does NOT return accessToken in JSON', async () => {
    mockAuthService.login.mockResolvedValue({
      requiresTwoFactorSetup: false,
      accessToken: 'super-secret-admin-token-12345',
    });

    const mockResponse: any = {
      cookie: jest.fn(),
    };

    const result = await controller.login(
      { email: 'admin@bazaarflow.com', password: 'password', totpCode: '123456' },
      mockResponse,
    );

    // Verify cookie was set with HttpOnly and Secure
    expect(mockResponse.cookie).toHaveBeenCalledWith(
      'admin_access_token',
      'super-secret-admin-token-12345',
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: 'none',
      }),
    );

    // Verify token is NOT exposed in the returned JSON body
    expect(result).toEqual({ requiresTwoFactorSetup: false });
    expect((result as any).accessToken).toBeUndefined();
  });

  it('clears admin_access_token cookie upon logout', () => {
    const mockResponse: any = {
      clearCookie: jest.fn(),
    };

    const result = controller.logout(mockResponse);

    expect(mockResponse.clearCookie).toHaveBeenCalledWith(
      'admin_access_token',
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: 'none',
      }),
    );
    expect(result).toEqual({ success: true });
  });
});
