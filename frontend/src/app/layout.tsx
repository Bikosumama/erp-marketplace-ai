import type { Metadata } from 'next';
import './globals.css';
import Header from '@/components/Header';
import QueryProvider from '@/components/QueryProvider';

export const metadata: Metadata = {
  title: 'ERP Marketplace AI',
  description: 'Professional ERP Marketplace Management System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>
          <div className="min-h-screen flex flex-col">
            <Header />
            <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
              {children}
            </main>
            <footer className="bg-white border-t border-gray-200 py-4 mt-auto">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-500">
                © {new Date().getFullYear()} ERP Marketplace AI. All rights reserved.
              </div>
            </footer>
          </div>
        </QueryProvider>
      </body>
    </html>
  );
}
