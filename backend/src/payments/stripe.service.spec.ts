import { BadRequestException } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { PaymentStatus } from '../entities/payment.entity';

describe('StripeService', () => {
  let service: StripeService;
  let mockConfigService: any;
  let mockOrdersService: any;
  let mockEmailService: any;
  let mockDataSource: any;
  let mockPaymentRepo: any;
  let mockOrderRepo: any;
  let mockQueryRunner: any;

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'STRIPE_SECRET_KEY') return 'sk_test_mock_123';
        if (key === 'STRIPE_WEBHOOK_SECRET') return 'whsec_test_mock_123';
        return null;
      }),
    };

    mockOrdersService = {
      finalizePaidOrder: jest.fn().mockResolvedValue({
        id: 'order-123',
        customer: { email: 'customer@example.com' },
      }),
      markAsFailed: jest.fn().mockResolvedValue({ id: 'order-123' }),
    };

    mockEmailService = {
      sendOrderConfirmation: jest.fn().mockResolvedValue(undefined),
    };

    mockPaymentRepo = {
      findOne: jest.fn(),
      save: jest.fn((entity: any) => Promise.resolve(entity)),
      create: jest.fn((data: any) => ({ id: 'payment-uuid', ...data })),
    };

    mockOrderRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'order-123',
        total: '500.00',
        customer: { email: 'customer@example.com' },
      }),
    };

    mockQueryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        getRepository: jest.fn().mockReturnValue(mockPaymentRepo),
      },
    };

    mockDataSource = {
      getRepository: jest.fn().mockReturnValue(mockOrderRepo),
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    };

    service = new StripeService(
      mockConfigService,
      mockOrdersService,
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

  it('throws BadRequestException on payment amount mismatch', async () => {
    const mockEvent = {
      id: 'evt_mismatch',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_test_mismatch',
          amount: 10000, // 100.00 BDT
          currency: 'bdt',
          metadata: { orderId: 'order-123' },
        },
      },
    };
    (service as any).stripe.webhooks.constructEvent = jest.fn().mockReturnValue(mockEvent);

    // Order total is 500.00 BDT (50000 cents), but webhook amount is 10000 cents
    mockOrderRepo.findOne.mockResolvedValue({
      id: 'order-123',
      total: '500.00',
    });

    await expect(service.handleWebhook(Buffer.from('{}'), 'valid_sig')).rejects.toThrow(
      'Payment amount mismatch between intent and order',
    );
  });

  it('processes payment_intent.succeeded idempotently', async () => {
    const mockEvent = {
      id: 'evt_123',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_test_123',
          amount: 50000,
          currency: 'bdt',
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
    expect(mockOrdersService.finalizePaidOrder).toHaveBeenCalledWith('order-123', 'pi_test_123');
    expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    expect(mockEmailService.sendOrderConfirmation).toHaveBeenCalled();
  });

  it('skips order finalization if payment was already recorded as COMPLETED', async () => {
    const mockEvent = {
      id: 'evt_123',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_already_done',
          amount: 50000,
          currency: 'bdt',
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
    expect(mockOrdersService.finalizePaidOrder).not.toHaveBeenCalled();
  });

  it('handles payment_intent.payment_failed and marks order failed', async () => {
    const mockEvent = {
      id: 'evt_failed',
      type: 'payment_intent.payment_failed',
      data: {
        object: {
          id: 'pi_failed_123',
          amount: 50000,
          currency: 'bdt',
          metadata: { orderId: 'order-123' },
        },
      },
    };
    (service as any).stripe.webhooks.constructEvent = jest.fn().mockReturnValue(mockEvent);

    const res = await service.handleWebhook(Buffer.from('{}'), 'valid_sig');

    expect(res.received).toBe(true);
    expect(mockOrdersService.markAsFailed).toHaveBeenCalledWith('order-123');
    expect(mockPaymentRepo.save).toHaveBeenCalled();
  });
});
