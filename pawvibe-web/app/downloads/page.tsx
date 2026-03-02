import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
    title: "Download PawVibe — AI Pet Mood Analyzer",
    description: "Download PawVibe for iOS and Android. AI-powered pet mood analyzer with astrology charts and monthly reports.",
};

export default function DownloadsPage() {
    return (
        <div className="pt-28 pb-20 px-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="text-center mb-16">
                    <div className="text-6xl mb-6">🐾</div>
                    <h1 className="text-4xl md:text-5xl font-black mb-4">
                        Download <span className="text-[#FF007F]">Paw</span><span className="text-[#FFD700]">Vibe</span>
                    </h1>
                    <p className="text-[#D3C4E5] text-lg max-w-xl mx-auto">
                        Available on iOS and Android. Start your first vibe check for free!
                    </p>
                </div>

                {/* Download Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-2xl mx-auto mb-20">
                    {/* iOS */}
                    <a
                        href="https://apps.apple.com/app/pawvibe/id6759780429"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="gradient-border rounded-2xl p-8 text-center hover:scale-[1.03] transition-transform group"
                    >
                        <div className="text-5xl mb-4">🍎</div>
                        <h3 className="text-2xl font-bold text-white mb-2">iOS</h3>
                        <p className="text-[#8B7BA8] mb-6">iPhone & iPad</p>
                        <div className="bg-[#FF007F] group-hover:bg-[#ff3399] text-white font-bold py-3 px-6 rounded-full transition-colors glow-pink">
                            App Store
                        </div>
                    </a>

                    {/* Android */}
                    <div
                        className="gradient-border rounded-2xl p-8 text-center opacity-60 cursor-default"
                    >
                        <div className="text-5xl mb-4">🤖</div>
                        <h3 className="text-2xl font-bold text-white mb-2">Android</h3>
                        <p className="text-[#8B7BA8] mb-6">Phones & Tablets</p>
                        <div className="bg-[#6A4C93] text-white font-bold py-3 px-6 rounded-full">
                            Coming Soon
                        </div>
                    </div>
                </div>

                {/* What's Included */}
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-black mb-8">
                        What&apos;s <span className="text-[#FFD700]">Included</span>
                    </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto mb-16">
                    {[
                        { icon: "🆓", title: "Free Tier", items: ["5 scans per week", "6 mood metrics", "Shareable result cards", "7 language support"] },
                        { icon: "⭐", title: "Premium", items: ["Unlimited scans", "Astrology charts", "Monthly psych reports", "No watermarks"] },
                    ].map((plan, i) => (
                        <div key={i} className="bg-[#1A0B2E] rounded-2xl p-6 border border-[#6A4C93]/30">
                            <div className="text-3xl mb-3">{plan.icon}</div>
                            <h3 className="text-xl font-bold text-white mb-4">{plan.title}</h3>
                            <ul className="space-y-3">
                                {plan.items.map((item, j) => (
                                    <li key={j} className="flex items-center gap-2 text-[#D3C4E5]">
                                        <span className="text-[#FF007F] text-sm">✓</span>
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                {/* System Requirements */}
                <div className="bg-[#1A0B2E] rounded-2xl p-8 border border-[#6A4C93]/30 max-w-lg mx-auto">
                    <h3 className="text-xl font-bold text-white mb-4 text-center">System Requirements</h3>
                    <div className="space-y-3 text-[#8B7BA8]">
                        <div className="flex justify-between">
                            <span>iOS</span>
                            <span className="text-[#D3C4E5]">iOS 15.0 or later</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Android</span>
                            <span className="text-[#D3C4E5]">Android 10 or later</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Camera</span>
                            <span className="text-[#D3C4E5]">Required</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Internet</span>
                            <span className="text-[#D3C4E5]">Required for analysis</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
