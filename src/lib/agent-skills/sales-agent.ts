import { query, getClient } from '../db';
import { saasRedis } from '../redis';
import { searchCatalogSemantic } from '../embeddings';

export interface CustomerLead {
  customer_name?: string | null;
  customer_phone?: string | null;
  delivery_address?: string | null;
  delivery_city?: string | null;
  product_id?: string | null;
  product_title?: string | null;
  quantity?: number;
  unit_price?: number;
  delivery_fee?: number;
  total_amount?: number;
}

export type ConversationStage =
  | 'GREETING'
  | 'INQUIRY'
  | 'COLLECTING_DETAILS'
  | 'READY_TO_CONFIRM'
  | 'ORDER_PLACED'
  | 'HUMAN_HANDOFF';

export interface AgenticState {
  stage: ConversationStage;
  lead: CustomerLead;
  missingFields: string[];
  missingBengaliNotice?: string;
  matchedProducts: any[];
}

/**
 * Validates and extracts Bangladeshi 11-digit mobile number
 */
export function extractBangladeshiPhone(text: string): string | null {
  if (!text) return null;
  // Match 013, 014, 015, 016, 017, 018, 019 with optional country code (+88 or 88)
  const phoneRegex = /(?:(?:\+|00)?880|0)?(1[3-9]\d{8})\b/;
  const match = text.match(phoneRegex);
  if (match && match[1]) {
    return `0${match[1]}`;
  }
  return null;
}

/**
 * Extract customer name from Bengali/English text patterns
 */
export function extractCustomerName(text: string): string | null {
  if (!text) return null;
  const match = text.match(/(?:আমার\s*নাম|name\s*is|name:?|নাম:?)\s*([a-zA-Z\u0980-\u09FF\s]{2,30}?)(?:,|\.|\n|$|ঠিকানা|address|ফোন|phone|মোবাইল)/i);
  if (match && match[1]) {
    const candidate = match[1].trim();
    if (candidate.length >= 2 && !candidate.includes('ঠিকানা') && !candidate.includes('ফোন')) {
      return candidate;
    }
  }
  return null;
}

/**
 * Heuristic detector for customer address keywords in Bengali or English
 */
export function extractPotentialAddress(text: string): string | null {
  if (!text) return null;

  // Check explicit address prefix first: "ঠিকানা: বাসা ১২, ধানমন্ডি"
  const explicitMatch = text.match(/(?:ঠিকানা|address)\s*[:=–-]?\s*(.+)$/i);
  if (explicitMatch && explicitMatch[1] && explicitMatch[1].trim().length >= 5) {
    return explicitMatch[1].trim();
  }

  const addressIndicators = [
    'বাসা', 'রোড', 'বাড়ি', 'লেন', 'থানা', 'জেলা', 'গ্রাম', 'সেক্টর', 'ব্লক',
    'ঢাকা', 'চট্টগ্রাম', 'সিলেট', 'রাজশাহী', 'খুলনা', 'বরিশাল', 'রংপুর', 'ময়মনসিংহ',
    'ধানমন্ডি', 'মিরপুর', 'উত্তরা', 'গুলশান', 'বনানী', 'মোহাম্মদপুর', 'বাড্ডা', 'গাজীপুর', 'নারায়ণগঞ্জ',
    'house', 'road', 'sector', 'block', 'thana', 'dist', 'dhaka', 'chittagong', 'sylhet', 'flat', 'floor'
  ];

  const lower = text.toLowerCase();
  const hasIndicator = addressIndicators.some((kw) => lower.includes(kw));

  if (hasIndicator && text.trim().length >= 8) {
    return text.trim();
  }
  return null;
}

/**
 * Skill: Evaluate order readiness and calculate missing required information
 */
export function evaluateOrderReadiness(lead: CustomerLead): {
  isReady: boolean;
  missingFields: string[];
  missingBengaliLabels: string[];
} {
  const missing: string[] = [];
  const missingLabels: string[] = [];

  if (!lead.customer_name || lead.customer_name.trim().length < 2) {
    missing.push('customer_name');
    missingLabels.push('আপনার নাম');
  }

  if (!lead.customer_phone || !/^01[3-9]\d{8}$/.test(lead.customer_phone)) {
    missing.push('customer_phone');
    missingLabels.push('সক্রিয় ১১ ডিজিটের মোবাইল নম্বর');
  }

  if (!lead.delivery_address || lead.delivery_address.trim().length < 5) {
    missing.push('delivery_address');
    missingLabels.push('পূর্ণ ডেলিভারি ঠিকানা (বাসা/রোড/এলাকা/জেলা)');
  }

  return {
    isReady: missing.length === 0,
    missingFields: missing,
    missingBengaliLabels: missingLabels,
  };
}

/**
 * Skill: Atomic Order Creation inside Database Transaction with inventory protection
 */
export async function executeOrderCreation(params: {
  tenantId: string;
  channelId: string;
  lead: CustomerLead;
  shop: any;
}): Promise<{ success: boolean; orderNumber?: string; orderId?: string; total?: number; error?: string }> {
  const { tenantId, channelId, lead, shop } = params;
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const orderNumber = `KS-${Math.floor(100000 + Math.random() * 900000)}`;
    const cName = lead.customer_name || 'Valued Customer';
    const cPhone = lead.customer_phone || '';
    const address = lead.delivery_address || 'Address provided in chat';
    const city = lead.delivery_city || (address.toLowerCase().includes('dhaka') || address.includes('ঢাকা') ? 'Dhaka' : 'Outside Dhaka');

    const insideFee = Number(shop.delivery_inside_dhaka || 80);
    const outsideFee = Number(shop.delivery_outside_dhaka || 130);
    const fee = city.toLowerCase().includes('dhaka') ? insideFee : outsideFee;

    const unitPrice = Number(lead.unit_price || 0);
    const qty = Number(lead.quantity || 1);
    const subtotal = unitPrice * qty;
    const total = lead.total_amount || (subtotal + fee);
    const profit = Math.round(subtotal * 0.35);

    const orderInsertSql = `
      INSERT INTO orders (
        order_number, tenant_id, customer_name, customer_phone,
        delivery_address, delivery_city, district, delivery_fee, 
        subtotal, total_amount, status, channel_id, notes, 
        courier_name, courier_status, fraud_score, capi_fired, estimated_profit
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', $11, 
        'Agentic AI Sales Engine (Autonomous Skill)', 'Steadfast / Pathao', 'pending', 100, TRUE, $12
      ) RETURNING id, order_number;
    `;

    const orderRes = await client.query(orderInsertSql, [
      orderNumber,
      tenantId,
      cName,
      cPhone,
      address,
      city,
      city,
      fee,
      subtotal,
      total,
      channelId,
      profit,
    ]);

    const newOrder = orderRes.rows[0];
    const orderId = newOrder.id;

    // Insert Order Item
    await client.query(
      `INSERT INTO order_items (order_id, product_id, product_title, unit_price, quantity, total_price)
       VALUES ($1, $2, $3, $4, $5, $6);`,
      [
        orderId,
        lead.product_id || null,
        lead.product_title || 'General Product',
        unitPrice,
        qty,
        subtotal,
      ]
    );

    // Decrement product inventory atomically
    if (lead.product_id) {
      await client.query(
        `UPDATE products SET stock = GREATEST(0, stock - $1), updated_at = NOW() 
         WHERE id = $2 AND tenant_id = $3;`,
        [qty, lead.product_id, tenantId]
      );
      await saasRedis.del(`catalog:${tenantId}`);
    }

    await client.query('COMMIT');
    console.log(`🎉 [Agentic Skill] Autonomous Order created: #${orderNumber} for ${cName} (${cPhone}) - ৳${total}`);

    return {
      success: true,
      orderNumber,
      orderId,
      total,
    };
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Order creation error in agentic skill:', err);
    return { success: false, error: err.message };
  } finally {
    client.release();
  }
}
