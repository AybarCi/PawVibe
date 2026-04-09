import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { callEdgeFunction } from '../lib/supabase';
import { Search, ChevronLeft, ChevronRight, Camera } from 'lucide-react';

const AnalysesPage: React.FC = () => {
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');

    const { data, isLoading } = useQuery({
        queryKey: ['scans', page, search],
        queryFn: () => callEdgeFunction('get-paged-scans', { page, limit: 15, search }),
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col lg:flex-row justify-between lg:items-end gap-4">
                <div>
                    <h2 className="text-3xl font-bold">Vibe Analyses</h2>
                    <p className="text-gray-400 mt-1 text-sm">Monitor all pet mood scans and AI activity.</p>
                </div>

                <div className="relative w-full lg:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                    <input
                        type="text"
                        placeholder="Search by mood title..."
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
                                <th className="px-6 py-4">Scan Details</th>
                                <th className="px-6 py-4">User Info</th>
                                <th className="px-6 py-4">Mood Title</th>
                                <th className="px-6 py-4">Confidence</th>
                                <th className="px-6 py-4">Stats</th>
                                <th className="px-6 py-4">Created At</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {isLoading ? (
                                <tr><td colSpan={6} className="p-12 text-center text-gray-500">Loading analyses...</td></tr>
                            ) : data?.scans?.map((scan: any) => (
                                <tr key={scan.id} className="hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center space-x-3">
                                            <div className="w-10 h-10 rounded-xl bg-[#FF007F]/10 flex items-center justify-center shrink-0 border border-[#FF007F]/20">
                                                <Camera size={18} className="text-[#FF007F]" />
                                            </div>
                                            <div className="flex flex-col">
                                                <p className="text-[10px] text-gray-500 font-mono truncate w-24" title={scan.id}>{scan.id}</p>
                                                <span className="text-[10px] text-[#6A4C93] font-bold">VIBE-CHECK</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <p className="text-sm font-medium text-white">{scan.email}</p>
                                            <p className="text-[10px] text-gray-500">@{scan.username}</p>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-sm font-bold text-white bg-gradient-to-r from-[#FF007F] to-[#6A4C93] bg-clip-text text-transparent">
                                            {scan.mood_title}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 h-1.5 w-16 bg-[#0A001A] rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-emerald-500" 
                                                    style={{ width: `${scan.confidence * 100}%` }}
                                                />
                                            </div>
                                            <span className="text-xs text-emerald-500 font-bold">{(scan.confidence * 100).toFixed(0)}%</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-4">
                                            <MetricSmall label="CH" value={scan.chaos_score} color="pink" />
                                            <MetricSmall label="EN" value={scan.energy_level} color="cyan" />
                                            <MetricSmall label="SW" value={scan.sweetness_score} color="amber" />
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-400">
                                        {new Date(scan.created_at).toLocaleString()}
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
                    Total: {data?.totalCount || 0} analyses
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
                        disabled={!data?.scans || data.scans.length < 15}
                        onClick={() => setPage(p => p + 1)}
                        className="p-2 border border-[#2D005A] rounded-lg disabled:opacity-30 hover:bg-white/5 transition-colors"
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};

const MetricSmall = ({ label, value, color }: { label: string; value: number, color: string }) => {
    const colorMap: any = {
        pink: 'text-[#FF007F]',
        cyan: 'text-[#00FFFF]',
        amber: 'text-[#FFD700]'
    };
    return (
        <div className="flex items-center gap-1">
            <span className="text-[9px] text-gray-600 font-black">{label}</span>
            <span className={`text-xs font-bold ${colorMap[color]}`}>{value}</span>
        </div>
    );
};

export default AnalysesPage;
