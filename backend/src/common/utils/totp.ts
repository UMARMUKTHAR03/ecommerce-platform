import * as crypto from 'crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(input: string): Buffer {
  const cleanInput = input.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = '';
  for (let i = 0; i < cleanInput.length; i++) {
    const val = BASE32_ALPHABET.indexOf(cleanInput.charAt(i));
    if (val === -1) {
      continue;
    }
    bits += val.toString(2).padStart(5, '0');
  }

  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substr(i, 8), 2));
  }

  return Buffer.from(bytes);
}

function base32Encode(buffer: Buffer): string {
  let bits = '';
  for (let i = 0; i < buffer.length; i++) {
    bits += buffer[i].toString(2).padStart(8, '0');
  }

  let output = '';
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.substr(i, 5);
    if (chunk.length < 5) {
      const padded = chunk.padEnd(5, '0');
      output += BASE32_ALPHABET[parseInt(padded, 2)];
      break;
    }
    output += BASE32_ALPHABET[parseInt(chunk, 2)];
  }

  return output;
}

export function generateSecret(length = 20): string {
  const randomBytes = crypto.randomBytes(length);
  return base32Encode(randomBytes);
}

export function generateURI(options: { issuer: string; label: string; secret: string }): string {
  const encodedIssuer = encodeURIComponent(options.issuer);
  const encodedLabel = encodeURIComponent(options.label);
  return `otpauth://totp/${encodedIssuer}:${encodedLabel}?secret=${options.secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

export function generateHOTP(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigInt64BE(BigInt(counter));

  const hmac = crypto.createHmac('sha1', key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return otp.toString().padStart(6, '0');
}

export async function verify(options: { token: string; secret: string; window?: number }): Promise<{ valid: boolean }> {
  const { token, secret, window = 1 } = options;
  if (!token || !secret) {
    return { valid: false };
  }

  const currentEpoch = Math.floor(Date.now() / 1000);
  const currentStep = Math.floor(currentEpoch / 30);

  // Check +/- window step
  for (let stepOffset = -window; stepOffset <= window; stepOffset++) {
    const expectedToken = generateHOTP(secret, currentStep + stepOffset);
    if (crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expectedToken))) {
      return { valid: true };
    }
  }

  return { valid: false };
}
