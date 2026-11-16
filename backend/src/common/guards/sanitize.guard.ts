import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class SanitizeGuard implements CanActivate {
  private readonly sqlPattern = /\b(select|insert|drop|delete|update|union)\b|--/gi;

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { sanitizedQuery?: unknown }>();

    if (request && request.query && typeof request.query === 'object') {
      const sanitizedQuery = this.sanitizeValue(request.query) as Record<string, unknown>;

      // Populate dedicated sanitized property without touching read-only descriptors
      request.sanitizedQuery = sanitizedQuery;

      // Safely apply to request.query across Express versions
      this.applySanitizedQuery(request, sanitizedQuery);
    }

    return true;
  }

  private applySanitizedQuery(
    request: Request & { sanitizedQuery?: unknown },
    sanitizedQuery: Record<string, unknown>,
  ): void {
    // 1. If property is configurable or own property, redefine it with value descriptor
    try {
      Object.defineProperty(request, 'query', {
        value: sanitizedQuery,
        writable: true,
        enumerable: true,
        configurable: true,
      });
      return;
    } catch {
      // Cannot redefine property directly
    }

    // 2. If setter exists on prototype or own property, invoke it safely
    const desc =
      Object.getOwnPropertyDescriptor(request, 'query') ||
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(request), 'query');

    if (desc && typeof desc.set === 'function') {
      try {
        (request as unknown as { query: unknown }).query = sanitizedQuery;
        return;
      } catch {
        // Fall through to in-place mutation
      }
    }

    // 3. In-place mutation of the existing query object if it is extensible/mutable
    if (request.query && typeof request.query === 'object' && !Object.isFrozen(request.query)) {
      try {
        const queryObj = request.query as Record<string, unknown>;
        for (const key of Object.keys(queryObj)) {
          delete queryObj[key];
        }
        Object.assign(queryObj, sanitizedQuery);
      } catch {
        // Property is completely locked/read-only; sanitizedQuery remains available on request
      }
    }
  }

  private sanitizeValue(value: unknown): unknown {
    if (typeof value === 'string') {
      return value.replace(this.sqlPattern, '').replace(/\s{2,}/g, ' ').trim();
    }

    if (Array.isArray(value)) {
      return value.map((entry) => this.sanitizeValue(entry));
    }

    if (!value || typeof value !== 'object') {
      return value;
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, this.sanitizeValue(entry)]),
    );
  }
}
