import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Support Portal",
  description: "Mobile-friendly customer portal with Supabase auth and realtime chat."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
