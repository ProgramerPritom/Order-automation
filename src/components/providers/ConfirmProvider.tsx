'use client';

import React, { createContext, useContext, useState, useRef, ReactNode } from 'react';
import { AlertTriangle, Info, HelpCircle, X } from 'lucide-react';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({ message: '' });
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = (opts: ConfirmOptions | string): Promise<boolean> => {
    const config: ConfirmOptions = typeof opts === 'string' ? { message: opts } : opts;
    setOptions(config);
    setIsOpen(true);

    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  };

  const handleConfirm = () => {
    setIsOpen(false);
    if (resolverRef.current) {
      resolverRef.current(true);
      resolverRef.current = null;
    }
  };

  const handleCancel = () => {
    setIsOpen(false);
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }
  };

  const type = options.type || 'danger';

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}

      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
          >
            {/* Header / Accent top border */}
            <div
              className={`h-1.5 w-full ${
                type === 'danger'
                  ? 'bg-rose-500'
                  : type === 'warning'
                  ? 'bg-amber-500'
                  : 'bg-indigo-500'
              }`}
            />

            <button
              onClick={handleCancel}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-6">
              <div className="flex items-start gap-4">
                <div
                  className={`p-3 rounded-xl flex-shrink-0 ${
                    type === 'danger'
                      ? 'bg-rose-50 text-rose-600 ring-4 ring-rose-50/50'
                      : type === 'warning'
                      ? 'bg-amber-50 text-amber-600 ring-4 ring-amber-50/50'
                      : 'bg-indigo-50 text-indigo-600 ring-4 ring-indigo-50/50'
                  }`}
                >
                  {type === 'danger' ? (
                    <AlertTriangle className="w-6 h-6" />
                  ) : type === 'warning' ? (
                    <HelpCircle className="w-6 h-6" />
                  ) : (
                    <Info className="w-6 h-6" />
                  )}
                </div>

                <div className="flex-1 min-w-0 pr-4">
                  <h3 className="text-lg font-bold text-slate-900 leading-snug">
                    {options.title || 'নিশ্চিতকরণ'}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed break-words whitespace-pre-line">
                    {options.message}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-all"
                >
                  {options.cancelText || 'বাতিল'}
                </button>
                <button
                  type="button"
                  autoFocus
                  onClick={handleConfirm}
                  className={`px-5 py-2.5 text-sm font-semibold text-white rounded-xl shadow-lg transition-all active:scale-95 ${
                    type === 'danger'
                      ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/25'
                      : type === 'warning'
                      ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/25'
                      : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/25'
                  }`}
                >
                  {options.confirmText || 'হ্যাঁ, নিশ্চিত'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
}
