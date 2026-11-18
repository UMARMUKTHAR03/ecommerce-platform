import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CouponsService } from './coupons.service';
import { Coupon, CouponType } from '../entities/coupon.entity';

describe('CouponsService', () => {
  let service: CouponsService;

  const mockCouponRepository = {
    findOne: jest.fn(),
    create: jest.fn((dto) => dto),
    save: jest.fn((entity) => Promise.resolve({ id: 'coupon-1', ...entity })),
    update: jest.fn(),
    delete: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouponsService,
        {
          provide: getRepositoryToken(Coupon),
          useValue: mockCouponRepository,
        },
      ],
    }).compile();

    service = module.get<CouponsService>(CouponsService);
  });

  describe('validateCoupon', () => {
    it('should validate percentage coupon and return correct discount', async () => {
      mockCouponRepository.findOne.mockResolvedValue({
        id: 'c1',
        code: 'LUXE10',
        type: CouponType.PERCENTAGE,
        value: '10.00',
        minSpend: null,
        usageLimit: 100,
        usedCount: 5,
        isActive: true,
        expiresAt: new Date(Date.now() + 86400000),
      });

      const result = await service.validateCoupon({
        code: 'luxe10 ',
        orderAmount: 2000,
      });

      expect(result.valid).toBe(true);
      expect(result.discountAmount).toBe(200);
      expect(result.code).toBe('LUXE10');
      expect(result.type).toBe(CouponType.PERCENTAGE);
    });

    it('should validate fixed amount coupon and cap at order amount', async () => {
      mockCouponRepository.findOne.mockResolvedValue({
        id: 'c2',
        code: 'FLAT500',
        type: CouponType.FIXED,
        value: '500.00',
        minSpend: null,
        usageLimit: null,
        usedCount: 0,
        isActive: true,
        expiresAt: null,
      });

      const result = await service.validateCoupon({
        code: 'FLAT500',
        orderAmount: 300,
      });

      expect(result.valid).toBe(true);
      expect(result.discountAmount).toBe(300); // capped at orderAmount
    });

    it('should throw BadRequestException if minimum spend is not met', async () => {
      mockCouponRepository.findOne.mockResolvedValue({
        id: 'c3',
        code: 'VIP100',
        type: CouponType.FIXED,
        value: '100.00',
        minSpend: '500.00',
        usageLimit: null,
        usedCount: 0,
        isActive: true,
        expiresAt: null,
      });

      await expect(
        service.validateCoupon({
          code: 'VIP100',
          orderAmount: 400,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if coupon is expired', async () => {
      mockCouponRepository.findOne.mockResolvedValue({
        id: 'c4',
        code: 'EXPIRED',
        type: CouponType.PERCENTAGE,
        value: '20.00',
        minSpend: null,
        usageLimit: null,
        usedCount: 0,
        isActive: true,
        expiresAt: new Date(Date.now() - 10000),
      });

      await expect(
        service.validateCoupon({
          code: 'EXPIRED',
          orderAmount: 1000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if usage limit is reached', async () => {
      mockCouponRepository.findOne.mockResolvedValue({
        id: 'c5',
        code: 'MAXED',
        type: CouponType.FIXED,
        value: '50.00',
        minSpend: null,
        usageLimit: 10,
        usedCount: 10,
        isActive: true,
        expiresAt: null,
      });

      await expect(
        service.validateCoupon({
          code: 'MAXED',
          orderAmount: 500,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if coupon does not exist or inactive', async () => {
      mockCouponRepository.findOne.mockResolvedValue(null);

      await expect(
        service.validateCoupon({
          code: 'NONEXISTENT',
          orderAmount: 1000,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('createCoupon', () => {
    it('should trim and uppercase coupon code upon creation', async () => {
      await service.createCoupon({
        code: '  welcome20  ',
        type: CouponType.PERCENTAGE,
        value: 20,
        minSpend: 500,
      });

      expect(mockCouponRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'WELCOME20',
          type: CouponType.PERCENTAGE,
          value: '20.00',
          minSpend: '500.00',
        }),
      );
    });
  });
});
