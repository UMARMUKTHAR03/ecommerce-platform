import { generateSecret, generateURI, generateHOTP, verify } from './totp';

describe('TOTP RFC 6238 implementation', () => {
  it('generates a base32 encoded secret of sufficient length', () => {
    const secret = generateSecret(20);
    expect(typeof secret).toBe('string');
    expect(secret.length).toBeGreaterThanOrEqual(20);
    expect(/^[A-Z2-7]+$/.test(secret)).toBe(true);
  });

  it('generates a valid otpauth URI for authenticator apps', () => {
    const uri = generateURI({
      issuer: 'BazaarFlow LUXE',
      label: 'admin@bazaarflow.com',
      secret: 'JBSWY3DPEHPK3PXP',
    });

    expect(uri).toContain('otpauth://totp/');
    expect(uri).toContain('secret=JBSWY3DPEHPK3PXP');
    expect(uri).toContain('digits=6');
    expect(uri).toContain('period=30');
  });

  it('generates expected RFC 4226 HOTP test vector codes for ASCII "12345678901234567890"', () => {
    // Secret in base32 for "12345678901234567890" is "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
    const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
    // RFC 4226 Appendix D vectors
    expect(generateHOTP(secret, 0)).toBe('755224');
    expect(generateHOTP(secret, 1)).toBe('287082');
    expect(generateHOTP(secret, 2)).toBe('359152');
    expect(generateHOTP(secret, 3)).toBe('969429');
    expect(generateHOTP(secret, 4)).toBe('338314');
  });

  it('verifies valid TOTP tokens within window and rejects invalid tokens', async () => {
    const secret = generateSecret(20);
    const currentEpoch = Math.floor(Date.now() / 1000);
    const currentStep = Math.floor(currentEpoch / 30);
    const validToken = generateHOTP(secret, currentStep);

    const validResult = await verify({ token: validToken, secret });
    expect(validResult.valid).toBe(true);

    const invalidResult = await verify({ token: '000000', secret: 'JBSWY3DPEHPK3PXP' });
    expect(invalidResult.valid).toBe(false);

    const emptyResult = await verify({ token: '', secret });
    expect(emptyResult.valid).toBe(false);
  });
});
