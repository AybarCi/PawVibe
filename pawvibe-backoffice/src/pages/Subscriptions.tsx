import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { callEdgeFunction } from '../lib/supabase';
import { Shield, ChevronLeft, ChevronRight, Smartphone, Calendar, Search, Copy, Check, Filter } from 'lucide-react';
import { Text } from '@tremor/react';

const SubscriptionsPage: React.FC = () => {
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [productId, setProductId] = useState('');
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ['subscriptions', page, search, productId],
        queryFn: () => callEdgeFunction('get-iap-transactions', { type: 'subscription', page, limit: 15, search, productId }),
    });

    const handleCopy = (uniqueId: string, valueToCopy: string, field: string) => {
        navigator.clipboard.writeText(valueToCopy);
        setCopiedId(`${uniqueId}-${field}`);
        setTimeout(() => setCopiedId(null), 2000);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col lg:flex-row justify-between lg:items-end gap-6">
                <div className="flex-1 text-center lg:text-left">
                    <h2 className="text-3xl font-bold font-display text-white italic tracking-tight">PREMIUM SUBSCRIPTIONS</h2>
                    <div className="flex flex-col sm:flex-row items-center gap-4 mt-2 lg:mt-1 justify-center lg:justify-start">
                        <p className="text-gray-500 font-medium italic text-sm">Track VIP members and recurring revenue.</p>
                        <div className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-lg whitespace-nowrap">
                            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Active Total:</span>
                            <span className="ml-2 text-white font-bold text-xs">{data?.totalCount || 0}</span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                    <div className="relative w-full sm:w-auto">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                        <select
                            className="bg-[#15002C] border border-[#2D005A] rounded-xl pl-10 pr-10 py-3 text-sm focus:outline-none focus:border-[#FF007F] transition-all appearance-none cursor-pointer text-gray-300 w-full sm:min-w-[160px]"
                            value={productId}
                            onChange={(e) => { setProductId(e.target.value); setPage(1); }}
                        >
                            <option value="">All Plans</option>
                            <option value="pawvibe_premium_monthly">Monthly Plan</option>
                            <option value="pawvibe_premium_yearly">Yearly Plan</option>
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                            <ChevronRight size={14} className="rotate-90" />
                        </div>
                    </div>
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                        <input
                            type="text"
                            placeholder="Search by User ID or Tx ID..."
                            className="bg-[#15002C] border border-[#2D005A] rounded-xl pl-10 pr-4 py-3 w-full focus:outline-none focus:border-[#FF007F] transition-all text-sm"
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        />
                    </div>
                </div>
            </div>

            <div className="bg-[#15002C] border border-[#2D005A] rounded-2xl overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[900px]">
                        <thead>
                            <tr className="bg-[#0A001A] text-gray-500 text-[10px] uppercase font-black tracking-widest border-b border-white/5">
                                <th className="px-6 py-4">Transaction ID</th>
                                <th className="px-6 py-4">Subscriber</th>
                                <th className="px-6 py-4">Plan Detail</th>
                                <th className="px-6 py-4">Platform</th>
                                <th className="px-6 py-4">Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {isLoading ? (
                                <tr><td colSpan={5} className="p-12 text-center text-gray-600 animate-pulse font-bold tracking-widest uppercase text-xs">Fetching Premium Records...</td></tr>
                            ) : data?.transactions?.length === 0 ? (
                                <tr><td colSpan={5} className="p-12 text-center text-gray-400 italic">No subscriptions found.</td></tr>
                            ) : data?.transactions?.map((tx: any) => (
                                <tr key={tx.id} className="hover:bg-white/[0.02] transition-all group">
                                    <td className="px-6 py-5">
                                        <div className="flex items-center space-x-2">
                                            <span className="text-[11px] font-mono text-[#FF007F] font-bold" title={tx.transaction_id || tx.id}>
                                                {(tx.transaction_id || tx.id).substring(0, 10)}...
                                            </span>
                                            <button
                                                onClick={() => handleCopy(tx.id || `${tx.transaction_id}-${tx.user_id}`, tx.transaction_id || tx.id, 'tx')}
                                                className="p-1.5 bg-white/5 hover:bg-white/10 rounded-md transition-all text-gray-400 hover:text-indigo-400 border border-white/5"
                                                title="Copy Transaction ID"
                                            >
                                                {copiedId === `${tx.id || `${tx.transaction_id}-${tx.user_id}`}-tx` ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex items-center space-x-3">
                                            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                                                <Shield size={14} className="text-indigo-400" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
                                                    {tx.profiles?.username || 'Anonymous Subscriber'}
                                                </span>
                                                <div className="flex items-center space-x-1">
                                                    <span className="text-[9px] text-gray-600 font-mono tracking-tighter truncate w-20">{tx.user_id}</span>
                                                    <button
                                                        onClick={() => handleCopy(tx.id || `${tx.transaction_id}-${tx.user_id}`, tx.user_id, 'user')}
                                                        className="p-1.5 bg-white/5 hover:bg-white/10 rounded-md transition-all text-gray-500 hover:text-indigo-400 border border-white/5"
                                                        title="Copy User ID"
                                                    >
                                                        {copiedId === `${tx.id || `${tx.transaction_id}-${tx.user_id}`}-user` ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <span className="px-2 py-1 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-200 text-[10px] font-black uppercase italic tracking-wider">
                                            {tx.product_id.includes('monthly') ? 'Premium Monthly' : 'Premium Yearly'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-2 text-gray-400">
                                            <Smartphone size={12} className="opacity-40" />
                                            <span className="text-xs font-bold capitalize">{tx.platform}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-2 text-gray-500 font-mono text-xs">
                                            <Calendar size={12} className="opacity-30" />
                                            <span>{new Date(tx.created_at).toLocaleDateString()}</span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="px-6 py-4 bg-[#0A001A] flex justify-between items-center border-t border-white/5">
                    <Text className="text-[10px] text-gray-600 uppercase font-black tracking-widest">Total Results: {data?.totalCount || 0}</Text>
                    <div className="flex space-x-2">
                        <button
                            disabled={page === 1}
                            onClick={() => setPage(p => p - 1)}
                            className="p-2 bg-white/5 border border-white/5 rounded-lg disabled:opacity-30 hover:bg-white/10 transition-colors"
                        >
                            <ChevronLeft size={18} className="text-white" />
                        </button>
                        <button
                            disabled={!data?.transactions || data.transactions.length < 15}
                            onClick={() => setPage(p => p + 1)}
                            className="p-2 bg-white/5 border border-white/5 rounded-lg disabled:opacity-30 hover:bg-white/10 transition-colors"
                        >
                            <ChevronRight size={18} className="text-white" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SubscriptionsPage;
