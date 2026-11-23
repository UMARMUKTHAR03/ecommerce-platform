import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AdminJwtGuard } from './admin-jwt.guard';

describe('AdminJwtGuard', () => {
  let guard: AdminJwtGuard;
  let mockConfigService: any;
  let jwtService: JwtService;
  const jwtSecret = 'test-jwt-secret';

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'JWT_SECRET') return jwtSecret;
        return null;
      }),
    };
    guard = new AdminJwtGuard(mockConfigService as ConfigService);
    jwtService = new JwtService();
  });

  function createMockContext(headers: Record<string, string>): ExecutionContext {
    const request: any = {
      headers,
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  it('throws UnauthorizedException if no cookie is provided', () => {
    const context = createMockContext({});
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('rejects with ForbiddenException when ANY Bearer token is provided', () => {
    const token = jwtService.sign(
      { sub: 'admin@bazaarflow.com', role: 'admin' },
      { secret: jwtSecret },
    );
    const context = createMockContext({
      authorization: `Bearer ${token}`,
      cookie: `admin_access_token=${token}`,
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context)).toThrow('Admin endpoints require cookie authentication only. Bearer tokens are not accepted.');
  });

  it('rejects customer Bearer token with ForbiddenException even when a valid admin cookie is present', () => {
    const adminToken = jwtService.sign(
      { sub: 'admin@bazaarflow.com', role: 'admin' },
      { secret: jwtSecret },
    );
    const customerToken = jwtService.sign(
      { sub: 'cust-1', role: 'customer' },
      { secret: jwtSecret },
    );
    const context = createMockContext({
      authorization: `Bearer ${customerToken}`,
      cookie: `admin_access_token=${adminToken}`,
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('allows access when valid token is in admin_access_token HttpOnly cookie with role admin', () => {
    const token = jwtService.sign(
      { sub: 'admin@bazaarflow.com', role: 'admin' },
      { secret: jwtSecret },
    );
    const context = createMockContext({
      cookie: `other=123; admin_access_token=${token}; more=abc`,
    });

    const result = guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('allows access when valid token in cookie has role superadmin', () => {
    const token = jwtService.sign(
      { sub: 'super@bazaarflow.com', role: 'superadmin' },
      { secret: jwtSecret },
    );
    const context = createMockContext({
      cookie: `admin_access_token=${token}`,
    });

    const result = guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('allows access when valid token in cookie has role manager', () => {
    const token = jwtService.sign(
      { sub: 'manager@bazaarflow.com', role: 'manager' },
      { secret: jwtSecret },
    );
    const context = createMockContext({
      cookie: `admin_access_token=${token}`,
    });

    const result = guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('rejects with ForbiddenException when a customer token is passed inside cookie', () => {
    const customerToken = jwtService.sign(
      { sub: 'cust-1', role: 'customer' },
      { secret: jwtSecret },
    );
    const context = createMockContext({
      cookie: `admin_access_token=${customerToken}`,
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rejects with UnauthorizedException when token in cookie is expired or invalid', () => {
    const context = createMockContext({
      cookie: 'admin_access_token=invalid.jwt.token',
    });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
