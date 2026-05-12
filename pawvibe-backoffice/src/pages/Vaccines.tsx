import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Syringe, CheckCircle2, Clock, Search, PawPrint } from 'lucide-react';

export default function VaccinesPage() {
    const [vaccines, setVaccines] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchVaccines();
    }, []);

    async function fetchVaccines() {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('vaccinations')
                .select('*')
                .order('date_administered', { ascending: false });

            if (error) throw error;
            setVaccines(data || []);
        } catch (err) {
            console.error('Error fetching vaccines:', err);
        } finally {
            setLoading(false);
        }
    }

    const filteredVaccines = vaccines.filter(v => 
        v.pet_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.vaccine_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black bg-gradient-to-r from-white to-gray-500 bg-clip-text text-transparent">
                        VACCINE TRACKER
                    </h1>
                    <p className="text-gray-500 mt-2 font-medium tracking-wide uppercase text-xs">Monitoring user-created pet health records</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input 
                            type="text" 
                            placeholder="Search pet or vaccine..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-[#15002C] border border-[#2D005A] rounded-2xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-[#FF007F] w-64 text-white"
                        />
                    </div>
                    <button 
                        onClick={fetchVaccines}
                        className="bg-[#15002C] border border-[#2D005A] p-3 rounded-2xl hover:border-[#00FFFF] transition-all text-[#00FFFF]"
                    >
                        Refresh
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-[#15002C] border border-[#2D005A] rounded-3xl overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-[#0A001A] border-b border-[#2D005A]">
                                <th className="px-6 py-5 text-xs font-black uppercase tracking-widest text-gray-500">Pet & Owner</th>
                                <th className="px-6 py-5 text-xs font-black uppercase tracking-widest text-gray-500">Vaccine Details</th>
                                <th className="px-6 py-5 text-xs font-black uppercase tracking-widest text-gray-500">Dates</th>
                                <th className="px-6 py-5 text-xs font-black uppercase tracking-widest text-gray-500 text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#2D005A]">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-20 text-center text-gray-500 italic">
                                        Loading vaccination records...
                                    </td>
                                </tr>
                            ) : filteredVaccines.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-20 text-center text-gray-500 italic">
                                        No records found.
                                    </td>
                                </tr>
                            ) : filteredVaccines.map((v) => (
                                <tr key={v.id} className="hover:bg-white/5 transition-colors group">
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-[#00FFFF]/10 flex items-center justify-center text-[#00FFFF] border border-[#00FFFF]/20">
                                                <PawPrint size={20} />
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-white group-hover:text-[#00FFFF] transition-colors uppercase">
                                                    {v.pet_name || 'Unknown Pet'}
                                                </div>
                                                <div className="text-xs text-gray-500 truncate max-w-[200px]">
                                                    {v.user_id}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-2">
                                            <Syringe size={14} className="text-[#FF007F]" />
                                            <span className="text-sm font-semibold text-gray-200">{v.vaccine_name}</span>
                                        </div>
                                        {v.notes && (
                                            <p className="text-[10px] text-gray-500 mt-1 italic line-clamp-1">{v.notes}</p>
                                        )}
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 text-xs text-gray-400">
                                                <CheckCircle2 size={12} className="text-green-500" />
                                                <span>Admin: {new Date(v.date_administered).toLocaleDateString()}</span>
                                            </div>
                                            {v.next_due_date && (
                                                <div className="flex items-center gap-2 text-xs text-gray-400">
                                                    <Clock size={12} className="text-[#FFD700]" />
                                                    <span>Due: {new Date(v.next_due_date).toLocaleDateString()}</span>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 text-right">
                                        <span className={`text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest ${
                                            v.is_completed ? 'bg-green-500/10 text-green-500' : 'bg-[#FFD700]/10 text-[#FFD700]'
                                        }`}>
                                            {v.is_completed ? 'Completed' : 'Upcoming'}
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
