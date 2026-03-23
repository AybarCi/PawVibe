import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { callEdgeFunction } from '../lib/supabase';
import { Search, ChevronLeft, ChevronRight, User, Copy, Check, Filter } from 'lucide-react';
import { Text } from '@tremor/react';

const PurchasesPage: React.FC = () => {
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [productId, setProductId] = useState('');
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ['purchases', page, search, productId],
        queryFn: () => callEdgeFunction('get-iap-transactions', { type: 'credit', page, limit: 15, search, productId }),
    });

    const handleCopy = (uniqueId: string, valueToCopy: string, field: string) => {
        navigator.clipboard.writeText(valueToCopy);
        setCopiedId(`${uniqueId}-${field}`);
        setTimeout(() => setCopiedId(null), 2000);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col lg:flex-row justify-between lg:items-end gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-center lg:text-left">Credit Purchases</h2>
                    <p className="text-gray-400 mt-1 text-center lg:text-left text-sm">Monitor all in-app credit pack transactions.</p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                    <div className="relative w-full sm:w-auto">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                        <select
                            className="bg-[#15002C] border border-[#2D005A] rounded-xl pl-10 pr-10 py-3 text-sm focus:outline-none focus:border-[#FF007F] transition-all appearance-none cursor-pointer text-gray-300 w-full sm:min-w-[160px]"
                            value={productId}
                            onChange={(e) => { setProductId(e.target.value); setPage(1); }}
                        >
                            <option value="">All Products</option>
                            <option value="pawvibe_snack_pack">Snack Pack</option>
                            <option value="pawvibe_party_pack">Party Pack</option>
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                            <ChevronRight size={14} className="rotate-90" />
                        </div>
                    </div>

                    <div className="relative w-full sm:w-72">
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

            <div className="bg-[#15002C] border border-[#2D005A] rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[800px]">
                        <thead>
                            <tr className="bg-[#0A001A] text-gray-400 text-xs uppercase tracking-wider">
                                <th className="px-6 py-4">Transaction ID</th>
                                <th className="px-6 py-4">User</th>
                                <th className="px-6 py-4">Product</th>
                                <th className="px-6 py-4">Platform</th>
                                <th className="px-6 py-4">Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {isLoading ? (
                                <tr><td colSpan={5} className="p-12 text-center text-gray-500">Loading transactions...</td></tr>
                            ) : data?.transactions?.length === 0 ? (
                                <tr><td colSpan={5} className="p-12 text-center text-gray-400 italic">No credit purchases found.</td></tr>
                            ) : data?.transactions?.map((tx: any) => (
                                <tr key={tx.id} className="hover:bg-white/5 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center space-x-2">
                                            <span className="text-[11px] font-mono text-[#FF007F] font-bold truncate w-24" title={tx.transaction_id || tx.id}>
                                                {tx.transaction_id || tx.id.substring(0, 8)}
                                            </span>
                                            <button
                                                onClick={() => handleCopy(tx.id || `${tx.transaction_id}-${tx.user_id}`, tx.transaction_id || tx.id, 'tx')}
                                                className="p-1.5 bg-white/5 hover:bg-white/10 rounded-md transition-all text-gray-400 hover:text-[#FF007F] border border-white/5"
                                                title="Copy Transaction ID"
                                            >
                                                {copiedId === `${tx.id || `${tx.transaction_id}-${tx.user_id}`}-tx` ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center space-x-3">
                                            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center shrink-0">
                                                <User size={14} className="text-gray-400" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-white">{tx.profiles?.username || 'User'}</span>
                                                <div className="flex items-center space-x-1 group">
                                                    <span className="text-[10px] text-gray-500 font-mono truncate w-20">{tx.user_id}</span>
                                                    <button
                                                        onClick={() => handleCopy(tx.id || `${tx.transaction_id}-${tx.user_id}`, tx.user_id, 'user')}
                                                        className="p-1 bg-white/5 hover:bg-white/10 rounded-md transition-all text-gray-500 hover:text-[#FF007F] border border-white/5"
                                                        title="Copy User ID"
                                                    >
                                                        {copiedId === `${tx.id || `${tx.transaction_id}-${tx.user_id}`}-user` ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-1 rounded-lg bg-amber-500/10 text-amber-500 text-[10px] font-black uppercase">
                                            {tx.product_id.replace('pawvibe_', '').replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-xs text-gray-400 capitalize">{tx.platform}</span>
                                    </td>
                                    <td className="px-6 py-4 text-xs text-gray-500">
                                        {new Date(tx.created_at).toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="px-6 py-4 bg-[#0A001A] flex justify-between items-center text-gray-400">
                    <Text className="text-xs uppercase font-bold tracking-widest opacity-60">Total: {data?.totalCount || 0} items</Text>
                    <div className="flex space-x-2">
                        <button
                            disabled={page === 1}
                            onClick={() => setPage(p => p - 1)}
                            className="p-2 border border-[#2D005A] rounded-lg disabled:opacity-30 hover:bg-white/5"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <button
                            disabled={!data?.transactions || data.transactions.length < 15}
                            onClick={() => setPage(p => p + 1)}
                            className="p-2 border border-[#2D005A] rounded-lg disabled:opacity-30 hover:bg-white/5"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PurchasesPage;
