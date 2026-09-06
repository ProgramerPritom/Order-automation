'use client';

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Store,
  Truck,
  RotateCcw,
  Bot,
  Save,
  CheckCircle2,
  AlertCircle,
  Phone,
  MapPin,
  HelpCircle,
} from 'lucide-react';

import { useAppDispatch, useAppSelector } from '@/lib/store/hooks';
import {
  fetchShopKnowledge,
  saveShopKnowledge,
  updateKnowledgeField,
} from '@/lib/store/slices/shopSlice';

export default function ShopKnowledgePage() {
  const dispatch = useAppDispatch();
  const shopState = useAppSelector((state) => state.shop);

  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState(shopState.knowledge);

  // Sync form with Redux cached knowledge
  useEffect(() => {
    if (shopState.isLoaded) {
      setForm(shopState.knowledge);
    }
  }, [shopState.isLoaded, shopState.knowledge]);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    // Redux thunk will skip network call if already loaded in memory
    if (!shopState.isLoaded) {
      dispatch(fetchShopKnowledge(token));
    }
  }, [dispatch, shopState.isLoaded]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(null);
    setError(null);

    const token = localStorage.getItem('accessToken');
    if (!token) return;

    try {
      const action = await dispatch(saveShopKnowledge({ token, form })).unwrap();
      setSuccess(action.message || 'আপনার শপের তথ্য সফলভাবে সেভ হয়েছে!');
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(err || 'Failed to save');
    }
  };

  const loading = shopState.isLoading && !shopState.isLoaded;
  const saving = shopState.isSaving;

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500 font-bold animate-pulse">
        শপের এআই নলেজ লোড হচ্ছে...
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full pb-12">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>AI Knowledge Base & RAG Engine</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900">শপ প্রোফাইল ও এআই নলেজ বেস</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            এখানে আপনার শপের পলিসি ও ডেলিভারি তথ্য লিখে রাখুন — কাস্টমার মেসেজ দিলেই এআই এই তথ্য ব্যবহার করে নির্ভুল উত্তর দেবে
          </p>
        </div>
      </div>

      {success && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 font-bold shadow-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Section 1: Shop Basic Profile */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Store className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">১. শপের সাধারণ তথ্য ও যোগাযোগ</h2>
              <p className="text-xs text-slate-500">কাস্টমারকে আপনার ব্যবসা সম্পর্কে পরিচিত করানোর জন্য</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                বিজনেসের ক্যাটাগরি
              </label>
              <input
                type="text"
                value={form.business_category}
                onChange={(e) => setForm({ ...form, business_category: e.target.value })}
                placeholder="যেমন: প্রিমিয়াম জেন্টস ফ্যাশন"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                জরুরি হেল্পলাইন বা হোয়াটসঅ্যাপ নম্বর
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  value={form.support_phone}
                  onChange={(e) => setForm({ ...form, support_phone: e.target.value })}
                  placeholder="যেমন: 01700000000"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                শোরুম বা আউটলেটের পূর্ণ ঠিকানা (যদি থাকে)
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  value={form.showroom_address}
                  onChange={(e) => setForm({ ...form, showroom_address: e.target.value })}
                  placeholder="যেমন: হাউস ১২, রোড ৫, ধানমন্ডি, ঢাকা (অনলাইনে হলে লিখুন: শুধুই অনলাইন শপ)"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="sm:col-span-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  শপের বিস্তারিত তথ্য ও বিবরণ (Detailed Shop Information & About Us)
                </label>
                <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded-full">
                  AI RAG নলেজের জন্য অত্যন্ত কার্যকর
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mb-2">
                আপনার শপ সম্পর্কে বিস্তারিত যা কিছু জানাতে চান (যেমন: কত বছর ধরে ব্যবসা করছেন, পণ্যের উৎস বা স্পেশালিটি কী, কালার গ্যারান্টি, বিশেষ অফার ইত্যাদি) এখানে লিখুন। এআই কাস্টমারদের প্রশ্নের উত্তর দিতে এই তথ্য স্বয়ংক্রিয়ভাবে ব্যবহার করবে।
              </p>
              <textarea
                rows={4}
                value={form.about_shop}
                onChange={(e) => setForm({ ...form, about_shop: e.target.value })}
                placeholder="যেমন: আমাদের প্রতিষ্ঠান গত ৫ বছর ধরে প্রিমিয়াম কোয়ালিটির সম্পূর্ণ ১০০% কটন ফ্যাব্রিকের পাঞ্জাবি ও লাইফস্টাইল পণ্য বিক্রি করছে। আমাদের নিজস্ব ফ্যাক্টরি থেকে সরাসরি পণ্য সরবরাহ করা হয়, ফলে কোনো মধ্যস্বত্বভোগী নেই..."
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none leading-relaxed"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Delivery & Shipping Policy */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">২. ডেলিভারি চার্জ ও সময়সীমা (এআই অটো-ক্যালকুলেট করবে)</h2>
              <p className="text-xs text-slate-500">কাস্টমারকে ঠিকানা অনুযায়ী সঠিক চার্জ ও দিন জানাতে এই তথ্য ব্যবহার হবে</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                ঢাকা সিটির ভেতরে ডেলিভারি চার্জ (টাকা)
              </label>
              <input
                type="number"
                value={form.delivery_inside_dhaka}
                onChange={(e) => setForm({ ...form, delivery_inside_dhaka: Number(e.target.value) })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                ঢাকার ভেতরে ডেলিভারি সময়সীমা
              </label>
              <input
                type="text"
                value={form.delivery_time_dhaka}
                onChange={(e) => setForm({ ...form, delivery_time_dhaka: e.target.value })}
                placeholder="যেমন: ২৪ থেকে ৪৮ ঘণ্টার মধ্যে"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                ঢাকার বাইরে সারা বাংলাদেশে ডেলিভারি চার্জ (টাকা)
              </label>
              <input
                type="number"
                value={form.delivery_outside_dhaka}
                onChange={(e) => setForm({ ...form, delivery_outside_dhaka: Number(e.target.value) })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                ঢাকার বাইরে ডেলিভারি সময়সীমা
              </label>
              <input
                type="text"
                value={form.delivery_time_outside}
                onChange={(e) => setForm({ ...form, delivery_time_outside: e.target.value })}
                placeholder="যেমন: ২ থেকে ৪ কার্যদিবস"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Return & Exchange Policy */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">৩. রিটার্ন, সাইজ এক্সচেঞ্জ ও শপ রুলস</h2>
              <p className="text-xs text-slate-500">কাস্টমার যখন জানতে চাইবে পণ্য পছন্দ না হলে বা সাইজ না মিললে কী হবে</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              রিটার্ন ও এক্সচেঞ্জ পলিসি
            </label>
            <textarea
              rows={3}
              value={form.return_policy}
              onChange={(e) => setForm({ ...form, return_policy: e.target.value })}
              placeholder="যেমন: ডেলিভারি ম্যান থাকা অবস্থায় পার্সেল খুলে চেক করে নিতে পারবেন..."
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              অন্যান্য বিশেষ নিয়ম বা পেমেন্ট শর্ত (Custom Store Rules)
            </label>
            <textarea
              rows={2}
              value={form.custom_rules}
              onChange={(e) => setForm({ ...form, custom_rules: e.target.value })}
              placeholder="যেমন: অগ্রিম কোনো টাকা দিতে হবে না, সম্পূর্ণ ক্যাশ অন ডেলিভারি..."
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Section 4: AI Tone of Voice */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">৪. এআই-এর কথা বলার ধরণ (Tone of Voice)</h2>
              <p className="text-xs text-slate-500">আপনার ব্র্যান্ড অনুযায়ী এআই যেভাবে গ্রাহকদের সাথে চ্যাট করবে</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              কথোপকথনের স্টাইল
            </label>
            <select
              value={form.ai_tone}
              onChange={(e) => setForm({ ...form, ai_tone: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="friendly">নম্র ও আন্তরিক (ভাইয়া/আপু সম্বোধন — সেলস রূপান্তরের জন্য সেরা)</option>
              <option value="formal">মার্জিত ও পেশাদার (শ্রদ্ধেয় কাস্টমার / আপনি সম্বোধন)</option>
              <option value="casual">ক্যাজুয়াল ও দ্রুত রিপ্লাই (শর্ট ও ফ্রেন্ডলি)</option>
            </select>
          </div>
        </div>

        {/* Submit Save Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold text-xs text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/25 active:scale-[0.99] transition-all disabled:opacity-50"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>শপ নলেজ সেভ করুন</span>
          </button>
        </div>

      </form>

    </div>
  );
}
