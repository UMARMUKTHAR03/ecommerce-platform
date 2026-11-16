import { StripeService } from './stripe.service';
import { PaymentStatus } from '../entities/payment.entity';

describe('StripeService', () => {
  let service: StripeService;
  let mockConfigService: any;
  let mockOrdersService: any;
  let mockEmailService: any;
  let mockPaymentRepo: any;

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

    service = new StripeService(
      mockConfigService,
      mockOrdersService,
      mockEmailService,
      mockPaymentRepo,
    );
  });

  it('ignores webhook if STRIPE_WEBHOOK_SECRET is unconfigured', async () => {
    mockConfigService.get.mockReturnValue(null);
    const result = await service.handleWebhook('{}', 'sig_123');
    expect(result.received).toBe(false);
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

    // Spy on constructEvent
    (service as any).stripe.webhooks.constructEvent = jest.fn().mockReturnValue(mockEvent);

    // First time: payment does not exist yet
    mockPaymentRepo.findOne.mockResolvedValue(null);

    const res = await service.handleWebhook(Buffer.from('{}'), 'valid_sig');

    expect(res.received).toBe(true);
    expect(mockOrdersService.finalizePaidOrder).toHaveBeenCalledWith('order-123', 'pi_test_123');
    expect(mockPaymentRepo.save).toHaveBeenCalled();
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

    // Already completed payment in DB
    mockPaymentRepo.findOne.mockResolvedValue({
      id: 'existing-payment-id',
      transactionId: 'pi_already_done',
      status: PaymentStatus.COMPLETED,
    });

    const res = await service.handleWebhook(Buffer.from('{}'), 'valid_sig');

    expect(res.alreadyProcessed).toBe(true);
    expect(mockOrdersService.finalizePaidOrder).not.toHaveBeenCalled();
  });
});
