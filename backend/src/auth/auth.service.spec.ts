import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Customer } from '../entities/customer.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import * as bcrypt from 'bcrypt';

describe('AuthService RefreshToken & Session Lifecycle', () => {
  let authService: AuthService;
  let mockCustomerRepo: any;
  let mockRefreshTokenRepo: any;
  let mockJwtService: any;
  let mockConfigService: any;
  let mockEmailService: any;

  const mockCustomer: Customer = {
    id: 'cust-uuid-1',
    email: 'customer@bazaarflow.com',
    passwordHash: '',
    name: 'Test Customer',
    phone: null,
    isVerified: true,
    failedLoginAttempts: 0,
    lockedUntil: null,
    passwordResetTokenHash: null,
    passwordResetExpiresAt: null,
    orders: [],
    addresses: [],
    reviews: [],
    wishlists: [],
    refreshTokens: [],
    createdAt: new Date(),
  };

  beforeEach(async () => {
    mockCustomer.passwordHash = await bcrypt.hash('Password123!', 10);

    mockCustomerRepo = {
      findOne: jest.fn(),
      save: jest.fn((c: any) => Promise.resolve(c)),
      create: jest.fn((c: any) => ({ ...mockCustomer, ...c })),
      createQueryBuilder: jest.fn(),
    };

    const tokensStore: RefreshToken[] = [];
    mockRefreshTokenRepo = {
      create: jest.fn((data: any) => ({ id: 'token-uuid-' + Math.random(), ...data })),
      save: jest.fn((entry: RefreshToken) => {
        const existingIdx = tokensStore.findIndex((t) => t.id === entry.id || t.token === entry.token);
        if (existingIdx >= 0) {
          tokensStore[existingIdx] = entry;
        } else {
          tokensStore.push(entry);
        }
        return Promise.resolve(entry);
      }),
      findOne: jest.fn(({ where }: any) => {
        const found = tokensStore.find((t) => {
          let match = true;
          if (where.token && t.token !== where.token) match = false;
          if (where.isRevoked !== undefined && t.isRevoked !== where.isRevoked) match = false;
          return match;
        });
        return Promise.resolve(found ?? null);
      }),
      createQueryBuilder: jest.fn(() => ({
        update: jest.fn().mockReturnThis(),
        set: jest.fn((val: any) => ({
          where: jest.fn((clause: string, params: any) => ({
            execute: jest.fn(() => {
              tokensStore.forEach((t) => {
                if (t.customerId === params.customerId) {
                  t.isRevoked = val.isRevoked;
                }
              });
              return Promise.resolve({ affected: tokensStore.length });
            }),
          })),
        })),
      })),
    };

    let tokenCounter = 0;
    mockJwtService = {
      signAsync: jest.fn((payload: any, options: any) => {
        tokenCounter++;
        return Promise.resolve(`jwt.${payload.sub}.${payload.type ?? 'access'}.${Date.now()}.${tokenCounter}`);
      }),
      verifyAsync: jest.fn((token: string) => {
        if (token.includes('invalid')) {
          throw new Error('Invalid token');
        }
        return Promise.resolve({ sub: mockCustomer.id, type: 'refresh' });
      }),
    };

    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'JWT_SECRET') return 'strong-test-jwt-secret-12345';
        if (key === 'REFRESH_TOKEN_SECRET') return 'strong-test-refresh-secret-67890';
        if (key === 'JWT_EXPIRY') return '15m';
        if (key === 'REFRESH_TOKEN_EXPIRY') return '30d';
        return null;
      }),
    };

    mockEmailService = {
      sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
      sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    };

    authService = new AuthService(
      mockCustomerRepo,
      mockRefreshTokenRepo,
      mockJwtService,
      mockConfigService,
      mockEmailService,
    );
  });

  it('Customer registration issues tokens and persists RefreshToken', async () => {
    mockCustomerRepo.findOne.mockResolvedValue(null);

    const result = await authService.register({
      email: 'new@bazaarflow.com',
      password: 'Password123!',
      name: 'New User',
    });

    expect(result.tokens).toBeDefined();
    expect(result.tokens.accessToken).toBeDefined();
    expect(result.tokens.refreshToken).toBeDefined();
    expect(mockRefreshTokenRepo.save).toHaveBeenCalled();
  });

  it('Customer login issues fresh token pair and saves refresh token', async () => {
    mockCustomerRepo.findOne.mockResolvedValue(mockCustomer);

    const result = await authService.login({
      email: mockCustomer.email,
      password: 'Password123!',
    });

    expect(result.tokens.refreshToken).toBeDefined();
    expect(mockRefreshTokenRepo.save).toHaveBeenCalled();
  });

  it('Successful refresh rotates token: revokes old token and issues new pair', async () => {
    mockCustomerRepo.findOne.mockResolvedValue(mockCustomer);

    // Issue initial token pair
    const initial = await authService.login({
      email: mockCustomer.email,
      password: 'Password123!',
    });

    const oldRefreshToken = initial.tokens.refreshToken;

    // Refresh using old token
    const refreshed = await authService.refreshTokens(oldRefreshToken);
    expect(refreshed.tokens.refreshToken).toBeDefined();
    expect(refreshed.tokens.refreshToken).not.toEqual(oldRefreshToken);

    // Old token should now be revoked in the store
    const oldEntry = await mockRefreshTokenRepo.findOne({ where: { token: oldRefreshToken } });
    expect(oldEntry?.isRevoked).toBe(true);

    // Attempting to refresh again with the revoked old token should fail with 401
    await expect(authService.refreshTokens(oldRefreshToken)).rejects.toThrow(UnauthorizedException);
  });

  it('Logout revokes the refresh token and rejects further refresh attempts', async () => {
    mockCustomerRepo.findOne.mockResolvedValue(mockCustomer);

    const initial = await authService.login({
      email: mockCustomer.email,
      password: 'Password123!',
    });

    const tokenToRevoke = initial.tokens.refreshToken;

    // Logout
    const logoutRes = await authService.logout(tokenToRevoke);
    expect(logoutRes.success).toBe(true);

    // Refresh should now fail
    await expect(authService.refreshTokens(tokenToRevoke)).rejects.toThrow(UnauthorizedException);
  });

  it('Password reset revokes all existing refresh tokens for the customer', async () => {
    mockCustomerRepo.findOne.mockResolvedValue(mockCustomer);

    // Customer logs in on two devices
    const session1 = await authService.login({ email: mockCustomer.email, password: 'Password123!' });
    const session2 = await authService.login({ email: mockCustomer.email, password: 'Password123!' });

    // Mock reset token lookup
    const qbMock = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(mockCustomer),
    };
    mockCustomerRepo.createQueryBuilder.mockReturnValue(qbMock);

    // Execute resetPassword
    await authService.resetPassword({
      token: 'valid-reset-token',
      newPassword: 'BrandNewPassword123!',
    });

    // Both sessions should now be revoked
    const entry1 = await mockRefreshTokenRepo.findOne({ where: { token: session1.tokens.refreshToken } });
    const entry2 = await mockRefreshTokenRepo.findOne({ where: { token: session2.tokens.refreshToken } });

    expect(entry1?.isRevoked).toBe(true);
    expect(entry2?.isRevoked).toBe(true);
  });
});
