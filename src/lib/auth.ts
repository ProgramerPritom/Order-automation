import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import crypto from 'crypto';
import { query } from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_saas_default_2026';
const secretKey = new TextEncoder().encode(JWT_SECRET);

export interface TokenPayload {
  userId: string;
  tenantId: string;
  email: string;
  phone?: string;
  role: string;
}

/**
 * Hash plain password with bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
}

/**
 * Compare plain password with stored hash
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate Access Token (30 days persistent login session without unexpected logouts)
 */
export async function createAccessToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secretKey);
}

/**
 * Generate a long-lived Refresh Token (30 days) and save its hash in DB
 */
export async function createRefreshToken(userId: string): Promise<string> {
  const rawToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3);`,
    [userId, tokenHash, expiresAt]
  );

  return rawToken;
}

/**
 * Verify and rotate Refresh Token (Supports looking up user directly from refresh token)
 * Includes a 60-second grace period for recently rotated tokens to prevent race conditions
 * when multiple client requests or tab switches occur simultaneously.
 */
export async function rotateRefreshToken(
  rawToken: string,
  userId?: string
): Promise<{ newRefreshToken: string; userId: string } | null> {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  let res;
  if (userId) {
    res = await query(
      `SELECT id, user_id, expires_at, revoked, revoked_at 
       FROM refresh_tokens 
       WHERE user_id = $1 AND token_hash = $2;`,
      [userId, tokenHash]
    );
  } else {
    res = await query(
      `SELECT id, user_id, expires_at, revoked, revoked_at 
       FROM refresh_tokens 
       WHERE token_hash = $1;`,
      [tokenHash]
    );
  }

  if (res.rows.length === 0) return null;
  const tokenRecord = res.rows[0];

  // If expired, reject
  if (new Date(tokenRecord.expires_at) < new Date()) {
    return null;
  }

  // If already revoked:
  if (tokenRecord.revoked) {
    // Check grace period (60 seconds)
    const revokedTime = tokenRecord.revoked_at ? new Date(tokenRecord.revoked_at).getTime() : 0;
    const now = Date.now();
    if (revokedTime > 0 && now - revokedTime < 60000) {
      // Within grace window! Find the most recent active token for this user
      const latestRes = await query(
        `SELECT token_hash 
         FROM refresh_tokens 
         WHERE user_id = $1 AND revoked = FALSE AND expires_at > NOW() 
         ORDER BY created_at DESC 
         LIMIT 1;`,
        [tokenRecord.user_id]
      );
      if (latestRes.rows.length > 0) {
        // Issue fresh token without failing
        const newRefreshToken = await createRefreshToken(tokenRecord.user_id);
        return { newRefreshToken, userId: tokenRecord.user_id };
      }
    }
    return null;
  }

  // Revoke old token and record timestamp
  await query(
    `UPDATE refresh_tokens SET revoked = TRUE, revoked_at = NOW() WHERE id = $1;`,
    [tokenRecord.id]
  );

  // Issue new refresh token
  const newRefreshToken = await createRefreshToken(tokenRecord.user_id);
  return { newRefreshToken, userId: tokenRecord.user_id };
}

/**
 * Revoke specific refresh token (Logout)
 */
export async function revokeRefreshToken(rawToken: string): Promise<void> {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  await query(`UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = $1;`, [tokenHash]);
}

/**
 * Verify Access Token
 */
export async function verifyAccessToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    return {
      userId: payload.userId as string,
      tenantId: payload.tenantId as string,
      email: payload.email as string,
      phone: payload.phone as string | undefined,
      role: payload.role as string,
    };
  } catch (err) {
    return null;
  }
}
