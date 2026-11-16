import { BadRequestException } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentStatus } from '../entities/payment.entity';

describe('PaymentsController bKash Verification', () => {
  let controller: PaymentsController;
  let mockOrdersService: any;
  let mockStripeService: any;
  let mockBkashService: any;
  let mockEmailService: any;
  let mockConfigService: any;
  let mockPaymentRepo: any;

  const mockOrder = {
    id: 'order-bkash-123',
    customerId: 'cust-1',
    total: '1250.00',
    customer: { email: 'user@bazaarflow.com' },
  };

  beforeEach(() => {
    mockOrdersService = {
      getOrderForPayment: jest.fn().mockResolvedValue(mockOrder),
      finalizePaidOrder: jest.fn().mockResolvedValue(mockOrder),
    };

    mockStripeService = {};

    mockBkashService = {
      queryPayment: jest.fn(),
      executePayment: jest.fn(),
    };

    mockEmailService = {
      sendOrderConfirmation: jest.fn().mockResolvedValue(undefined),
    };

    mockConfigService = {
      get: jest.fn(),
    };

    mockPaymentRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((d: any) => ({ id: 'p-1', ...d })),
      save: jest.fn((d: any) => Promise.resolve(d)),
    };

    controller = new PaymentsController(
      mockOrdersService,
      mockStripeService,
      mockBkashService,
      mockEmailService,
      mockConfigService,
      mockPaymentRepo,
    );
  });

  it('rejects execution when status is failed or pending', async () => {
    mockBkashService.queryPayment.mockResolvedValue({
      statusCode: '2023',
      status: 'Pending',
    });
    mockBkashService.executePayment.mockResolvedValue({
      statusCode: '2023',
      transactionStatus: 'Failed',
    });

    await expect(
      controller.executeBkashPayment(
        { sub: 'cust-1' },
        { orderId: 'order-bkash-123', paymentId: 'pay-123' },
      ),
    ).rejects.toThrow(BadRequestException);

    expect(mockOrdersService.finalizePaidOrder).not.toHaveBeenCalled();
  });

  it('rejects execution when currency is not BDT', async () => {
    mockBkashService.queryPayment.mockResolvedValue({
      statusCode: '0000',
      transactionStatus: 'Completed',
      currency: 'USD',
      amount: '1250.00',
      paymentID: 'pay-123',
      merchantInvoiceNumber: 'order-bkash-123',
    });

    await expect(
      controller.executeBkashPayment(
        { sub: 'cust-1' },
        { orderId: 'order-bkash-123', paymentId: 'pay-123' },
      ),
    ).rejects.toThrow('bKash currency mismatch: expected BDT, received USD');

    expect(mockOrdersService.finalizePaidOrder).not.toHaveBeenCalled();
  });

  it('rejects execution when amount does not match order total', async () => {
    mockBkashService.queryPayment.mockResolvedValue({
      statusCode: '0000',
      transactionStatus: 'Completed',
      currency: 'BDT',
      amount: '500.00', // expected 1250.00
      paymentID: 'pay-123',
      merchantInvoiceNumber: 'order-bkash-123',
    });

    await expect(
      controller.executeBkashPayment(
        { sub: 'cust-1' },
        { orderId: 'order-bkash-123', paymentId: 'pay-123' },
      ),
    ).rejects.toThrow(/bKash amount mismatch/);

    expect(mockOrdersService.finalizePaidOrder).not.toHaveBeenCalled();
  });

  it('rejects execution when merchant invoice does not match order ID', async () => {
    mockBkashService.queryPayment.mockResolvedValue({
      statusCode: '0000',
      transactionStatus: 'Completed',
      currency: 'BDT',
      amount: '1250.00',
      paymentID: 'pay-123',
      merchantInvoiceNumber: 'different-order-999',
    });

    await expect(
      controller.executeBkashPayment(
        { sub: 'cust-1' },
        { orderId: 'order-bkash-123', paymentId: 'pay-123' },
      ),
    ).rejects.toThrow('bKash merchant invoice does not match order ID');

    expect(mockOrdersService.finalizePaidOrder).not.toHaveBeenCalled();
  });

  it('skips processing if payment is already recorded as COMPLETED (idempotency)', async () => {
    mockPaymentRepo.findOne.mockResolvedValue({
      id: 'existing-payment',
      transactionId: 'pay-123',
      status: PaymentStatus.COMPLETED,
    });

    const res = await controller.executeBkashPayment(
      { sub: 'cust-1' },
      { orderId: 'order-bkash-123', paymentId: 'pay-123' },
    );

    expect(res.alreadyProcessed).toBe(true);
    expect(mockBkashService.queryPayment).not.toHaveBeenCalled();
    expect(mockOrdersService.finalizePaidOrder).not.toHaveBeenCalled();
  });

  it('successfully verifies and finalizes order when all transaction attributes match', async () => {
    mockBkashService.queryPayment.mockResolvedValue({
      statusCode: '0000',
      transactionStatus: 'Completed',
      currency: 'BDT',
      amount: '1250.00',
      paymentID: 'pay-123',
      merchantInvoiceNumber: 'order-bkash-123',
    });

    const res = await controller.executeBkashPayment(
      { sub: 'cust-1' },
      { orderId: 'order-bkash-123', paymentId: 'pay-123' },
    );

    expect(res.status).toBe('completed');
    expect(mockOrdersService.finalizePaidOrder).toHaveBeenCalledWith('order-bkash-123', 'pay-123');
    expect(mockPaymentRepo.save).toHaveBeenCalled();
    expect(mockEmailService.sendOrderConfirmation).toHaveBeenCalled();
  });
});
