/**
 * Second-factor storage in Postgres (table user_mfa). The TOTP secret is stored
 * encrypted with MFA_ENCRYPTION_KEY; only the service role can touch the table.
 * Used sign-in link ids live in used_login_links so links stay single-use across instances.
 */
import { decryptSecret, encryptSecret, type MfaRecord, type MfaStore } from "@/server/auth/identity";
import type { Pool } from "pg";
import { getPool, inTx } from "@/server/pg";

export class PgMfaStore implements MfaStore {
  constructor(private readonly pool?: Pool) {}

  async get(userId: string): Promise<MfaRecord | null> {
    return inTx(this.pool ?? getPool(), "service", async (c) => {
      const r = await c.query(
        "SELECT totp_secret_enc, last_used_step, recovery_code_hashes, enrolled_at FROM user_mfa WHERE user_id = $1",
        [userId],
      );
      const row = r.rows[0];
      if (!row) return null;
      return {
        totpSecret: decryptSecret(row.totp_secret_enc),
        lastUsedStep: Number(row.last_used_step),
        recoveryCodeHashes: row.recovery_code_hashes ?? [],
        enrolledAt: row.enrolled_at ? new Date(row.enrolled_at).toISOString() : null,
      };
    });
  }

  async put(userId: string, record: MfaRecord): Promise<void> {
    await inTx(this.pool ?? getPool(), "service", (c) =>
      c.query(
        `INSERT INTO user_mfa (user_id, totp_secret_enc, last_used_step, recovery_code_hashes, enrolled_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id) DO UPDATE SET totp_secret_enc = EXCLUDED.totp_secret_enc,
           last_used_step = EXCLUDED.last_used_step, recovery_code_hashes = EXCLUDED.recovery_code_hashes,
           enrolled_at = EXCLUDED.enrolled_at`,
        [userId, encryptSecret(record.totpSecret), record.lastUsedStep, record.recoveryCodeHashes, record.enrolledAt],
      ),
    );
  }
}
