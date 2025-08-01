import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const jakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
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
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={cn(
          jakartaSans.variable,
          "font-sans antialiased bg-background text-foreground transition-colors duration-300"
        )}
      >
        {children}
      </body>
    </html>
  );
}