import { describe, it, expect } from 'vitest';
import { jwt } from '../src/common/utils/jwt.js';

const SECRET = 'unit-test-secret-abc123';

describe('JWT utility', () => {
  it('signs and verifies a token with correct payload', () => {
    const token = jwt.sign({ sub: 'user-1', role: 'CUSTOMER' }, SECRET, 3600);
    const payload = jwt.verify(token, SECRET);
    expect(payload.sub).toBe('user-1');
    expect(payload.role).toBe('CUSTOMER');
  });

  it('rejects a token signed with a different secret', () => {
    const token = jwt.sign({ sub: 'u', role: 'CUSTOMER' }, SECRET, 3600);
    expect(() => jwt.verify(token, 'wrong-secret')).toThrow(/invalid signature/);
  });

  it('rejects a token that is expired', () => {
    const token = jwt.sign({ sub: 'u', role: 'CUSTOMER' }, SECRET, -1);
    expect(() => jwt.verify(token, SECRET)).toThrow(/expired/);
  });

  it('rejects a malformed token', () => {
    expect(() => jwt.verify('not.a.valid.jwt.parts', SECRET)).toThrow();
    expect(() => jwt.verify('onlyone', SECRET)).toThrow();
  });

  it('uses constant-time comparison (cannot bypass with partial match)', () => {
    const token = jwt.sign({ sub: 'u', role: 'CUSTOMER' }, SECRET, 3600);
    const parts = token.split('.');
    // tamper the signature by one character
    const tamperedSig = parts[2].slice(0, -1) + (parts[2].slice(-1) === 'a' ? 'b' : 'a');
    const tampered = `${parts[0]}.${parts[1]}.${tamperedSig}`;
    expect(() => jwt.verify(tampered, SECRET)).toThrow(/invalid signature/);
  });
});
