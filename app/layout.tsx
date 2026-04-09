import type { Metadata } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";
import "./globals.css";

const body = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
});

const headline = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-headline",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Clutch | Premium Sports Betting Tracker",
  description: "A premium sports betting tracker for disciplined bettors.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${body.variable} ${headline.variable}`}>
        {children}
      </body>
    </html>
  );
}
