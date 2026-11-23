import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateOrderDto, CreateOrderItemDto } from './create-order.dto';

describe('CreateOrderDto Validation', () => {
  it('rejects order with non-UUID productId', async () => {
    const payload = {
      items: [
        {
          productId: 'prod-123-not-a-uuid',
          quantity: 1,
        },
      ],
      shippingAddress: {
        fullName: 'Test Customer',
        phone: '9876543210',
        streetAddress: '123 Main Street',
        city: 'Mumbai',
        postalCode: '400001',
        country: 'India',
      },
      deliveryMethod: 'standard',
      paymentMethod: 'stripe',
    };

    const instance = plainToInstance(CreateOrderDto, payload);
    const errors = await validate(instance);

    expect(errors.length).toBeGreaterThan(0);
    const itemError = errors.find((e) => e.property === 'items');
    expect(itemError).toBeDefined();

    // Check nested errors in children
    const childErrors = itemError?.children?.[0]?.children ?? [];
    const productIdError = childErrors.find((c) => c.property === 'productId');
    expect(productIdError?.constraints?.matches).toBeDefined();
    expect(productIdError?.constraints?.matches).toBe('productId must be a UUID');
  });

  it('rejects order with invalid variantId if provided', async () => {
    const payload = {
      items: [
        {
          productId: 'b0000000-0000-0000-0000-000000000101',
          variantId: 'variant-not-a-uuid',
          quantity: 2,
        },
      ],
      shippingAddress: {
        fullName: 'Test Customer',
        phone: '9876543210',
        streetAddress: '123 Main Street',
        city: 'Mumbai',
      },
    };

    const instance = plainToInstance(CreateOrderDto, payload);
    const errors = await validate(instance);

    expect(errors.length).toBeGreaterThan(0);
    const itemError = errors.find((e) => e.property === 'items');
    const childErrors = itemError?.children?.[0]?.children ?? [];
    const variantIdError = childErrors.find((c) => c.property === 'variantId');
    expect(variantIdError?.constraints?.matches).toBeDefined();
    expect(variantIdError?.constraints?.matches).toBe('variantId must be a UUID');
  });

  it('accepts order with valid product and variant UUIDs', async () => {
    const payload = {
      items: [
        {
          productId: 'b0000000-0000-0000-0000-000000000101',
          variantId: 'c0000000-0000-0000-0000-000000000001',
          quantity: 1,
        },
      ],
      shippingAddress: {
        fullName: 'Test Customer',
        phone: '9876543210',
        streetAddress: '123 Main Street',
        city: 'Mumbai',
        postalCode: '400001',
        country: 'India',
      },
      paymentMethod: 'stripe',
    };

    const instance = plainToInstance(CreateOrderDto, payload);
    const errors = await validate(instance);

    if (errors.length > 0) {
      console.log('Validation errors:', JSON.stringify(errors, null, 2));
    }

    expect(errors.length).toBe(0);
  });
});
