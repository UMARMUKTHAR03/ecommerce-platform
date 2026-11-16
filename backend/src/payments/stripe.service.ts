import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import Stripe from 'stripe';
import { Payment, PaymentStatus } from '../entities/payment.entity';
import { Order, OrderStatus } from '../entities/order.entity';
import { EmailService } from '../email/email.service';
import { OrdersService } from '../orders/orders.service';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly stripe: Stripe;

  constructor(
    private readonly configService: ConfigService,
    private readonly ordersService: OrdersService,
    private readonly emailService: EmailService,
    private readonly dataSource: DataSource,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
  ) {
    const secretKey =
      this.configService.get<string>('STRIPE_SECRET_KEY') ?? 'sk_test_placeholder';

    this.stripe = new Stripe(secretKey);
  }

  async createPaymentIntent(
    amountInCents: number,
    currency: string,
    orderId: string,
    customerEmail: string,
  ) {
    return this.stripe.paymentIntents.create({
      amount: amountInCents,
      currency: currency.toLowerCase(),
      receipt_email: customerEmail,
      metadata: {
        orderId,
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });
  }

  async handleWebhook(rawBody: Buffer | string, signature: string) {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      this.logger.warn('STRIPE_WEBHOOK_SECRET is not configured. Webhook ignored.');
      return { received: false, reason: 'unconfigured_secret' };
    }

    const bodyBuffer =
      typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf-8') : rawBody;

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        bodyBuffer,
        signature,
        webhookSecret,
      );
    } catch (err) {
      this.logger.error(`Stripe signature verification failed: ${(err as Error).message}`);
      throw new BadRequestException(`Webhook signature verification failed: ${(err as Error).message}`);
    }

    this.logger.log(`Stripe webhook verified: ${event.type} (${event.id})`);

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const orderId = paymentIntent.metadata?.orderId;

      if (!orderId) {
        this.logger.warn(`Stripe event ${event.id} missing orderId in metadata`);
        return { received: true, ignored: 'missing_order_id' };
      }

      // Check payment intent amount vs order total in DB
      const expectedOrder = await this.dataSource.getRepository(Order).findOne({
        where: { id: orderId },
        relations: { customer: true },
      });

      if (!expectedOrder) {
        this.logger.error(`Order ${orderId} referenced in PaymentIntent not found`);
        throw new BadRequestException(`Order ${orderId} not found`);
      }

      const expectedAmountInCents = Math.round(Number(expectedOrder.total) * 100);
      if (paymentIntent.amount !== expectedAmountInCents) {
        this.logger.error(
          `Payment amount mismatch for order ${orderId}: expected ${expectedAmountInCents} cents, got ${paymentIntent.amount} cents`,
        );
        throw new BadRequestException('Payment amount mismatch between intent and order');
      }

      // Perform atomic idempotent payment registration inside transaction with row lock
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        const paymentRepo = queryRunner.manager.getRepository(Payment);
        const existingPayment = await paymentRepo.findOne({
          where: { transactionId: paymentIntent.id },
        });

        if (existingPayment && existingPayment.status === PaymentStatus.COMPLETED) {
          this.logger.log(`Payment ${paymentIntent.id} already processed for order ${orderId}`);
          await queryRunner.rollbackTransaction();
          return { received: true, alreadyProcessed: true };
        }

        const paidOrder = await this.ordersService.finalizePaidOrder(orderId, paymentIntent.id);

        if (existingPayment) {
          existingPayment.status = PaymentStatus.COMPLETED;
          existingPayment.rawPayload = event as unknown as Record<string, unknown>;
          await paymentRepo.save(existingPayment);
        } else {
          const paymentRecord = paymentRepo.create({
            orderId,
            provider: 'stripe',
            transactionId: paymentIntent.id,
            amount: (paymentIntent.amount / 100).toFixed(2),
            currency: (paymentIntent.currency || 'bdt').toUpperCase(),
            status: PaymentStatus.COMPLETED,
            rawPayload: event as unknown as Record<string, unknown>,
          });
          await paymentRepo.save(paymentRecord);
        }

        await queryRunner.commitTransaction();

        this.logger.log(`Stripe payment succeeded and recorded for order ${orderId}`);

        if (paidOrder.customer?.email) {
          this.emailService
            .sendOrderConfirmation(paidOrder, paidOrder.customer)
            .catch((error: unknown) => {
              this.logger.warn(
                `Order confirmation email failed for order ${paidOrder.id}`,
                error instanceof Error ? error.stack : undefined,
              );
            });
        }
      } catch (err) {
        await queryRunner.rollbackTransaction();
        throw err;
      } finally {
        await queryRunner.release();
      }
    }

    if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const orderId = paymentIntent.metadata?.orderId;

      if (orderId) {
        await this.ordersService.markAsFailed(orderId);

        const paymentRecord = this.paymentRepository.create({
          orderId,
          provider: 'stripe',
          transactionId: paymentIntent.id,
          amount: (paymentIntent.amount / 100).toFixed(2),
          currency: (paymentIntent.currency || 'bdt').toUpperCase(),
          status: PaymentStatus.FAILED,
          rawPayload: event as unknown as Record<string, unknown>,
        });
        await this.paymentRepository.save(paymentRecord);

        this.logger.warn(`Stripe payment failed recorded for order ${orderId}`);
      }
    }

    return { received: true, eventId: event.id };
  }
}
