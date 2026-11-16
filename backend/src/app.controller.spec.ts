import { HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;
  let mockDataSource: { query: jest.Mock };

  beforeEach(async () => {
    mockDataSource = {
      query: jest.fn().mockResolvedValue([1]),
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('health', () => {
    it('should return connected status payload when DB is available', async () => {
      const result = await appController.getHealth();

      expect(result).toMatchObject({
        status: 'ok',
        db: 'connected',
      });
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should throw HttpException 503 SERVICE_UNAVAILABLE when DB query fails', async () => {
      mockDataSource.query.mockRejectedValueOnce(new Error('Connection terminated'));

      await expect(appController.getHealth()).rejects.toThrow(HttpException);
      try {
        await appController.getHealth();
      } catch (err: any) {
        expect(err.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      }
    });
  });
});
