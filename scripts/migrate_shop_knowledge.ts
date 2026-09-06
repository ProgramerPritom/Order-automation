import { pool, query } from '../src/lib/db';

async function migrateShopKnowledge() {
  console.log('--- Migrating Database for Shop Profile & AI Knowledge (RAG) ---');
  try {
    await query(`
      ALTER TABLE "tenants" 
      ADD COLUMN IF NOT EXISTS "business_category" VARCHAR(100) DEFAULT 'Fashion & Clothing',
      ADD COLUMN IF NOT EXISTS "support_phone" VARCHAR(50),
      ADD COLUMN IF NOT EXISTS "showroom_address" TEXT,
      ADD COLUMN IF NOT EXISTS "delivery_inside_dhaka" NUMERIC(10,2) DEFAULT 80,
      ADD COLUMN IF NOT EXISTS "delivery_outside_dhaka" NUMERIC(10,2) DEFAULT 150,
      ADD COLUMN IF NOT EXISTS "delivery_time_dhaka" VARCHAR(100) DEFAULT '২৪ থেকে ৪৮ ঘণ্টার মধ্যে',
      ADD COLUMN IF NOT EXISTS "delivery_time_outside" VARCHAR(100) DEFAULT '৩ থেকে ৪ কার্যদিবসের মধ্যে',
      ADD COLUMN IF NOT EXISTS "return_policy" TEXT DEFAULT 'ডেলিভারি ম্যানের সামনে পণ্য চেক করে রিসিভ করবেন। কোনো সমস্যা বা সাইজ এক্সচেঞ্জ প্রয়োজন হলে সাথে সাথে ডেলিভারি ম্যানের কাছে ফেরত পাঠাতে পারবেন।',
      ADD COLUMN IF NOT EXISTS "ai_tone" VARCHAR(50) DEFAULT 'friendly',
      ADD COLUMN IF NOT EXISTS "custom_rules" TEXT DEFAULT 'অগ্রিম কোনো টাকা দিতে হবে না, পণ্য হাতে পেয়ে মূল্য পরিশোধ (ক্যাশ অন ডেলিভারি)।';
    `);

    // Update demo tenant with rich realistic info
    await query(`
      UPDATE "tenants" 
      SET 
        "business_category" = 'প্রিমিয়াম ফ্যাশন ও ক্লথিং',
        "support_phone" = '01700000000',
        "showroom_address" = 'হাউস ১২, রোড ৫, ধানমন্ডি, ঢাকা',
        "delivery_inside_dhaka" = 80,
        "delivery_outside_dhaka" = 150,
        "delivery_time_dhaka" = '২৪ থেকে ৪৮ ঘণ্টা (ঢাকা সিটির ভেতরে)',
        "delivery_time_outside" = '২ থেকে ৩ কার্যদিবস (ঢাকার বাইরে)',
        "return_policy" = 'ডেলিভারি ম্যান থাকা অবস্থায় পার্সেল খুলে চেক করে নিতে পারবেন। সাইজ না মিললে বা অপছন্দ হলে শুধু ডেলিভারি চার্জ দিয়ে রিটার্ন করা যাবে।',
        "ai_tone" = 'নম্র ও আন্তরিক (ভাইয়া/আপু সম্বোধন)',
        "custom_rules" = 'ক্যাশ অন ডেলিভারিতে অর্ডার নেওয়া হবে। অর্ডার নিশ্চিত করার জন্য নাম, মোবাইল নম্বর এবং সম্পূর্ণ ঠিকানা অবশ্যই প্রয়োজন।'
      WHERE "slug" = 'demo-aarong-fashion';
    `);

    console.log('✅ Shop knowledge columns added and demo tenant updated successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrateShopKnowledge();
