/**
 * Real Dense Vector Embeddings Engine powered by Google Gemini (gemini-embedding-001)
 * Zero dummy vectors - authentic 768-dimensional embeddings for pgvector RAG.
 */

import { query } from './db';

const DEFAULT_DIMENSIONS = 768;

/**
 * Generate a dense vector embedding for any text input
 */
export async function generateEmbedding(
  text: string,
  dimensions = DEFAULT_DIMENSIONS
): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set in environment.');
  }

  const cleanText = (text || '').trim();
  if (!cleanText) {
    // Return zero vector if empty string
    return new Array(dimensions).fill(0);
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'models/gemini-embedding-001',
      content: {
        parts: [{ text: cleanText }],
      },
      outputDimensionality: dimensions,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(`Gemini Embedding API error (${res.status}): ${JSON.stringify(errData)}`);
  }

  const data = await res.json();
  if (!data.embedding?.values || !Array.isArray(data.embedding.values)) {
    throw new Error('Invalid response structure from Gemini Embedding API.');
  }

  return data.embedding.values;
}

/**
 * Format a vector float array into pgvector literal format: '[0.123,-0.456,...]'
 */
export function formatVectorForPg(vector: number[]): string {
  return `[${vector.map((v) => Number(v.toFixed(6))).join(',')}]`;
}

/**
 * Combine product metadata into a rich composite text representation for semantic indexing
 */
export function buildProductSemanticText(product: {
  title: string;
  category?: string | null;
  description?: string | null;
  rag_knowledge?: string | null;
}): string {
  const parts: string[] = [];
  if (product.title) parts.push(`পণ্য / Product: ${product.title}`);
  if (product.category) parts.push(`ক্যাটাগরি / Category: ${product.category}`);
  if (product.description) parts.push(`বিবরণ / Description: ${product.description}`);
  if (product.rag_knowledge) parts.push(`র্যাক নলেজ / Specifications & Features: ${product.rag_knowledge}`);

  return parts.join('. ');
}

/**
 * High-level helper: Generates and formats real vector for a product
 */
export async function generateProductVector(product: {
  title: string;
  category?: string | null;
  description?: string | null;
  rag_knowledge?: string | null;
}): Promise<string> {
  const semanticText = buildProductSemanticText(product);
  const vector = await generateEmbedding(semanticText, DEFAULT_DIMENSIONS);
  return formatVectorForPg(vector);
}

/**
 * High-level semantic search across product catalog using cosine similarity
 */
export async function searchCatalogSemantic(
  tenantId: string,
  queryText: string,
  limit = 5,
  channelId?: string
): Promise<any[]> {
  const cleanQuery = (queryText || '').trim();
  if (!cleanQuery) return [];

  try {
    const queryVector = await generateEmbedding(cleanQuery, DEFAULT_DIMENSIONS);
    const vectorString = formatVectorForPg(queryVector);

    let sql = `
      SELECT id, title, description, category, price, stock, sku, image_url, rag_knowledge, channel_id,
             ROUND((1 - (embedding <=> $2::vector))::numeric, 4) as similarity
      FROM products 
      WHERE tenant_id = $1 AND is_active = TRUE AND embedding IS NOT NULL
    `;
    const params: any[] = [tenantId, vectorString];

    if (channelId) {
      sql += ` AND (channel_id IS NULL OR channel_id = $3)`;
      params.push(channelId);
      sql += ` ORDER BY embedding <=> $2::vector ASC LIMIT $4;`;
      params.push(limit);
    } else {
      sql += ` ORDER BY embedding <=> $2::vector ASC LIMIT $3;`;
      params.push(limit);
    }

    const vectorRes = await query(sql, params);

    if (vectorRes.rows.length > 0) {
      return vectorRes.rows;
    }
  } catch (vectorErr: any) {
    console.warn('pgvector cosine query fallback to text search:', vectorErr.message);
  }

  // Graceful fallback to text search if no vector products yet
  let fallbackSql = `
    SELECT id, title, description, category, price, stock, sku, image_url, rag_knowledge, channel_id, 0.70 as similarity
    FROM products 
    WHERE tenant_id = $1 AND is_active = TRUE 
      AND (title ILIKE $2 OR description ILIKE $2 OR category ILIKE $2 OR rag_knowledge ILIKE $2)
  `;
  const fallbackParams: any[] = [tenantId, `%${cleanQuery}%`];

  if (channelId) {
    fallbackSql += ` AND (channel_id IS NULL OR channel_id = $3)`;
    fallbackParams.push(channelId);
    fallbackSql += ` ORDER BY stock DESC LIMIT $4;`;
    fallbackParams.push(limit);
  } else {
    fallbackSql += ` ORDER BY stock DESC LIMIT $3;`;
    fallbackParams.push(limit);
  }

  const fallbackRes = await query(fallbackSql, fallbackParams);
  return fallbackRes.rows;
}
