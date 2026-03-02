import Link from "next/link";

const features = [
  { emoji: "📊", title: "6 Mood Metrics", desc: "Chaos, Energy, Sweetness, Judgment, Cuddle-O-Meter & Derp Factor" },
  { emoji: "🔮", title: "Astrology Charts", desc: "Sun, Moon & Rising signs for your pet's cosmic personality" },
  { emoji: "📋", title: "Monthly Reports", desc: "30-day behavioral analysis with professional vet advice" },
  { emoji: "🌍", title: "7 Languages", desc: "English, Turkish, Spanish, Russian, French, Portuguese & German" },
  { emoji: "🤖", title: "Advanced AI", desc: "GPT-4o powered vision analysis for accurate mood detection" },
  { emoji: "📸", title: "Shareable Cards", desc: "Beautiful result cards to share your pet's vibe with friends" },
];

const metrics = [
  { name: "Chaos Score", desc: "How much trouble are they planning?", color: "#FF007F" },
  { name: "Energy Level", desc: "Fully charged or nap mode?", color: "#00FFFF" },
  { name: "Sweetness", desc: "Heart-melting capacity", color: "#FFD700" },
  { name: "Judgment", desc: "Are they judging you right now?", color: "#FF007F" },
  { name: "Cuddle-O-Meter", desc: "Huggability index", color: "#00FFFF" },
  { name: "Derp Factor", desc: "Maximum goofiness level", color: "#FFD700" },
];

export default function Home() {
  return (
    <div className="pt-20">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        {/* Gradient Orbs */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-[#FF007F]/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-[#6A4C93]/20 rounded-full blur-[150px]" />
        <div className="absolute top-40 right-20 w-64 h-64 bg-[#FFD700]/10 rounded-full blur-[100px]" />

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          <div className="inline-block mb-6 px-4 py-2 rounded-full bg-[#1A0B2E] border border-[#FF007F]/30 text-[#FF007F] text-sm font-semibold">
            🐾 AI-Powered Pet Mood Analyzer
          </div>
          <h1 className="text-5xl md:text-7xl font-black mb-6 leading-tight">
            Discover What Your Pet
            <br />
            <span className="text-[#FF007F] text-glow-pink">Is Really </span>
            <span className="text-[#FFD700] text-glow-gold">Thinking</span>
          </h1>
          <p className="text-[#D3C4E5] text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            Snap a photo of your furry friend and let AI dramatically analyze their mood —
            with hilariously detailed and shareable results.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/downloads"
              className="bg-[#FF007F] hover:bg-[#ff3399] text-white font-bold px-8 py-4 rounded-full text-lg transition-all glow-pink hover:scale-105"
            >
              Download Free 🚀
            </Link>
            <a
              href="#features"
              className="bg-transparent border-2 border-[#6A4C93] hover:border-[#FF007F] text-[#D3C4E5] hover:text-white font-bold px-8 py-4 rounded-full text-lg transition-all"
            >
              See Features ✨
            </a>
          </div>

          <p className="text-[#8B7BA8] text-sm mt-6">5 free scans every week • No account required</p>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black mb-4">
              <span className="text-[#FF007F]">Packed</span> with Features
            </h2>
            <p className="text-[#D3C4E5] text-lg max-w-xl mx-auto">
              Everything you need to decode your pet&apos;s inner world
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div
                key={i}
                className="gradient-border rounded-2xl p-6 hover:scale-[1.02] transition-transform cursor-default"
              >
                <div className="text-4xl mb-4">{f.emoji}</div>
                <h3 className="text-xl font-bold text-white mb-2">{f.title}</h3>
                <p className="text-[#8B7BA8] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Metrics Section */}
      <section className="py-24 px-6 bg-[#1A0B2E]/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black mb-4">
              6 Mood <span className="text-[#FFD700]">Metrics</span>
            </h2>
            <p className="text-[#D3C4E5] text-lg">Each scan reveals a detailed emotional breakdown</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {metrics.map((m, i) => (
              <div key={i} className="bg-[#1A0B2E] rounded-2xl p-6 border border-[#6A4C93]/30">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: m.color, boxShadow: `0 0 10px ${m.color}` }} />
                  <h3 className="text-lg font-bold" style={{ color: m.color }}>{m.name}</h3>
                </div>
                <p className="text-[#8B7BA8]">{m.desc}</p>
                <div className="mt-4 h-2 bg-[#2A1B3E] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${60 + Math.random() * 35}%`,
                      backgroundColor: m.color,
                      boxShadow: `0 0 8px ${m.color}`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Premium Section */}
      <section id="premium" className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-block mb-6 px-4 py-2 rounded-full bg-[#FFD700]/10 border border-[#FFD700]/30 text-[#FFD700] text-sm font-semibold">
            ⭐ Premium
          </div>
          <h2 className="text-4xl md:text-5xl font-black mb-6">
            Go <span className="text-[#FFD700] text-glow-gold">Unlimited</span>
          </h2>
          <p className="text-[#D3C4E5] text-lg max-w-xl mx-auto mb-12">
            Unlock the full power of PawVibe with a Premium subscription
          </p>

          <div className="gradient-border rounded-3xl p-8 md:p-12 max-w-lg mx-auto">
            <div className="space-y-5 text-left">
              {[
                ["♾️", "Unlimited Scans", "No weekly credit limits"],
                ["🔮", "Astrology Charts", "Cosmic personality analysis"],
                ["📋", "Monthly Reports", "Professional behavioral insights"],
                ["🖼️", "No Watermarks", "Clean, shareable result cards"],
              ].map(([emoji, title, desc], i) => (
                <div key={i} className="flex items-start gap-4">
                  <span className="text-2xl">{emoji}</span>
                  <div>
                    <h4 className="font-bold text-white">{title}</h4>
                    <p className="text-[#8B7BA8] text-sm">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <Link
              href="/downloads"
              className="block mt-8 bg-gradient-to-r from-[#FF007F] to-[#FFD700] text-white font-bold py-4 rounded-full text-lg text-center hover:scale-105 transition-transform"
            >
              Get PawVibe Premium
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 bg-gradient-to-b from-transparent to-[#1A0B2E]/30">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-black mb-6">
            Ready to Read Your Pet&apos;s <span className="text-[#FF007F]">Mind</span>?
          </h2>
          <p className="text-[#D3C4E5] text-lg mb-10">
            Download PawVibe and start your first vibe check — it&apos;s free!
          </p>
          <Link
            href="/downloads"
            className="inline-block bg-[#FF007F] hover:bg-[#ff3399] text-white font-bold px-10 py-4 rounded-full text-lg transition-all glow-pink hover:scale-105"
          >
            Download Now 🐾
          </Link>
        </div>
      </section>
    </div>
  );
}
