import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Request, Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CustomerJwtGuard } from '../common/guards/customer-jwt.guard';
import { Payment, PaymentStatus } from '../entities/payment.entity';
import { EmailService } from '../email/email.service';
import { OrdersService } from '../orders/orders.service';
import { BkashService } from './bkash.service';
import { CreateBkashPaymentDto } from './dto/create-bkash-payment.dto';
import { CreateStripeIntentDto } from './dto/create-stripe-intent.dto';
import { ExecuteBkashPaymentDto } from './dto/execute-bkash-payment.dto';
import { StripeService } from './stripe.service';

@Controller('store/payments')
export class PaymentsController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly stripeService: StripeService,
    private readonly bkashService: BkashService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
  ) {}

  @Post('stripe/create-intent')
  @UseGuards(CustomerJwtGuard)
  async createStripeIntent(
    @CurrentUser() user: Record<string, unknown>,
    @Body() dto: CreateStripeIntentDto,
  ) {
    const customerId = this.extractCustomerId(user);
    const order = await this.ordersService.getOrderForPayment(dto.orderId, customerId);
    const amountInCents = Math.round(Number(order.total) * 100);

    const paymentIntent = await this.stripeService.createPaymentIntent(
      amountInCents,
      'inr',
      order.id,
      order.customer.email,
    );

    return {
      orderId: order.id,
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
    };
  }

  @Post('stripe/webhook')
  async stripeWebhook(
    @Req() request: Request,
    @Headers('stripe-signature') signature: string | undefined,
  ) {
    if (!signature) {
      throw new BadRequestException('Stripe signature is missing');
    }

    const rawBody = Buffer.isBuffer(request.body)
      ? request.body
      : Buffer.from(JSON.stringify(request.body ?? {}));

    return this.stripeService.handleWebhook(rawBody, signature);
  }

  @Post('bkash/create')
  @UseGuards(CustomerJwtGuard)
  async createBkashPayment(
    @CurrentUser() user: Record<string, unknown>,
    @Body() dto: CreateBkashPaymentDto,
  ) {
    const customerId = this.extractCustomerId(user);
    const order = await this.ordersService.getOrderForPayment(dto.orderId, customerId);

    const backendPublicUrl =
      this.configService.get<string>('BACKEND_PUBLIC_URL') ??
      `http://localhost:${this.configService.get<string>('PORT') ?? '3001'}`;

    const callbackUrl =
      dto.callbackUrl ??
      `${backendPublicUrl}/store/payments/bkash/callback?orderId=${encodeURIComponent(order.id)}`;

    const payment = await this.bkashService.createPayment(
      Number(order.total).toFixed(2),
      order.id,
      callbackUrl,
    );

    return {
      orderId: order.id,
      callbackUrl,
      payment,
    };
  }

  @Post('bkash/execute')
  @UseGuards(CustomerJwtGuard)
  async executeBkashPayment(
    @CurrentUser() user: Record<string, unknown>,
    @Body() dto: ExecuteBkashPaymentDto,
  ) {
    const customerId = this.extractCustomerId(user);

    // 1. Verify ownership of order
    const order = await this.ordersService.getOrderForPayment(dto.orderId, customerId);

    // 2. Prevent duplicate processing
    const existingPayment = await this.paymentRepository.findOne({
      where: { transactionId: dto.paymentId },
    });

    if (existingPayment && existingPayment.status === PaymentStatus.COMPLETED) {
      return {
        orderId: dto.orderId,
        paymentId: dto.paymentId,
        alreadyProcessed: true,
      };
    }

    // 3. Query transaction status from bKash provider to verify amount and status
    let txnPayload = await this.bkashService.queryPayment(dto.paymentId);

    if (!this.isTransactionCompleted(txnPayload)) {
      // Execute payment through tokenized API
      txnPayload = await this.bkashService.executePayment(dto.paymentId);
      if (!this.isTransactionCompleted(txnPayload)) {
        throw new BadRequestException('bKash payment transaction is not completed or failed');
      }
    }

    // 4. Validate exact amount, currency, order reference, and payment ID
    this.validateBkashTransaction(txnPayload, order, dto.paymentId);

    // 5. Finalize paid order and record payment record idempotently
    const paidOrder = await this.ordersService.finalizePaidOrder(dto.orderId, dto.paymentId);

    if (existingPayment) {
      existingPayment.status = PaymentStatus.COMPLETED;
      existingPayment.rawPayload = txnPayload;
      await this.paymentRepository.save(existingPayment);
    } else {
      const paymentRecord = this.paymentRepository.create({
        orderId: dto.orderId,
        provider: 'bkash',
        transactionId: dto.paymentId,
        amount: Number(paidOrder.total).toFixed(2),
        currency: 'BDT',
        status: PaymentStatus.COMPLETED,
        rawPayload: txnPayload,
      });
      await this.paymentRepository.save(paymentRecord);
    }

    if (paidOrder.customer?.email) {
      this.emailService
        .sendOrderConfirmation(paidOrder, paidOrder.customer)
        .catch(() => {});
    }

    return {
      orderId: dto.orderId,
      paymentId: dto.paymentId,
      status: 'completed',
    };
  }

  @Get('bkash/callback')
  async bkashCallback(
    @Query('orderId') orderId: string | undefined,
    @Query('paymentID') paymentId: string | undefined,
    @Query('status') status: string | undefined,
    @Res() response: Response,
  ) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';

    const params = new URLSearchParams({
      bkashReturn: 'true',
      orderId: orderId ?? '',
      paymentID: paymentId ?? '',
      status: status ?? 'unknown',
    });

    return response.redirect(`${frontendUrl}/checkout?${params.toString()}`);
  }

  private extractCustomerId(user: Record<string, unknown> | undefined): string {
    const customerId = (user?.sub as string | undefined) ?? (user?.id as string | undefined);

    if (!customerId) {
      throw new BadRequestException('Authenticated customer id is missing from token payload');
    }

    return customerId;
  }

  private isTransactionCompleted(payload: Record<string, unknown>): boolean {
    const statusCode = String(payload?.statusCode ?? '');
    const transactionStatus = String(payload?.transactionStatus ?? payload?.status ?? '').toLowerCase();

    // In bKash tokenized API:
    // statusCode "0000" and transactionStatus "Completed" or "Initiated/Success"
    if (statusCode === '0000' && (transactionStatus === 'completed' || transactionStatus === 'success')) {
      return true;
    }

    return transactionStatus === 'completed';
  }

  private validateBkashTransaction(
    payload: Record<string, unknown>,
    order: { id: string; total: string },
    paymentId: string,
  ) {
    // A. Match paymentID
    const returnedPaymentId = String(payload.paymentID ?? payload.paymentId ?? '');
    if (returnedPaymentId && returnedPaymentId !== paymentId) {
      throw new BadRequestException('bKash payment ID mismatch');
    }

    // B. Match Merchant Invoice / Order reference
    const merchantInvoice = String(
      payload.merchantInvoiceNumber ?? payload.merchantInvoice ?? payload.payerReference ?? '',
    );
    if (merchantInvoice && merchantInvoice !== order.id) {
      throw new BadRequestException('bKash merchant invoice does not match order ID');
    }

    // C. Match Currency
    const currency = String(payload.currency ?? 'BDT').toUpperCase();
    if (currency !== 'BDT') {
      throw new BadRequestException(`bKash currency mismatch: expected BDT, received ${currency}`);
    }

    // D. Match Amount
    const paidAmount = Number(payload.amount ?? 0);
    const expectedAmount = Number(order.total);
    if (Math.abs(paidAmount - expectedAmount) > 0.01) {
      throw new BadRequestException(
        `bKash amount mismatch: expected ${expectedAmount}, received ${paidAmount}`,
      );
    }
  }
}
