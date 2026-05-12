import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { MousePointerClick, Calendar, User, TrendingUp, Package } from 'lucide-react';

export default function ClicksPage() {
    const [clicks, setClicks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ total: 0, topProduct: 'None' });

    useEffect(() => {
        fetchClicks();
    }, []);

    async function fetchClicks() {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('recommendation_clicks')
                .select(`
                    *,
                    profiles:user_id (email, username),
                    recommendations:product_id (name, image_url)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            console.log('[Backoffice] Fetched Clicks:', data); // DEBUG LOG
            setClicks(data || []);

            // Basic stats calculation
            if (data && data.length > 0) {
                const productCounts: Record<string, number> = {};
                data.forEach((c: any) => {
                    const name = c.recommendations?.name || 'Unknown';
                    productCounts[name] = (productCounts[name] || 0) + 1;
                });
                
                const top = Object.entries(productCounts).reduce((a, b) => a[1] > b[1] ? a : b);
                setStats({ total: data.length, topProduct: top[0] });
            }
        } catch (err) {
            console.error('Error fetching clicks:', err);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black bg-gradient-to-r from-white to-gray-500 bg-clip-text text-transparent">
                        PRODUCT CLICKS
                    </h1>
                    <p className="text-gray-500 mt-2 font-medium tracking-wide uppercase text-xs">Tracking conversion and user interest</p>
                </div>
                <button 
                    onClick={fetchClicks}
                    className="bg-[#15002C] border border-[#2D005A] p-3 rounded-2xl hover:border-[#FF007F] transition-all text-[#FF007F]"
                >
                    Refresh Data
                </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-[#15002C] border border-[#2D005A] p-6 rounded-3xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <MousePointerClick size={80} color="#FF007F" />
                    </div>
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-[#FF007F]/10 rounded-2xl text-[#FF007F]">
                            <TrendingUp size={24} />
                        </div>
                        <span className="text-gray-400 font-bold uppercase tracking-widest text-xs">Total Clicks</span>
                    </div>
                    <div className="text-5xl font-black text-white">{stats.total}</div>
                </div>

                <div className="bg-[#15002C] border border-[#2D005A] p-6 rounded-3xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Package size={80} color="#00FFFF" />
                    </div>
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-[#00FFFF]/10 rounded-2xl text-[#00FFFF]">
                            <TrendingUp size={24} />
                        </div>
                        <span className="text-gray-400 font-bold uppercase tracking-widest text-xs">Top Product</span>
                    </div>
                    <div className="text-2xl font-black text-white truncate">{stats.topProduct}</div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-[#15002C] border border-[#2D005A] rounded-3xl overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-[#0A001A] border-b border-[#2D005A]">
                                <th className="px-6 py-5 text-xs font-black uppercase tracking-widest text-gray-500">Product</th>
                                <th className="px-6 py-5 text-xs font-black uppercase tracking-widest text-gray-500">User</th>
                                <th className="px-6 py-5 text-xs font-black uppercase tracking-widest text-gray-500">Date</th>
                                <th className="px-6 py-5 text-xs font-black uppercase tracking-widest text-gray-500 text-right">Platform</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#2D005A]">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-20 text-center text-gray-500 italic">
                                        Loading analytics...
                                    </td>
                                </tr>
                            ) : clicks.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-20 text-center text-gray-500 italic">
                                        No clicks tracked yet.
                                    </td>
                                </tr>
                            ) : clicks.map((click) => (
                                <tr key={click.id} className="hover:bg-white/5 transition-colors group">
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl overflow-hidden bg-black border border-[#2D005A]">
                                                {click.recommendations?.image_url && (
                                                    <img src={click.recommendations.image_url} alt="" className="w-full h-full object-cover" />
                                                )}
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-white group-hover:text-[#FF007F] transition-colors">
                                                    {click.recommendations?.name || click.product_id || 'Unknown Product'}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-2 text-gray-300">
                                            <User size={14} className="text-[#6A4C93]" />
                                            <span className="text-sm">
                                                {click.profiles?.email || click.profiles?.username || click.user_id || 'Guest'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-2 text-gray-500">
                                            <Calendar size={14} />
                                            <span className="text-xs">{new Date(click.created_at).toLocaleString()}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 text-right">
                                        <span className={`text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest ${
                                            click.platform === 'ios' ? 'bg-[#00FFFF]/10 text-[#00FFFF]' : 'bg-[#FF007F]/10 text-[#FF007F]'
                                        }`}>
                                            {click.platform || 'N/A'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
