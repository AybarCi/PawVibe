import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { callEdgeFunction } from '../lib/supabase';
import { Search, ChevronLeft, ChevronRight, Edit2, Shield, User, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const UsersPage: React.FC = () => {
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [adjustValue, setAdjustValue] = useState(0);
    const [reason, setReason] = useState('');

    const [copiedId, setCopiedId] = useState<string | null>(null);

    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: ['users', page, search],
        queryFn: () => callEdgeFunction('get-paged-users', { page, limit: 15, search }),
    });

    const mutation = useMutation({
        mutationFn: (vars: { userId: string; amount: number; reason: string }) =>
            callEdgeFunction('manage-user-credits', vars),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            setSelectedUser(null);
            setAdjustValue(0);
            setReason('');
        }
    });

    const handleCopy = (id: string) => {
        navigator.clipboard.writeText(id);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col lg:flex-row justify-between lg:items-end gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-center lg:text-left">User Management</h2>
                    <p className="text-gray-400 mt-1 text-center lg:text-left">Manage PawVibe users and adjust credits.</p>
                </div>

                <div className="relative w-full lg:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                    <input
                        type="text"
                        placeholder="Search by email or ID..."
                        className="bg-[#15002C] border border-[#2D005A] rounded-xl pl-10 pr-4 py-3 w-full focus:outline-none focus:border-[#FF007F] transition-all text-sm"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    />
                </div>
            </div>

            <div className="bg-[#15002C] border border-[#2D005A] rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[900px]">
                        <thead>
                            <tr className="bg-[#0A001A] text-gray-400 text-xs uppercase tracking-wider">
                                <th className="px-6 py-4">User ID</th>
                                <th className="px-6 py-4">Email</th>
                                <th className="px-6 py-4">Account Link Status</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Credits</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {isLoading ? (
                                <tr><td colSpan={6} className="p-12 text-center text-gray-500">Loading users...</td></tr>
                            ) : data?.users?.map((user: any) => (
                                <tr key={user.id} className="hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center space-x-2 group">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FF007F] to-[#6A4C93] flex items-center justify-center shrink-0">
                                                <User size={14} className="text-white" />
                                            </div>
                                            <p className="text-[11px] text-gray-400 font-mono tracking-tighter truncate w-24" title={user.id}>{user.id}</p>
                                            <button
                                                onClick={() => handleCopy(user.id)}
                                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded transition-all text-gray-500 hover:text-[#FF007F]"
                                                title="Copy ID"
                                            >
                                                {copiedId === user.id ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-sm font-medium text-white">{user.email || <span className="text-gray-600 italic">Anonymous</span>}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        {user.email_change ? (
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-[#FF007F] font-bold uppercase tracking-tight">Linking In Progress:</span>
                                                <span className="text-sm text-pink-200">{user.email_change}</span>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-gray-500 italic">
                                                {user.email ? 'Connected' : 'henüz hesabını bağlamamış'}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {user.profile?.is_premium ? (
                                            <span className="px-2 py-1 rounded-full bg-indigo-500/20 text-indigo-400 text-[10px] font-bold uppercase flex items-center w-fit gap-1">
                                                <Shield size={10} /> Premium
                                            </span>
                                        ) : (
                                            <span className="px-2 py-1 rounded-full bg-gray-500/20 text-gray-400 text-[10px] font-bold uppercase">Free</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-[#FFD700]">{user.profile?.purchased_credits || 0} Paid</span>
                                            <span className="text-[10px] text-gray-500">{user.profile?.weekly_credits || 0} Weekly</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-400">
                                        {new Date(user.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => setSelectedUser(user)}
                                            className="p-2 hover:bg-[#FF007F]/10 hover:text-[#FF007F] rounded-lg transition-colors text-gray-400"
                                        >
                                            <Edit2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            <div className="px-6 py-4 bg-[#0A001A] flex justify-between items-center">
                <p className="text-sm text-gray-500">
                    Showing {((page - 1) * 15) + 1} to {Math.min(page * 15, data?.totalCount || 0)} of {data?.totalCount || 0} users
                </p>
                <div className="flex space-x-2">
                    <button
                        disabled={page === 1}
                        onClick={() => setPage(p => p - 1)}
                        className="p-2 border border-[#2D005A] rounded-lg disabled:opacity-30 hover:bg-white/5 transition-colors"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <button
                        disabled={!data?.users || data.users.length < 15}
                        onClick={() => setPage(p => p + 1)}
                        className="p-2 border border-[#2D005A] rounded-lg disabled:opacity-30 hover:bg-white/5 transition-colors"
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>

            {/* Credit Adjust Modal */}
            <AnimatePresence>
                {selectedUser && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                            onClick={() => setSelectedUser(null)}
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                            className="relative bg-[#15002C] border border-[#2D005A] p-8 rounded-3xl w-full max-w-md shadow-2xl"
                        >
                            <h3 className="text-2xl font-bold">Adjust Credits</h3>
                            <p className="text-gray-400 text-sm mt-1 mb-6">User: {selectedUser.email || selectedUser.id}</p>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Amount (+ or -)</label>
                                    <input
                                        type="number"
                                        className="w-full bg-[#0A001A] border border-[#2D005A] rounded-xl px-4 py-3 mt-1 focus:outline-none focus:border-[#FF007F]"
                                        value={adjustValue}
                                        onChange={(e) => setAdjustValue(parseInt(e.target.value))}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Reason for manual adjustment</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Support gesture, Refund compensation"
                                        className="w-full bg-[#0A001A] border border-[#2D005A] rounded-xl px-4 py-3 mt-1 focus:outline-none focus:border-[#FF007F]"
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                    />
                                </div>

                                <div className="pt-4 flex gap-3">
                                    <button
                                        className="flex-1 bg-white/5 hover:bg-white/10 py-3 rounded-xl transition-colors font-bold"
                                        onClick={() => setSelectedUser(null)}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        disabled={mutation.isPending || !reason || adjustValue === 0}
                                        className="flex-1 bg-gradient-to-r from-[#FF007F] to-[#6A4C93] py-3 rounded-xl transition-all font-bold hover:shadow-[0_0_20px_rgba(255,0,127,0.3)] disabled:opacity-50"
                                        onClick={() => mutation.mutate({ userId: selectedUser.id, amount: adjustValue, reason })}
                                    >
                                        {mutation.isPending ? 'Processing...' : 'Confirm'}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default UsersPage;
