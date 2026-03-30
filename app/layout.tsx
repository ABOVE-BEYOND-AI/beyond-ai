import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { cn } from "@/lib/utils";
import { GoogleAuthProvider } from "@/components/google-auth-provider-clean";

const googleSans = localFont({
  src: [
    {
      path: "../public/Google_Sans/GoogleSans-VariableFont_GRAD,opsz,wght.ttf",
      style: "normal",
    },
    {
      path: "../public/Google_Sans/GoogleSans-Italic-VariableFont_GRAD,opsz,wght.ttf",
      style: "italic",
    },
  ],
  variable: "--font-google-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Above + Beyond AI - Internal Tools",
  description: "Sales, pipeline, finance, events and AI-powered tools for the Above + Beyond team.",
  keywords: "travel, sales, pipeline, AI, CRM, finance, events",
  authors: [{ name: "Above + Beyond AI" }],
  openGraph: {
    title: "Above + Beyond AI",
    description: "Internal tools for the Above + Beyond team",
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
          googleSans.variable,
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