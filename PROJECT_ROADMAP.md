# 🚀 Social Commerce AI SaaS Platform — Phase Execution Tracker

> **Core Philosophy:** প্রতিটা ফেজের জন্য নির্দিষ্ট টার্গেট, ফাংশনাল রিকোয়ারমেন্ট এবং **Internal Test Suite (DoD - Definition of Done)** থাকবে। প্রতিটি ফেজ শেষ করার পর স্বয়ংক্রিয় টেস্ট স্ক্রিপ্ট রান করে ১০০% সফল হলেই কেবল সেই ফেজকে **`COMPLETED`** হিসেবে মার্ক করা হবে।

---

## 📊 Phase Overview & Status

| Phase | Description | Deliverables | Internal Test Method | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 0** | Database Reset & Multi-Tenant Schema | Supabase clean-up, Postgres schema, RLS, Redis setup | `npm run test:db` (Connection, Tables, RLS, Redis) | ✅ **COMPLETED** (18/18 Passed) |
| **Phase 1** | SaaS Core, JWT Auth & Rate Limiting | Next.js App Router, JWT Rotation, Redis Rate Limiter | `npm run test:auth` (Signup, Token, RLS, Rate Limit) | ✅ **COMPLETED** (17/17 Passed) |
| **Phase 2** | High-Converting Marketing Landing Page | Hero with Live Chat Simulation, Offer Tiers, Pricing | `npm run test:build` + UI Component Render Tests | ✅ **COMPLETED** (Build Passed 0 errors) |
| **Phase 3** | Dashboard, Channels & n8n Health Monitor | Multi-tenant Layout, FB/IG/WA Hub, Live n8n Monitor | `npm run test:channels` + Health Telemetry Ping | ✅ **COMPLETED** (12/12 Passed) |
| **Phase 4** | Product Catalog & Auto-RAG Vector Sync | Product CRUD, Variants, Stock, `pgvector` Sync | `npm run test:products` (CRUD + Vector Similarity) | ✅ **COMPLETED** (7/7 Passed) |
| **Phase 5** | Order CRM, Live Inbox & Human Handoff | Kanban Pipeline, Live Chat, "Take Over" Pause Bot | `npm run test:orders` (Order Lifecycle, Takeover Flag) | ✅ **COMPLETED** (10/10 Passed) |
| **Phase 6** | Ultra-Fast Webhook Gateway & Stress Test | Meta Webhook Ingestion, Redis FAQ Cache, Dispatcher | `npm run test:stress` (100+ Concurrent Hits < 50ms) | ✅ **COMPLETED** (7/7 Passed, 1266 req/s) |

---

## 📑 Phase Details & Definition of Done (DoD)

---

### 🔹 Phase 0: Database Reset & Multi-Tenant Infrastructure
* **টার্গেট:** বর্তমান Supabase প্রজেক্টের অপ্রয়োজনীয় EduTech টেবিল ড্রপ করে ফ্রেশ মাল্টি-টেন্যান্ট ই-কমার্স স্কিমা তৈরি করা এবং Upstash Redis-এ `saas:*` প্রিফিক্স কনফিগার করা।
* **মূল কাজসমূহ:**
  1. `db/reset_and_migrate.sql` স্ক্রিপ্ট তৈরি।
  2. `pgvector`, `uuid-ossp`, `pgcrypto` এক্সটেনশন এনাবল করা।
  3. টেবিল তৈরি: `tenants`, `users`, `channels`, `automation_health_logs`, `products`, `product_variants`, `orders`, `order_items`, `conversations`, `messages`, `faq_cache`।
  4. প্রতিটি টেবিলে **Row Level Security (RLS)** পলিসি প্রয়োগ করা।
  5. `src/lib/db.ts` এবং `src/lib/redis.ts` কনফিগারেশন তৈরি।
* **🧪 Internal Test Suite (`test:db`):**
  - [ ] Supabase কানেকশন টেস্ট (Pooler & Direct URL)।
  - [ ] সব টেবিল সঠিকভাবে তৈরি হয়েছে কিনা তা চেক করা।
  - [ ] RLS আইসোলেশন টেস্ট (Tenant A যাতে Tenant B এর ডাটা এক্সেস না করতে পারে)।
  - [ ] Upstash Redis-এ `saas:ping` লিখে রিড/রাইট রেসপন্স টেস্ট।
* **Definition of Done (DoD):** টেস্ট স্ক্রিপ্ট ১০০% পাস করলে Phase 0 সম্পন্ন ঘোষণা করা হবে।

---

### 🔹 Phase 1: Enterprise JWT Auth, Security & Rate Limiting
* **টার্গেট:** সম্পূর্ণ সিকিউর মাল্টি-টেন্যান্ট সাইনআপ, লগইন, টোকেন রোটেশন এবং ব্রুট-ফোর্স/ডিডিওএস প্রতিরোধে রেট লিমিটিং বাস্তবায়ন।
* **মূল কাজসমূহ:**
  1. পাসওয়ার্ড হ্যাশিং (bcrypt)।
  2. ডাবল-লেয়ার JWT আর্কিটেকচার (Short-lived Access Token + HttpOnly Secure Refresh Token Cookie)।
  3. Upstash Redis স্লাইডিং-উইন্ডো রেট লিমিটিং মিডলওয়্যার (Auth-এ প্রতি মিনিটে ৫ রিকোয়েস্ট লিমিট)।
  4. API Endpoints: `/api/auth/register`, `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`, `/api/auth/me`।
* **🧪 Internal Test Suite (`test:auth`):**
  - [ ] নতুন টেন্যান্ট ও ইউজার রেজিস্ট্রেশন টেস্ট।
  - [ ] ডুপ্লিকেট ইমেইল রিজেকশন টেস্ট।
  - [ ] ভুল পাসওয়ার্ডে ৪০১ রিজেকশন এবং সঠিক ক্রেডেনশিয়ালে JWT কুকি যাচাই।
  - [ ] ৫ বারের বেশি ভুল লগইন ট্রাই করলে 429 Too Many Requests রেট-লিমিট ট্রিগার টেস্ট।
  - [ ] টোকেন রিফ্রেশ ও এক্সপায়ার্ড টোকেন রিভোকেশন টেস্ট।
* **Definition of Done (DoD):** কোনো সিকিউরিটি লিক ছাড়া সকল অথেনটিকেশন টেস্ট পাস হওয়া।

---

### 🔹 Phase 2: High-Converting Marketing Landing Page (Product Showcase)
* **টার্গেট:** একটি প্রিমিয়াম, আধুনিক ও আকর্ষণীয় পাবলিক ল্যান্ডিং পেইজ যা দেখে গ্রাহকরা প্রোডাক্টের সুবিধা বুঝতে পারে এবং সাইনআপ করতে আগ্রহী হয়।
* **মূল কাজসমূহ:**
  1. **Hero Section:** আকর্ষণীয় স্লোগান ("আপনার ফেসবুক ও হোয়াটসঅ্যাপ ইনবক্স রূপান্তর করুন ২৪/৭ সেলস মেশিনে")।
  2. **Interactive Live Chat Simulation:** একটি লাইভ অ্যানিমেটেড মেসেঞ্জার/হোয়াটসঅ্যাপ উইজেট যেখানে দেখানো হবে কাস্টমার মেসেজ দিলে এআই কীভাবে সাথে সাথে স্টক চেক করে অর্ডার কনফার্ম করে দিচ্ছে।
  3. **Feature Grid:** ওমনি-চ্যানেল সুবিধা, রিয়েল-টাইম বাংলা ও বাংলিশ বুঝার ক্ষমতা, কুরিয়ার অটোমেশন।
  4. **Limited-time Offer & Pricing Cards:** স্টার্টার, গ্রোথ ও প্রো প্যাকেজ (১৪ দিনের ফ্রি ট্রায়াল CTA)।
  5. **Top Navigation:** Features, Live Demo, Pricing, এবং "Login / Start Free Trial" বাটন।
* **🧪 Internal Test Suite:**
  - [ ] মোবাইল, ট্যাবলেট ও ডেস্কটপ ভিউতে ১০০% রেসপনসিভনেস চেক।
  - [ ] কোনো ব্রোকেন লিংক বা কনসোল এরর নেই তা নিশ্চিত করা।
  - [ ] নেক্সট.জেএস প্রোডাকশন অপ্টিমাইজড বান্ডেল বিল্ড টেস্ট (`npm run build`)।
* **Definition of Done (DoD):** সাইট দ্রুত লোড হওয়া এবং ইন্টারেক্টিভ ডেমো স্মুথলি কাজ করা।

---

### 🔹 Phase 3: SaaS Dashboard Layout, Channels Hub & n8n Monitor
* **টার্গেট:** ক্লায়েন্টের জন্য একটি প্রফেশনাল ড্যাশবোর্ড তৈরি করা যাতে সোশ্যাল চ্যানেল কানেক্ট করা যায় এবং n8n অটোমেশনের লাইভ হেলথ স্ট্যাটাস দেখা যায়।
* **মূল কাজসমূহ:**
  1. **Dashboard Shell:** রেসপনসিভ সাইডবার, টপ ন্যাভবার, টেন্যান্ট সুইচ ও ডার্ক/লাইট মোড সাপোর্ট।
  2. **Dedicated n8n & Automation Health Page (`/dashboard/automation`):**
     - n8n কানেকশন স্ট্যাটাস (🟢 Live / 🔴 Down, Latency ms)।
     - সর্বশেষ কখন মেসেজ প্রসেস হয়েছে তার টাইমস্ট্যাম্প।
     - "Send Test Ping to n8n" ইন্টারেক্টিভ বাটন।
  3. **Dedicated Channels Menu (`/dashboard/channels`):**
     - Facebook Page Connect কার্ড (Page ID, Token Health, Webhook Status)।
     - Instagram Direct Connect কার্ড।
     - WhatsApp Cloud API Connect কার্ড (Phone ID, Quality Rating)।
     - প্রতিটা চ্যানেলের জন্য আলাদা **"AI Auto-Reply" ON/OFF Switch**।
* **🧪 Internal Test Suite (`test:channels`):**
  - [ ] চ্যানেল কানেকশন ও ক্রেডেনশিয়াল সেভ API টেস্ট।
  - [ ] AI টগল সুইচ স্টেট ডাটাবেজে পারসিস্ট হচ্ছে কিনা তা টেস্ট।
  - [ ] n8n হেলথ চেক এন্ডপয়েন্ট পিং ও ল্যাটেন্সি ক্যালকুলেশন টেস্ট।
* **Definition of Done (DoD):** সব চ্যানেলের স্ট্যাটাস ও হেলথ প্যানেল রিয়েল-টাইম ডাটা রিটার্ন করতে সক্ষম হওয়া।

---

### 🔹 Phase 4: Product Catalog & Auto-RAG Vector Sync
* **টার্গেট:** ইউজার যেন সহজেই তার পণ্যের বিবরণ যুক্ত করতে পারে এবং স্বয়ংক্রিয়ভাবে তা এআই-এর RAG মেমোরিতে (`pgvector`) সিঙ্ক হয়ে যায়।
* **মূল কাজসমূহ:**
  1. প্রোডাক্ট অ্যাড/এডিট ফর্ম (টাইটেল, ডেসক্রিপশন, ক্যাটাগরি, প্রাইস, ইমেজ)।
  2. ভ্যারিয়েন্ট ও স্টক ট্র্যাকিং (M, L, XL / কালার / স্টক কাউন্ট)।
  3. **Auto-Embedding Generator:** প্রোডাক্ট সেভ বা আপডেট হওয়ার সাথে সাথে ব্যাকগ্রাউন্ডে টেক্সট এম্বেডিং তৈরি হয়ে `products.embedding` কলামে সেভ হওয়া।
* **🧪 Internal Test Suite (`test:products`):**
  - [ ] প্রোডাক্ট ও ভ্যারিয়েন্ট CRUD অপারেশন টেস্ট।
  - [ ] ভেক্টর এম্বেডিং সফলভাবে তৈরি এবং কসিমাইন সিমিলারিটি সার্চ টেস্ট।
  - [ ] টেন্যান্ট আইসোলেশন টেস্ট (Tenant A-এর RAG সার্চে Tenant B-এর প্রোডাক্ট আসবে না)।
* **Definition of Done (DoD):** প্রোডাক্ট অ্যাড করার পর তাৎক্ষণিক ভেক্টর সার্চে প্রাসঙ্গিক রেজাল্ট পাওয়া।

---

### 🔹 Phase 5: Order Management CRM, Live Inbox & Human Handoff
* **টার্গেট:** এআই যে অর্ডারগুলো কালেক্ট করবে তা ইউজার সহজে ম্যানেজ করতে পারবে এবং কাস্টমারের সাথে নিজে লাইভ চ্যাটে যুক্ত হতে পারবে।
* **মূল কাজসমূহ:**
  1. **Order CRM Pipeline:** স্ট্যাটাস ভিত্তিক ফিল্টারিং (Pending ➔ Confirmed ➔ Shipped ➔ Delivered)।
  2. কাস্টমার ইনফো কার্ড (নাম, মোবাইল নম্বর, ডেলিভারি এড্রেস, পণ্যের নাম ও মোট বিল)।
  3. **Live Inbox:** মেসেঞ্জারের মতো চ্যাট ভিউ যাতে ইউজার কাস্টমারের রিয়েল-টাইম মেসেজ দেখতে পারে।
  4. **"Take Over Chat" (Human Handoff):** বাটনে ক্লিক করলে ওই কাস্টমারের জন্য এআই ২৪ ঘণ্টার জন্য মিউট (`ai_muted_until = NOW() + 24 hours`) হয়ে যাবে যাতে ওনার নিজে চ্যাট করতে পারে।
* **🧪 Internal Test Suite (`test:orders`):**
  - [ ] অর্ডার ক্রিয়েশন ও স্ট্যাটাস ট্রানজিশন টেস্ট।
  - [ ] হিউম্যান টেকওভার ফ্ল্যাগ সক্রিয় হলে বট রেসপন্স অফ থাকার লজিক ভ্যালিডেশন টেস্ট।
* **Definition of Done (DoD):** অর্ডার লাইফসাইকেল এবং হিউম্যান টেকওভার লজিক সম্পূর্ণভাবে কার্যকর হওয়া।

---

### 🔹 Phase 6: High-Throughput Webhook Gateway & Stress Testing
* **টার্গেট:** মেটা থেকে শত শত মেসেজ একসাথে এলেও সাব-৫০ মিলিসেকেন্ডে `200 OK` দিয়ে কিউ ও ক্যাশের মাধ্যমে প্রসেস করা।
* **মূল কাজসমূহ:**
  1. মেটা সেন্ট্রাল ওয়েবহুক গেটওয়ে (`/api/webhooks/meta`): `X-Hub-Signature-256` ভ্যালিডেশন।
  2. **Upstash FAQ Cache:** সাধারণ প্রশ্নের উত্তর সরাসরি ক্যাশ থেকে ইনস্ট্যান্ট পাঠানো (০ টাকা খরচ)।
  3. Producer-Consumer Queue: মেটা মেসেজ কিউ-তে পুশ করে নিমেষে `200 OK` রিটার্ন।
  4. n8n ডিসপ্যাচার: টেন্যান্ট কনটেক্সট যুক্ত করে n8n মাস্টার ওয়ার্কফ্লোতে পাঠানো।
* **🧪 Internal Test Suite (`test:stress`):**
  - [ ] একসাথে ১০০টি কনকারেন্ট ফেক ওয়েবহুক হিট পাঠিয়ে টেস্ট (গড় রেসপন্স টাইম ৫০ms-এর কম থাকা)।
  - [ ] ক্যাশ হিট রেট টেস্ট (FAQ মেসেজে কোনো এআই কল না যাওয়া)।
* **Definition of Done (DoD):** কনকারেন্সি টেস্টে কোনো মেসেজ ড্রপ না হওয়া এবং রেসপন্স টাইম স্ট্রিক্টলি মেটার লিমিটের মধ্যে থাকা।
