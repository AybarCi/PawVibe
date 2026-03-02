"use client";
import Link from "next/link";
import { useState } from "react";

export default function Navbar() {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-[#0A001A]/80 border-b border-[#FF007F]/20">
            <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2 group">
                    <span className="text-3xl">🐾</span>
                    <span className="text-2xl font-black text-white group-hover:text-[#FFD700] transition-colors">
                        Paw<span className="text-[#FF007F]">Vibe</span>
                    </span>
                </Link>

                {/* Desktop Nav */}
                <div className="hidden md:flex items-center gap-8">
                    <Link href="/" className="text-[#D3C4E5] hover:text-[#FF007F] transition-colors font-medium">Home</Link>
                    <Link href="/downloads" className="text-[#D3C4E5] hover:text-[#FF007F] transition-colors font-medium">Download</Link>
                    <Link href="/privacy" className="text-[#D3C4E5] hover:text-[#FF007F] transition-colors font-medium">Privacy</Link>
                    <Link href="/terms" className="text-[#D3C4E5] hover:text-[#FF007F] transition-colors font-medium">Terms</Link>
                    <Link
                        href="/downloads"
                        className="bg-[#FF007F] hover:bg-[#ff3399] text-white font-bold px-6 py-2.5 rounded-full transition-all glow-pink hover:scale-105"
                    >
                        Get the App
                    </Link>
                </div>

                {/* Mobile Hamburger */}
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="md:hidden text-white p-2"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {isOpen ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        )}
                    </svg>
                </button>
            </div>

            {/* Mobile Menu */}
            {isOpen && (
                <div className="md:hidden bg-[#1A0B2E] border-t border-[#FF007F]/20 px-6 py-4 flex flex-col gap-4">
                    <Link href="/" onClick={() => setIsOpen(false)} className="text-[#D3C4E5] hover:text-[#FF007F] transition-colors font-medium py-2">Home</Link>
                    <Link href="/downloads" onClick={() => setIsOpen(false)} className="text-[#D3C4E5] hover:text-[#FF007F] transition-colors font-medium py-2">Download</Link>
                    <Link href="/privacy" onClick={() => setIsOpen(false)} className="text-[#D3C4E5] hover:text-[#FF007F] transition-colors font-medium py-2">Privacy</Link>
                    <Link href="/terms" onClick={() => setIsOpen(false)} className="text-[#D3C4E5] hover:text-[#FF007F] transition-colors font-medium py-2">Terms</Link>
                    <Link
                        href="/downloads"
                        onClick={() => setIsOpen(false)}
                        className="bg-[#FF007F] text-white font-bold px-6 py-3 rounded-full text-center glow-pink"
                    >
                        Get the App
                    </Link>
                </div>
            )}
        </nav>
    );
}
