import {
  BadRequestException,
  Body,
  Controller,
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
      'bdt',
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
  async executeBkashPayment(@Body() dto: ExecuteBkashPaymentDto) {
    const execution = await this.bkashService.executePayment(dto.paymentId);

    if (this.isBkashSuccess(execution)) {
      const paidOrder = await this.ordersService.finalizePaidOrder(dto.orderId, dto.paymentId);

      // Record payment entity
      const existingPayment = await this.paymentRepository.findOne({
        where: { transactionId: dto.paymentId },
      });

      if (existingPayment) {
        existingPayment.status = PaymentStatus.COMPLETED;
        existingPayment.rawPayload = execution;
        await this.paymentRepository.save(existingPayment);
      } else {
        const paymentRecord = this.paymentRepository.create({
          orderId: dto.orderId,
          provider: 'bkash',
          transactionId: dto.paymentId,
          amount: Number(paidOrder.total).toFixed(2),
          currency: 'BDT',
          status: PaymentStatus.COMPLETED,
          rawPayload: execution,
        });
        await this.paymentRepository.save(paymentRecord);
      }

      if (paidOrder.customer?.email) {
        this.emailService
          .sendOrderConfirmation(paidOrder, paidOrder.customer)
          .catch(() => {
            // Keep payment completion resilient; email failures are logged in EmailService.
          });
      }
    }

    return {
      orderId: dto.orderId,
      paymentId: dto.paymentId,
      execution,
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

  private isBkashSuccess(payload: Record<string, unknown>) {
    const statusCode = String(payload.statusCode ?? '');
    const transactionStatus = String(payload.transactionStatus ?? payload.status ?? '');

    if (statusCode === '0000') {
      return true;
    }

    const normalized = transactionStatus.toLowerCase();
    return normalized === 'completed' || normalized === 'success';
  }
}
