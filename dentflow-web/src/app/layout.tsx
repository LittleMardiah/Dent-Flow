import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import { WebSocketToast } from "@/components/ui/WebSocketToast";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DentFlow - Klinik Gigi Modern",
  description: "Booking online, antrian real-time, rekam medis digital.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className={`${inter.className} antialiased`}>
        <Providers>
          {children}
          <WebSocketToast />
        </Providers>
      </body>
    </html>
  );
}
