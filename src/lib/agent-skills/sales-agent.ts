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
 * Converts Bengali digits (০, ১, ২, ৩, ৪, ৫, ৬, ৭, ৮, ৯) to standard Arabic numerals (0-9)
 */
export function convertBengaliToEnglishNumerals(text: string): string {
  if (!text) return '';
  const bnToEnMap: Record<string, string> = {
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
    '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
  };
  return text.replace(/[০-৯]/g, (char) => bnToEnMap[char] || char);
}

/**
 * Validates and extracts Bangladeshi 11-digit mobile number
 * Supports:
 * - Bengali digits: ০১৭১২৩৪৫৬৭৮
 * - Standard digits with country code: +8801712345678, 8801712345678
 * - Banglish formats: 01712-345678, 01712 345678, 01712.345678
 */
export function extractBangladeshiPhone(text: string): string | null {
  if (!text) return null;

  // Convert any Bengali numerals first
  const normalizedText = convertBengaliToEnglishNumerals(text);

  // Remove standard formatting separators between digits
  const cleanSeparators = normalizedText.replace(/(\d)[\s\-\.\/](\d)/g, '$1$2').replace(/(\d)[\s\-\.\/](\d)/g, '$1$2');

  // Match 013, 014, 015, 016, 017, 018, 019 with optional country code
  const phoneRegex = /(?:(?:\+|00)?880|0)?(1[3-9]\d{8})\b/;
  const match = cleanSeparators.match(phoneRegex);
  if (match && match[1]) {
    return `0${match[1]}`;
  }
  return null;
}

/**
 * Extract customer name from Bengali, English, and Banglish text patterns
 * Supports:
 * - "আমার নাম রোহান", "নাম: রহিম"
 * - "amar nam Rohan", "amar name Tanvir", "nam holo Pritom", "my name is..."
 */
export function extractCustomerName(text: string): string | null {
  if (!text) return null;

  // Pattern 1: Explicit labels (আমার নাম, amar nam, amar name, my name is, nam:, name:)
  const match = text.match(
    /(?:আমার\s*নাম|amar\s*name\s*is|amar\s*nam\s*holo|amar\s*name\s*holo|amar\s*nam|amar\s*name|my\s*name\s*is|name:?|নাম:?|nam:?)\s*[:=–-]?\s*([a-zA-Z\u0980-\u09FF\s]{2,30}?)(?:,|\.|\n|$|ঠিকানা|address|thikana|ফোন|phone|mobile|মোবাইল)/i
  );

  if (match && match[1]) {
    const candidate = match[1].trim();
    const blacklist = ['ঠিকানা', 'address', 'thikana', 'ফোন', 'phone', 'mobile', 'dhaka', 'basa', 'road'];
    if (candidate.length >= 2 && !blacklist.some((b) => candidate.toLowerCase().includes(b))) {
      return candidate;
    }
  }

  return null;
}

/**
 * Heuristic detector for customer address keywords in Bengali, English, and Banglish
 * Detects divisions, districts, thanas, roads, house numbers, flats, and Banglish location slang
 */
export function extractPotentialAddress(text: string): string | null {
  if (!text) return null;

  // Check explicit address prefix first: "ঠিকানা: বাসা ১২", "thikana: mirpur 10", "address: House 5, Road 2"
  const explicitMatch = text.match(/(?:ঠিকানা|address|thikana|amar\s*address|amar\s*thikana)\s*[:=–-]?\s*(.+)$/i);
  if (explicitMatch && explicitMatch[1] && explicitMatch[1].trim().length >= 5) {
    return explicitMatch[1].trim();
  }

  const addressIndicators = [
    // Bengali locations & keywords
    'বাসা', 'রোড', 'বাড়ি', 'লেন', 'থানা', 'জেলা', 'গ্রাম', 'সেক্টর', 'ব্লক', 'ফ্ল্যাট',
    'ঢাকা', 'চট্টগ্রাম', 'সিলেট', 'রাজশাহী', 'খুলনা', 'বরিশাল', 'রংপুর', 'ময়মনসিংহ', 'কুমিল্লা',
    'ধানমন্ডি', 'মিরপুর', 'উত্তরা', 'গুলশান', 'বনানী', 'মোহাম্মদপুর', 'বাড্ডা', 'গাজীপুর', 'নারায়ণগঞ্জ',
    'সাভার', 'কেরানীগঞ্জ', 'বগুড়া', 'যশোর', 'কক্সবাজার', 'ফেনী', 'নোয়াখালী',
    // Banglish & English keywords
    'house', 'road', 'sector', 'block', 'thana', 'dist', 'district', 'flat', 'floor', 'lane',
    'dhaka', 'dhk', 'chittagong', 'ctg', 'sylhet', 'rajshahi', 'khulna', 'barisal', 'rangpur',
    'mymensingh', 'cumilla', 'comilla', 'gazipur', 'savar', 'narayanganj', 'keraniganj', 'bogra', 'bogura',
    'mirpur', 'uttara', 'dhanmondi', 'gulshan', 'banani', 'mohammadpur', 'badda', 'jatrabari', 'motijheel',
    'basa', 'bari', 'gram', 'jela', 'thikana'
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
    const total = subtotal + fee;

    const orderRes = await client.query(
      `INSERT INTO orders (
        tenant_id, channel_id, order_number, customer_name, customer_phone, 
        delivery_address, delivery_city, subtotal, delivery_fee, total_amount, 
        status, courier_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', 'unassigned')
      RETURNING id;`,
      [tenantId, channelId, orderNumber, cName, cPhone, address, city, subtotal, fee, total]
    );

    const orderId = orderRes.rows[0].id;

    if (lead.product_id) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, title, quantity, unit_price, total_price)
         VALUES ($1, $2, $3, $4, $5, $6);`,
        [orderId, lead.product_id, lead.product_title || 'Item', qty, unitPrice, subtotal]
      );

      // Decrement inventory stock atomically
      await client.query(
        `UPDATE products 
         SET stock = GREATEST(0, stock - $1), updated_at = NOW() 
         WHERE id = $2 AND tenant_id = $3;`,
        [qty, lead.product_id, tenantId]
      );
    }

    // Increment tenant's monthly order count
    await client.query(
      `UPDATE tenants 
       SET orders_count_current_month = COALESCE(orders_count_current_month, 0) + 1, updated_at = NOW() 
       WHERE id = $1;`,
      [tenantId]
    );

    await client.query('COMMIT');

    return {
      success: true,
      orderNumber,
      orderId,
      total,
    };
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Order creation transaction failed:', err);
    return {
      success: false,
      error: err.message,
    };
  } finally {
    client.release();
  }
}
