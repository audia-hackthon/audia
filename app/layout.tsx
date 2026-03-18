import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import VoiceWidget from '@/components/VoiceWidget';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Voivr | Voice Layer for Websites',
  description: 'Control your website with voice commands using Murf AI and OpenAI.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        {/* The floating voice widget available on all pages */}
        <VoiceWidget />
      </body>
    </html>
  );
}
