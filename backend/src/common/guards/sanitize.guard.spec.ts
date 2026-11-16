import { ExecutionContext } from '@nestjs/common';
import { SanitizeGuard } from './sanitize.guard';

describe('SanitizeGuard', () => {
  let guard: SanitizeGuard;

  beforeEach(() => {
    guard = new SanitizeGuard();
  });

  const createMockContext = (req: Record<string, unknown>): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => ({}),
        getNext: () => ({}),
      }),
    }) as unknown as ExecutionContext;

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow activation when request has no query', () => {
    const req = {};
    const context = createMockContext(req);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should sanitize basic query parameters without throwing', () => {
    const req = {
      query: {
        search: "  SELECT * FROM users; DROP TABLE test; --  ",
        page: '1',
      },
    };
    const context = createMockContext(req);

    expect(guard.canActivate(context)).toBe(true);
    expect(req.query.search).toBe('* FROM users; TABLE test;');
    expect(req.query.page).toBe('1');
    expect((req as Record<string, unknown>).sanitizedQuery).toEqual({
      search: '* FROM users; TABLE test;',
      page: '1',
    });
  });

  it('should not throw when request.query is getter-only on prototype (Express 5 IncomingMessage)', () => {
    // Simulates Express 5 where query is a getter-only property on prototype
    const proto = {};
    Object.defineProperty(proto, 'query', {
      get() {
        return this._queryStore;
      },
      configurable: true,
      enumerable: true,
    });

    const req = Object.create(proto);
    req._queryStore = {
      filter: "UNION SELECT 1, 2, 'admin'--",
      sort: 'desc',
    };

    const context = createMockContext(req);

    expect(() => guard.canActivate(context)).not.toThrow();
    expect(req.query.filter).toBe("1, 2, 'admin'");
    expect(req.query.sort).toBe('desc');
    expect(req.sanitizedQuery).toEqual({
      filter: "1, 2, 'admin'",
      sort: 'desc',
    });
  });

  it('should not throw when request.query is non-configurable getter-only on prototype', () => {
    const proto = {};
    Object.defineProperty(proto, 'query', {
      get() {
        return this._queryStore;
      },
      configurable: false,
      enumerable: true,
    });

    const req = Object.create(proto);
    req._queryStore = {
      q: 'UPDATE users SET is_admin = true',
    };

    const context = createMockContext(req);

    expect(() => guard.canActivate(context)).not.toThrow();
    expect(req.query.q).toBe('users SET is_admin = true');
    expect(req.sanitizedQuery).toEqual({
      q: 'users SET is_admin = true',
    });
  });

  it('should not throw when request.query is completely locked/frozen on instance', () => {
    const req: Record<string, unknown> = {};
    const frozenQuery = Object.freeze({
      q: 'SELECT id FROM products',
    });

    Object.defineProperty(req, 'query', {
      get() {
        return frozenQuery;
      },
      configurable: false,
      enumerable: true,
    });

    const context = createMockContext(req);

    expect(() => guard.canActivate(context)).not.toThrow();
    // Even if query could not be modified in place, sanitizedQuery is populated safely
    expect(req.sanitizedQuery).toEqual({
      q: 'id FROM products',
    });
  });

  it('should sanitize nested objects and arrays in query', () => {
    const req = {
      query: {
        filter: {
          category: 'electronics',
          tags: ['SELECT', 'phones', 'DROP --'],
        },
      },
    };
    const context = createMockContext(req);

    expect(guard.canActivate(context)).toBe(true);
    expect(req.query).toEqual({
      filter: {
        category: 'electronics',
        tags: ['', 'phones', ''],
      },
    });
  });
});
