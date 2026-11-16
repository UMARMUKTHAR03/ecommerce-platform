import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { generateSecret, generateURI, verify } from 'otplib';
import { Admin, AdminRole } from '../entities/admin.entity';
import { AdminLoginDto } from './dto/admin-login.dto';

@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    @InjectRepository(Admin)
    private readonly adminRepository: Repository<Admin>,
  ) {}

  async login(dto: AdminLoginDto) {
    const email = dto.email.toLowerCase();
    const envAdminEmail = this.configService.get<string>('ADMIN_EMAIL');
    const envAdminPasswordHash = this.configService.get<string>('ADMIN_PASSWORD_HASH');

    // First try database lookup
    let admin = await this.adminRepository.findOne({
      where: { email, isActive: true },
    });

    // If not in database but matches env admin, seed admin record in database
    if (!admin && envAdminEmail && email === envAdminEmail.toLowerCase() && envAdminPasswordHash) {
      admin = this.adminRepository.create({
        email: envAdminEmail.toLowerCase(),
        passwordHash: envAdminPasswordHash,
        name: 'Super Admin',
        role: AdminRole.SUPERADMIN,
        isActive: true,
      });
      await this.adminRepository.save(admin);
    }

    if (!admin) {
      this.logger.warn(`Admin login failed: ${email} not found`);
      throw new UnauthorizedException('Invalid admin credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, admin.passwordHash);
    if (!passwordValid) {
      this.logger.warn(`Admin login failed: invalid password for ${email}`);
      throw new UnauthorizedException('Invalid admin credentials');
    }

    // Two-factor setup check
    if (!admin.totpSecret) {
      const secret = generateSecret();
      admin.totpSecret = secret;
      await this.adminRepository.save(admin);

      const appName = this.configService.get<string>('APP_NAME') ?? 'BazaarFlow LUXE';
      const qrCodeUrl = generateURI({
        issuer: appName,
        label: admin.email,
        secret,
      });

      return {
        requiresTwoFactorSetup: true,
        qrCodeUrl,
      };
    }

    if (!dto.totpCode) {
      this.logger.warn(`Admin login rejected (missing TOTP): ${email}`);
      throw new UnauthorizedException('TOTP code is required');
    }

    const verification = await verify({
      token: dto.totpCode,
      secret: admin.totpSecret,
    });

    if (!verification.valid) {
      this.logger.warn(`Admin login failed (invalid TOTP): ${email}`);
      throw new UnauthorizedException('Invalid TOTP code');
    }

    const accessToken = await this.jwtService.signAsync(
      {
        sub: admin.email,
        id: admin.id,
        role: admin.role,
      },
      {
        secret: this.configService.get<string>('JWT_SECRET') ?? 'dev-jwt-secret',
        expiresIn: 15 * 60,
      },
    );

    return {
      requiresTwoFactorSetup: false,
      accessToken,
    };
  }

  me(user: Record<string, unknown>) {
    return {
      email: (user.sub as string | undefined) ?? null,
      role: (user.role as string | undefined) ?? 'admin',
    };
  }
}
