'use client';

import React, { useState, useEffect } from 'react';
import {
  User,
  Store,
  CreditCard,
  Lock,
  Save,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Phone,
  Mail,
  MapPin,
  Clock,
  ShieldCheck,
} from 'lucide-react';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'profile' | 'shop' | 'subscription' | 'security'>('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('');

  // Shop states
  const [shopName, setShopName] = useState('');
  const [businessCategory, setBusinessCategory] = useState('');
  const [supportPhone, setSupportPhone] = useState('');
  const [showroomAddress, setShowroomAddress] = useState('');

  // Subscription data
  const [subData, setSubData] = useState<any>(null);

  // Security states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/tenants/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setName(data.user?.name || '');
        setEmail(data.user?.email || '');
        setPhone(data.user?.phone || '');
        setRole(data.user?.role || 'client');

        setShopName(data.tenant?.name || '');
        setBusinessCategory(data.tenant?.business_category || 'Clothing & Fashion');
        setSupportPhone(data.tenant?.support_phone || '');
        setShowroomAddress(data.tenant?.showroom_address || '');

        setSubData({
          plan: data.tenant?.plan,
          status: data.tenant?.subscription_status,
          trial_ends_at: data.tenant?.trial_ends_at,
          evaluation: data.tenant?.subscription_evaluation,
        });
      } else {
        setErrorMessage(data.error || 'প্রোফাইল লোড করতে ব্যর্থ হয়েছে');
      }
    } catch (e: any) {
      setErrorMessage(e.message || 'নেটওয়ার্ক এরর');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    if (newPassword && newPassword !== confirmPassword) {
      setErrorMessage('নতুন পাসওয়ার্ড এবং কনফার্ম পাসওয়ার্ড মিলছে না!');
      setSaving(false);
      return;
    }

    try {
      const token = localStorage.getItem('accessToken');
      const payload: any = {
        name,
        phone,
        shop_name: shopName,
        business_category: businessCategory,
        support_phone: supportPhone,
        showroom_address: showroomAddress,
      };

      if (newPassword) {
        payload.current_password = currentPassword;
        payload.new_password = newPassword;
      }

      const res = await fetch('/api/tenants/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMessage(data.message || 'সেটিংস সফলভাবে সংরক্ষিত হয়েছে!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        // Update local storage user/tenant info
        const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
        const storedTenant = JSON.parse(localStorage.getItem('tenant') || '{}');
        localStorage.setItem('user', JSON.stringify({ ...storedUser, name, phone }));
        localStorage.setItem('tenant', JSON.stringify({ ...storedTenant, name: shopName }));
      } else {
        setErrorMessage(data.error || 'সংরক্ষণ ব্যর্থ হয়েছে');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'সার্ভার এরর');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-xs font-bold text-slate-500">প্রোফাইল সেটিংস লোড হচ্ছে...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold mb-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Account & Shop Configuration</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900">প্রোফাইল ও অ্যাকাউন্ট সেটিংস</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          আপনার ব্যক্তিগত প্রোফাইল, শপের নাম, পাসওয়ার্ড এবং ৭ দিনের ট্রায়াল স্ট্যাটাস পরিচালনা করুন
        </p>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 shadow-sm animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2 shadow-sm animate-fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="font-semibold">{errorMessage}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('profile')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'profile'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <User className="w-4 h-4" />
          <span>ব্যক্তিগত প্রোফাইল</span>
        </button>

        <button
          onClick={() => setActiveTab('shop')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'shop'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Store className="w-4 h-4" />
          <span>শপ ও শোরুম বিবরণ</span>
        </button>

        <button
          onClick={() => setActiveTab('subscription')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'subscription'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>প্যাকেজ ও ট্রায়াল</span>
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'security'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>সিকিউরিটি ও পাসওয়ার্ড</span>
        </button>
      </div>

      {/* Form Content */}
      <form onSubmit={handleSave}>
        {/* Tab 1: Personal Profile */}
        {activeTab === 'profile' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-6">
            <h3 className="font-extrabold text-sm text-slate-900 border-b border-slate-100 pb-3">
              অ্যাকাউন্ট হোল্ডারের তথ্য
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">আপনার পূর্ণ নাম (Full Name)</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 font-medium text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">মোবাইল নম্বর (Phone)</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 font-medium text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">ইমেইল ঠিকানা (Email)</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    disabled
                    value={email}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-500 cursor-not-allowed"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">লগইন আইডেন্টিফায়ার হিসেবে ব্যবহৃত হয়</p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">অ্যাকাউন্ট রোল (Role)</label>
                <div className="py-2.5 px-3.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-700 capitalize">
                  {role === 'superadmin' ? '👑 Master Super Admin' : '🛍️ Client / Merchant Account'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Shop & Showroom */}
        {activeTab === 'shop' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-6">
            <h3 className="font-extrabold text-sm text-slate-900 border-b border-slate-100 pb-3">
              শপ প্রোফাইল ও কাস্টমার সাপোর্ট
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">শপের ব্র্যান্ডের নাম (Shop Name)</label>
                <div className="relative">
                  <Store className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 font-medium text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">বিজনেস ক্যাটাগরি (Business Category)</label>
                <select
                  value={businessCategory}
                  onChange={(e) => setBusinessCategory(e.target.value)}
                  className="w-full py-2.5 px-3.5 rounded-xl border border-slate-200 font-medium text-slate-900 focus:outline-none focus:border-indigo-600"
                >
                  <option value="Clothing & Fashion">পোশাক ও ফ্যাশন (Clothing & Fashion)</option>
                  <option value="Electronics & Gadgets">ইলেকট্রনিক্স ও গ্যাজেট</option>
                  <option value="Beauty & Cosmetics">সৌন্দর্য ও প্রসাধন (Cosmetics)</option>
                  <option value="Footwear & Shoes">জুতা ও ফুটওয়্যার</option>
                  <option value="Home & Kitchen">গৃহস্থালি ও কিচেন</option>
                  <option value="Organic Food">অর্গানিক ফুড ও গ্রোসারি</option>
                  <option value="Other">অন্যান্য (Other)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">হটলাইন / কাস্টমার সাপোর্ট নম্বর</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={supportPhone}
                    onChange={(e) => setSupportPhone(e.target.value)}
                    placeholder="যেমন: 01700000000"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 font-medium text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">ইনবক্সে এআই কাস্টমারকে এই নম্বর হেল্পলাইন হিসেবে দেবে</p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">শোরুম / দোকানের পূর্ণ ঠিকানা</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={showroomAddress}
                    onChange={(e) => setShowroomAddress(e.target.value)}
                    placeholder="যেমন: শপ নং ৪, লেভেল ৩, বসুন্ধরা সিটি"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 font-medium text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Subscription & 7-Day Trial */}
        {activeTab === 'subscription' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-6">
            <h3 className="font-extrabold text-sm text-slate-900 border-b border-slate-100 pb-3">
              সাবস্ক্রিপশন প্ল্যান ও ট্রায়াল স্ট্যাটাস
            </h3>

            <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-900 to-slate-900 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-bold border border-indigo-500/30 mb-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>৭ দিনের ফ্রি ট্রায়াল পলিসি সক্রিয়</span>
                </div>
                <h4 className="text-xl font-black">
                  {subData?.plan ? `${subData.plan.toUpperCase()} প্যাকেজ` : 'Pro প্যাকেজ'}
                </h4>
                <p className="text-xs text-indigo-200 mt-1">
                  {subData?.evaluation?.message || '৭ দিনের ফ্রি ট্রায়াল সচল রয়েছে'}
                </p>
              </div>

              <div className="text-right sm:border-l sm:border-slate-700 sm:pl-6">
                <span className="text-[10px] uppercase font-bold text-slate-400">অবশিষ্ট মেয়াদ</span>
                <p className="text-3xl font-black text-amber-400">
                  {subData?.evaluation?.daysRemaining ?? 7} দিন
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">রিনিউয়াল প্রয়োজন নেই</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50">
                <p className="text-slate-500 font-semibold">মাসিক অর্ডার সীমা</p>
                <p className="text-base font-extrabold text-slate-900 mt-1">আনলিমিটেড অর্ডার</p>
              </div>
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50">
                <p className="text-slate-500 font-semibold">এআই মেসেজ সাপোর্ট</p>
                <p className="text-base font-extrabold text-emerald-600 mt-1">২৪/৭ সচল</p>
              </div>
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50">
                <p className="text-slate-500 font-semibold">সোশ্যাল চ্যানেল কানেক্ট</p>
                <p className="text-base font-extrabold text-slate-900 mt-1">সর্বোচ্চ ৫টি পেজ</p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Security & Password */}
        {activeTab === 'security' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-6">
            <h3 className="font-extrabold text-sm text-slate-900 border-b border-slate-100 pb-3">
              পাসওয়ার্ড পরিবর্তন করুন
            </h3>

            <div className="max-w-md space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">বর্তমান পাসওয়ার্ড (Current Password)</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="আপনার বর্তমান পাসওয়ার্ড দিন"
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-medium text-slate-900 focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">নতুন পাসওয়ার্ড (New Password)</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="কমপক্ষে ৬ অক্ষরের নতুন পাসওয়ার্ড"
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-medium text-slate-900 focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">নতুন পাসওয়ার্ড নিশ্চিত করুন (Confirm)</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="নতুন পাসওয়ার্ড পুনরায় লিখুন"
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-medium text-slate-900 focus:outline-none focus:border-indigo-600"
                />
              </div>
            </div>
          </div>
        )}

        {/* Bottom Save Action */}
        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 flex items-center gap-2 disabled:opacity-50 transition-all"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'সংরক্ষণ হচ্ছে...' : 'পরিবর্তন সংরক্ষণ করুন'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
