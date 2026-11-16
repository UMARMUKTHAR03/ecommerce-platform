import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import Stripe from 'stripe';
import { Payment, PaymentStatus } from '../entities/payment.entity';
import { Order, OrderStatus } from '../entities/order.entity';
import { Product } from '../entities/product.entity';
import { ProductVariant } from '../entities/product-variant.entity';
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

      // Check currency
      const intentCurrency = (paymentIntent.currency || '').toLowerCase();
      if (intentCurrency !== 'bdt') {
        this.logger.error(`Stripe currency mismatch for order ${orderId}: expected bdt, got ${intentCurrency}`);
        throw new BadRequestException(`Stripe currency mismatch: expected bdt, got ${intentCurrency}`);
      }

      // Atomic payment finalization inside a single database transaction
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        const orderRepo = queryRunner.manager.getRepository(Order);
        const paymentRepo = queryRunner.manager.getRepository(Payment);

        // Lock order row to prevent race conditions
        const order = await orderRepo
          .createQueryBuilder('o')
          .setLock('pessimistic_write')
          .leftJoinAndSelect('o.customer', 'customer')
          .leftJoinAndSelect('o.items', 'items')
          .where('o.id = :id', { id: orderId })
          .getOne();

        if (!order) {
          throw new BadRequestException(`Order ${orderId} not found`);
        }

        const expectedAmountInCents = Math.round(Number(order.total) * 100);
        if (paymentIntent.amount !== expectedAmountInCents) {
          throw new BadRequestException(
            `Payment amount mismatch: expected ${expectedAmountInCents} cents, received ${paymentIntent.amount} cents`,
          );
        }

        // Check if payment already completed
        const existingPayment = await paymentRepo.findOne({
          where: { transactionId: paymentIntent.id },
        });

        if (existingPayment && existingPayment.status === PaymentStatus.COMPLETED) {
          this.logger.log(`Payment ${paymentIntent.id} already completed for order ${orderId}`);
          await queryRunner.rollbackTransaction();
          return { received: true, alreadyProcessed: true };
        }

        // Update Order in same transaction
        order.status = OrderStatus.PAID;
        order.paymentReference = paymentIntent.id;
        await orderRepo.save(order);

        // Insert or update payment record
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
            currency: 'BDT',
            status: PaymentStatus.COMPLETED,
            rawPayload: event as unknown as Record<string, unknown>,
          });
          await paymentRepo.save(paymentRecord);
        }

        await queryRunner.commitTransaction();
        this.logger.log(`Stripe payment succeeded and committed for order ${orderId}`);

        if (order.customer?.email) {
          this.emailService
            .sendOrderConfirmation(order, order.customer)
            .catch((error: unknown) => {
              this.logger.warn(`Order confirmation email failed for order ${order.id}`, error);
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
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
          const orderRepo = queryRunner.manager.getRepository(Order);
          const paymentRepo = queryRunner.manager.getRepository(Payment);

          const order = await orderRepo.findOne({
            where: { id: orderId },
            relations: { items: { product: true, variant: true } },
          });

          if (order && order.status !== OrderStatus.CANCELLED) {
            order.status = OrderStatus.CANCELLED;
            await orderRepo.save(order);

            // Restore stock in same transaction
            const prodRepo = queryRunner.manager.getRepository(Product);
            const varRepo = queryRunner.manager.getRepository(ProductVariant);

            for (const item of order.items) {
              if (item.product) {
                item.product.stock += item.quantity;
                await prodRepo.save(item.product);
              }
              if (item.variant) {
                item.variant.stock += item.quantity;
                await varRepo.save(item.variant);
              }
            }
          }

          // Check if payment with transaction_id already recorded (e.g. previous failure)
          const existingPayment = await paymentRepo.findOne({
            where: { transactionId: paymentIntent.id },
          });

          if (existingPayment) {
            existingPayment.status = PaymentStatus.FAILED;
            existingPayment.rawPayload = event as unknown as Record<string, unknown>;
            await paymentRepo.save(existingPayment);
          } else {
            const paymentRecord = paymentRepo.create({
              orderId,
              provider: 'stripe',
              transactionId: paymentIntent.id,
              amount: (paymentIntent.amount / 100).toFixed(2),
              currency: (paymentIntent.currency || 'bdt').toUpperCase(),
              status: PaymentStatus.FAILED,
              rawPayload: event as unknown as Record<string, unknown>,
            });
            await paymentRepo.save(paymentRecord);
          }

          await queryRunner.commitTransaction();
          this.logger.warn(`Stripe payment failed transaction committed for order ${orderId}`);
        } catch (err) {
          await queryRunner.rollbackTransaction();
          throw err;
        } finally {
          await queryRunner.release();
        }
      }
    }

    return { received: true, eventId: event.id };
  }
}
