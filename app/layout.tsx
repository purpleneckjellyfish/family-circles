import type { Metadata, Viewport } from "next";
import { Fraunces, Source_Sans_3, Geist_Mono } from "next/font/google";

import { ServiceWorkerRegister } from "@/components/sw-register";
import "./globals.css";

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
});

const body = Source_Sans_3({
  variable: "--font-body",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  applicationName: "Family Circles",
  title: {
    default: "Family Circles",
    template: "%s · Family Circles",
  },
  description:
    "Self-hosted family memories — private circles, photos, and timelines you keep on your own server.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Family Circles",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#1f4d3a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${geistMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col font-sans text-ink">
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
