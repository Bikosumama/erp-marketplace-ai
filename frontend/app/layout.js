import './globals.css';
import { Providers } from './providers';

export const metadata = {
  title: 'ERP Marketplace AI',
  description: 'AI-powered ERP system with marketplace integration',
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
