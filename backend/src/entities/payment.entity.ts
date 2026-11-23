import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Order } from './order.entity';

export enum PaymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

@Entity({ name: 'payments' })
@Index('idx_payments_transaction_unique', ['transactionId'], {
  unique: true,
  where: '"transaction_id" IS NOT NULL',
})
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_payments_order_id')
  @Column({ name: 'order_id', type: 'uuid' })
  orderId!: string;

  @ManyToOne(() => Order, (order) => order.payments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'order_id' })
  order!: Order;

  @Column({ type: 'varchar', length: 50 })
  provider!: string; // 'stripe' | 'bkash' | 'cod'

  @Index('idx_payments_transaction_id')
  @Column({ name: 'transaction_id', type: 'varchar', length: 255, nullable: true })
  transactionId!: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: string;

  @Column({ type: 'varchar', length: 10, default: 'INR' })
  currency!: string;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status!: PaymentStatus;

  @Column({ name: 'raw_payload', type: 'jsonb', nullable: true })
  rawPayload!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
