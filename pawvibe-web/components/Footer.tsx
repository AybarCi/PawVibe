import Link from "next/link";

export default function Footer() {
    return (
        <footer className="bg-[#0A001A] border-t border-[#FF007F]/20 py-12">
            <div className="max-w-7xl mx-auto px-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
                    {/* Brand */}
                    <div className="md:col-span-1">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-2xl">🐾</span>
                            <span className="text-xl font-black text-white">
                                Paw<span className="text-[#FF007F]">Vibe</span>
                            </span>
                        </div>
                        <p className="text-[#8B7BA8] text-sm leading-relaxed">
                            AI-powered pet mood analyzer. Discover what your pet is really thinking!
                        </p>
                    </div>

                    {/* Product */}
                    <div>
                        <h4 className="text-[#FF007F] font-bold mb-4 text-sm uppercase tracking-wider">Product</h4>
                        <div className="flex flex-col gap-3">
                            <Link href="/downloads" className="text-[#8B7BA8] hover:text-[#D3C4E5] transition-colors text-sm">Download</Link>
                            <Link href="/#features" className="text-[#8B7BA8] hover:text-[#D3C4E5] transition-colors text-sm">Features</Link>
                            <Link href="/#premium" className="text-[#8B7BA8] hover:text-[#D3C4E5] transition-colors text-sm">Premium</Link>
                        </div>
                    </div>

                    {/* Legal */}
                    <div>
                        <h4 className="text-[#FF007F] font-bold mb-4 text-sm uppercase tracking-wider">Legal</h4>
                        <div className="flex flex-col gap-3">
                            <Link href="/privacy" className="text-[#8B7BA8] hover:text-[#D3C4E5] transition-colors text-sm">Privacy Policy</Link>
                            <Link href="/terms" className="text-[#8B7BA8] hover:text-[#D3C4E5] transition-colors text-sm">Terms of Service</Link>
                        </div>
                    </div>

                    {/* Contact */}
                    <div>
                        <h4 className="text-[#FF007F] font-bold mb-4 text-sm uppercase tracking-wider">Contact</h4>
                        <div className="flex flex-col gap-3">
                            <a href="mailto:info@setifera.com" className="text-[#8B7BA8] hover:text-[#D3C4E5] transition-colors text-sm">info@setifera.com</a>
                        </div>
                    </div>
                </div>

                <div className="border-t border-[#6A4C93]/30 mt-10 pt-8 text-center">
                    <p className="text-[#8B7BA8] text-sm">
                        © {new Date().getFullYear()} Setifera. All rights reserved.
                    </p>
                </div>
            </div>
        </footer>
    );
}
