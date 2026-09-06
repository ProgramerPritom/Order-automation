'use client';

import React, { useState, useEffect } from 'react';
import PaginationControl from '@/components/ui/PaginationControl';
import { getSessionToken } from '@/lib/session';
import {
  Package,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Tag,
  Layers,
  Trash2,
} from 'lucide-react';

interface Product {
  id: string;
  title: string;
  description: string;
  category: string;
  price: number;
  stock: number;
  sku: string;
  image_url: string;
  is_active: boolean;
  has_vector: boolean;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Panjabi');
  const [price, setPrice] = useState('2150');
  const [stock, setStock] = useState('25');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 15;

  useEffect(() => {
    fetchProducts(null, 1);
  }, []);

  const fetchProducts = async (cursorParam?: string | null, targetPage: number = 1) => {
    setLoading(true);
    try {
      const token = getSessionToken();
      let url = `/api/products?limit=${pageSize}`;
      if (search) url += `&q=${encodeURIComponent(search)}`;
      if (cursorParam) url += `&cursor=${encodeURIComponent(cursorParam)}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.products) {
        setProducts(data.products);
        if (data.pagination) {
          setNextCursor(data.pagination.nextCursor);
          setHasMore(data.pagination.hasMore);
          setTotalCount(data.pagination.totalCount || 0);
        }
        setCurrentPage(targetPage);
      } else {
        setProducts([]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleNextPage = () => {
    if (!nextCursor || loading) return;
    setCursorStack((prev) => [...prev, nextCursor]);
    fetchProducts(nextCursor, currentPage + 1);
  };

  const handlePrevPage = () => {
    if (currentPage <= 1 || loading) return;
    const prevCursor = cursorStack[currentPage - 2] || null;
    setCursorStack((prev) => prev.slice(0, currentPage - 1));
    fetchProducts(prevCursor, currentPage - 1);
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          category,
          price,
          stock,
          description,
        }),
      });
      const data = await res.json();
      if (res.ok && data.product) {
        setProducts((prev) => [{ ...data.product, has_vector: true }, ...prev]);
        setModalOpen(false);
        setTitle('');
        setDescription('');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('আপনি কি নিশ্চিত যে এই পণ্যটি মুছে ফেলতে চান? এটি এআই ক্যাটালগ ও ক্যাশ থেকেও মুছে যাবে।')) {
      return;
    }
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/products?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setProducts((prev) => prev.filter((p) => p.id !== id));
      }
    } catch (e) {
      console.error('Delete product error:', e);
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 w-full">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>RAG Vector Synced Catalog</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900">পণ্য ক্যাটালগ ও ইনভেন্টরি</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            পণ্যের স্টক ও মূল্য আপডেট করুন — এআই স্বয়ংক্রিয়ভাবে RAG ভেক্টরের সাথে সিঙ্ক করে নেবে
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>নতুন পণ্য যুক্ত করুন</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="পণ্য, ক্যাটাগরি বা SKU খুঁজুন..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>মোট পণ্য: <strong className="text-slate-900">{products.length}</strong></span>
          <span>•</span>
          <span>স্টকে আছে: <strong className="text-emerald-600">{products.filter((p) => p.stock > 0).length}</strong></span>
          <span>•</span>
          <span>আউট অব স্টক: <strong className="text-rose-600">{products.filter((p) => p.stock === 0).length}</strong></span>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3.5 px-6">পণ্য</th>
                <th className="py-3.5 px-6">ক্যাটাগরি</th>
                <th className="py-3.5 px-6">SKU কোড</th>
                <th className="py-3.5 px-6">মূল্য</th>
                <th className="py-3.5 px-6">স্টক লেভেল</th>
                <th className="py-3.5 px-6">RAG ভেক্টর স্ট্যাটাস</th>
                <th className="py-3.5 px-6 text-right">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-4 px-6 flex items-center gap-3">
                    <img
                      src={product.image_url}
                      alt={product.title}
                      className="w-11 h-11 rounded-xl object-cover border border-slate-200 shrink-0"
                    />
                    <div>
                      <p className="font-bold text-slate-900 line-clamp-1">{product.title}</p>
                      <p className="text-[11px] text-slate-400 line-clamp-1">{product.description}</p>
                    </div>
                  </td>
                  <td className="py-4 px-6 font-medium text-slate-600">
                    <span className="px-2 py-0.5 rounded bg-slate-100 font-semibold">
                      {product.category}
                    </span>
                  </td>
                  <td className="py-4 px-6 font-mono font-bold text-slate-700">{product.sku}</td>
                  <td className="py-4 px-6 font-black text-slate-900">৳ {product.price.toLocaleString()}</td>
                  <td className="py-4 px-6">
                    {product.stock > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{product.stock} টি স্টকে আছে</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Out of Stock</span>
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-6">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      <span>pgvector Synced</span>
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <button
                      onClick={() => handleDeleteProduct(product.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="পণ্যটি মুছে ফেলুন (ক্যাশ সিঙ্ক হবে)"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {products.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 text-xs">
                    <p className="font-bold text-slate-700 text-sm">কোনো পণ্য পাওয়া যায়নি</p>
                    <p className="text-slate-400 mt-1">উপরে "+ নতুন পণ্য যুক্ত করুন" বাটনে ক্লিক করে পণ্য ক্যাটালগ শুরু করুন।</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Cursor Pagination Controls */}
        <PaginationControl
          currentPage={currentPage}
          pageSize={pageSize}
          totalCount={totalCount}
          hasMore={hasMore}
          onNextPage={handleNextPage}
          onPrevPage={handlePrevPage}
          loading={loading}
          itemLabel="পণ্য"
        />
      </div>

      {/* Add Product Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200">
            <h3 className="text-lg font-black text-slate-900">নতুন পণ্য যুক্ত করুন</h3>
            <p className="text-xs text-slate-500 mt-1">
              পণ্য সেভ হওয়ামাত্রই এআই স্বয়ংক্রিয়ভাবে RAG এম্বেডিং ভেক্টর তৈরি করে নিবে
            </p>

            <form onSubmit={handleCreateProduct} className="mt-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  পণ্যের শিরোনাম (Product Title)
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="যেমন: প্রিমিয়াম সিল্ক শাড়ি"
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-medium text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    ক্যাটাগরি
                  </label>
                  <input
                    type="text"
                    required
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="যেমন: পাঞ্জাবি"
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-medium text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    মূল্য (টাকায়)
                  </label>
                  <input
                    type="number"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="2150"
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-medium text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  স্টক সংখ্যা
                </label>
                <input
                  type="number"
                  required
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  placeholder="20"
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-medium text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  বিবরণ (Description - RAG নলেজবেসের জন্য গুরুত্বপূর্ণ)
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="ফ্যাব্রিক, সাইজ ও কালারের বিস্তারিত বিবরণ লিখুন..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-medium text-slate-900"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                >
                  {submitting ? 'ভেক্টর সিঙ্ক হচ্ছে...' : 'পণ্য সেভ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
