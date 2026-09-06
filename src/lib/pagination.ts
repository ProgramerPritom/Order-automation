/**
 * Keyset / Cursor-Based Pagination Utility
 * 
 * Provides efficient cursor encoding/decoding for PostgreSQL tables
 * without OFFSET performance degradation or concurrency duplicates.
 */

export interface CursorPayload {
  id: string;
  createdAt: string; // ISO timestamp
}

export interface PaginationParams {
  cursor?: string | null;
  limit: number;
}

export interface PaginationResult<T> {
  items: T[];
  pagination: {
    nextCursor: string | null;
    prevCursor: string | null;
    hasMore: boolean;
    limit: number;
    totalCount?: number;
  };
}

/**
 * Encode cursor object into an opaque Base64 URL-safe string
 */
export function encodeCursor(payload: CursorPayload): string {
  const json = JSON.stringify({ i: payload.id, t: payload.createdAt });
  return Buffer.from(json).toString('base64url');
}

/**
 * Decode opaque Base64 cursor back into object
 */
export function decodeCursor(cursorStr?: string | null): CursorPayload | null {
  if (!cursorStr || cursorStr.trim() === '') return null;
  try {
    const raw = Buffer.from(cursorStr, 'base64url').toString('utf-8');
    const parsed = JSON.parse(raw);
    if (parsed.i && parsed.t) {
      return { id: parsed.i, createdAt: parsed.t };
    }
  } catch (err) {
    // If not base64, check if direct ISO timestamp or ID
    return null;
  }
  return null;
}

/**
 * Extract cursor pagination parameters from NextRequest URL
 */
export function parsePaginationParams(
  url: string,
  defaultLimit: number = 15,
  maxLimit: number = 50
): PaginationParams {
  const { searchParams } = new URL(url);
  const cursor = searchParams.get('cursor');
  let limit = parseInt(searchParams.get('limit') || String(defaultLimit), 10);
  if (isNaN(limit) || limit < 1) limit = defaultLimit;
  if (limit > maxLimit) limit = maxLimit;

  return { cursor, limit };
}
