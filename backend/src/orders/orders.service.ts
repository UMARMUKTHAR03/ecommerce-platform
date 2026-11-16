import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Address } from '../entities/address.entity';
import { Coupon, CouponType } from '../entities/coupon.entity';
import { Order, OrderStatus, ShippingAddressSnapshot } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { Product } from '../entities/product.entity';
import { ProductVariant } from '../entities/product-variant.entity';
import { EmailService } from '../email/email.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ProductVariant)
    private readonly productVariantRepository: Repository<ProductVariant>,
    @InjectRepository(Coupon)
    private readonly couponRepository: Repository<Coupon>,
    @InjectRepository(Address)
    private readonly addressRepository: Repository<Address>,
    private readonly emailService: EmailService,
  ) {}

  async createOrder(customerId: string, dto: CreateOrderDto) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Order must include at least one item');
    }

    // Determine shipping snapshot
    let shippingSnapshot: ShippingAddressSnapshot;
    if (dto.shippingAddress && dto.shippingAddress.fullName && dto.shippingAddress.streetAddress) {
      shippingSnapshot = {
        fullName: dto.shippingAddress.fullName,
        phone: dto.shippingAddress.phone,
        streetAddress: dto.shippingAddress.streetAddress,
        city: dto.shippingAddress.city,
        postalCode: dto.shippingAddress.postalCode,
        country: dto.shippingAddress.country || 'Bangladesh',
      };
    } else if (dto.addressId) {
      const savedAddress = await this.addressRepository.findOne({
        where: { id: dto.addressId, customerId },
      });
      if (savedAddress) {
        shippingSnapshot = {
          fullName: savedAddress.fullName,
          phone: savedAddress.phone,
          streetAddress: savedAddress.streetAddress,
          city: savedAddress.city,
          postalCode: savedAddress.postalCode ?? undefined,
          country: savedAddress.country,
        };
      } else {
        // Fallback for custom formatted address string from UI
        shippingSnapshot = {
          fullName: 'Customer',
          phone: '',
          streetAddress: dto.addressId,
          city: 'Dhaka',
          country: 'Bangladesh',
        };
      }
    } else {
      shippingSnapshot = {
        fullName: 'Customer',
        phone: '',
        streetAddress: 'Default Address',
        city: 'Dhaka',
        country: 'Bangladesh',
      };
    }

    const deliveryMethod = dto.deliveryMethod === 'express' ? 'express' : 'standard';
    const shippingFee = deliveryMethod === 'express' ? 220 : 120;

    // Run inside database transaction with row locks for atomic stock verification
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let subtotal = 0;
      const orderItemsToSave: Array<{
        productId: string;
        variantId: string | null;
        quantity: number;
        price: string;
      }> = [];

      for (const item of dto.items) {
        // Pessimistic write lock on product to prevent overselling
        const product = await queryRunner.manager
          .createQueryBuilder(Product, 'p')
          .setLock('pessimistic_write')
          .where('p.id = :id AND p.is_active = true', { id: item.productId })
          .getOne();

        if (!product) {
          throw new BadRequestException(`Product ${item.productId} was not found or is inactive`);
        }

        let unitPrice = Number(product.discountPrice ?? product.price);

        if (item.variantId) {
          const variant = await queryRunner.manager
            .createQueryBuilder(ProductVariant, 'v')
            .setLock('pessimistic_write')
            .where('v.id = :vId AND v.product_id = :pId', {
              vId: item.variantId,
              pId: product.id,
            })
            .getOne();

          if (!variant) {
            throw new BadRequestException(`Variant ${item.variantId} not found for product ${product.title}`);
          }

          if (variant.stock < item.quantity) {
            throw new BadRequestException(`Insufficient stock for variant ${variant.sku || variant.title}`);
          }

          unitPrice += Number(variant.priceAdjustment || 0);
          variant.stock -= item.quantity;
          await queryRunner.manager.save(variant);
        } else {
          if (product.stock < item.quantity) {
            throw new BadRequestException(`Insufficient stock for product: ${product.title}`);
          }
        }

        // Decrement overall product stock
        product.stock -= item.quantity;
        await queryRunner.manager.save(product);

        subtotal += unitPrice * item.quantity;

        orderItemsToSave.push({
          productId: product.id,
          variantId: item.variantId ?? null,
          quantity: item.quantity,
          price: unitPrice.toFixed(2),
        });
      }

      // Coupon calculation
      const { coupon, discountAmount } = await this.calculateDiscount(
        dto.couponCode,
        subtotal,
        queryRunner.manager.getRepository(Coupon),
      );

      const total = Math.max(subtotal - discountAmount + shippingFee, 0);

      const order = queryRunner.manager.create(Order, {
        customerId,
        status: OrderStatus.PENDING,
        subtotal: subtotal.toFixed(2),
        shippingFee: shippingFee.toFixed(2),
        discountAmount: discountAmount.toFixed(2),
        total: total.toFixed(2),
        deliveryMethod,
        shippingAddress: shippingSnapshot,
        paymentMethod: dto.paymentMethod,
        paymentReference: null,
      });

      const savedOrder = await queryRunner.manager.save(order);

      const orderItems = orderItemsToSave.map((oi) =>
        queryRunner.manager.create(OrderItem, {
          ...oi,
          orderId: savedOrder.id,
        }),
      );
      await queryRunner.manager.save(orderItems);

      if (coupon) {
        coupon.usedCount += 1;
        await queryRunner.manager.save(coupon);
      }

      await queryRunner.commitTransaction();

      const createdOrder = await this.orderRepository.findOne({
        where: { id: savedOrder.id },
        relations: {
          items: {
            product: true,
            variant: true,
          },
        },
      });

      if (!createdOrder) {
        throw new NotFoundException('Created order could not be loaded');
      }

      return createdOrder;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async getMyOrders(customerId: string, page = 1, limit = 20) {
    const [items, total] = await this.orderRepository.findAndCount({
      where: { customerId },
      relations: {
        items: {
          product: true,
          variant: true,
        },
      },
      order: {
        createdAt: 'DESC',
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getOrderByIdForCustomer(orderId: string, customerId: string) {
    const order = await this.orderRepository.findOne({
      where: {
        id: orderId,
        customerId,
      },
      relations: {
        customer: true,
        items: {
          product: true,
          variant: true,
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async getOrderForPayment(orderId: string, customerId: string) {
    const order = await this.orderRepository.findOne({
      where: {
        id: orderId,
        customerId,
      },
      relations: {
        customer: true,
        items: {
          product: true,
          variant: true,
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async getAllOrders(status?: OrderStatus, page = 1, limit = 20) {
    const qb = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.customer', 'customer')
      .leftJoinAndSelect('order.items', 'item')
      .leftJoinAndSelect('item.product', 'product')
      .leftJoinAndSelect('item.variant', 'variant')
      .orderBy('order.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (status) {
      qb.andWhere('order.status = :status', { status });
    }

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getOrderByIdForAdmin(orderId: string) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: {
        customer: true,
        items: {
          product: true,
          variant: true,
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async updateOrderStatus(orderId: string, dto: UpdateOrderStatusDto) {
    const order = await this.orderRepository.findOneBy({ id: orderId });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const previousStatus = order.status;

    // Handle cancellation: restore inventory if cancelled
    if (dto.status === OrderStatus.CANCELLED && previousStatus !== OrderStatus.CANCELLED) {
      await this.restoreOrderInventory(order.id);
    }

    order.status = dto.status;
    const saved = await this.orderRepository.save(order);
    this.logger.log(`Order status updated: ${saved.id} ${previousStatus} -> ${saved.status}`);

    if (
      previousStatus !== saved.status &&
      (saved.status === OrderStatus.SHIPPED || saved.status === OrderStatus.DELIVERED)
    ) {
      const fullOrder = await this.orderRepository.findOne({
        where: { id: saved.id },
        relations: { customer: true },
      });

      if (fullOrder?.customer?.email) {
        this.emailService
          .sendShippingUpdate(
            fullOrder,
            fullOrder.customer,
            fullOrder.status,
            'https://track.redx.com.bd',
          )
          .catch((error: unknown) => {
            this.logger.warn(
              `Shipping update email failed for order ${fullOrder.id}`,
              error instanceof Error ? error.stack : undefined,
            );
          });
      }
    }

    return saved;
  }

  async markAsPaid(orderId: string, paymentReference?: string) {
    return this.finalizePaidOrder(orderId, paymentReference ?? null);
  }

  async markAsFailed(orderId: string) {
    const order = await this.orderRepository.findOneBy({ id: orderId });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== OrderStatus.CANCELLED) {
      await this.restoreOrderInventory(order.id);
      order.status = OrderStatus.CANCELLED;
      this.logger.warn(`Order marked as failed/cancelled: ${order.id}`);
      return this.orderRepository.save(order);
    }

    return order;
  }

  async finalizePaidOrder(orderId: string, paymentReference: string | null) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: {
        customer: true,
        items: {
          product: true,
          variant: true,
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status === OrderStatus.PAID) {
      if (paymentReference && !order.paymentReference) {
        order.paymentReference = paymentReference;
        await this.orderRepository.save(order);
      }

      return order;
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Cancelled orders cannot be marked as paid');
    }

    order.status = OrderStatus.PAID;
    order.paymentReference = paymentReference;
    this.logger.log(`Order finalized as paid: ${order.id}`);

    return this.orderRepository.save(order);
  }

  private async restoreOrderInventory(orderId: string) {
    const items = await this.orderItemRepository.find({
      where: { orderId },
      relations: { product: true, variant: true },
    });

    for (const item of items) {
      if (item.product) {
        item.product.stock += item.quantity;
        await this.productRepository.save(item.product);
      }
      if (item.variant) {
        item.variant.stock += item.quantity;
        await this.productVariantRepository.save(item.variant);
      }
    }
    this.logger.log(`Inventory restored for cancelled order: ${orderId}`);
  }

  private async calculateDiscount(
    couponCode: string | undefined,
    subtotal: number,
    customRepo?: Repository<Coupon>,
  ) {
    if (!couponCode) {
      return {
        coupon: null,
        discountAmount: 0,
      };
    }

    const repo = customRepo ?? this.couponRepository;
    const coupon = await repo.findOne({
      where: {
        code: couponCode,
        isActive: true,
      },
    });

    if (!coupon) {
      throw new BadRequestException('Invalid coupon code');
    }

    if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Coupon has expired');
    }

    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      throw new BadRequestException('Coupon usage limit reached');
    }

    if (coupon.minSpend !== null && subtotal < Number(coupon.minSpend)) {
      throw new BadRequestException(`Minimum spend of ${coupon.minSpend} required for this coupon`);
    }

    const rawDiscount =
      coupon.type === CouponType.PERCENTAGE
        ? (subtotal * Number(coupon.value)) / 100
        : Number(coupon.value);

    return {
      coupon,
      discountAmount: Math.min(rawDiscount, subtotal),
    };
  }
}
