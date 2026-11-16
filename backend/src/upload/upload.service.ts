import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { sanitizeFilename } from '../common/utils/sanitize';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly bucketName = 'product-images';
  private readonly maxFileSize = 5 * 1024 * 1024;
  private readonly allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
  private readonly supabase: SupabaseClient | null = null;

  constructor(private readonly configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const serviceKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceKey) {
      this.logger.warn(
        'Supabase storage credentials (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY) not configured. File upload service is in disabled mode.',
      );
      this.supabase = null;
    } else {
      try {
        this.supabase = createClient(supabaseUrl, serviceKey, {
          auth: { persistSession: false },
        });
      } catch (err) {
        this.logger.error('Failed to initialize Supabase client:', err);
        this.supabase = null;
      }
    }
  }

  async uploadFile(file: Express.Multer.File, folder: string): Promise<string> {
    if (!this.supabase) {
      throw new BadRequestException(
        'Storage service is not configured. Please supply SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
      );
    }

    this.validateFile(file);

    const fileName = this.buildFileName(file.originalname, file.mimetype);
    const safeFolder = sanitizeFilename(folder) || 'general';
    const path = `products/${safeFolder}/${fileName}`;

    const { error } = await this.supabase.storage
      .from(this.bucketName)
      .upload(path, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) {
      throw new BadRequestException(`File upload failed: ${error.message}`);
    }

    const { data } = this.supabase.storage.from(this.bucketName).getPublicUrl(path);

    return data.publicUrl;
  }

  async deleteFile(filePath: string) {
    if (!this.supabase) {
      return { success: false, reason: 'storage_unconfigured' };
    }

    const cleanedPath = filePath.replace(/^https?:\/\/[^/]+\/storage\/v1\/object\/public\/product-images\//, '');

    const { error } = await this.supabase.storage.from(this.bucketName).remove([cleanedPath]);

    if (error) {
      throw new BadRequestException(`File delete failed: ${error.message}`);
    }

    return { success: true };
  }

  private validateFile(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    if (file.size > this.maxFileSize) {
      throw new BadRequestException('File exceeds max size limit of 5MB');
    }

    if (!this.allowedMimeTypes.has(file.mimetype)) {
      throw new BadRequestException('File type not allowed. Allowed types: JPEG, PNG, WEBP');
    }
  }

  private buildFileName(originalName: string, mimeType: string): string {
    const ext = this.resolveExtension(originalName, mimeType);
    return `${Date.now()}-${randomUUID()}${ext}`;
  }

  private resolveExtension(originalName: string, mimeType: string): string {
    const lastDotIndex = originalName.lastIndexOf('.');
    if (lastDotIndex !== -1) {
      return originalName.slice(lastDotIndex).toLowerCase();
    }

    if (mimeType === 'image/jpeg') return '.jpg';
    if (mimeType === 'image/png') return '.png';
    if (mimeType === 'image/webp') return '.webp';
    return '';
  }
}
