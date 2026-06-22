import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DepositBack — Get your security deposit back",
  description:
    "Your landlord kept your deposit. DepositBack computes what's actually illegal under your state's (or India's) law and hands you a citation-backed demand letter. Grounded in real statutes — not vibes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body className="grain min-h-screen">{children}</body>
    </html>
  );
}
