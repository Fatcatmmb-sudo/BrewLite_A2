import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "BrewLite — Cà phê & Trà",
  description: "Đặt đồ uống nhanh chóng và thưởng thức hương vị ấm áp.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans bg-[#FBF8F2] text-[#1E1915]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
