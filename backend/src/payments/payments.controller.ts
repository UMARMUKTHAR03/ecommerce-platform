import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CustomerJwtGuard } from '../common/guards/customer-jwt.guard';
import { OrdersService } from '../orders/orders.service';
import { CreateStripeIntentDto } from './dto/create-stripe-intent.dto';
import { StripeService } from './stripe.service';

@Controller('store/payments')
export class PaymentsController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly stripeService: StripeService,
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

  private extractCustomerId(user: Record<string, unknown> | undefined): string {
    const customerId = (user?.sub as string | undefined) ?? (user?.id as string | undefined);

    if (!customerId) {
      throw new BadRequestException('Authenticated customer id is missing from token payload');
    }

    return customerId;
  }
}

