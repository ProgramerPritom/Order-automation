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
 * Generate a short-lived Access Token (15 minutes)
 */
export async function createAccessToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(secretKey);
}

/**
 * Generate a long-lived Refresh Token (7 days) and save its hash in DB
 */
export async function createRefreshToken(userId: string): Promise<string> {
  const rawToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3);`,
    [userId, tokenHash, expiresAt]
  );

  return rawToken;
}

/**
 * Verify and rotate Refresh Token
 */
export async function rotateRefreshToken(userId: string, rawToken: string): Promise<string | null> {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const res = await query(
    `SELECT id, expires_at, revoked 
     FROM refresh_tokens 
     WHERE user_id = $1 AND token_hash = $2;`,
    [userId, tokenHash]
  );

  if (res.rows.length === 0) return null;
  const tokenRecord = res.rows[0];

  if (tokenRecord.revoked || new Date(tokenRecord.expires_at) < new Date()) {
    return null;
  }

  // Revoke old token
  await query(`UPDATE refresh_tokens SET revoked = TRUE WHERE id = $1;`, [tokenRecord.id]);

  // Issue new refresh token
  return createRefreshToken(userId);
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
