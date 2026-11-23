import { BadRequestException } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { PaymentStatus } from '../entities/payment.entity';
import { OrderStatus } from '../entities/order.entity';

describe('StripeService Atomic Payment Finalization', () => {
  let service: StripeService;
  let mockConfigService: any;
  let mockOrdersService: any;
  let mockEmailService: any;
  let mockDataSource: any;
  let mockPaymentRepo: any;
  let mockOrderRepo: any;
  let mockProductRepo: any;
  let mockVariantRepo: any;
  let mockQueryRunner: any;

  const mockOrder = {
    id: 'order-123',
    total: '500.00',
    status: OrderStatus.PENDING,
    customer: { email: 'customer@bazaarflow.com' },
    items: [],
  };

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'STRIPE_SECRET_KEY') return 'sk_test_mock_123';
        if (key === 'STRIPE_WEBHOOK_SECRET') return 'whsec_test_mock_123';
        return null;
      }),
    };

    mockOrdersService = {};

    mockEmailService = {
      sendOrderConfirmation: jest.fn().mockResolvedValue(undefined),
    };

    mockPaymentRepo = {
      findOne: jest.fn(),
      save: jest.fn((entity: any) => Promise.resolve(entity)),
      create: jest.fn((data: any) => ({ id: 'payment-uuid', ...data })),
    };

    const orderQb = {
      setLock: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({ ...mockOrder }),
    };

    mockOrderRepo = {
      findOne: jest.fn().mockResolvedValue({ ...mockOrder }),
      save: jest.fn((o: any) => Promise.resolve(o)),
      createQueryBuilder: jest.fn().mockReturnValue(orderQb),
    };

    mockProductRepo = { save: jest.fn() };
    mockVariantRepo = { save: jest.fn() };

    mockQueryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        getRepository: jest.fn((entity: any) => {
          if (entity.name === 'Payment' || entity === 'Payment') return mockPaymentRepo;
          if (entity.name === 'Order' || entity === 'Order') return mockOrderRepo;
          if (entity.name === 'Product' || entity === 'Product') return mockProductRepo;
          if (entity.name === 'ProductVariant' || entity === 'ProductVariant') return mockVariantRepo;
          return mockOrderRepo;
        }),
      },
    };

    mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
      getRepository: jest.fn().mockReturnValue(mockPaymentRepo),
    };

    service = new StripeService(
      mockConfigService,
      mockOrdersService as any,
      mockEmailService,
      mockDataSource,
      mockPaymentRepo,
    );
  });

  it('ignores webhook if STRIPE_WEBHOOK_SECRET is unconfigured', async () => {
    mockConfigService.get.mockReturnValue(null);
    const result = await service.handleWebhook('{}', 'sig_123');
    expect(result.received).toBe(false);
  });

  it('throws BadRequestException on invalid signature', async () => {
    (service as any).stripe.webhooks.constructEvent = jest.fn().mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    await expect(service.handleWebhook(Buffer.from('{}'), 'bad_sig')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('throws BadRequestException on currency mismatch', async () => {
    const mockEvent = {
      id: 'evt_currency_mismatch',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_test_cur',
          amount: 50000,
          currency: 'usd', // expected inr
          metadata: { orderId: 'order-123' },
        },
      },
    };
    (service as any).stripe.webhooks.constructEvent = jest.fn().mockReturnValue(mockEvent);

    await expect(service.handleWebhook(Buffer.from('{}'), 'valid_sig')).rejects.toThrow(
      'Stripe currency mismatch: expected inr, got usd',
    );
  });

  it('throws BadRequestException on payment amount mismatch', async () => {
    const mockEvent = {
      id: 'evt_mismatch',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_test_mismatch',
          amount: 10000, // 100.00 INR
          currency: 'inr',
          metadata: { orderId: 'order-123' },
        },
      },
    };
    (service as any).stripe.webhooks.constructEvent = jest.fn().mockReturnValue(mockEvent);

    // Order total is 500.00 INR (50000 cents), but webhook amount is 10000 cents
    await expect(service.handleWebhook(Buffer.from('{}'), 'valid_sig')).rejects.toThrow(
      /Payment amount mismatch/,
    );
  });

  it('processes payment_intent.succeeded atomically and commits single transaction', async () => {
    const mockEvent = {
      id: 'evt_123',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_test_123',
          amount: 50000,
          currency: 'inr',
          metadata: {
            orderId: 'order-123',
          },
        },
      },
    };

    (service as any).stripe.webhooks.constructEvent = jest.fn().mockReturnValue(mockEvent);
    mockPaymentRepo.findOne.mockResolvedValue(null);

    const res = await service.handleWebhook(Buffer.from('{}'), 'valid_sig');

    expect(res.received).toBe(true);
    expect(mockOrderRepo.createQueryBuilder().setLock).toHaveBeenCalledWith(
      'pessimistic_write',
      undefined,
      ['o'],
    );
    expect(mockOrderRepo.save).toHaveBeenCalled();
    expect(mockPaymentRepo.save).toHaveBeenCalled();
    expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    expect(mockEmailService.sendOrderConfirmation).toHaveBeenCalled();
  });

  it('handles duplicate payment_intent.succeeded idempotently without duplicate error', async () => {
    const mockEvent = {
      id: 'evt_123',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_already_done',
          amount: 50000,
          currency: 'inr',
          metadata: {
            orderId: 'order-123',
          },
        },
      },
    };

    (service as any).stripe.webhooks.constructEvent = jest.fn().mockReturnValue(mockEvent);

    mockPaymentRepo.findOne.mockResolvedValue({
      id: 'existing-payment-id',
      transactionId: 'pi_already_done',
      status: PaymentStatus.COMPLETED,
    });

    const res = await service.handleWebhook(Buffer.from('{}'), 'valid_sig');

    expect(res.alreadyProcessed).toBe(true);
    expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
  });

  it('handles payment_intent.payment_failed idempotently under duplicate deliveries', async () => {
    const mockEvent = {
      id: 'evt_failed',
      type: 'payment_intent.payment_failed',
      data: {
        object: {
          id: 'pi_failed_123',
          amount: 50000,
          currency: 'inr',
          metadata: { orderId: 'order-123' },
        },
      },
    };
    (service as any).stripe.webhooks.constructEvent = jest.fn().mockReturnValue(mockEvent);

    // First delivery
    mockPaymentRepo.findOne.mockResolvedValue(null);
    let res = await service.handleWebhook(Buffer.from('{}'), 'valid_sig');
    expect(res.received).toBe(true);
    expect(mockPaymentRepo.save).toHaveBeenCalled();

    // Repeated delivery with existing failed payment
    mockPaymentRepo.findOne.mockResolvedValue({
      id: 'failed-payment-id',
      transactionId: 'pi_failed_123',
      status: PaymentStatus.FAILED,
    });

    res = await service.handleWebhook(Buffer.from('{}'), 'valid_sig');
    expect(res.received).toBe(true);
    expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
  });
});
