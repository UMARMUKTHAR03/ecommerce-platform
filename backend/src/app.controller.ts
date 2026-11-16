import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly dataSource: DataSource,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  async getHealth(): Promise<{ status: 'ok'; db: 'connected'; timestamp: Date }> {
    try {
      await this.dataSource.query('SELECT 1');

      return {
        status: 'ok',
        db: 'connected',
        timestamp: new Date(),
      };
    } catch (err) {
      throw new HttpException(
        {
          status: 'error',
          db: 'disconnected',
          message: 'Database connectivity probe failed',
          timestamp: new Date(),
        },
        HttpStatus.SERVICE_UNAVAILABLE, // HTTP 503
      );
    }
  }
}
