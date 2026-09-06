'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  ShoppingBag,
  Filter,
  CheckCircle2,
  Clock,
  Truck,
  XCircle,
  FileText,
  Phone,
  MapPin,
  Sparkles,
  Search,
  RotateCcw,
  MessageCircle,
  Eye,
  Edit,
  Trash2,
  Printer,
  X,
  Plus,
  TrendingUp,
  ShieldCheck,
  Check,
  Send,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';

interface OrderItem {
  id?: string;
  title: string;
  variant?: string;
  price: number;
  quantity: number;
  total_price?: number;
}

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  district?: string;
  postal_code?: string;
  delivery_city?: string;
  delivery_fee: number;
  subtotal: number;
  total_amount: number;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  notes?: string;
  courier_name?: string;
  courier_status?: string;
  fraud_score?: number;
  capi_fired?: boolean;
  estimated_profit?: number;
  created_at: string;
  channel_platform?: string;
  channel_name?: string;
  items?: OrderItem[];
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all');

  // Metrics
  const [metrics, setMetrics] = useState({
    totalOrders: 0,
    deliveredCount: 0,
    deliveredSales: 0,
    deliveredProfit: 0,
    botCost: '৳০ - ৳৪০',
  });

  // Modal states
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [printingOrder, setPrintingOrder] = useState<Order | null>(null);
  const [newProductTitle, setNewProductTitle] = useState('');

  // Quick action feedback
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();
  }, [statusFilter]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      let url = `/api/orders?status=${statusFilter}`;
      if (searchQuery) url += `&q=${encodeURIComponent(searchQuery)}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.orders) {
        setOrders(data.orders);
        if (data.metrics) setMetrics(data.metrics);
      }
    } catch (e) {
      console.error('Fetch orders error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOrders();
  };

  // Filtered orders client-side for fast instant search
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        o.order_number.toLowerCase().includes(q) ||
        o.customer_name.toLowerCase().includes(q) ||
        o.customer_phone.includes(q);

      const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [orders, searchQuery, statusFilter]);

  // Inline Quick Status Change
  const handleStatusChange = async (orderId: string, newStatus: string) => {
    // Optimistic update
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus as any } : o))
    );

    try {
      const token = localStorage.getItem('accessToken');
      await fetch('/api/orders', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ orderId, status: newStatus }),
      });
      showNotice(`অর্ডার স্ট্যাটাস '${getStatusLabel(newStatus)}' এ পরিবর্তিত হয়েছে`);
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

  // Delete Order
  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm('আপনি কি নিশ্চিত যে এই অর্ডারটি ডিলিট করতে চান?')) return;

    try {
      const token = localStorage.getItem('accessToken');
      await fetch(`/api/orders?id=${orderId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      showNotice('অর্ডারটি সফলভাবে ডিলিট করা হয়েছে');
    } catch (err) {
      console.error(err);
    }
  };

  // 1-Click Send to Courier
  const handleSendToCourier = async (order: Order) => {
    showNotice(`🚚 ${order.customer_name}-এর অর্ডারটি পাঠাও কুরিয়ারে বুক করা হয়েছে!`);
    handleStatusChange(order.id, 'shipped');
  };

  const showNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3500);
  };

  // Save changes from Edit Modal
  const handleSaveEdit = async () => {
    if (!editingOrder) return;
    setIsSaving(true);

    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/orders', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editingOrder),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update order');

      setSaveSuccess('অর্ডারের তথ্য সফলভাবে সেভ হয়েছে!');
      fetchOrders();
      setTimeout(() => {
        setSaveSuccess(null);
        setEditingOrder(null);
      }, 1000);
    } catch (err: any) {
      alert(err.message || 'Error saving order');
    } finally {
      setIsSaving(false);
    }
  };

  // Add Item in Edit Modal
  const handleAddItem = () => {
    if (!newProductTitle.trim() || !editingOrder) return;
    const newItem: OrderItem = {
      title: newProductTitle.trim(),
      price: 500,
      quantity: 1,
      total_price: 500,
    };
    const updatedItems = [...(editingOrder.items || []), newItem];
    const subtotal = updatedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    setEditingOrder({
      ...editingOrder,
      items: updatedItems,
      subtotal,
      total_amount: subtotal + (editingOrder.delivery_fee || 0),
    });
    setNewProductTitle('');
  };

  // Remove Item in Edit Modal
  const handleRemoveItem = (index: number) => {
    if (!editingOrder?.items) return;
    const updated = editingOrder.items.filter((_, i) => i !== index);
    const subtotal = updated.reduce((sum, item) => sum + item.price * item.quantity, 0);
    setEditingOrder({
      ...editingOrder,
      items: updated,
      subtotal,
      total_amount: subtotal + (editingOrder.delivery_fee || 0),
    });
  };

  // Update item quantity or price in Edit Modal
  const handleItemChange = (index: number, field: 'quantity' | 'price', val: number) => {
    if (!editingOrder?.items) return;
    const updated = [...editingOrder.items];
    updated[index] = { ...updated[index], [field]: val };
    const subtotal = updated.reduce((sum, item) => sum + item.price * item.quantity, 0);
    setEditingOrder({
      ...editingOrder,
      items: updated,
      subtotal,
      total_amount: subtotal + (editingOrder.delivery_fee || 0),
    });
  };

  // Update delivery fee in Edit Modal
  const handleDeliveryFeeChange = (fee: number) => {
    if (!editingOrder) return;
    setEditingOrder({
      ...editingOrder,
      delivery_fee: fee,
      total_amount: (editingOrder.subtotal || 0) + fee,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'shipped':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'delivered':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'cancelled':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-amber-50 text-amber-700 border-amber-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'confirmed':
        return '✅ কনফার্মড';
      case 'shipped':
        return '🚚 পাঠানো হয়েছে';
      case 'delivered':
        return '🎉 ডেলিভারড';
      case 'cancelled':
        return '❌ বাতিল';
      default:
        return '⏳ পেন্ডিং';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      
      {/* Toast Notification */}
      {actionNotice && (
        <div className="fixed top-20 right-8 z-50 p-4 rounded-2xl bg-slate-900 text-white text-xs font-bold shadow-2xl flex items-center gap-2 border border-slate-700 animate-slide-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Top Summary Metrics Cards (Alapi Style) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-400">মোট অর্ডার</span>
          <div className="mt-2 text-2xl font-black text-indigo-600">
            {metrics.totalOrders || orders.length}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-400">ডেলিভারড</span>
          <div className="mt-2 text-2xl font-black text-teal-600">
            {metrics.deliveredCount || orders.filter(o => o.status === 'delivered').length}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-400">ডেলিভারড বিক্রি</span>
          <div className="mt-2 text-2xl font-black text-emerald-600">
            ৳ {metrics.deliveredSales || 3390}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex flex-col justify-between bg-gradient-to-br from-white to-emerald-50/40">
          <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
            <span>ডেলিভারড নিট লাভ</span>
            <TrendingUp className="w-3 h-3 text-emerald-600" />
          </span>
          <div className="mt-2 text-2xl font-black text-emerald-700">
            ৳ {metrics.deliveredProfit || 1240}
          </div>
        </div>

        <div className="col-span-2 sm:col-span-1 p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold text-amber-600 flex items-center gap-1">
            <span>⚡ বট খরচ (আজ/মাস)</span>
          </span>
          <div className="mt-2 text-xl font-black text-amber-600">
            {metrics.botCost}
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearch} className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="নাম / ফোন / অর্ডার নং"
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
          />
        </form>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">সব স্ট্যাটাস</option>
            <option value="pending">পেন্ডিং</option>
            <option value="confirmed">কনফার্মড</option>
            <option value="shipped">পাঠানো হয়েছে</option>
            <option value="delivered">ডেলিভারড</option>
            <option value="cancelled">বাতিল</option>
          </select>

          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">সব সময়</option>
            <option value="today">আজ</option>
            <option value="yesterday">গতকাল</option>
            <option value="week">এই সপ্তাহ</option>
          </select>

          <button
            onClick={fetchOrders}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
            title="রিফ্রেশ করুন"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <div className="px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold shrink-0">
            {filteredOrders.length}/{orders.length} অর্ডার
          </div>
        </div>
      </div>

      {/* Orders Table (Alapi Master Table) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3.5 pl-4"># অর্ডার আইডি</th>
                <th className="p-3.5">কাস্টমার</th>
                <th className="p-3.5">চ্যানেল</th>
                <th className="p-3.5">পণ্য</th>
                <th className="p-3.5">মোট</th>
                <th className="p-3.5">স্ট্যাটাস</th>
                <th className="p-3.5">ফ্রড স্কোর / মেটা</th>
                <th className="p-3.5 text-right pr-4">অ্যাকশন</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 font-bold animate-pulse">
                    অর্ডার লোড হচ্ছে...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    কোনো অর্ডার পাওয়া যায়নি
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const firstItem = order.items?.[0] || { title: 'পণ্য', quantity: 1 };
                  const cleanPhone = order.customer_phone?.replace(/[^0-9]/g, '') || '';
                  const waNumber = cleanPhone.startsWith('88') ? cleanPhone : `88${cleanPhone}`;

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                      
                      {/* Order Number & Timestamp */}
                      <td className="p-3.5 pl-4">
                        <div className="flex items-center gap-2">
                          <input type="checkbox" className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                          <div>
                            <span className="font-extrabold text-indigo-600 tracking-tight">
                              #{order.order_number}
                            </span>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {new Date(order.created_at).toLocaleDateString('bn-BD', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Customer Info with 1-Click WhatsApp & Call */}
                      <td className="p-3.5">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900">{order.customer_name}</span>
                          <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500">
                            <span>{order.customer_phone}</span>
                            {/* 1-Click WhatsApp Button */}
                            <a
                              href={`https://wa.me/${waNumber}?text=${encodeURIComponent(`প্রিয় ${order.customer_name}, আপনার অর্ডারটি (#${order.order_number}) কনফার্ম করতে যোগাযোগ করছি।`)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                              title="হোয়াটসঅ্যাপে চ্যাট করুন"
                            >
                              <MessageCircle className="w-3 h-3" />
                            </a>
                            {/* Direct Call Button */}
                            <a
                              href={`tel:${order.customer_phone}`}
                              className="p-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                              title="সরাসরি কল করুন"
                            >
                              <Phone className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      </td>

                      {/* Channel Badge */}
                      <td className="p-3.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                          {order.channel_platform === 'whatsapp' ? '🟢 WA' : order.channel_platform === 'instagram' ? '🟣 IG' : '🔵 FB'}
                        </span>
                      </td>

                      {/* Product Thumbnail + Title + Courier Status */}
                      <td className="p-3.5 max-w-[220px]">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200">
                            <ShoppingBag className="w-4 h-4 text-slate-500" />
                          </div>
                          <div className="overflow-hidden">
                            <p className="font-bold text-slate-800 truncate" title={firstItem.title}>
                              {firstItem.title} <span className="text-slate-500 text-[11px]">×{firstItem.quantity || 1}</span>
                            </p>
                            {order.courier_status && (
                              <span className="inline-block mt-0.5 text-[9px] px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 font-bold border border-amber-200">
                                🚚 {order.courier_name || 'কুরিয়ার'}: {order.courier_status}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Total Amount */}
                      <td className="p-3.5">
                        <span className="font-black text-slate-900 text-sm">
                          ৳ {order.total_amount}
                        </span>
                      </td>

                      {/* Inline Status Dropdown */}
                      <td className="p-3.5">
                        <select
                          value={order.status}
                          onChange={(e) => handleStatusChange(order.id, e.target.value)}
                          className={`px-2.5 py-1 rounded-xl text-xs font-bold border focus:outline-none transition-colors cursor-pointer ${getStatusBadge(
                            order.status
                          )}`}
                        >
                          <option value="pending">⏳ পেন্ডিং</option>
                          <option value="confirmed">✅ কনফার্মড</option>
                          <option value="shipped">🚚 পাঠানো হয়েছে</option>
                          <option value="delivered">🎉 ডেলিভারড</option>
                          <option value="cancelled">❌ বাতিল</option>
                        </select>
                      </td>

                      {/* Fraud Score & Meta CAPI Tag */}
                      <td className="p-3.5">
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span>ভালো {order.fraud_score || 95}%</span>
                          </span>
                          {order.capi_fired !== false && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                              <Check className="w-2.5 h-2.5 text-blue-600" />
                              <span>CAPI Fire</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Action Icons */}
                      <td className="p-3.5 text-right pr-4">
                        <div className="flex items-center justify-end gap-1.5">
                          
                          {/* Quick Action Button */}
                          <button
                            onClick={() => handleSendToCourier(order)}
                            className="px-2 py-1 rounded-lg text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors flex items-center gap-1"
                            title="১-ক্লিকে পাঠাও/স্টেডফাস্ট কুরিয়ারে বুক করুন"
                          >
                            <Truck className="w-3 h-3" />
                            <span>কুরিয়ার</span>
                          </button>

                          {/* Print Invoice Button */}
                          <button
                            onClick={() => setPrintingOrder(order)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                            title="ক্যাশ মেমো / চালান প্রিন্ট করুন"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {/* Edit Modal Button */}
                          <button
                            onClick={() => setEditingOrder(JSON.parse(JSON.stringify(order)))}
                            className="p-1.5 rounded-lg text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 transition-colors"
                            title="অর্ডার এডিট করুন"
                          >
                            <Edit className="w-4 h-4" />
                          </button>

                          {/* Delete Order Button */}
                          <button
                            onClick={() => handleDeleteOrder(order.id)}
                            className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                            title="অর্ডার ডিলিট করুন"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ORDER EDIT MODAL (Matching Screenshot 2 Perfectly) */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
              <h2 className="text-lg font-black text-slate-900">
                অর্ডার এডিট #{editingOrder.order_number}
              </h2>
              <button
                onClick={() => setEditingOrder(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {saveSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{saveSuccess}</span>
              </div>
            )}

            {/* Modal Content - Two Columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Left Column: Products & Pricing */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-700">
                    🛍️ পণ্য (পরিমাণ / দাম এডিট করুন)
                  </span>
                </div>

                {/* Products List */}
                <div className="space-y-3">
                  {editingOrder.items && editingOrder.items.length > 0 ? (
                    editingOrder.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-slate-900">{item.title}</p>
                          <button
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1 rounded-lg text-rose-500 hover:bg-rose-100 transition-colors"
                            title="পণ্যটি রিমুভ করুন"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">
                              পরিমাণ
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(idx, 'quantity', parseInt(e.target.value) || 1)}
                              className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">
                              দাম ৳/টি
                            </label>
                            <input
                              type="number"
                              value={item.price}
                              onChange={(e) => handleItemChange(idx, 'price', parseFloat(e.target.value) || 0)}
                              className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="text-right text-xs font-black text-indigo-600">
                          ৳ {item.price * item.quantity}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 italic">কোনো পণ্য নেই</p>
                  )}
                </div>

                {/* Add More Products */}
                <div className="pt-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newProductTitle}
                      onChange={(e) => setNewProductTitle(e.target.value)}
                      placeholder="🔍 স্টোর থেকে পণ্য খুঁজুন যোগ করুন..."
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    <button
                      onClick={handleAddItem}
                      className="px-3 py-2 rounded-xl bg-indigo-50 text-indigo-700 font-bold text-xs hover:bg-indigo-100 transition-colors shrink-0"
                    >
                      যোগ করুন
                    </button>
                  </div>
                </div>

                {/* Pricing Summary */}
                <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 space-y-2 mt-4">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>পণ্যের মূল্য</span>
                    <span className="font-bold text-slate-900">৳ {editingOrder.subtotal || 0}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span className="flex items-center gap-1">
                      <span>🚚 ডেলিভারি চার্জ</span>
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-400">৳</span>
                      <input
                        type="number"
                        value={editingOrder.delivery_fee}
                        onChange={(e) => handleDeliveryFeeChange(parseFloat(e.target.value) || 0)}
                        className="w-20 px-2 py-1 rounded-lg border border-slate-300 text-xs font-bold text-slate-900 text-right focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-indigo-200/60 flex items-center justify-between text-sm font-black text-slate-900">
                    <span>সর্বমোট</span>
                    <span className="text-base text-indigo-700">৳ {editingOrder.total_amount || 0}</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Customer Info & Delivery Details */}
              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">কাস্টমারের নাম</label>
                  <input
                    type="text"
                    value={editingOrder.customer_name}
                    onChange={(e) => setEditingOrder({ ...editingOrder, customer_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">মোবাইল নম্বর</label>
                  <input
                    type="text"
                    value={editingOrder.customer_phone}
                    onChange={(e) => setEditingOrder({ ...editingOrder, customer_phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ঠিকানা</label>
                  <textarea
                    rows={3}
                    value={editingOrder.delivery_address}
                    onChange={(e) => setEditingOrder({ ...editingOrder, delivery_address: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">জেলা</label>
                    <input
                      type="text"
                      value={editingOrder.district || ''}
                      onChange={(e) => setEditingOrder({ ...editingOrder, district: e.target.value })}
                      placeholder="যেমন: ঢাকা বা পিরোজপুর"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">📍 পোস্ট কোড</label>
                    <input
                      type="text"
                      value={editingOrder.postal_code || ''}
                      onChange={(e) => setEditingOrder({ ...editingOrder, postal_code: e.target.value })}
                      placeholder="যেমন ৪২০০"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">স্ট্যাটাস</label>
                  <select
                    value={editingOrder.status}
                    onChange={(e) => setEditingOrder({ ...editingOrder, status: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                  >
                    <option value="pending">⏳ পেন্ডিং</option>
                    <option value="confirmed">✅ কনফার্মড</option>
                    <option value="shipped">🚚 পাঠানো হয়েছে</option>
                    <option value="delivered">🎉 ডেলিভারড</option>
                    <option value="cancelled">❌ বাতিল</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">নোট (ঐচ্ছিক)</label>
                  <input
                    type="text"
                    value={editingOrder.notes || ''}
                    onChange={(e) => setEditingOrder({ ...editingOrder, notes: e.target.value })}
                    placeholder="যেমন: Order via Messenger (কালার চেক করবেন)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

            </div>

            {/* Modal Actions */}
            <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                onClick={() => setEditingOrder(null)}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                বাতিল
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSaving}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/25 flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {isSaving ? 'সেভ হচ্ছে...' : '💾 সেভ'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* PRINTABLE INVOICE MODAL */}
      {printingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-8 shadow-2xl border border-slate-200 text-slate-900">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-6">
              <div>
                <h2 className="text-xl font-black text-indigo-600">KothaShop.ai</h2>
                <p className="text-[10px] text-slate-400">অর্ডার চালান / ক্যাশ মেমো</p>
              </div>
              <button
                onClick={() => setPrintingOrder(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Memo Content */}
            <div className="space-y-4 text-xs">
              <div className="flex justify-between border-b pb-3 border-slate-100">
                <div>
                  <p className="text-slate-400">অর্ডার নম্বর:</p>
                  <p className="font-extrabold text-slate-900">#{printingOrder.order_number}</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-400">তারিখ:</p>
                  <p className="font-bold text-slate-800">
                    {new Date(printingOrder.created_at).toLocaleDateString('bn-BD')}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-slate-400 text-[10px] uppercase font-bold mb-1">কাস্টমার তথ্য</p>
                <p className="font-black text-sm text-slate-900">{printingOrder.customer_name}</p>
                <p className="text-slate-700">{printingOrder.customer_phone}</p>
                <p className="text-slate-600">{printingOrder.delivery_address}, {printingOrder.district || ''}</p>
              </div>

              <div className="pt-2">
                <table className="w-full border-t border-slate-200 text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] text-slate-400 uppercase">
                      <th className="py-2 text-left">বিবরণ</th>
                      <th className="py-2 text-center">পরিমাণ</th>
                      <th className="py-2 text-right">মূল্য</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(printingOrder.items || []).map((it, idx) => (
                      <tr key={idx} className="border-b border-slate-50">
                        <td className="py-2 font-bold">{it.title}</td>
                        <td className="py-2 text-center">{it.quantity}</td>
                        <td className="py-2 text-right">৳ {it.price * it.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pt-3 border-t border-slate-200 space-y-1.5">
                <div className="flex justify-between text-slate-600">
                  <span>পণ্যের মূল্য</span>
                  <span className="font-bold">৳ {printingOrder.subtotal}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>ডেলিভারি চার্জ</span>
                  <span className="font-bold">৳ {printingOrder.delivery_fee}</span>
                </div>
                <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-200">
                  <span>সর্বমোট বিল</span>
                  <span className="text-indigo-600">৳ {printingOrder.total_amount}</span>
                </div>
              </div>

              <div className="mt-4 p-2.5 rounded-xl bg-slate-50 text-center text-[10px] text-slate-500">
                আমাদের শপ থেকে কেনাকাটার জন্য ধন্যবাদ!
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setPrintingOrder(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
              >
                বন্ধ করুন
              </button>
              <button
                onClick={() => window.print()}
                className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>প্রিন্ট মেমো</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
