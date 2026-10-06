import { describe, expect, it } from "vitest";
import {
  base32Decode,
  base32Encode,
  generateRecoveryCodes,
  generateSecret,
  hashRecoveryCode,
  hotp,
  otpauthUrl,
  stepAt,
  verifyRecoveryCode,
  verifyTotp,
} from "@/server/auth/totp";

const SECRET = base32Encode(Buffer.from("12345678901234567890"));

describe("totp", () => {
  it("matches RFC 6238 SHA1 vectors", () => {
    const vectors: [number, string][] = [
      [59, "94287082"],
      [1111111109, "07081804"],
      [1111111111, "14050471"],
      [1234567890, "89005924"],
      [2000000000, "69279037"],
      [20000000000, "65353130"],
    ];
    for (const [t, code] of vectors) expect(hotp(SECRET, Math.floor(t / 30), 8)).toBe(code);
  });

  it("base32 roundtrips", () => {
    const b = Buffer.from("hello world!!");
    expect(base32Decode(base32Encode(b)).equals(b)).toBe(true);
    expect(generateSecret()).toMatch(/^[A-Z2-7]{32}$/);
  });

  it("accepts the current step and one either side, returning the step", () => {
    const t = 1_700_000_000_000;
    const cur = stepAt(t);
    expect(verifyTotp(SECRET, hotp(SECRET, cur), t)).toBe(cur);
    expect(verifyTotp(SECRET, hotp(SECRET, cur - 1), t)).toBe(cur - 1);
    expect(verifyTotp(SECRET, hotp(SECRET, cur + 1), t)).toBe(cur + 1);
    expect(verifyTotp(SECRET, hotp(SECRET, cur - 2), t)).toBeNull();
    expect(verifyTotp(SECRET, hotp(SECRET, cur + 2), t)).toBeNull();
    expect(verifyTotp(SECRET, "abc123", t)).toBeNull();
  });

  it("builds an otpauth url", () => {
    const u = otpauthUrl("ABC", "a@b.com", "Acme Law");
    expect(u).toContain("otpauth://totp/Acme%20Law:a%40b.com?");
    expect(u).toContain("secret=ABC");
  });

  it("recovery codes hash and verify", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    const h = hashRecoveryCode(codes[0]);
    expect(h).not.toContain(codes[0]);
    expect(verifyRecoveryCode(codes[0].toUpperCase(), h)).toBe(true);
    expect(verifyRecoveryCode(codes[1], h)).toBe(false);
  });
});
