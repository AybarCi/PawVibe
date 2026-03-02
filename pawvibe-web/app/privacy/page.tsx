import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Privacy Policy — PawVibe",
    description: "PawVibe privacy policy. Learn how we handle your data.",
};

export default function PrivacyPage() {
    return (
        <div className="pt-28 pb-20 px-6">
            <div className="max-w-3xl mx-auto">
                <h1 className="text-4xl md:text-5xl font-black mb-2">
                    <span className="text-[#FF007F]">Privacy</span> Policy
                </h1>
                <p className="text-[#8B7BA8] mb-12">Last updated: March 2, 2026</p>

                <div className="space-y-8 text-[#D3C4E5] leading-relaxed">
                    <section>
                        <h2 className="text-2xl font-bold text-white mb-3">1. Introduction</h2>
                        <p>PawVibe (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our mobile application.</p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-3">2. Information We Collect</h2>
                        <p className="mb-3">We collect minimal information to provide our services:</p>
                        <ul className="list-disc list-inside space-y-2 text-[#8B7BA8]">
                            <li><span className="text-[#D3C4E5]">Photos:</span> Pet photos you take are sent to our AI service for analysis. Photos are processed in real-time and are not permanently stored on our servers.</li>
                            <li><span className="text-[#D3C4E5]">Anonymous Account:</span> We create an anonymous session for you automatically. No personal information such as name, email, or phone number is required.</li>
                            <li><span className="text-[#D3C4E5]">Scan Results:</span> Analysis results (mood scores, explanations) are stored in your anonymous account so you can view your scan history.</li>
                            <li><span className="text-[#D3C4E5]">Purchase Data:</span> If you make in-app purchases, transaction records are stored securely for receipt verification.</li>
                            <li><span className="text-[#D3C4E5]">Device Info:</span> We collect basic device information (platform, language preference) to optimize your experience.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-3">3. How We Use Your Information</h2>
                        <ul className="list-disc list-inside space-y-2 text-[#8B7BA8]">
                            <li>To analyze pet photos and provide mood results</li>
                            <li>To generate astrology charts and monthly reports (Premium)</li>
                            <li>To manage your credits and subscription status</li>
                            <li>To improve our AI analysis accuracy</li>
                            <li>To provide customer support</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-3">4. Data Storage & Security</h2>
                        <p>Your data is stored securely using <strong>Supabase</strong>, a trusted cloud platform with enterprise-grade security. All data transmission is encrypted using TLS/SSL. We implement Row Level Security (RLS) to ensure users can only access their own data.</p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-3">5. Third-Party Services</h2>
                        <p className="mb-3">We use the following third-party services:</p>
                        <ul className="list-disc list-inside space-y-2 text-[#8B7BA8]">
                            <li><span className="text-[#D3C4E5]">OpenAI:</span> For AI-powered image analysis (photos are sent securely via API)</li>
                            <li><span className="text-[#D3C4E5]">Apple App Store / Google Play:</span> For in-app purchase processing</li>
                            <li><span className="text-[#D3C4E5]">Supabase:</span> For secure data storage and authentication</li>
                            <li><span className="text-[#D3C4E5]">Expo:</span> For app delivery and updates</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-3">6. Children&apos;s Privacy</h2>
                        <p>PawVibe is suitable for all ages. We do not knowingly collect personal information from children under 13. Since the app uses anonymous sessions, no personal data is required to use the app.</p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-3">7. Data Retention</h2>
                        <p>Scan results are retained in your anonymous account indefinitely so you can access your history. Photos are processed in real-time and are not stored after analysis is complete.</p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-3">8. Your Rights</h2>
                        <p>You may request deletion of your data at any time by contacting us at <a href="mailto:info@setifera.com" className="text-[#FF007F] hover:underline">info@setifera.com</a>.</p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-3">9. Changes to This Policy</h2>
                        <p>We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the &quot;Last updated&quot; date.</p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-3">10. Contact Us</h2>
                        <p>If you have any questions about this Privacy Policy, please contact us at:</p>
                        <p className="mt-2">
                            <a href="mailto:info@setifera.com" className="text-[#FF007F] hover:underline font-semibold">info@setifera.com</a>
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
}
