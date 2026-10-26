
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Final Grade Access System',
  description: 'Final grade inquiry portal for students.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
