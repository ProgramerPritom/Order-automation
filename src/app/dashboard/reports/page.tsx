'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Calendar,
  TrendingUp,
  ShoppingBag,
  Share2,
  Printer,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';

interface ReportOrder {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  product: string;
  total_amount: number;
  delivery_fee: number;
  channel: string;
  status: string;
  date: string;
}

export default function ReportsPage() {
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'last_month'>('month');

  const allOrders: Record<string, ReportOrder[]> = {
    today: [
      {
        id: '1',
        order_number: 'AS-8942',
        customer_name: 'সোহেল রানা',
        customer_phone: '01712-345678',
        delivery_address: 'ধানমন্ডি, ঢাকা',
        product: 'প্রিমিয়াম ব্ল্যাক পাঞ্জাবি (L)',
        total_amount: 2230,
        delivery_fee: 80,
        channel: 'Facebook Messenger',
        status: 'confirmed',
        date: '2026-09-06 03:15 AM',
      },
      {
        id: '2',
        order_number: 'AS-8941',
        customer_name: 'তানজিনা আক্তার',
        customer_phone: '01819-887766',
        delivery_address: 'জিইসি মোড়, চট্টগ্রাম',
        product: 'জর্জেট কুর্তি (M)',
        total_amount: 1650,
        delivery_fee: 150,
        channel: 'WhatsApp Business',
        status: 'pending',
        date: '2026-09-06 02:40 AM',
      },
      {
        id: '3',
        order_number: 'AS-8940',
        customer_name: 'রাকিবুল ইসলাম',
        customer_phone: '01922-334455',
        delivery_address: 'উত্তরা সেক্টর ৪, ঢাকা',
        product: 'ক্যাজুয়াল পোলো টি-শার্ট (L) x ২',
        total_amount: 1860,
        delivery_fee: 80,
        channel: 'Instagram Direct',
        status: 'confirmed',
        date: '2026-09-06 01:10 AM',
      },
    ],
    week: [
      {
        id: '1',
        order_number: 'AS-8942',
        customer_name: 'সোহেল রানা',
        customer_phone: '01712-345678',
        delivery_address: 'ধানমন্ডি, ঢাকা',
        product: 'প্রিমিয়াম ব্ল্যাক পাঞ্জাবি (L)',
        total_amount: 2230,
        delivery_fee: 80,
        channel: 'Facebook Messenger',
        status: 'confirmed',
        date: '2026-09-06',
      },
      {
        id: '2',
        order_number: 'AS-8941',
        customer_name: 'তানজিনা আক্তার',
        customer_phone: '01819-887766',
        delivery_address: 'চট্টগ্রাম',
        product: 'জর্জেট কুর্তি (M)',
        total_amount: 1650,
        delivery_fee: 150,
        channel: 'WhatsApp Business',
        status: 'confirmed',
        date: '2026-09-05',
      },
      {
        id: '3',
        order_number: 'AS-8939',
        customer_name: 'নাজমুল করিম',
        customer_phone: '01755-112233',
        delivery_address: 'মিরপুর ১০, ঢাকা',
        product: 'সিল্ক পাঞ্জাবি (XL)',
        total_amount: 2750,
        delivery_fee: 80,
        channel: 'Facebook Messenger',
        status: 'shipped',
        date: '2026-09-04',
      },
      {
        id: '4',
        order_number: 'AS-8938',
        customer_name: 'ফারহানা আহমেদ',
        customer_phone: '01611-445566',
        delivery_address: 'গুলশান ২, ঢাকা',
        product: 'জামদানি শাড়ি (ব্লু)',
        total_amount: 4930,
        delivery_fee: 80,
        channel: 'Instagram Direct',
        status: 'delivered',
        date: '2026-09-03',
      },
      {
        id: '5',
        order_number: 'AS-8937',
        customer_name: 'আরিফুল হক',
        customer_phone: '01912-778899',
        delivery_address: 'সিলেট সদর',
        product: 'পোলো টি-শার্ট x ৩',
        total_amount: 2820,
        delivery_fee: 150,
        channel: 'WhatsApp Business',
        status: 'delivered',
        date: '2026-09-02',
      },
    ],
    month: [
      {
        id: '1',
        order_number: 'AS-8942',
        customer_name: 'সোহেল রানা',
        customer_phone: '01712-345678',
        delivery_address: 'ধানমন্ডি, ঢাকা',
        product: 'প্রিমিয়াম ব্ল্যাক পাঞ্জাবি (L)',
        total_amount: 2230,
        delivery_fee: 80,
        channel: 'Facebook Messenger',
        status: 'confirmed',
        date: '2026-09-06',
      },
      {
        id: '2',
        order_number: 'AS-8941',
        customer_name: 'তানজিনা আক্তার',
        customer_phone: '01819-887766',
        delivery_address: 'চট্টগ্রাম',
        product: 'জর্জেট কুর্তি (M)',
        total_amount: 1650,
        delivery_fee: 150,
        channel: 'WhatsApp Business',
        status: 'confirmed',
        date: '2026-09-05',
      },
      {
        id: '3',
        order_number: 'AS-8939',
        customer_name: 'নাজমুল করিম',
        customer_phone: '01755-112233',
        delivery_address: 'মিরপুর ১০, ঢাকা',
        product: 'সিল্ক পাঞ্জাবি (XL)',
        total_amount: 2750,
        delivery_fee: 80,
        channel: 'Facebook Messenger',
        status: 'shipped',
        date: '2026-09-04',
      },
      {
        id: '4',
        order_number: 'AS-8938',
        customer_name: 'ফারহানা আহমেদ',
        customer_phone: '01611-445566',
        delivery_address: 'গুলশান ২, ঢাকা',
        product: 'জামদানি শাড়ি (ব্লু)',
        total_amount: 4930,
        delivery_fee: 80,
        channel: 'Instagram Direct',
        status: 'delivered',
        date: '2026-09-03',
      },
      {
        id: '5',
        order_number: 'AS-8937',
        customer_name: 'আরিফুল হক',
        customer_phone: '01912-778899',
        delivery_address: 'সিলেট সদর',
        product: 'পোলো টি-শার্ট x ৩',
        total_amount: 2820,
        delivery_fee: 150,
        channel: 'WhatsApp Business',
        status: 'delivered',
        date: '2026-09-02',
      },
      {
        id: '6',
        order_number: 'AS-8936',
        customer_name: 'ইমরান খান',
        customer_phone: '01833-221100',
        delivery_address: 'রাজশাহী',
        product: 'কটন পাঞ্জাবি (M)',
        total_amount: 1950,
        delivery_fee: 150,
        channel: 'Facebook Messenger',
        status: 'delivered',
        date: '2026-09-01',
      },
    ],
    last_month: [
      {
        id: '10',
        order_number: 'AS-8812',
        customer_name: 'শফিকুর রহমান',
        customer_phone: '01711-001122',
        delivery_address: 'ঢাকা',
        product: 'পাঞ্জাবি x ২',
        total_amount: 4380,
        delivery_fee: 80,
        channel: 'Facebook Messenger',
        status: 'delivered',
        date: '2026-08-30',
      },
      {
        id: '11',
        order_number: 'AS-8811',
        customer_name: 'মমতাজ বেগম',
        customer_phone: '01822-334455',
        delivery_address: 'খুলনা',
        product: 'সিল্ক শাড়ি',
        total_amount: 5250,
        delivery_fee: 150,
        channel: 'WhatsApp Business',
        status: 'delivered',
        date: '2026-08-28',
      },
    ],
  };

  const currentOrders = allOrders[period] || allOrders.today;

  // Calculate Metrics
  const totalRevenue = currentOrders.reduce((sum, o) => sum + o.total_amount, 0);
  const totalOrders = currentOrders.length;
  const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
  const confirmedCount = currentOrders.filter((o) => o.status !== 'cancelled').length;
  const confirmationRate = totalOrders > 0 ? Math.round((confirmedCount / totalOrders) * 100) : 100;

  // CSV Export Handler
  const handleExportCSV = () => {
    const headers = [
      'Order Number',
      'Customer Name',
      'Phone',
      'Address',
      'Product',
      'Delivery Fee (BDT)',
      'Total Amount (BDT)',
      'Channel',
      'Status',
      'Date',
    ];

    const rows = currentOrders.map((o) => [
      o.order_number,
      `"${o.customer_name}"`,
      o.customer_phone,
      `"${o.delivery_address}"`,
      `"${o.product}"`,
      o.delivery_fee,
      o.total_amount,
      `"${o.channel}"`,
      o.status,
      o.date,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Sales_Report_${period.toUpperCase()}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Executive Business Analytics</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900">দৈনিক ও মাসিক সেলস রিপোর্ট</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            অটোমেটেড সেলস রিপোর্ট বিশ্লেষণ করুন এবং ১ ক্লিকে Excel/CSV বা PDF ফরম্যাটে ডাউনলোড করুন
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 shadow-sm"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>প্রিন্ট সামারি</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>রিপোর্ট ডাউনলোড করুন (CSV)</span>
          </button>
        </div>
      </div>

      {/* Period Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200">
        <button
          onClick={() => setPeriod('today')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            period === 'today'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          📅 আজকের রিপোর্ট (Daily)
        </button>
        <button
          onClick={() => setPeriod('week')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            period === 'week'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          গত ৭ দিন (Weekly)
        </button>
        <button
          onClick={() => setPeriod('month')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            period === 'month'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          📊 চলতি মাস (Monthly)
        </button>
        <button
          onClick={() => setPeriod('last_month')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            period === 'last_month'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          গত মাস (Last Month)
        </button>
      </div>

      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">মোট অর্ডারের মূল্য</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <p className="mt-4 text-3xl font-black text-slate-900">৳ {totalRevenue.toLocaleString()}</p>
          <p className="mt-1 text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>অটোমেটিক এআই কালেকশন</span>
          </p>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">মোট অর্ডার সংখ্যা</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
          <p className="mt-4 text-3xl font-black text-slate-900">{totalOrders} টি</p>
          <p className="mt-1 text-[11px] text-slate-500">সম্পূর্ণ ডেলিভারি-রেডি</p>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">গড় অর্ডারের মান (AOV)</span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
          <p className="mt-4 text-3xl font-black text-slate-900">৳ {avgOrderValue.toLocaleString()}</p>
          <p className="mt-1 text-[11px] text-purple-600 font-semibold">প্রতি কাস্টমারে গড় বিক্রয়</p>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">অর্ডার কনফার্মেশন রেট</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <p className="mt-4 text-3xl font-black text-slate-900">{confirmationRate}%</p>
          <p className="mt-1 text-[11px] text-emerald-600 font-semibold">ভ্যালিড ফোন নম্বরসহ নিশ্চিত</p>
        </div>

      </div>

      {/* Orders Breakdown Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-base text-slate-900">
              নির্বাচিত সময়ের বিস্তারিত সেলস শিট ({period.toUpperCase()})
            </h3>
            <p className="text-xs text-slate-500">ইনভয়েস নম্বর, গ্রাহকের বিবরণ ও চ্যানেল ভিত্তিক বিক্রয় তথ্য</p>
          </div>
          <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
            মোট রেকর্ড: {currentOrders.length} টি
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3.5 px-6">অর্ডার নং</th>
                <th className="py-3.5 px-6">তারিখ ও সময়</th>
                <th className="py-3.5 px-6">গ্রাহকের নাম ও ফোন</th>
                <th className="py-3.5 px-6">ঠিকানা</th>
                <th className="py-3.5 px-6">পণ্য</th>
                <th className="py-3.5 px-6">চ্যানেল</th>
                <th className="py-3.5 px-6">মোট বিল</th>
                <th className="py-3.5 px-6">স্ট্যাটাস</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {currentOrders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-4 px-6 font-mono font-bold text-indigo-600">{order.order_number}</td>
                  <td className="py-4 px-6 text-slate-500">{order.date}</td>
                  <td className="py-4 px-6">
                    <p className="font-bold text-slate-900">{order.customer_name}</p>
                    <p className="text-[11px] text-slate-500">{order.customer_phone}</p>
                  </td>
                  <td className="py-4 px-6 max-w-[180px] truncate text-slate-600">{order.delivery_address}</td>
                  <td className="py-4 px-6 font-medium text-slate-800">{order.product}</td>
                  <td className="py-4 px-6">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700">
                      {order.channel}
                    </span>
                  </td>
                  <td className="py-4 px-6 font-black text-slate-900">৳ {order.total_amount.toLocaleString()}</td>
                  <td className="py-4 px-6">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{order.status}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
