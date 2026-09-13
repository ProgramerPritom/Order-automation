import type { Metadata } from 'next';
import { Hind_Siliguri, Inter } from 'next/font/google';
import './globals.css';

const hindSiliguri = Hind_Siliguri({
  subsets: ['bengali'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-bengali',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'KothaShop.ai — 24/7 Social Commerce AI Sales Agent & Order Engine',
  description:
    'Turn Facebook Messenger, Instagram DM, and WhatsApp conversations into confirmed e-commerce orders 24/7 with RAG AI catalog, real-time inventory, and n8n automation.',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
};

import StoreProvider from '@/components/providers/StoreProvider';
import PublicSalesChatbot from '@/components/marketing/PublicSalesChatbot';
import { ConfirmProvider } from '@/components/providers/ConfirmProvider';
import { Toaster } from 'sonner';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="bn" className="scroll-smooth">
      <body className={`${hindSiliguri.className} ${hindSiliguri.variable} ${inter.variable} antialiased text-slate-900 bg-slate-50 selection:bg-indigo-500 selection:text-white`}>
        <StoreProvider>
          <ConfirmProvider>
            {children}
            <PublicSalesChatbot />
            <Toaster 
              position="top-right" 
              richColors 
              closeButton 
              duration={4000}
              toastOptions={{
                style: {
                  fontFamily: 'var(--font-bengali), var(--font-sans)',
                  borderRadius: '14px',
                  boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.15)',
                  fontSize: '14px',
                },
              }}
            />
          </ConfirmProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
