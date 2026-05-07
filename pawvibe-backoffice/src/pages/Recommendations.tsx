import { useState, useEffect } from 'react';
import { callEdgeFunction } from '../lib/supabase';
import { Plus, Trash2, Edit2, ExternalLink, X, Search, CheckCircle2, AlertCircle, HelpCircle } from 'lucide-react';

interface Recommendation {
  id: string;
  name: string;
  description: string;
  image_url: string;
  affiliate_url: string;
  pet_type: 'cat' | 'dog' | 'both';
  min_energy: number;
  min_chaos: number;
  min_sweetness: number;
  is_active: boolean;
}

interface StatusModalProps {
  isOpen: boolean;
  type: 'success' | 'error' | 'confirm';
  title: string;
  message: string;
  onClose: () => void;
  onConfirm?: () => void;
}

const StatusModal = ({ isOpen, type, title, message, onClose, onConfirm }: StatusModalProps) => {
  if (!isOpen) return null;

  const config = {
    success: { icon: <CheckCircle2 size={48} className="text-emerald-500" />, color: 'border-emerald-500/50', bg: 'bg-emerald-500/10' },
    error: { icon: <AlertCircle size={48} className="text-red-500" />, color: 'border-red-500/50', bg: 'bg-red-500/10' },
    confirm: { icon: <HelpCircle size={48} className="text-[#FF007F]" />, color: 'border-[#FF007F]/50', bg: 'bg-[#FF007F]/10' },
  };

  const current = config[type];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className={`bg-[#15002C] border ${current.color} rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-2xl`}>
        <div className={`p-10 flex flex-col items-center text-center space-y-6 ${current.bg}`}>
          {current.icon}
          <div>
            <h3 className="text-xl font-black uppercase tracking-tighter italic text-white mb-2">{title}</h3>
            <p className="text-gray-400 text-sm font-medium">{message}</p>
          </div>

          <div className="flex gap-3 w-full">
            {type === 'confirm' ? (
              <>
                <button onClick={onClose} className="flex-1 bg-[#0A001A] border border-[#2D005A] text-gray-400 py-4 rounded-2xl font-bold hover:bg-white/5 transition-all">Cancel</button>
                <button onClick={() => { onConfirm?.(); onClose(); }} className="flex-1 bg-[#FF007F] text-white py-4 rounded-2xl font-bold hover:bg-[#FF007F]/80 shadow-lg shadow-[#FF007F]/20 transition-all">Yes, Delete</button>
              </>
            ) : (
              <button onClick={onClose} className="w-full bg-[#0A001A] border border-[#2D005A] text-white py-4 rounded-2xl font-bold hover:bg-white/5 transition-all">Got it</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function Recommendations() {
  const [items, setItems] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<Recommendation> | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Status Modal States
  const [statusModal, setStatusModal] = useState<{
    isOpen: boolean;
    type: 'success' | 'error' | 'confirm';
    title: string;
    message: string;
    onConfirm?: () => void;
  }>({
    isOpen: false,
    type: 'success',
    title: '',
    message: '',
  });

  const showStatus = (type: 'success' | 'error' | 'confirm', title: string, message: string, onConfirm?: () => void) => {
    setStatusModal({ isOpen: true, type, title, message, onConfirm });
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const data = await callEdgeFunction('manage-recommendations', { action: 'list' });
      setItems(data || []);
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      showStatus('error', 'Fetch Failed', 'Could not load products from the cosmic database.');
    }
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    const { id, ...payload } = editingItem;

    try {
      if (id) {
        await callEdgeFunction('manage-recommendations', { 
          action: 'update', 
          id, 
          payload 
        });
        showStatus('success', 'Updated!', 'Product has been beamed into the app successfully.');
      } else {
        await callEdgeFunction('manage-recommendations', { 
          action: 'create', 
          payload 
        });
        showStatus('success', 'Created!', 'New product has been added to the vibe pool.');
      }
      setIsModalOpen(false);
      setEditingItem(null);
      fetchItems();
    } catch (error: any) {
      showStatus('error', 'Save Error', error.message || 'Something went wrong while saving.');
    }
  };

  const handleDelete = async (id: string) => {
    showStatus('confirm', 'Are you sure?', 'This product will be removed from all pet recommendations.', async () => {
      try {
        await callEdgeFunction('manage-recommendations', { action: 'delete', id });
        fetchItems();
        // Show success briefly after delete? Maybe just fetchItems is enough.
      } catch (error: any) {
        showStatus('error', 'Delete Error', error.message || 'Could not delete the product.');
      }
    });
  };

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black bg-gradient-to-r from-white to-gray-500 bg-clip-text text-transparent uppercase tracking-tighter">
            Product Recommendations
          </h1>
          <p className="text-gray-500 mt-2 font-medium">Manage AI-driven product suggestions for pets</p>
        </div>
        <button 
          onClick={() => { setEditingItem({ pet_type: 'both', is_active: true, min_energy: 0, min_chaos: 0, min_sweetness: 0 }); setIsModalOpen(true); }}
          className="bg-[#FF007F] hover:bg-[#FF007F]/80 text-white px-6 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,0,127,0.3)] transition-all transform hover:scale-105"
        >
          <Plus size={20} />
          <span>Add New Product</span>
        </button>
      </div>

      <div className="bg-[#15002C]/50 border border-[#2D005A] rounded-3xl p-4 flex items-center gap-4 focus-within:border-[#FF007F] transition-colors">
        <Search className="text-gray-500 ml-2" size={20} />
        <input 
          type="text" 
          placeholder="Search products..." 
          className="bg-transparent border-none outline-none text-white w-full py-2"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-12 h-12 border-4 border-[#FF007F] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredItems.map((item) => (
            <div key={item.id} className="group bg-[#15002C] border border-[#2D005A] rounded-3xl overflow-hidden hover:border-[#FF007F]/50 transition-all shadow-xl hover:shadow-[#FF007F]/10">
              <div className="relative h-48 overflow-hidden bg-black">
                <img src={item.image_url} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 opacity-80 group-hover:opacity-100" />
                <div className="absolute top-4 right-4 flex gap-2">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                    item.pet_type === 'cat' ? 'bg-orange-500/20 text-orange-500' : 
                    item.pet_type === 'dog' ? 'bg-blue-500/20 text-blue-500' : 'bg-purple-500/20 text-purple-500'
                  }`}>
                    {item.pet_type}
                  </span>
                  {!item.is_active && (
                    <span className="bg-red-500/20 text-red-500 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">Inactive</span>
                  )}
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <h3 className="text-xl font-bold text-white group-hover:text-[#FF007F] transition-colors">{item.name}</h3>
                  <p className="text-gray-400 text-sm mt-1 line-clamp-2">{item.description}</p>
                </div>

                <div className="flex flex-wrap gap-2 py-2 border-y border-[#2D005A]/30">
                  {item.min_energy > 0 && <span className="text-[10px] text-gray-500 uppercase">⚡ En {item.min_energy}%</span>}
                  {item.min_chaos > 0 && <span className="text-[10px] text-gray-500 uppercase">🌀 Ch {item.min_chaos}%</span>}
                  {item.min_sweetness > 0 && <span className="text-[10px] text-gray-500 uppercase">💖 Sw {item.min_sweetness}%</span>}
                </div>

                <div className="flex items-center justify-between gap-3 pt-2">
                  <div className="flex gap-2">
                    <button onClick={() => { setEditingItem(item); setIsModalOpen(true); }} className="p-3 bg-[#2D005A]/50 hover:bg-[#FF007F]/20 text-gray-400 hover:text-[#FF007F] rounded-xl transition-all">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="p-3 bg-[#2D005A]/50 hover:bg-red-500/20 text-gray-400 hover:text-red-500 rounded-xl transition-all">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <a href={item.affiliate_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs font-bold text-[#6A4C93] hover:text-[#FF007F] transition-colors">
                    <span>Link</span>
                    <ExternalLink size={14} />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-[#15002C] border border-[#2D005A] rounded-[2.5rem] w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-[0_0_50px_rgba(255,0,127,0.2)]">
            <div className="p-8 lg:p-12">
              <div className="flex justify-between items-center mb-10">
                <h2 className="text-2xl font-black uppercase tracking-tighter italic">
                  {editingItem?.id ? 'Edit Product' : 'Add New Product'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-white/5 rounded-2xl text-gray-500">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest ml-1">Product Name</label>
                    <input 
                      required
                      type="text" 
                      className="w-full bg-[#0A001A] border border-[#2D005A] rounded-2xl px-5 py-4 focus:outline-none focus:border-[#FF007F] text-white"
                      value={editingItem?.name || ''}
                      onChange={e => setEditingItem({ ...editingItem, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest ml-1">Pet Type</label>
                    <select 
                      className="w-full bg-[#0A001A] border border-[#2D005A] rounded-2xl px-5 py-4 focus:outline-none focus:border-[#FF007F] text-white appearance-none"
                      value={editingItem?.pet_type || 'both'}
                      onChange={e => setEditingItem({ ...editingItem, pet_type: e.target.value as any })}
                    >
                      <option value="both">Both (Cat & Dog)</option>
                      <option value="cat">Only Cats</option>
                      <option value="dog">Only Dogs</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest ml-1">Image URL</label>
                  <input 
                    type="text" 
                    className="w-full bg-[#0A001A] border border-[#2D005A] rounded-2xl px-5 py-4 focus:outline-none focus:border-[#FF007F] text-white font-mono text-sm"
                    placeholder="https://..."
                    value={editingItem?.image_url || ''}
                    onChange={e => setEditingItem({ ...editingItem, image_url: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest ml-1">Affiliate Link</label>
                  <input 
                    required
                    type="text" 
                    className="w-full bg-[#0A001A] border border-[#2D005A] rounded-2xl px-5 py-4 focus:outline-none focus:border-[#FF007F] text-white font-mono text-sm"
                    placeholder="https://amazon.com/..."
                    value={editingItem?.affiliate_url || ''}
                    onChange={e => setEditingItem({ ...editingItem, affiliate_url: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest ml-1">Description</label>
                  <textarea 
                    rows={3}
                    className="w-full bg-[#0A001A] border border-[#2D005A] rounded-2xl px-5 py-4 focus:outline-none focus:border-[#FF007F] text-white"
                    value={editingItem?.description || ''}
                    onChange={e => setEditingItem({ ...editingItem, description: e.target.value })}
                  />
                </div>

                <div className="bg-[#0A001A] p-6 rounded-3xl border border-[#2D005A] space-y-6">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-[#6A4C93]">Vibe Thresholds (0-100)</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] text-gray-600 font-bold uppercase">Min Energy</label>
                      <input 
                        type="number" min="0" max="100"
                        className="w-full bg-[#15002C] border border-[#2D005A] rounded-xl px-4 py-2 focus:outline-none focus:border-[#FF007F] text-white"
                        value={editingItem?.min_energy || 0}
                        onChange={e => setEditingItem({ ...editingItem, min_energy: parseInt(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] text-gray-600 font-bold uppercase">Min Chaos</label>
                      <input 
                        type="number" min="0" max="100"
                        className="w-full bg-[#15002C] border border-[#2D005A] rounded-xl px-4 py-2 focus:outline-none focus:border-[#FF007F] text-white"
                        value={editingItem?.min_chaos || 0}
                        onChange={e => setEditingItem({ ...editingItem, min_chaos: parseInt(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] text-gray-600 font-bold uppercase">Min Sweet</label>
                      <input 
                        type="number" min="0" max="100"
                        className="w-full bg-[#15002C] border border-[#2D005A] rounded-xl px-4 py-2 focus:outline-none focus:border-[#FF007F] text-white"
                        value={editingItem?.min_sweetness || 0}
                        onChange={e => setEditingItem({ ...editingItem, min_sweetness: parseInt(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 py-4">
                  <input 
                    type="checkbox" 
                    id="is_active"
                    className="w-5 h-5 accent-[#FF007F]"
                    checked={editingItem?.is_active || false}
                    onChange={e => setEditingItem({ ...editingItem, is_active: e.target.checked })}
                  />
                  <label htmlFor="is_active" className="text-sm font-bold text-gray-300">Active and Visible</label>
                </div>

                <button className="w-full bg-gradient-to-r from-[#FF007F] to-[#6A4C93] py-5 rounded-[1.5rem] font-black uppercase tracking-widest text-lg shadow-lg hover:shadow-[#FF007F]/20 transition-all active:scale-[0.98]">
                  Save Product
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      <StatusModal 
        {...statusModal} 
        onClose={() => setStatusModal({ ...statusModal, isOpen: false })} 
      />
    </div>
  );
}
