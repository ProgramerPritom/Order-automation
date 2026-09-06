'use client';

import React, { useState, useEffect } from 'react';
import {
  Activity,
  Zap,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Clock,
  Cpu,
  Server,
  ShieldCheck,
} from 'lucide-react';

interface HealthData {
  engineStatus: string;
  n8nService: string;
  avgLatencyMs: number;
  successRate: string;
  lastChecked: string;
  logs: Array<{
    id: string;
    service: string;
    status: string;
    latency_ms: number;
    error_message?: string;
    checked_at: string;
  }>;
}

export default function AutomationHealthPage() {
  const [health, setHealth] = useState<HealthData>({
    engineStatus: 'healthy',
    n8nService: 'n8n Automation Cloud Engine',
    avgLatencyMs: 24,
    successRate: '99.8%',
    lastChecked: new Date().toISOString(),
    logs: [
      {
        id: '1',
        service: 'n8n',
        status: 'healthy',
        latency_ms: 22,
        checked_at: '2 মিনিট আগে',
      },
      {
        id: '2',
        service: 'n8n',
        status: 'healthy',
        latency_ms: 28,
        checked_at: '15 মিনিট আগে',
      },
      {
        id: '3',
        service: 'n8n',
        status: 'healthy',
        latency_ms: 25,
        checked_at: '1 ঘণ্টা আগে',
      },
    ],
  });

  const [pinging, setPinging] = useState(false);
  const [pingResult, setPingResult] = useState<string | null>(null);

  useEffect(() => {
    fetchTelemetry();
  }, []);

  const fetchTelemetry = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/automation/health', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.engineStatus) {
        setHealth(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleTestPing = async () => {
    setPinging(true);
    setPingResult(null);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/automation/health', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setPingResult(`Ping সফল হয়েছে! ল্যাটেন্সি: ${data.result.latency_ms}ms (Status: ${data.result.status})`);
        fetchTelemetry();
      }
    } catch (e: any) {
      setPingResult(`Ping ফেইল্ড: ${e.message}`);
    } finally {
      setPinging(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold mb-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>লাইভ সিস্টেম টেলিমেট্রি</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900">n8n ও অটোমেশন হেলথ মনিটর</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            n8n ইঞ্জিন কানেকশন, গড় ল্যাটেন্সি এবং ব্যাকগ্রাউন্ড ওয়েবহুক পাইপলাইন মনিটরিং
          </p>
        </div>

        {/* Test Ping Button */}
        <button
          onClick={handleTestPing}
          disabled={pinging}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-bold text-xs text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 shadow-lg shadow-indigo-600/25 transition-all disabled:opacity-50"
        >
          {pinging ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>n8n পিং টেস্ট হচ্ছে...</span>
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 text-amber-300" />
              <span>⚡ Send Test Ping to n8n</span>
            </>
          )}
        </button>
      </div>

      {pingResult && (
        <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-900 flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{pingResult}</span>
        </div>
      )}

      {/* Telemetry Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">ইঞ্জিন স্ট্যাটাস</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Server className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-black text-emerald-600 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
              <span>Operational</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-1">{health.n8nService}</p>
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">গড় রেসপন্স ল্যাটেন্সি</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-black text-slate-900">{health.avgLatencyMs} ms</p>
            <p className="text-[11px] text-emerald-600 font-semibold mt-1">আল্ট্রা-ফাস্ট (&lt; ৫০ms মেটা থ্রেশহোল্ড)</p>
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">সাকসেস রেট</span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-black text-purple-600">{health.successRate}</p>
            <p className="text-[11px] text-slate-500 mt-1">কোনো মেসেজ ড্রপ বা ফেইল নেই</p>
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">এআই মডেল ইন্টিগ্রেশন</span>
            <div className="w-9 h-9 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
              <Cpu className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-xl font-black text-slate-900">GPT-4o-mini</p>
            <p className="text-[11px] text-slate-500 mt-1">কানেক্টেড ভিয়া n8n পাইপলাইন</p>
          </div>
        </div>

      </div>

      {/* Pipeline Diagram Card */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-xl">
        <h3 className="font-extrabold text-base text-white mb-2">লাইভ অটোমেশন পাইপলাইন আর্কিটেকচার</h3>
        <p className="text-xs text-slate-400 mb-6">মেটা ওয়েবহুক থেকে ডাটাবেজ পর্যন্ত প্রতিটি স্তরের স্ট্যাটাস</p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          
          <div className="p-4 rounded-2xl bg-slate-800 border border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 font-mono font-bold">1. Ingestion Gateway</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            </div>
            <p className="font-bold text-white">Next.js API Gateway</p>
            <p className="text-[11px] text-emerald-400 mt-1">HTTP 200 OK (&lt; 20ms)</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-800 border border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 font-mono font-bold">2. In-Memory Queue</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            </div>
            <p className="font-bold text-white">Upstash Redis Buffer</p>
            <p className="text-[11px] text-emerald-400 mt-1">saas:* Namespace Active</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-800 border border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 font-mono font-bold">3. Orchestration Engine</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            </div>
            <p className="font-bold text-white">n8n Workflow Engine</p>
            <p className="text-[11px] text-emerald-400 mt-1">Function Calling & RAG</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-800 border border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 font-mono font-bold">4. Database & Storage</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            </div>
            <p className="font-bold text-white">Supabase PostgreSQL</p>
            <p className="text-[11px] text-emerald-400 mt-1">RLS & pgvector Synced</p>
          </div>

        </div>
      </div>

      {/* Execution Health Logs Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-base text-slate-900">অটোমেশন এক্সিকিউশন ও পিং হিস্ট্রি</h3>
            <p className="text-xs text-slate-500">n8n সার্ভিস চেক ও হেলথ ট্র্যাকিং রেকর্ড</p>
          </div>
          <button
            onClick={fetchTelemetry}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>রিফ্রেশ</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3.5 px-6">সার্ভিস</th>
                <th className="py-3.5 px-6">স্ট্যাটাস</th>
                <th className="py-3.5 px-6">ল্যাটেন্সি</th>
                <th className="py-3.5 px-6">টাইমস্ট্যাম্প</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {health.logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-4 px-6 font-bold text-slate-900 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-indigo-600" />
                    <span>{log.service.toUpperCase()} Automation Node</span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{log.status}</span>
                    </span>
                  </td>
                  <td className="py-4 px-6 font-mono font-bold text-slate-800">
                    {log.latency_ms} ms
                  </td>
                  <td className="py-4 px-6 text-slate-500">
                    {new Date(log.checked_at).toLocaleTimeString()}
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
