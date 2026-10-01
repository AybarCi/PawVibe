import React, { useState, useEffect, useMemo, useRef } from 'react';
import { callEdgeFunction } from '../lib/supabase';
import {
  Store,
  Plus,
  Trash2,
  Edit2,
  ExternalLink,
  X,
  Search,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Upload,
  Mail,
  Send,
  Eye,
  FileText,
  RefreshCw,
  Phone,
  CheckSquare,
  Square,
  Download,
} from 'lucide-react';

interface Petshop {
  id: string;
  name: string;
  email: string;
  country: 'TR' | 'US';
  city?: string;
  website?: string;
  phone?: string;
  category: 'general' | 'ecommerce' | 'retail' | 'boutique' | 'vet_clinic';
  status: 'lead' | 'contacted' | 'replied' | 'partner' | 'unsubscribed';
  notes?: string;
  last_contacted_at?: string;
  created_at: string;
}

interface PetshopStats {
  total: number;
  us_count: number;
  tr_count: number;
  lead_count: number;
  contacted_count: number;
  partner_count: number;
}

const DEFAULT_TEMPLATES = {
  tr: {
    subject: 'PawVibe Yapay Zekâ Evcil Hayvan Analizi & {{shop_name}} Ürün Ortaklığı Teklifi',
    body: `Merhaba {{shop_name}} Ekibi,

PawVibe olarak, evcil hayvan sahiplerinin kedi ve köpek fotoğraflarını yükleyerek yapay zekâ destekli duygu, enerji ve davranış analizi aldığı yenilikçi bir mobil platform sunuyoruz.

Kullanıcılarımız evcil hayvanlarının mod analizini tamamladığında, sistemimiz onların anlık ruh haline, ırkına ve yaş özelliklerine uygun özel ürün önerileri listelemektedir.

{{shop_name}} bünyesindeki kaliteli evcil hayvan ürünlerini ve mama/oyuncak çeşitlerini PawVibe platformundaki analiz sonuçlarında doğrudan hedef kitleye önermek ve mağazanıza yüksek dönüşümlü satış trafiği yönlendirmek istiyoruz.

Sıfır maliyetli ve komisyon/affiliate bazlı bu iş ortaklığı fırsatını kısaca görüşmek üzere uygun bir zamanınızı rica ederiz.`,
  },
  en: {
    subject: 'PawVibe AI Pet Behavioral Analysis & {{shop_name}} Product Partnership',
    body: `Hello {{shop_name}} Team,

At PawVibe, we provide an AI-powered pet behavioral and mood analysis platform that helps pet parents understand their cats and dogs on a deeper level through real-time ethological visual scans.

Following each vibe analysis, our engine generates personalized, context-aware product recommendations tailored to the pet's current energy, mood, breed, and life stage.

We would love to feature {{shop_name}}'s premium pet products and accessories directly inside our post-analysis recommendation feed, driving highly engaged, pet-loving customers directly to your storefront.

We operate flexible placement and affiliate partnership models. Let us know if you would be open to a quick 10-minute chat this week to explore collaboration!`,
  },
};

export default function PetshopsPage() {
  const [petshops, setPetshops] = useState<Petshop[]>([]);
  const [stats, setStats] = useState<PetshopStats>({
    total: 0,
    us_count: 0,
    tr_count: 0,
    lead_count: 0,
    contacted_count: 0,
    partner_count: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCountry, setFilterCountry] = useState<'ALL' | 'TR' | 'US'>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [editingPetshop, setEditingPetshop] = useState<Petshop | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isOutreachOpen, setIsOutreachOpen] = useState(false);

  // Status Modal (Alert/Confirm)
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

  // Outreach Modal State
  const [outreachLang, setOutreachLang] = useState<'tr' | 'en'>('tr');
  const [outreachSubject, setOutreachSubject] = useState(DEFAULT_TEMPLATES.tr.subject);
  const [outreachBody, setOutreachBody] = useState(DEFAULT_TEMPLATES.tr.body);
  const [outreachTab, setOutreachTab] = useState<'edit' | 'preview'>('edit');
  const [isSendingOutreach, setIsSendingOutreach] = useState(false);

  // CSV Import State
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedCsvRows, setParsedCsvRows] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Add/Edit Form State
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formCountry, setFormCountry] = useState<'TR' | 'US'>('TR');
  const [formCity, setFormCity] = useState('');
  const [formWebsite, setFormWebsite] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formCategory, setFormCategory] = useState<Petshop['category']>('general');
  const [formStatus, setFormStatus] = useState<Petshop['status']>('lead');
  const [formNotes, setFormNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Load Data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [listRes, statsRes] = await Promise.all([
        callEdgeFunction('manage-petshops', {
          action: 'list',
          payload: {
            country: filterCountry,
            status: filterStatus,
            search,
          },
        }),
        callEdgeFunction('manage-petshops', { action: 'stats' }),
      ]);

      setPetshops(Array.isArray(listRes) ? listRes : []);
      if (statsRes && typeof statsRes === 'object') {
        setStats(statsRes);
      }
    } catch (err: any) {
      console.error('[Petshops] Error loading data:', err);
      setStatusModal({
        isOpen: true,
        type: 'error',
        title: 'Veri Yükleme Hatası',
        message: err.message || 'Petshop verileri yüklenirken bir hata oluştu.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filterCountry, filterStatus]);

  // Handle Search Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Sync Outreach Language with Selected Target Market
  useEffect(() => {
    if (outreachLang === 'tr') {
      setOutreachSubject(DEFAULT_TEMPLATES.tr.subject);
      setOutreachBody(DEFAULT_TEMPLATES.tr.body);
    } else {
      setOutreachSubject(DEFAULT_TEMPLATES.en.subject);
      setOutreachBody(DEFAULT_TEMPLATES.en.body);
    }
  }, [outreachLang]);

  // Selection Logic
  const allFilteredIds = useMemo(() => petshops.map((p) => p.id), [petshops]);
  const isAllSelected = petshops.length > 0 && selectedIds.length === petshops.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(allFilteredIds);
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Add / Edit Modal Open
  const openAddModal = () => {
    setEditingPetshop(null);
    setFormName('');
    setFormEmail('');
    setFormCountry(filterCountry === 'US' ? 'US' : 'TR');
    setFormCity('');
    setFormWebsite('');
    setFormPhone('');
    setFormCategory('general');
    setFormStatus('lead');
    setFormNotes('');
    setIsAddEditOpen(true);
  };

  const openEditModal = (p: Petshop) => {
    setEditingPetshop(p);
    setFormName(p.name);
    setFormEmail(p.email);
    setFormCountry(p.country);
    setFormCity(p.city || '');
    setFormWebsite(p.website || '');
    setFormPhone(p.phone || '');
    setFormCategory(p.category || 'general');
    setFormStatus(p.status || 'lead');
    setFormNotes(p.notes || '');
    setIsAddEditOpen(true);
  };

  const handleSavePetshop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim()) {
      alert('İsim ve E-posta zorunludur.');
      return;
    }

    setIsSaving(true);
    try {
      if (editingPetshop) {
        await callEdgeFunction('manage-petshops', {
          action: 'update',
          id: editingPetshop.id,
          payload: {
            name: formName,
            email: formEmail,
            country: formCountry,
            city: formCity || null,
            website: formWebsite || null,
            phone: formPhone || null,
            category: formCategory,
            status: formStatus,
            notes: formNotes || null,
          },
        });
      } else {
        await callEdgeFunction('manage-petshops', {
          action: 'create',
          payload: {
            name: formName,
            email: formEmail,
            country: formCountry,
            city: formCity || null,
            website: formWebsite || null,
            phone: formPhone || null,
            category: formCategory,
            status: formStatus,
            notes: formNotes || null,
          },
        });
      }

      setIsAddEditOpen(false);
      fetchData();
      setStatusModal({
        isOpen: true,
        type: 'success',
        title: 'Başarılı',
        message: editingPetshop
          ? 'Petshop bilgileri güncellendi.'
          : 'Yeni petshop başarıyla kaydedildi.',
      });
    } catch (err: any) {
      console.error(err);
      setStatusModal({
        isOpen: true,
        type: 'error',
        title: 'Kayıt Hatası',
        message: err.message || 'Kayıt sırasında bir hata oluştu.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete
  const handleDelete = (id: string, name: string) => {
    setStatusModal({
      isOpen: true,
      type: 'confirm',
      title: 'Petshop Silinsin mi?',
      message: `"${name}" adlı petshop veritabanından kalıcı olarak silinecektir.`,
      onConfirm: async () => {
        try {
          await callEdgeFunction('manage-petshops', { action: 'delete', id });
          setSelectedIds((prev) => prev.filter((i) => i !== id));
          fetchData();
        } catch (err: any) {
          alert('Silme hatası: ' + err.message);
        }
      },
    });
  };

  // Bulk Delete
  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setStatusModal({
      isOpen: true,
      type: 'confirm',
      title: 'Toplu Silme Onayı',
      message: `Seçili ${selectedIds.length} adet petshop kalıcı olarak silinecektir.`,
      onConfirm: async () => {
        try {
          await callEdgeFunction('manage-petshops', {
            action: 'delete',
            ids: selectedIds,
          });
          setSelectedIds([]);
          fetchData();
        } catch (err: any) {
          alert('Toplu silme hatası: ' + err.message);
        }
      },
    });
  };

  // CSV Parsing
  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r\n|\n/).filter((l) => l.trim().length > 0);
      if (lines.length <= 1) {
        alert('CSV dosyası boş veya sadece başlık satırı içeriyor.');
        return;
      }

      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/["']/g, ''));
      const rows: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        // Basic CSV regex split taking into account quoted strings
        const values = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((v) => v.trim().replace(/^["']|["']$/g, ''));

        if (values.length < 2) continue;

        const rowObj: any = {};
        headers.forEach((header, idx) => {
          rowObj[header] = values[idx] || '';
        });

        // Map column aliases
        const name = rowObj.name || rowObj['petshop_name'] || rowObj['store_name'] || rowObj['title'] || '';
        const email = rowObj.email || rowObj['mail'] || rowObj['contact_email'] || '';
        const country = (rowObj.country || rowObj['country_code'] || 'TR').toUpperCase() === 'US' ? 'US' : 'TR';
        const city = rowObj.city || rowObj['state'] || '';
        const website = rowObj.website || rowObj['url'] || rowObj['site'] || '';
        const phone = rowObj.phone || rowObj['tel'] || '';
        const category = rowObj.category || 'general';

        if (name && email && email.includes('@')) {
          rows.push({ name, email, country, city, website, phone, category });
        }
      }

      setParsedCsvRows(rows);
    };
    reader.readAsText(file);
  };

  const handleExecuteImport = async () => {
    if (parsedCsvRows.length === 0) return;
    setIsImporting(true);

    try {
      const res = await callEdgeFunction('manage-petshops', {
        action: 'bulk_import',
        payload: { items: parsedCsvRows },
      });

      setIsImportOpen(false);
      setCsvFile(null);
      setParsedCsvRows([]);
      fetchData();

      setStatusModal({
        isOpen: true,
        type: 'success',
        title: 'İçe Aktarma Tamamlandı',
        message: `${res.imported || parsedCsvRows.length} adet petshop başarıyla sisteme aktarıldı.`,
      });
    } catch (err: any) {
      console.error(err);
      setStatusModal({
        isOpen: true,
        type: 'error',
        title: 'İçe Aktarma Hatası',
        message: err.message || 'CSV aktarılırken bir hata oluştu.',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const downloadSampleCsv = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,name,email,country,city,website,phone,category\n' +
      'Pati Petshop,info@patipetshop.com,TR,Istanbul,https://patipetshop.com,02120000000,boutique\n' +
      'Bay Area Pet Supply,hello@bayareapets.com,US,San Francisco,https://bayareapets.com,+14155552671,ecommerce\n';

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'petshops_sample.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Outreach Handlers
  const openOutreachModal = () => {
    if (selectedIds.length === 0) return;

    // Detect primary country among selected
    const selectedShops = petshops.filter((p) => selectedIds.includes(p.id));
    const usCount = selectedShops.filter((s) => s.country === 'US').length;
    const isMainlyUs = usCount > selectedShops.length / 2;

    const initialLang = isMainlyUs ? 'en' : 'tr';
    setOutreachLang(initialLang);
    setOutreachSubject(DEFAULT_TEMPLATES[initialLang].subject);
    setOutreachBody(DEFAULT_TEMPLATES[initialLang].body);
    setOutreachTab('edit');
    setIsOutreachOpen(true);
  };

  const handleSendOutreach = async () => {
    if (selectedIds.length === 0) return;
    setIsSendingOutreach(true);

    try {
      const res = await callEdgeFunction('send-petshop-outreach', {
        petshop_ids: selectedIds,
        language: outreachLang,
        subject_template: outreachSubject,
        body_template: outreachBody,
      });

      setIsOutreachOpen(false);
      setSelectedIds([]);
      fetchData();

      setStatusModal({
        isOpen: true,
        type: 'success',
        title: 'E-Postalar İletildi',
        message: `${res.sent || selectedIds.length} petshop'a B2B e-postası başarıyla gönderildi ve durumları güncellendi.`,
      });
    } catch (err: any) {
      console.error(err);
      setStatusModal({
        isOpen: true,
        type: 'error',
        title: 'Gönderim Hatası',
        message: err.message || 'E-postalar gönderilirken bir hata oluştu.',
      });
    } finally {
      setIsSendingOutreach(false);
    }
  };

  // Preview petshop for dynamic interpolation in preview tab
  const sampleShopForPreview = useMemo(() => {
    if (selectedIds.length > 0) {
      const found = petshops.find((p) => selectedIds.includes(p.id));
      if (found) return found;
    }
    return (
      petshops[0] || {
        id: 'sample',
        name: outreachLang === 'tr' ? 'Örnek Pet Butik' : 'Sample Pet Supply Co.',
        email: 'partner@example.com',
        country: outreachLang === 'tr' ? 'TR' : 'US',
        city: outreachLang === 'tr' ? 'İstanbul' : 'Austin, TX',
        website: 'https://examplepet.com',
        category: 'boutique',
        status: 'lead',
        created_at: new Date().toISOString(),
      }
    );
  }, [selectedIds, petshops, outreachLang]);

  const previewSubject = outreachSubject
    .replace(/{{shop_name}}/gi, sampleShopForPreview.name)
    .replace(/{{website}}/gi, sampleShopForPreview.website || 'https://petshop.com')
    .replace(/{{city}}/gi, sampleShopForPreview.city || '');

  const previewBody = outreachBody
    .replace(/{{shop_name}}/gi, sampleShopForPreview.name)
    .replace(/{{website}}/gi, sampleShopForPreview.website || 'https://petshop.com')
    .replace(/{{city}}/gi, sampleShopForPreview.city || '');

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* 1. Header & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#FF007F] to-[#6A4C93] flex items-center justify-center shadow-lg shadow-[#FF007F]/20">
              <Store className="text-white" size={26} />
            </div>
            <div>
              <h2 className="text-3xl font-black italic tracking-tighter uppercase text-white flex items-center gap-2">
                Petshops <span className="text-[#FF007F]">B2B Outreach</span>
              </h2>
              <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">
                Türkiye & ABD Pazarındaki Pet Mağazalarına Tanıtım ve Ortaklık E-Postaları
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsImportOpen(true)}
            className="flex items-center gap-2 bg-[#15002C] hover:bg-[#20003E] text-white border border-[#2D005A] hover:border-[#FF007F]/50 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-md"
          >
            <Upload size={16} className="text-[#FFD700]" />
            <span>CSV İçe Aktar</span>
          </button>

          <button
            onClick={openAddModal}
            className="flex items-center gap-2 bg-gradient-to-r from-[#FF007F] to-[#6A4C93] hover:from-[#FF007F]/90 hover:to-[#6A4C93]/90 text-white px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-[#FF007F]/20"
          >
            <Plus size={16} />
            <span>Yeni Petshop Ekle</span>
          </button>
        </div>
      </div>

      {/* 2. Live Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-[#15002C] border border-[#2D005A] p-4 rounded-2xl">
          <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Toplam Kayıt</p>
          <p className="text-2xl font-black text-white mt-1">{stats.total}</p>
        </div>

        <div className="bg-[#15002C] border border-[#2D005A] p-4 rounded-2xl">
          <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest flex items-center gap-1">
            <span>🇺🇸 ABD (US)</span>
          </p>
          <p className="text-2xl font-black text-[#FF007F] mt-1">{stats.us_count}</p>
        </div>

        <div className="bg-[#15002C] border border-[#2D005A] p-4 rounded-2xl">
          <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest flex items-center gap-1">
            <span>🇹🇷 Türkiye (TR)</span>
          </p>
          <p className="text-2xl font-black text-cyan-400 mt-1">{stats.tr_count}</p>
        </div>

        <div className="bg-[#15002C] border border-[#2D005A] p-4 rounded-2xl">
          <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Yeni Lead</p>
          <p className="text-2xl font-black text-yellow-400 mt-1">{stats.lead_count}</p>
        </div>

        <div className="bg-[#15002C] border border-[#2D005A] p-4 rounded-2xl">
          <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Mail Atıldı</p>
          <p className="text-2xl font-black text-purple-400 mt-1">{stats.contacted_count}</p>
        </div>

        <div className="bg-[#15002C] border border-[#2D005A] p-4 rounded-2xl">
          <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">İş Ortağı</p>
          <p className="text-2xl font-black text-emerald-400 mt-1">{stats.partner_count}</p>
        </div>
      </div>

      {/* 3. Filters, Search & Multi-Action Bar */}
      <div className="bg-[#15002C] border border-[#2D005A] p-5 rounded-3xl space-y-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Petshop adı, e-posta, şehir veya web sitesi ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#0A001A] border border-[#2D005A] focus:border-[#FF007F] rounded-2xl pl-12 pr-4 py-3 text-sm text-white focus:outline-none transition-all"
            />
          </div>

          {/* Filter Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Country Tabs */}
            <div className="flex bg-[#0A001A] border border-[#2D005A] rounded-2xl p-1">
              <button
                onClick={() => setFilterCountry('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                  filterCountry === 'ALL' ? 'bg-[#FF007F] text-white shadow-md' : 'text-gray-400 hover:text-white'
                }`}
              >
                Tümü
              </button>
              <button
                onClick={() => setFilterCountry('TR')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                  filterCountry === 'TR' ? 'bg-cyan-600 text-white shadow-md' : 'text-gray-400 hover:text-white'
                }`}
              >
                <span>🇹🇷 Türkiye</span>
              </button>
              <button
                onClick={() => setFilterCountry('US')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                  filterCountry === 'US' ? 'bg-[#FF007F] text-white shadow-md' : 'text-gray-400 hover:text-white'
                }`}
              >
                <span>🇺🇸 ABD</span>
              </button>
            </div>

            {/* Status Dropdown */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-[#0A001A] border border-[#2D005A] text-white text-xs font-bold rounded-2xl px-4 py-3 focus:outline-none focus:border-[#FF007F]"
            >
              <option value="ALL">Tüm Durumlar</option>
              <option value="lead">Yeni (Lead)</option>
              <option value="contacted">Mail Atıldı</option>
              <option value="replied">Cevap Alındı</option>
              <option value="partner">İş Ortağı (Partner)</option>
            </select>

            <button
              onClick={fetchData}
              title="Yenile"
              className="p-3 bg-[#0A001A] border border-[#2D005A] text-gray-400 hover:text-white hover:border-[#FF007F] rounded-2xl transition-all"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Bulk Action Strip when items are selected */}
        {selectedIds.length > 0 && (
          <div className="bg-gradient-to-r from-[#FF007F]/15 to-[#6A4C93]/15 border border-[#FF007F]/40 p-3 rounded-2xl flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-300">
            <div className="flex items-center gap-3">
              <span className="bg-[#FF007F] text-white text-xs font-black px-3 py-1 rounded-full">
                {selectedIds.length} Petshop Seçildi
              </span>
              <button
                onClick={() => setSelectedIds([])}
                className="text-gray-400 hover:text-white text-xs underline font-bold"
              >
                Seçimi Temizle
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={openOutreachModal}
                className="flex items-center gap-2 bg-gradient-to-r from-[#FF007F] to-[#6A4C93] text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider shadow-md hover:scale-105 transition-all"
              >
                <Mail size={14} />
                <span>Seçilenlere E-Posta Gönder</span>
              </button>

              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 px-3 py-2 rounded-xl text-xs font-bold transition-all"
              >
                <Trash2 size={14} />
                <span>Sil</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. Table */}
      <div className="bg-[#15002C] border border-[#2D005A] rounded-3xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-[#0A001A] border-b border-[#2D005A] text-[10px] font-black uppercase tracking-widest text-gray-400">
              <tr>
                <th className="p-4 w-12 text-center">
                  <button onClick={toggleSelectAll} className="text-gray-400 hover:text-white">
                    {isAllSelected ? (
                      <CheckSquare size={18} className="text-[#FF007F]" />
                    ) : (
                      <Square size={18} />
                    )}
                  </button>
                </th>
                <th className="p-4">Petshop Adı</th>
                <th className="p-4">Pazar / Ülke</th>
                <th className="p-4">İletişim E-Postası</th>
                <th className="p-4">Şehir / Web</th>
                <th className="p-4">Durum</th>
                <th className="p-4">Son İletişim</th>
                <th className="p-4 text-right">Aksiyonlar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2D005A]/40">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-gray-500">
                    <RefreshCw className="animate-spin inline-block mr-2" size={20} />
                    Petshop listesi yükleniyor...
                  </td>
                </tr>
              ) : petshops.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-20 px-4">
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto text-gray-500">
                        <Store size={32} />
                      </div>
                      <h4 className="text-lg font-black text-white italic uppercase tracking-wider">
                        Henüz Petshop Kaydı Bulunmuyor
                      </h4>
                      <p className="text-gray-400 text-xs leading-relaxed">
                        Yukarıdaki <strong>"CSV İçe Aktar"</strong> butonu ile pet mağazası listenizi toplu yükleyebilir veya <strong>"Yeni Petshop Ekle"</strong> butonuyla manuel kayıt oluşturabilirsiniz.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                petshops.map((shop) => {
                  const isSelected = selectedIds.includes(shop.id);
                  return (
                    <tr
                      key={shop.id}
                      className={`hover:bg-white/[0.02] transition-colors ${
                        isSelected ? 'bg-[#FF007F]/5' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-4 text-center">
                        <button
                          onClick={() => toggleSelectRow(shop.id)}
                          className="text-gray-400 hover:text-white"
                        >
                          {isSelected ? (
                            <CheckSquare size={18} className="text-[#FF007F]" />
                          ) : (
                            <Square size={18} />
                          )}
                        </button>
                      </td>

                      {/* Name & Category */}
                      <td className="p-4">
                        <div className="font-bold text-white text-sm">{shop.name}</div>
                        <div className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">
                          {shop.category || 'Genel'}
                        </div>
                      </td>

                      {/* Country Flag Badge */}
                      <td className="p-4">
                        {shop.country === 'TR' ? (
                          <span className="inline-flex items-center gap-1.5 bg-cyan-950/60 border border-cyan-800/50 text-cyan-300 text-xs font-black px-2.5 py-1 rounded-xl">
                            <span>🇹🇷</span> Türkiye
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 bg-[#FF007F]/10 border border-[#FF007F]/30 text-[#FF007F] text-xs font-black px-2.5 py-1 rounded-xl">
                            <span>🇺🇸</span> USA
                          </span>
                        )}
                      </td>

                      {/* Email & Phone */}
                      <td className="p-4">
                        <div className="text-white font-mono text-xs">{shop.email}</div>
                        {shop.phone && (
                          <div className="text-gray-500 text-[11px] flex items-center gap-1 mt-0.5">
                            <Phone size={10} />
                            <span>{shop.phone}</span>
                          </div>
                        )}
                      </td>

                      {/* City & Website */}
                      <td className="p-4">
                        <div className="text-gray-300 text-xs font-medium">
                          {shop.city || '-'}
                        </div>
                        {shop.website ? (
                          <a
                            href={shop.website.startsWith('http') ? shop.website : `https://${shop.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[#FF007F] hover:underline text-[11px] mt-0.5"
                          >
                            <span>Siteye Git</span>
                            <ExternalLink size={10} />
                          </a>
                        ) : (
                          <span className="text-gray-600 text-[11px]">-</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="p-4">
                        {shop.status === 'lead' && (
                          <span className="bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full">
                            Lead
                          </span>
                        )}
                        {shop.status === 'contacted' && (
                          <span className="bg-purple-500/15 text-purple-400 border border-purple-500/30 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full">
                            Mail Atıldı
                          </span>
                        )}
                        {shop.status === 'replied' && (
                          <span className="bg-blue-500/15 text-blue-400 border border-blue-500/30 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full">
                            Cevap Verdi
                          </span>
                        )}
                        {shop.status === 'partner' && (
                          <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full">
                            İş Ortağı
                          </span>
                        )}
                        {shop.status === 'unsubscribed' && (
                          <span className="bg-gray-500/15 text-gray-400 border border-gray-500/30 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full">
                            Ayrıldı
                          </span>
                        )}
                      </td>

                      {/* Last Contacted */}
                      <td className="p-4 text-xs text-gray-400">
                        {shop.last_contacted_at ? (
                          new Date(shop.last_contacted_at).toLocaleDateString('tr-TR', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        ) : (
                          <span className="text-gray-600 italic">Gönderilmedi</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setSelectedIds([shop.id]);
                              openOutreachModal();
                            }}
                            title="Bu Mağazaya Mail Gönder"
                            className="p-2 bg-[#0A001A] border border-[#2D005A] text-purple-400 hover:text-white hover:border-[#FF007F] rounded-xl transition-all"
                          >
                            <Mail size={14} />
                          </button>
                          <button
                            onClick={() => openEditModal(shop)}
                            title="Düzenle"
                            className="p-2 bg-[#0A001A] border border-[#2D005A] text-gray-400 hover:text-white hover:border-cyan-500 rounded-xl transition-all"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(shop.id, shop.name)}
                            title="Sil"
                            className="p-2 bg-[#0A001A] border border-[#2D005A] text-red-500 hover:text-red-400 hover:border-red-500 rounded-xl transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 5. OUTREACH & EMAIL PREVIEW MODAL */}
      {/* ========================================================= */}
      {isOutreachOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-[#15002C] border border-[#2D005A] rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="p-6 border-b border-[#2D005A] flex items-center justify-between bg-[#0A001A]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-[#FF007F] to-[#6A4C93] flex items-center justify-center text-white">
                  <Mail size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black italic uppercase text-white tracking-tight">
                    Petshop B2B E-Posta Gönderimi
                  </h3>
                  <p className="text-xs text-gray-400">
                    Seçili <span className="text-[#FF007F] font-bold">{selectedIds.length}</span> mağazaya kişiselleştirilmiş tanıtım iletisi gönderilecek.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOutreachOpen(false)}
                className="text-gray-400 hover:text-white p-2 rounded-xl"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Navigation / Language & Tabs Bar */}
            <div className="px-6 py-3 bg-[#120024] border-b border-[#2D005A] flex flex-wrap items-center justify-between gap-3">
              {/* Target Country Language Switch */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Hedef Pazar Dili:</span>
                <div className="flex bg-[#0A001A] border border-[#2D005A] rounded-xl p-1">
                  <button
                    onClick={() => setOutreachLang('tr')}
                    className={`px-3 py-1 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all ${
                      outreachLang === 'tr' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <span>🇹🇷 Türkçe (TR)</span>
                  </button>
                  <button
                    onClick={() => setOutreachLang('en')}
                    className={`px-3 py-1 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all ${
                      outreachLang === 'en' ? 'bg-[#FF007F] text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <span>🇺🇸 English (US)</span>
                  </button>
                </div>
              </div>

              {/* View Tabs */}
              <div className="flex bg-[#0A001A] border border-[#2D005A] rounded-xl p-1">
                <button
                  onClick={() => setOutreachTab('edit')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    outreachTab === 'edit' ? 'bg-[#2D005A] text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <FileText size={14} />
                  <span>Şablon Düzenle</span>
                </button>
                <button
                  onClick={() => setOutreachTab('preview')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    outreachTab === 'preview' ? 'bg-[#FF007F] text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Eye size={14} />
                  <span>Canlı Önizleme</span>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {outreachTab === 'edit' ? (
                <>
                  {/* Dynamic Tags Helper */}
                  <div className="bg-[#0A001A] border border-[#2D005A] p-3 rounded-2xl flex flex-wrap items-center gap-2">
                    <span className="text-xs text-gray-400 font-bold">Dinamik Değişkenler:</span>
                    <button
                      type="button"
                      onClick={() => setOutreachBody((prev) => prev + ' {{shop_name}}')}
                      className="bg-white/5 hover:bg-[#FF007F]/20 text-[#FF007F] border border-[#FF007F]/30 text-xs px-2.5 py-1 rounded-lg font-mono font-bold"
                    >
                      &#123;&#123;shop_name&#125;&#125;
                    </button>
                    <button
                      type="button"
                      onClick={() => setOutreachBody((prev) => prev + ' {{website}}')}
                      className="bg-white/5 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-xs px-2.5 py-1 rounded-lg font-mono font-bold"
                    >
                      &#123;&#123;website&#125;&#125;
                    </button>
                    <button
                      type="button"
                      onClick={() => setOutreachBody((prev) => prev + ' {{city}}')}
                      className="bg-white/5 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 text-xs px-2.5 py-1 rounded-lg font-mono font-bold"
                    >
                      &#123;&#123;city&#125;&#125;
                    </button>
                  </div>

                  {/* Subject Input */}
                  <div>
                    <label className="block text-xs font-black uppercase text-gray-400 mb-2">
                      E-Posta Konusu (Subject):
                    </label>
                    <input
                      type="text"
                      value={outreachSubject}
                      onChange={(e) => setOutreachSubject(e.target.value)}
                      className="w-full bg-[#0A001A] border border-[#2D005A] focus:border-[#FF007F] rounded-2xl px-4 py-3 text-sm text-white focus:outline-none"
                    />
                  </div>

                  {/* Body Textarea */}
                  <div>
                    <label className="block text-xs font-black uppercase text-gray-400 mb-2">
                      E-Posta Metni (Body):
                    </label>
                    <textarea
                      rows={10}
                      value={outreachBody}
                      onChange={(e) => setOutreachBody(e.target.value)}
                      className="w-full bg-[#0A001A] border border-[#2D005A] focus:border-[#FF007F] rounded-2xl p-4 text-sm text-white focus:outline-none font-sans leading-relaxed"
                    />
                  </div>
                </>
              ) : (
                /* Canlı HTML Önizleme */
                <div className="bg-[#0A001A] p-4 rounded-2xl border border-[#2D005A] space-y-4">
                  <div className="border-b border-[#2D005A] pb-3 text-xs space-y-1">
                    <p className="text-gray-400">
                      <strong className="text-white">Alıcı:</strong> {sampleShopForPreview.name} &lt;{sampleShopForPreview.email}&gt;
                    </p>
                    <p className="text-gray-400">
                      <strong className="text-white">Konu:</strong> {previewSubject}
                    </p>
                  </div>

                  {/* Rendered Email Preview Container */}
                  <div className="max-w-[560px] mx-auto bg-white rounded-2xl shadow-xl overflow-hidden text-gray-800">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-[#15002C] via-[#2D005A] to-[#FF007F] p-6 text-center text-white">
                      <h2 className="text-2xl font-black tracking-tight">
                        Paw<span className="text-[#FFD700]">Vibe</span> 🐾
                      </h2>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-white/80 mt-1">
                        {outreachLang === 'tr'
                          ? 'Yapay Zekâ Destekli Evcil Hayvan Analizi & Ürün Pazaryeri'
                          : 'AI-Powered Pet Behavioral Analysis & Product Marketplace'}
                      </p>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-4 text-sm text-gray-700 leading-relaxed font-sans">
                      {previewBody.split('\n\n').map((paragraph, idx) => (
                        <p key={idx} className="whitespace-pre-line">
                          {paragraph}
                        </p>
                      ))}

                      {/* Benefits box */}
                      <div className="bg-purple-50 border-l-4 border-[#FF007F] p-4 rounded-lg text-xs space-y-1 text-gray-700">
                        <p className="font-bold text-[#15002C] uppercase">
                          ✨ {outreachLang === 'tr' ? 'PawVibe Partner Avantajları:' : 'Why Partner with PawVibe:'}
                        </p>
                        <p>• {outreachLang === 'tr' ? 'Analiz sonrası pet sahibine nokta atışı ürün önerisi' : 'Context-aware product placement based on AI mood scan'}</p>
                        <p>• {outreachLang === 'tr' ? 'Yüksek satın alma motivasyonlu kullanıcı kitlesi' : 'High intent pet parents actively caring for pet well-being'}</p>
                      </div>

                      {/* CTA button */}
                      <div className="text-center pt-3 pb-1">
                        <span className="inline-block bg-gradient-to-r from-[#FF007F] to-[#6A4C93] text-white text-xs font-black px-6 py-3 rounded-full shadow-lg">
                          {outreachLang === 'tr' ? 'Ortaklık Detaylarını Görüşelim 🐾' : 'Schedule a Quick Partnership Call 🐾'}
                        </span>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="bg-gray-50 border-t border-gray-100 p-4 text-center text-[10px] text-gray-400">
                      PawVibe App • {outreachLang === 'tr' ? 'İletişim: partnership@pawvibe.app' : 'Contact: partnership@pawvibe.app'}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-[#2D005A] bg-[#0A001A] flex items-center justify-between">
              <span className="text-xs text-gray-400">
                Seçili: <strong className="text-white">{selectedIds.length} Petshop</strong>
              </span>

              <div className="flex gap-3">
                <button
                  onClick={() => setIsOutreachOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-[#2D005A] text-gray-400 hover:text-white text-xs font-bold"
                >
                  Vazgeç
                </button>
                <button
                  disabled={isSendingOutreach}
                  onClick={handleSendOutreach}
                  className="flex items-center gap-2 bg-gradient-to-r from-[#FF007F] to-[#6A4C93] text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-[#FF007F]/20"
                >
                  {isSendingOutreach ? (
                    <>
                      <RefreshCw className="animate-spin" size={14} />
                      <span>Gönderiliyor...</span>
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      <span>E-Postaları Başlat</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. CSV BULK IMPORT MODAL */}
      {/* ========================================================= */}
      {isImportOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-[#15002C] border border-[#2D005A] rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-[#2D005A] flex items-center justify-between bg-[#0A001A]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-[#FFD700] to-[#FF007F] flex items-center justify-center text-white">
                  <Upload size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black italic uppercase text-white tracking-tight">
                    Toplu Petshop CSV İçe Aktarma
                  </h3>
                  <p className="text-xs text-gray-400">TR ve ABD pet mağazaları listesini tek tıkla yükleyin</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsImportOpen(false);
                  setCsvFile(null);
                  setParsedCsvRows([]);
                }}
                className="text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* File Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#2D005A] hover:border-[#FF007F] bg-[#0A001A] p-8 rounded-2xl text-center cursor-pointer transition-all space-y-2"
              >
                <Upload size={32} className="text-[#FF007F] mx-auto" />
                <p className="text-sm font-bold text-white">
                  {csvFile ? csvFile.name : 'CSV dosyasını seçmek için tıklayın'}
                </p>
                <p className="text-xs text-gray-500">Desteklenen kolonlar: name, email, country, city, website, phone</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleCsvFileChange}
                />
              </div>

              {/* Sample format link */}
              <div className="flex items-center justify-between text-xs px-2">
                <span className="text-gray-400">Formatınız hazır değil mi?</span>
                <button
                  type="button"
                  onClick={downloadSampleCsv}
                  className="text-[#FFD700] hover:underline font-bold flex items-center gap-1"
                >
                  <Download size={12} />
                  <span>Örnek CSV Formatını İndir</span>
                </button>
              </div>

              {/* Preview parsed rows */}
              {parsedCsvRows.length > 0 && (
                <div className="bg-[#0A001A] border border-[#2D005A] rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-emerald-400">
                      ✓ {parsedCsvRows.length} Geçerli Petshop Algılandı
                    </span>
                    <span className="text-[10px] text-gray-500">İlk 5 satır önizlemesi</span>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 text-xs text-gray-300">
                    {parsedCsvRows.slice(0, 5).map((row, idx) => (
                      <div key={idx} className="flex items-center justify-between py-1 border-b border-[#2D005A]/30">
                        <span className="font-bold text-white truncate max-w-[180px]">{row.name}</span>
                        <span className="text-gray-400 font-mono text-[11px] truncate max-w-[200px]">{row.email}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-white/5">{row.country}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-[#2D005A] bg-[#0A001A] flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsImportOpen(false);
                  setCsvFile(null);
                  setParsedCsvRows([]);
                }}
                className="px-5 py-2.5 rounded-xl border border-[#2D005A] text-gray-400 hover:text-white text-xs font-bold"
              >
                Vazgeç
              </button>
              <button
                disabled={parsedCsvRows.length === 0 || isImporting}
                onClick={handleExecuteImport}
                className="flex items-center gap-2 bg-gradient-to-r from-[#FF007F] to-[#6A4C93] text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider hover:opacity-90 disabled:opacity-40 transition-all shadow-lg"
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="animate-spin" size={14} />
                    <span>Aktarılıyor...</span>
                  </>
                ) : (
                  <>
                    <Upload size={14} />
                    <span>İçe Aktarımı Tamamla ({parsedCsvRows.length})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 7. ADD / EDIT MODAL */}
      {/* ========================================================= */}
      {isAddEditOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-[#15002C] border border-[#2D005A] rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-[#2D005A] flex items-center justify-between bg-[#0A001A]">
              <h3 className="text-lg font-black italic uppercase text-white tracking-tight">
                {editingPetshop ? 'Petshop Bilgilerini Düzenle' : 'Yeni Petshop Ekle'}
              </h3>
              <button onClick={() => setIsAddEditOpen(false)} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSavePetshop} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1">Petshop Adı *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Örn: Pati Butik"
                    className="w-full bg-[#0A001A] border border-[#2D005A] focus:border-[#FF007F] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1">E-Posta Adresi *</label>
                  <input
                    type="email"
                    required
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="info@petshop.com"
                    className="w-full bg-[#0A001A] border border-[#2D005A] focus:border-[#FF007F] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1">Ülke / Pazar</label>
                  <select
                    value={formCountry}
                    onChange={(e) => setFormCountry(e.target.value as 'TR' | 'US')}
                    className="w-full bg-[#0A001A] border border-[#2D005A] focus:border-[#FF007F] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                  >
                    <option value="TR">🇹🇷 Türkiye (TR)</option>
                    <option value="US">🇺🇸 Amerika (US)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1">Şehir</label>
                  <input
                    type="text"
                    value={formCity}
                    onChange={(e) => setFormCity(e.target.value)}
                    placeholder="Örn: İstanbul"
                    className="w-full bg-[#0A001A] border border-[#2D005A] focus:border-[#FF007F] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1">Kategori</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as any)}
                    className="w-full bg-[#0A001A] border border-[#2D005A] focus:border-[#FF007F] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                  >
                    <option value="general">Genel</option>
                    <option value="ecommerce">E-Ticaret</option>
                    <option value="boutique">Butik</option>
                    <option value="retail">Perakende / Zincir</option>
                    <option value="vet_clinic">Veteriner Kliniği</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1">Web Sitesi</label>
                  <input
                    type="text"
                    value={formWebsite}
                    onChange={(e) => setFormWebsite(e.target.value)}
                    placeholder="https://petshop.com"
                    className="w-full bg-[#0A001A] border border-[#2D005A] focus:border-[#FF007F] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1">Telefon</label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="Örn: 0212 555 0000"
                    className="w-full bg-[#0A001A] border border-[#2D005A] focus:border-[#FF007F] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">Durum</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as any)}
                  className="w-full bg-[#0A001A] border border-[#2D005A] focus:border-[#FF007F] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                >
                  <option value="lead">Lead (Yeni)</option>
                  <option value="contacted">Contacted (Mail Gönderildi)</option>
                  <option value="replied">Replied (Cevap Verdi)</option>
                  <option value="partner">Partner (İş Ortağı)</option>
                  <option value="unsubscribed">Unsubscribed (Listeden Çıktı)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">Özel Notlar</label>
                <textarea
                  rows={3}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="İletişim notları, yetkili adı vb."
                  className="w-full bg-[#0A001A] border border-[#2D005A] focus:border-[#FF007F] rounded-xl p-3 text-sm text-white focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-[#2D005A] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddEditOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-[#2D005A] text-gray-400 hover:text-white text-xs font-bold"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="bg-gradient-to-r from-[#FF007F] to-[#6A4C93] text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider hover:opacity-90 disabled:opacity-50"
                >
                  {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 8. STATUS / CONFIRM MODAL */}
      {/* ========================================================= */}
      {statusModal.isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-[#15002C] border border-[#2D005A] rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="p-8 flex flex-col items-center text-center space-y-4">
              {statusModal.type === 'success' && (
                <CheckCircle2 size={48} className="text-emerald-500" />
              )}
              {statusModal.type === 'error' && (
                <AlertCircle size={48} className="text-red-500" />
              )}
              {statusModal.type === 'confirm' && (
                <HelpCircle size={48} className="text-[#FF007F]" />
              )}

              <div>
                <h3 className="text-xl font-black uppercase italic tracking-tight text-white mb-2">
                  {statusModal.title}
                </h3>
                <p className="text-gray-400 text-sm font-medium leading-relaxed">
                  {statusModal.message}
                </p>
              </div>

              <div className="flex gap-3 w-full pt-2">
                {statusModal.type === 'confirm' ? (
                  <>
                    <button
                      onClick={() => setStatusModal((prev) => ({ ...prev, isOpen: false }))}
                      className="flex-1 bg-[#0A001A] border border-[#2D005A] text-gray-400 py-3 rounded-2xl font-bold hover:bg-white/5 text-xs uppercase tracking-wider"
                    >
                      İptal
                    </button>
                    <button
                      onClick={() => {
                        statusModal.onConfirm?.();
                        setStatusModal((prev) => ({ ...prev, isOpen: false }));
                      }}
                      className="flex-1 bg-[#FF007F] text-white py-3 rounded-2xl font-bold hover:bg-[#FF007F]/80 shadow-lg text-xs uppercase tracking-wider"
                    >
                      Evet, Sil
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setStatusModal((prev) => ({ ...prev, isOpen: false }))}
                    className="w-full bg-[#0A001A] border border-[#2D005A] text-white py-3 rounded-2xl font-bold hover:bg-white/5 text-xs uppercase tracking-wider"
                  >
                    Tamam
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
