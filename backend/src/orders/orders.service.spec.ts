import { BadRequestException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrderStatus } from '../entities/order.entity';
import { CouponType } from '../entities/coupon.entity';

describe('OrdersService', () => {
  let service: OrdersService;
  let mockDataSource: any;
  let mockOrderRepo: any;
  let mockOrderItemRepo: any;
  let mockProductRepo: any;
  let mockProductVariantRepo: any;
  let mockCouponRepo: any;
  let mockAddressRepo: any;
  let mockEmailService: any;
  let mockQueryRunner: any;

  beforeEach(() => {
    mockQueryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        createQueryBuilder: jest.fn(),
        save: jest.fn(),
        create: jest.fn((entityClass, data) => ({ id: 'mock-id', ...data })),
        getRepository: jest.fn(),
      },
    };

    mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    };

    mockOrderRepo = {
      create: jest.fn((data) => ({ id: 'mock-order-id', ...data })),
      save: jest.fn((data) => Promise.resolve({ id: 'mock-order-id', ...data })),
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      findAndCount: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    mockOrderItemRepo = {
      create: jest.fn((data) => ({ id: 'mock-item-id', ...data })),
      save: jest.fn((data) => Promise.resolve(data)),
      find: jest.fn().mockResolvedValue([]),
    };

    mockProductRepo = {
      save: jest.fn((data) => Promise.resolve(data)),
      findOne: jest.fn(),
      findOneBy: jest.fn(),
    };

    mockProductVariantRepo = {
      save: jest.fn((data) => Promise.resolve(data)),
      findOne: jest.fn(),
      findOneBy: jest.fn(),
    };

    mockCouponRepo = {
      findOne: jest.fn(),
      save: jest.fn((data) => Promise.resolve(data)),
    };

    mockAddressRepo = {
      findOne: jest.fn(),
    };

    mockEmailService = {
      sendOrderConfirmation: jest.fn().mockResolvedValue(undefined),
      sendShippingUpdate: jest.fn().mockResolvedValue(undefined),
    };

    service = new OrdersService(
      mockDataSource,
      mockOrderRepo,
      mockOrderItemRepo,
      mockProductRepo,
      mockProductVariantRepo,
      mockCouponRepo,
      mockAddressRepo,
      mockEmailService,
    );
  });

  describe('createOrder', () => {
    it('throws BadRequestException if items array is empty', async () => {
      await expect(
        service.createOrder('cust-1', {
          items: [],
          paymentMethod: 'stripe',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if product stock is insufficient', async () => {
      const mockQb = {
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          id: 'prod-1',
          title: 'Luxury Watch',
          price: '5000.00',
          stock: 2, // Stock is 2
          isActive: true,
        }),
      };
      mockQueryRunner.manager.createQueryBuilder.mockReturnValue(mockQb);

      await expect(
        service.createOrder('cust-1', {
          items: [{ productId: 'prod-1', quantity: 5 }], // Request 5
          paymentMethod: 'stripe',
        }),
      ).rejects.toThrow('Insufficient stock for product: Luxury Watch');

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('creates order, decrements stock atomically, applies shipping rate, and commits', async () => {
      const mockProduct = {
        id: 'prod-1',
        title: 'Luxury Chronograph',
        price: '10000.00',
        discountPrice: '9000.00',
        stock: 10,
        isActive: true,
      };

      const mockQb = {
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockProduct),
      };
      mockQueryRunner.manager.createQueryBuilder.mockReturnValue(mockQb);
      mockQueryRunner.manager.save.mockImplementation((entity: any) => Promise.resolve(entity));

      mockOrderRepo.findOne.mockResolvedValue({
        id: 'mock-order-uuid',
        customerId: 'cust-1',
        status: OrderStatus.PENDING,
        subtotal: '9000.00',
        shippingFee: '120.00',
        discountAmount: '0.00',
        total: '9120.00',
        items: [{ productId: 'prod-1', quantity: 1, price: '9000.00' }],
      });

      const order = await service.createOrder('cust-1', {
        items: [{ productId: 'prod-1', quantity: 1 }],
        deliveryMethod: 'standard',
        paymentMethod: 'stripe',
        shippingAddress: {
          fullName: 'Umar Mukthar',
          phone: '+8801700000000',
          streetAddress: '128 Gulshan Ave',
          city: 'Mumbai',
        },
      });

      expect(mockProduct.stock).toBe(9); // Decremented
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(order.total).toBe('9120.00');
    });

    it('creates order with valid coupon discount and increments coupon usedCount', async () => {
      const mockProduct = {
        id: 'prod-1',
        title: 'Luxury Chronograph',
        price: '10000.00',
        stock: 5,
        isActive: true,
      };

      const mockCoupon = {
        id: 'coupon-luxe10',
        code: 'LUXE10',
        type: CouponType.PERCENTAGE,
        value: '10.00',
        minSpend: '5000.00',
        usageLimit: 100,
        usedCount: 2,
        isActive: true,
        expiresAt: new Date(Date.now() + 86400000),
      };

      const mockQb = {
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockProduct),
      };
      mockQueryRunner.manager.createQueryBuilder.mockReturnValue(mockQb);
      mockQueryRunner.manager.save.mockImplementation((entity: any) => Promise.resolve(entity));
      mockQueryRunner.manager.getRepository.mockReturnValue({
        findOne: jest.fn().mockResolvedValue(mockCoupon),
        save: jest.fn().mockImplementation((c: any) => Promise.resolve(c)),
      });

      mockOrderRepo.findOne.mockResolvedValue({
        id: 'order-with-coupon',
        customerId: 'cust-1',
        status: OrderStatus.PENDING,
        subtotal: '10000.00',
        shippingFee: '120.00',
        discountAmount: '1000.00',
        total: '9120.00',
        items: [{ productId: 'prod-1', quantity: 1, price: '10000.00' }],
      });

      const order = await service.createOrder('cust-1', {
        items: [{ productId: 'prod-1', quantity: 1 }],
        deliveryMethod: 'standard',
        couponCode: 'luxe10',
        paymentMethod: 'stripe',
      });

      expect(mockCoupon.usedCount).toBe(3);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(order.discountAmount).toBe('1000.00');
    });

    it('throws BadRequestException if coupon is expired', async () => {
      const mockProduct = {
        id: 'prod-1',
        title: 'Luxury Chronograph',
        price: '10000.00',
        stock: 5,
        isActive: true,
      };

      const mockExpiredCoupon = {
        id: 'coupon-exp',
        code: 'EXPIRED10',
        type: CouponType.PERCENTAGE,
        value: '10.00',
        minSpend: null,
        usageLimit: null,
        usedCount: 0,
        isActive: true,
        expiresAt: new Date(Date.now() - 100000),
      };

      const mockQb = {
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockProduct),
      };
      mockQueryRunner.manager.createQueryBuilder.mockReturnValue(mockQb);
      mockQueryRunner.manager.getRepository.mockReturnValue({
        findOne: jest.fn().mockResolvedValue(mockExpiredCoupon),
      });

      await expect(
        service.createOrder('cust-1', {
          items: [{ productId: 'prod-1', quantity: 1 }],
          couponCode: 'EXPIRED10',
          paymentMethod: 'stripe',
        }),
      ).rejects.toThrow('Coupon has expired');

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('updateOrderStatus', () => {
    it('restores stock when order is cancelled', async () => {
      mockOrderRepo.findOneBy.mockResolvedValue({
        id: 'order-123',
        status: OrderStatus.PENDING,
      });
      mockOrderRepo.save.mockImplementation((o: any) => Promise.resolve(o));

      const mockProd = { id: 'p1', stock: 5 };
      mockOrderItemRepo.find.mockResolvedValue([
        {
          orderId: 'order-123',
          quantity: 2,
          product: mockProd,
        },
      ]);

      const result = await service.updateOrderStatus('order-123', {
        status: OrderStatus.CANCELLED,
      });

      expect(result.status).toBe(OrderStatus.CANCELLED);
      expect(mockProd.stock).toBe(7); // Restored from 5 to 7
      expect(mockProductRepo.save).toHaveBeenCalledWith(mockProd);
    });

    it('updates tracking number when provided', async () => {
      mockOrderRepo.findOneBy.mockResolvedValue({
        id: 'order-123',
        status: OrderStatus.PAID,
        trackingNumber: null,
      });
      mockOrderRepo.save.mockImplementation((o: any) => Promise.resolve(o));

      const result = await service.updateOrderStatus('order-123', {
        status: OrderStatus.SHIPPED,
        trackingNumber: 'REDX-TEST-998877',
      });

      expect(result.status).toBe(OrderStatus.SHIPPED);
      expect(result.trackingNumber).toBe('REDX-TEST-998877');
      expect(mockOrderRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: OrderStatus.SHIPPED,
          trackingNumber: 'REDX-TEST-998877',
        }),
      );
    });
  });
});
