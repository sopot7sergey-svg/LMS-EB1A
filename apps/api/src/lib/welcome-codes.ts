import crypto from 'crypto';

export interface WelcomeCode {
  code: string;
  isTest: boolean;
}

/** Generate 205 welcome access codes: 200 production + 5 TEST (deterministic). */
export function generateWelcomeCodes(): WelcomeCode[] {
  const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const codes: WelcomeCode[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < 200; i++) {
    let code: string;
    let attempts = 0;
    do {
      const hash = crypto.createHash('sha256').update(`welcome-seed-2025-${i}-${attempts}`).digest('hex');
      code = 'WELCOME-';
      for (let j = 0; j < 6; j++) {
        code += ALPHABET[parseInt(hash.slice(j * 2, j * 2 + 2), 16) % ALPHABET.length];
      }
      attempts++;
    } while (seen.has(code));
    seen.add(code);
    codes.push({ code, isTest: false });
  }

  const testCodes = ['TEST-WELCOME-001', 'TEST-WELCOME-002', 'TEST-WELCOME-003', 'TEST-WELCOME-004', 'TEST-WELCOME-005'];
  for (const code of testCodes) {
    codes.push({ code, isTest: true });
  }

  return codes;
}
