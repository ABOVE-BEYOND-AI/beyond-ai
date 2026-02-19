import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { GoogleAuthProvider } from "@/components/google-auth-provider-clean";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Above + Beyond AI - Premium Travel Itinerary Creator",
  description: "Transform client briefs into luxury travel experiences with AI-powered research and beautiful Canva templates.",
  keywords: "travel, itinerary, luxury, AI, Canva, travel consultant",
  authors: [{ name: "Above + Beyond AI" }],
  openGraph: {
    title: "Above + Beyond AI",
    description: "Premium Travel Itinerary Creator",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{if(localStorage.theme==='dark')document.documentElement.classList.add('dark')}catch(e){}` }} />
      </head>
      <body
        className={cn(
          inter.variable,
          "font-sans antialiased bg-background text-foreground"
        )}
      >
        <GoogleAuthProvider>
          {children}
        </GoogleAuthProvider>
      </body>
    </html>
  );
}