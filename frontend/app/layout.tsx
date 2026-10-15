import type { Metadata } from 'next';
import { Instrument_Sans } from 'next/font/google';
import { AuthProvider } from '@/components/AuthProvider';
import './globals.css';

const font = Instrument_Sans({ subsets: ['latin'], display: 'swap' });

// Runs before first paint so the page never flashes the wrong theme.
const THEME_SCRIPT =
  "(function(){var t=null;try{t=localStorage.getItem('theme')}catch(e){}if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t})()";

export const metadata: Metadata = {
  title: 'Chat',
  description: 'A simple chatbot powered by Gemini',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className={font.className}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
