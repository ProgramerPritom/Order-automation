# ⚙️ KothaShop.ai + n8n Master Automation Workflow

এই ফোল্ডারে আপনার n8n অর্কেস্ট্রেশনের জন্য রেডিমেড ওয়ার্কফ্লো টেমপ্লেট রাখা হয়েছে।

---

## 🚀 আর্কিটেকচার ওভারভিউ

1. **Facebook Messenger Ingest:**  
   কাস্টমার মেসেজ পাঠালে ফেসবুকের রিকোয়েস্ট আসে `POST /api/webhooks/meta`-তে।
2. **KothaShop Enriched Gateway:**  
   সফটওয়্যারটি ডাটাবেজ থেকে শপের পলিসি, ডেলিভারি চার্জ এবং প্রোডাক্ট ক্যাটালগ একত্র করে একটি সাজানো পে-লোড বানিয়ে n8n-এর `http://localhost:5678/webhook/social-commerce`-এ পাঠায়।
3. **n8n Orchestrator:**  
   - `gemini-2.5-flash` দিয়ে মানুষের মতো বাংলায় স্মার্ট রিপ্লাই প্রস্তুত করে।
   - কাস্টমার নাম, ফোন ও ঠিকানা দিলে অর্ডারটি ডিটেক্ট করে।
   - **Google Sheets:** নতুন কনফার্মড অর্ডার গুগল শিটে যুক্ত করে।
   - **KothaShop Callback:** `POST /api/n8n/callback`-এ পাঠায় যা ফেসবুক মেসেঞ্জারে রিপ্লাই সেন্ড করে এবং PostgreSQL ডাটাবেজে নতুন অর্ডার সেভ করে স্টক কমায়।

---

## 🛠️ n8n-এ যেভাবে ইমপোর্ট করবেন (Step-by-Step)

1. আপনার ব্রাউজারে n8n ওপেন করুন (`http://localhost:5678`)।
2. ডানপাশের মেনু থেকে **"Import from File"** ক্লিক করুন।
3. এই ফাইলটি সিলেক্ট করুন:  
   `d:\Frontend Work\Pritom-folder\Page-automation\n8n\kothashop_workflow_template.json`
4. ওয়ার্কফ্লোটি ওপেন হলে:
   - **Gemini Node:** আপনার `.env`-এর `GEMINI_API_KEY` সেট করুন।
   - **Google Sheets Node (ঐচ্ছিক):** আপনার Google Sheets অ্যাকাউন্ট কানেক্ট করুন।
5. উপরের ডানপাশে **"Active"** টগলটি চালু করুন।

🎉 আপনার ফেসবুক পেজ, KothaShop সফটওয়্যার, n8n এবং গুগল শিট রিয়েলটাইমে সম্পূর্ণ সংযুক্ত!
