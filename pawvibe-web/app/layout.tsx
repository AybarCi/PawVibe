import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "PawVibe — AI Pet Mood Analyzer",
  description: "Snap a photo of your pet and let AI analyze their mood with hilarious, dramatic results. Astrology charts, monthly psych reports & shareable vibe checks.",
  keywords: "pet, mood, AI, analyzer, cat, dog, vibe, astrology, funny, animal",
  openGraph: {
    title: "PawVibe — AI Pet Mood Analyzer",
    description: "Discover your pet's mood with AI! Hilarious vibe checks, astrology charts & monthly psych reports.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
