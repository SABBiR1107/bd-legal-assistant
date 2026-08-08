import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BD Legal AI - Smart Legal Assistant for Bangladesh",
  description: "Advanced AI legal research, chat, document processing, and compliance dashboard for Bangladeshi laws.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const rawKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const isValidKey =
    rawKey &&
    (rawKey.startsWith("pk_test_") || rawKey.startsWith("pk_live_")) &&
    !rawKey.includes("...");

  const clerkPublishableKey = isValidKey
    ? rawKey
    : "pk_test_cG9zc2libGUtaGFyZS03NS5jbGVyay5hY2NvdW50cy5kZXYk";

  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: "#10b981", // Emerald green to match our premium theme
        },
      }}
    >
      <html lang="en" className="dark">
        <body className={`${inter.className} antialiased min-h-screen bg-slate-950 text-slate-100`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
