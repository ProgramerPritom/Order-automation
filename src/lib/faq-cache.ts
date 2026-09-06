import { saasRedis } from './redis';
import crypto from 'crypto';

/**
 * Normalize Bangla / English text for cache matching
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[?,.!@#$%^&*()_+=\-[\]{};':"\\|<>~/`]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Built-in default FAQ patterns for Bangladeshi E-Commerce
 */
const DEFAULT_FAQS: Record<string, string> = {
  'delivery charge koto': 'আমাদের ডেলিভারি চার্জ ঢাকার ভেতরে ৮০ টাকা এবং ঢাকার বাইরে ১৫০ টাকা। সাধারণত ২-৩ কার্যদিবসের মধ্যে ডেলিভারি সম্পন্ন হয়।',
  'ডেলিভারি চার্জ কত': 'আমাদের ডেলিভারি চার্জ ঢাকার ভেতরে ৮০ টাকা এবং ঢাকার বাইরে ১৫০ টাকা। সাধারণত ২-৩ কার্যদিবসের মধ্যে ডেলিভারি সম্পন্ন হয়।',
  'cash on delivery ache': 'জি ভাইয়া! সমগ্র বাংলাদেশে ক্যাশ অন ডেলিভারি (পণ্য হাতে পেয়ে মূল্য পরিশোধ) সুবিধা রয়েছে।',
  'ক্যাশ অন ডেলিভারি আছে': 'জি ভাইয়া! সমগ্র বাংলাদেশে ক্যাশ অন ডেলিভারি (পণ্য হাতে পেয়ে মূল্য পরিশোধ) সুবিধা রয়েছে।',
  'showroom kothay': 'আমাদের অনলাইন ভিত্তিক অপারেশন। তবে আপনি চাইলে আমাদের ওয়্যারহাউস থেকে সরাসরি পিকআপ করতে পারবেন। ঠিকানা: ধানমন্ডি ২৭, ঢাকা।',
  'শোরুম কোথায়': 'আমাদের অনলাইন ভিত্তিক অপারেশন। তবে আপনি চাইলে আমাদের ওয়্যারহাউস থেকে সরাসরি পিকআপ করতে পারবেন। ঠিকানা: ধানমন্ডি ২৭, ঢাকা।',
};

/**
 * Check if customer query exists in FAQ Cache (Upstash Redis)
 */
export async function checkFaqCache(tenantId: string, rawText: string): Promise<string | null> {
  const normalized = normalizeText(rawText);
  if (!normalized) return null;

  // 1. Check default common phrases
  if (DEFAULT_FAQS[normalized]) {
    return DEFAULT_FAQS[normalized];
  }

  // 2. Check tenant-specific Redis cache
  const hash = crypto.createHash('md5').update(normalized).digest('hex');
  const cacheKey = `faq:${tenantId}:${hash}`;

  try {
    const cached = await saasRedis.get<string>(cacheKey);
    return cached;
  } catch (err) {
    return null;
  }
}

/**
 * Set tenant specific FAQ in cache
 */
export async function setFaqCache(tenantId: string, rawText: string, answer: string): Promise<void> {
  const normalized = normalizeText(rawText);
  const hash = crypto.createHash('md5').update(normalized).digest('hex');
  const cacheKey = `faq:${tenantId}:${hash}`;

  try {
    await saasRedis.set(cacheKey, answer, { ex: 7 * 24 * 60 * 60 }); // 7 days
  } catch (err) {
    console.error('Failed to set FAQ cache:', err);
  }
}
