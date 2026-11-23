import { BadRequestException } from '@nestjs/common';
import { PaymentsController } from './payments.controller';

describe('PaymentsController Stripe Integration', () => {
  let controller: PaymentsController;
  let mockOrdersService: any;
  let mockStripeService: any;

  const mockOrder = {
    id: 'order-stripe-123',
    customerId: 'cust-1',
    total: '1250.00',
    customer: { email: 'user@bazaarflow.com' },
  };

  beforeEach(() => {
    mockOrdersService = {
      getOrderForPayment: jest.fn().mockResolvedValue(mockOrder),
      finalizePaidOrder: jest.fn().mockResolvedValue(mockOrder),
    };

    mockStripeService = {
      createPaymentIntent: jest.fn().mockResolvedValue({
        id: 'pi_test_123',
        client_secret: 'pi_test_123_secret',
      }),
      handleWebhook: jest.fn().mockResolvedValue({ received: true }),
    };

    controller = new PaymentsController(
      mockOrdersService,
      mockStripeService,
    );
  });

  it('creates Stripe payment intent for valid order and authenticated customer', async () => {
    const res = await controller.createStripeIntent(
      { sub: 'cust-1' },
      { orderId: 'order-stripe-123' },
    );

    expect(mockOrdersService.getOrderForPayment).toHaveBeenCalledWith('order-stripe-123', 'cust-1');
    expect(mockStripeService.createPaymentIntent).toHaveBeenCalledWith(
      125000,
      'inr',
      'order-stripe-123',
      'user@bazaarflow.com',
    );
    expect(res).toEqual({
      orderId: 'order-stripe-123',
      paymentIntentId: 'pi_test_123',
      clientSecret: 'pi_test_123_secret',
    });
  });

  it('throws BadRequestException when Stripe signature is missing in webhook', async () => {
    await expect(
      controller.stripeWebhook({ body: {} } as any, undefined),
    ).rejects.toThrow(BadRequestException);
  });

  it('delegates valid webhook to StripeService', async () => {
    const mockRequest = { body: Buffer.from('{"id":"evt_1"}') };
    const res = await controller.stripeWebhook(mockRequest as any, 'test_sig');

    expect(mockStripeService.handleWebhook).toHaveBeenCalledWith(
      mockRequest.body,
      'test_sig',
    );
    expect(res).toEqual({ received: true });
  });
});
