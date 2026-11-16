import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerJwtGuard } from '../common/guards/customer-jwt.guard';
import { Payment } from '../entities/payment.entity';
import { OrdersModule } from '../orders/orders.module';
import { BkashService } from './bkash.service';
import { PaymentsController } from './payments.controller';
import { StripeService } from './stripe.service';

@Module({
  imports: [ConfigModule, OrdersModule, TypeOrmModule.forFeature([Payment])],
  controllers: [PaymentsController],
  providers: [StripeService, BkashService, CustomerJwtGuard],
  exports: [StripeService, BkashService],
})
export class PaymentsModule {}
