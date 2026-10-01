import { useState, useEffect } from 'react';
import {
  Sparkles,
  RefreshCw,
  ExternalLink,
  Copy,
  CheckCircle2,
  XCircle,
  Hash,
  Search,
  ShieldCheck,
  Plus,
  Trash2,
  Clock,
  Instagram,
  Check
} from 'lucide-react';
import {
  fetchTargetHashtags,
  addHashtag,
  toggleHashtag,
  deleteHashtag,
  fetchDiscoveredPosts,
  updatePostStatus,
  syncGrowthAssistantPosts,
  purgeAndResyncPosts,
  addCustomInstagramPost,
  fetchTodayCommentCount
} from '../lib/growth-assistant';
import type {
  TargetHashtag,
  DiscoveredPost,
  CommentVariation
} from '../lib/growth-assistant';

export default function GrowthAssistantPage() {
  const [hashtags, setHashtags] = useState<TargetHashtag[]>([]);
  const [posts, setPosts] = useState<DiscoveredPost[]>([]);
  const [todayCommentCount, setTodayCommentCount] = useState<number>(0);
  const dailyTargetLimit = 35;
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  const [hashtagFilter, setHashtagFilter] = useState<string>('ALL');

  // Hashtag Modal state
  const [isHashtagModalOpen, setIsHashtagModalOpen] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [addingTag, setAddingTag] = useState(false);

  // Add Custom Post Modal state
  const [isAddPostModalOpen, setIsAddPostModalOpen] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [customAuthor, setCustomAuthor] = useState('');
  const [customCaption, setCustomCaption] = useState('');
  const [customTag, setCustomTag] = useState('doglovers');
  const [addingCustomPost, setAddingCustomPost] = useState(false);

  // Copy Feedback state: postId_variationId -> boolean
  const [copiedMap, setCopiedMap] = useState<Record<string, boolean>>({});

  // Feedback Notification Toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [statusFilter, hashtagFilter]);

  async function loadData() {
    setLoading(true);
    try {
      const [tagsData, postsData, countData] = await Promise.all([
        fetchTargetHashtags(),
        fetchDiscoveredPosts(statusFilter, hashtagFilter),
        fetchTodayCommentCount()
      ]);
      setHashtags(tagsData);
      setPosts(postsData);
      setTodayCommentCount(countData);
    } catch (err) {
      console.error('Failed to load growth assistant data:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleSync = async () => {
    setSyncing(true);
    showToast('Syncing Instagram hashtag feeds & generating AI comments...');
    try {
      const res = await syncGrowthAssistantPosts();
      showToast(res.message);
      await loadData();
    } catch (err) {
      console.error('Sync failed:', err);
      showToast('Error occurred during sync execution.');
    } finally {
      setSyncing(false);
    }
  };

  const handlePurge = async () => {
    if (!confirm('Are you sure you want to purge all stale/dummy post records and resync 30 fresh real posts?')) return;
    setSyncing(true);
    showToast('Purging stale posts and resyncing 30 fresh real-shortcode posts...');
    try {
      const res = await purgeAndResyncPosts();
      showToast(res.message);
      await loadData();
    } catch (err) {
      console.error('Purge & Resync failed:', err);
      showToast('Failed to purge stale posts.');
    } finally {
      setSyncing(false);
    }
  };

  const handleCopyAndGo = async (post: DiscoveredPost, variation: CommentVariation) => {
    try {
      // 1. Copy comment text to system clipboard
      await navigator.clipboard.writeText(variation.comment_text);

      // 2. Mark copied feedback state
      const key = `${post.id}_${variation.id}`;
      setCopiedMap(prev => ({ ...prev, [key]: true }));
      setTimeout(() => {
        setCopiedMap(prev => ({ ...prev, [key]: false }));
      }, 3000);

      // 3. Open Instagram post URL in a new browser tab
      window.open(post.post_url, '_blank');

      showToast(`Copied comment & opened post! Click "Mark as Commented" below after posting.`);
    } catch (err) {
      console.error('Error during Copy & Go:', err);
      showToast('Failed to copy text or open Instagram link.');
    }
  };

  const handleToggleCommentedStatus = async (post: DiscoveredPost) => {
    try {
      const newStatus = post.status === 'POSTED' ? 'PENDING' : 'POSTED';
      await updatePostStatus(post.id, newStatus);
      setPosts(prev =>
        prev.map(p =>
          p.id === post.id
            ? {
                ...p,
                status: newStatus,
                posted_at: newStatus === 'POSTED' ? new Date().toISOString() : null
              }
            : p
        )
      );

      if (newStatus === 'POSTED') {
        setTodayCommentCount(prev => prev + 1);
        showToast(`Marked post as COMMENTED (${todayCommentCount + 1}/${dailyTargetLimit})`);
      } else {
        setTodayCommentCount(prev => Math.max(0, prev - 1));
        showToast(`Unmarked post (set back to PENDING)`);
      }
    } catch (err) {
      console.error('Error toggling comment status:', err);
      showToast('Failed to update post status.');
    }
  };

  const handleSkipPost = async (postId: string) => {
    try {
      await updatePostStatus(postId, 'SKIPPED');
      setPosts(prev =>
        prev.map(p => (p.id === postId ? { ...p, status: 'SKIPPED' } : p))
      );
      showToast('Post marked as skipped.');
    } catch (err) {
      console.error('Error skipping post:', err);
    }
  };

  const handleAddCustomPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUrl.trim()) return;
    setAddingCustomPost(true);
    try {
      const newPost = await addCustomInstagramPost(
        customUrl,
        customAuthor,
        customCaption,
        customTag
      );
      if (newPost) {
        setPosts(prev => [newPost, ...prev]);
        setCustomUrl('');
        setCustomAuthor('');
        setCustomCaption('');
        setIsAddPostModalOpen(false);
        showToast('Successfully added real Instagram post & generated 3 AI comment variations!');
      }
    } catch (err) {
      console.error('Failed to add custom post:', err);
      showToast('Failed to add post. Please check the URL format.');
    } finally {
      setAddingCustomPost(false);
    }
  };

  const handleAddHashtag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagInput.trim()) return;
    setAddingTag(true);
    try {
      const added = await addHashtag(newTagInput);
      if (added) {
        setHashtags(prev => [added, ...prev]);
        setNewTagInput('');
        showToast(`Added target hashtag #${added.tag}`);
      }
    } catch (err) {
      showToast('Failed to add hashtag or tag already exists.');
    } finally {
      setAddingTag(false);
    }
  };

  const handleToggleHashtag = async (id: string, currentActive: boolean) => {
    try {
      await toggleHashtag(id, !currentActive);
      setHashtags(prev =>
        prev.map(h => (h.id === id ? { ...h, is_active: !currentActive } : h))
      );
    } catch (err) {
      console.error('Error toggling hashtag:', err);
    }
  };

  const handleDeleteHashtag = async (id: string) => {
    try {
      await deleteHashtag(id);
      setHashtags(prev => prev.filter(h => h.id !== id));
      showToast('Hashtag removed.');
    } catch (err) {
      console.error('Error deleting hashtag:', err);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Filtered posts by search term
  const filteredPosts = posts.filter(
    p =>
      p.author_username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.caption?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.hashtag_source?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Derived Metrics
  const activeTagsCount = hashtags.filter(h => h.is_active).length;
  const pendingCount = posts.filter(p => p.status === 'PENDING').length;
  const postedCount = posts.filter(p => p.status === 'POSTED').length;
  const skippedCount = posts.filter(p => p.status === 'SKIPPED').length;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-[300] bg-[#15002C] border border-[#FF007F]/60 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top duration-300">
          <Sparkles className="text-[#FF007F]" size={18} />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2D005A] pb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 bg-[#FF007F]/10 border border-[#FF007F]/30 rounded-2xl text-[#FF007F]">
              <Instagram size={24} />
            </div>
            <div>
              <h1 className="text-3xl font-black bg-gradient-to-r from-white via-pink-200 to-[#FF007F] bg-clip-text text-transparent tracking-tight">
                GROWTH ASSISTANT
              </h1>
              <p className="text-gray-400 text-xs font-semibold tracking-wide uppercase">
                HITL Instagram Organic Comment Cockpit & AI Marketing
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsAddPostModalOpen(true)}
            className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-300 px-4 py-3 rounded-2xl text-xs font-bold transition-all"
          >
            <Plus size={16} className="text-emerald-400" />
            <span>+ Add Real Post URL</span>
          </button>

          <button
            onClick={() => setIsHashtagModalOpen(true)}
            className="flex items-center gap-2 bg-[#15002C] border border-[#2D005A] hover:border-[#6A4C93] text-gray-200 px-4 py-3 rounded-2xl text-xs font-bold transition-all hover:bg-white/5"
          >
            <Hash size={16} className="text-[#FF007F]" />
            <span>Manage Tags ({activeTagsCount})</span>
          </button>

          <button
            onClick={handlePurge}
            disabled={syncing}
            className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 text-red-300 px-4 py-3 rounded-2xl text-xs font-bold transition-all disabled:opacity-50"
          >
            <Trash2 size={16} className="text-red-400" />
            <span>Purge & Reset DB</span>
          </button>

          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 bg-gradient-to-r from-[#FF007F] to-[#6A4C93] hover:shadow-[0_0_25px_rgba(255,0,127,0.4)] text-white px-5 py-3 rounded-2xl text-xs font-bold transition-all disabled:opacity-50"
          >
            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
            <span>{syncing ? 'Discovering Posts...' : 'Sync & Discover Posts'}</span>
          </button>
        </div>
      </div>

      {/* Daily Comment Safety Tracker Widget */}
      <div className="bg-gradient-to-r from-[#1E0B36] to-[#120024] border border-[#2D005A] p-6 rounded-3xl relative overflow-hidden shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`p-3.5 rounded-2xl border ${
              todayCommentCount >= dailyTargetLimit
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                : todayCommentCount >= 25
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
            }`}>
              <ShieldCheck size={26} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                  Daily Instagram Comment Safety Tracker
                </h3>
                <span className={`text-[10px] font-extrabold px-3 py-0.5 rounded-full border uppercase ${
                  todayCommentCount >= dailyTargetLimit
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 animate-pulse'
                    : todayCommentCount >= 25
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                }`}>
                  {todayCommentCount >= dailyTargetLimit ? 'Limit Reached' : todayCommentCount >= 25 ? 'Caution Zone' : 'Safe Zone'}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Rate-limit protection: Max recommended outreach is 35 comments/day to keep account safe.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-3xl font-black text-white tracking-tight">
                {todayCommentCount} <span className="text-base text-gray-400 font-semibold">/ {dailyTargetLimit}</span>
              </p>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Comments Today</p>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-[#0A001A] h-3 rounded-full mt-4 overflow-hidden p-0.5 border border-[#2D005A]">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              todayCommentCount >= dailyTargetLimit
                ? 'bg-gradient-to-r from-rose-500 to-red-600'
                : todayCommentCount >= 25
                ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                : 'bg-gradient-to-r from-emerald-400 to-teal-500'
            }`}
            style={{ width: `${Math.min(100, (todayCommentCount / dailyTargetLimit) * 100)}%` }}
          />
        </div>

        {todayCommentCount >= dailyTargetLimit && (
          <div className="mt-3.5 bg-rose-500/10 border border-rose-500/30 p-3 rounded-xl flex items-center gap-2.5 text-rose-300 text-xs font-bold">
            <XCircle size={18} className="text-rose-400 shrink-0" />
            <span>⚠️ Daily safety target reached (35/35 comments). Pause outreach for today to protect account health!</span>
          </div>
        )}
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#15002C] border border-[#2D005A] p-5 rounded-3xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pending Action</span>
            <div className="p-2 bg-amber-500/10 rounded-xl text-amber-400">
              <Clock size={18} />
            </div>
          </div>
          <p className="text-3xl font-black text-white mt-3">{pendingCount}</p>
          <p className="text-[11px] text-amber-400/80 mt-1">Ready for review & 1-click copy</p>
        </div>

        <div className="bg-[#15002C] border border-[#2D005A] p-5 rounded-3xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Posted Comments</span>
            <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <p className="text-3xl font-black text-white mt-3">{postedCount}</p>
          <p className="text-[11px] text-emerald-400/80 mt-1">Successfully promoted @pawvibenow</p>
        </div>

        <div className="bg-[#15002C] border border-[#2D005A] p-5 rounded-3xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Skipped</span>
            <div className="p-2 bg-gray-500/10 rounded-xl text-gray-400">
              <XCircle size={18} />
            </div>
          </div>
          <p className="text-3xl font-black text-white mt-3">{skippedCount}</p>
          <p className="text-[11px] text-gray-400/80 mt-1">Filtered out or ignored</p>
        </div>

        <div className="bg-[#15002C] border border-[#2D005A] p-5 rounded-3xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Account Safety Limit</span>
            <div className="p-2 bg-purple-500/10 rounded-xl text-[#FF007F]">
              <ShieldCheck size={18} />
            </div>
          </div>
          <p className="text-3xl font-black text-white mt-3">{postedCount} / 35</p>
          <p className="text-[11px] text-purple-300 mt-1">Recommended max manual comments / day</p>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-[#15002C] border border-[#2D005A] p-4 rounded-3xl">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto p-1 bg-[#0A001A] rounded-2xl border border-[#2D005A]">
          {['PENDING', 'POSTED', 'SKIPPED', 'ALL'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                statusFilter === st
                  ? 'bg-gradient-to-r from-[#FF007F] to-[#6A4C93] text-white shadow-lg'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Search & Hashtag Filter */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Hashtag Dropdown */}
          <select
            value={hashtagFilter}
            onChange={e => setHashtagFilter(e.target.value)}
            className="bg-[#0A001A] border border-[#2D005A] text-white text-xs font-medium rounded-2xl px-3 py-2.5 focus:outline-none focus:border-[#FF007F]"
          >
            <option value="ALL">All Hashtags</option>
            {hashtags.map(h => (
              <option key={h.id} value={h.tag}>
                #{h.tag}
              </option>
            ))}
          </select>

          {/* Search Box */}
          <div className="relative flex-1 md:w-64">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Search username or caption..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-[#0A001A] border border-[#2D005A] rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#FF007F]"
            />
          </div>
        </div>
      </div>

      {/* Main Post Cards Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-[#15002C] border border-[#2D005A] rounded-3xl">
          <div className="w-10 h-10 border-4 border-[#FF007F] border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-400 text-sm">Loading discovered posts & AI variations...</p>
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-[#15002C] border border-[#2D005A] rounded-3xl text-center px-4">
          <div className="p-4 bg-[#FF007F]/10 rounded-full text-[#FF007F] mb-4">
            <Instagram size={36} />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No Posts Found</h3>
          <p className="text-gray-400 text-sm max-w-md mb-6">
            There are currently no posts matching the selected filters. Click "Sync & Discover Posts" to discover new posts from target hashtags.
          </p>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="bg-[#FF007F] hover:bg-[#FF007F]/80 text-white font-bold px-6 py-3 rounded-2xl text-xs transition-all shadow-lg shadow-[#FF007F]/20"
          >
            Run Sync Engine
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredPosts.map(post => (
            <PostCockpitCard
              key={post.id}
              post={post}
              copiedMap={copiedMap}
              onCopyAndGo={handleCopyAndGo}
              onSkip={handleSkipPost}
              onToggleCommented={handleToggleCommentedStatus}
            />
          ))}
        </div>
      )}

      {/* Hashtags Management Modal */}
      {isHashtagModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-[#15002C] border border-[#2D005A] rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-[#2D005A] flex justify-between items-center bg-[#0A001A]">
              <div className="flex items-center gap-2">
                <Hash className="text-[#FF007F]" size={20} />
                <h3 className="text-lg font-bold text-white">Target Hashtags</h3>
              </div>
              <button
                onClick={() => setIsHashtagModalOpen(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Add New Tag Form */}
              <form onSubmit={handleAddHashtag} className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 font-bold">#</span>
                  <input
                    type="text"
                    placeholder="doglovers, catlovers..."
                    value={newTagInput}
                    onChange={e => setNewTagInput(e.target.value)}
                    className="w-full bg-[#0A001A] border border-[#2D005A] rounded-xl pl-8 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#FF007F]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={addingTag}
                  className="bg-[#FF007F] hover:bg-[#FF007F]/80 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <Plus size={16} />
                  <span>Add</span>
                </button>
              </form>

              {/* Hashtags List */}
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {hashtags.map(h => (
                  <div
                    key={h.id}
                    className="flex items-center justify-between p-3 bg-[#0A001A] border border-[#2D005A] rounded-2xl"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[#FF007F] font-bold">#{h.tag}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleToggleHashtag(h.id, h.is_active)}
                        className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${
                          h.is_active
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                        }`}
                      >
                        {h.is_active ? 'Active' : 'Inactive'}
                      </button>

                      <button
                        onClick={() => handleDeleteHashtag(h.id)}
                        className="text-gray-500 hover:text-red-400 transition-colors p-1"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-[#2D005A] bg-[#0A001A] text-right">
              <button
                onClick={() => setIsHashtagModalOpen(false)}
                className="bg-[#2D005A] hover:bg-[#2D005A]/80 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Custom Real Post Modal */}
      {isAddPostModalOpen && (
        <div className="fixed inset-0 z-[250] bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#15002C] border border-[#2D005A] rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-[#2D005A] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Instagram className="text-emerald-400" size={20} />
                <h3 className="text-lg font-bold text-white">Add Real Instagram Post URL</h3>
              </div>
              <button
                onClick={() => setIsAddPostModalOpen(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddCustomPost} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase mb-1.5">
                  Direct Instagram Post URL *
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://www.instagram.com/p/CzDoL9Vh789/"
                  value={customUrl}
                  onChange={e => setCustomUrl(e.target.value)}
                  className="w-full bg-[#0A001A] border border-[#2D005A] rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-300 uppercase mb-1.5">
                    Author Username
                  </label>
                  <input
                    type="text"
                    placeholder="@doglovers"
                    value={customAuthor}
                    onChange={e => setCustomAuthor(e.target.value)}
                    className="w-full bg-[#0A001A] border border-[#2D005A] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-300 uppercase mb-1.5">
                    Target Hashtag
                  </label>
                  <select
                    value={customTag}
                    onChange={e => setCustomTag(e.target.value)}
                    className="w-full bg-[#0A001A] border border-[#2D005A] text-xs text-white rounded-xl px-3 py-2.5 focus:outline-none focus:border-emerald-400"
                  >
                    {hashtags.map(h => (
                      <option key={h.id} value={h.tag}>
                        #{h.tag}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase mb-1.5">
                  Caption / Text (For AI Comment Language Generator)
                </label>
                <textarea
                  rows={3}
                  placeholder="Paste caption here or write brief context in Turkish or English..."
                  value={customCaption}
                  onChange={e => setCustomCaption(e.target.value)}
                  className="w-full bg-[#0A001A] border border-[#2D005A] rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div className="pt-3 border-t border-[#2D005A] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddPostModalOpen(false)}
                  className="bg-[#2D005A] text-gray-300 text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingCustomPost}
                  className="bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                >
                  {addingCustomPost ? 'Generating AI Comments...' : 'Add Post & Generate Comments'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

// -------------------------------------------------------------
// Sub-Component: Post Cockpit Card
// -------------------------------------------------------------

interface PostCockpitCardProps {
  post: DiscoveredPost;
  copiedMap: Record<string, boolean>;
  onCopyAndGo: (post: DiscoveredPost, variation: CommentVariation) => void;
  onSkip: (postId: string) => void;
  onToggleCommented?: (post: DiscoveredPost) => void;
}

function PostCockpitCard({ post, copiedMap, onCopyAndGo, onSkip, onToggleCommented }: PostCockpitCardProps) {
  const [expandedCaption, setExpandedCaption] = useState(false);

  const getToneBadgeStyle = (tone: string) => {
    switch (tone?.toLowerCase()) {
      case 'praise':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'curious':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
      case 'humorous':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      default:
        return 'bg-pink-500/20 text-pink-300 border-pink-500/30';
    }
  };

  return (
    <div className="bg-[#15002C] border border-[#2D005A] hover:border-[#6A4C93]/60 rounded-3xl p-6 transition-all duration-300 shadow-xl flex flex-col lg:flex-row gap-6">
      {/* Left: Thumbnail & Author Info */}
      <div className="flex lg:flex-col items-center lg:items-start gap-4 lg:w-48 flex-shrink-0">
        <div className="relative group w-24 h-24 lg:w-44 lg:h-44 rounded-2xl overflow-hidden bg-[#0A001A] border border-[#2D005A] flex-shrink-0">
          <img
            src={post.thumbnail_url}
            alt="Instagram Post"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e: any) => {
              e.target.onerror = null;
              e.target.src = 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400';
            }}
          />
          <a
            href={post.post_url}
            target="_blank"
            rel="noreferrer"
            className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"
          >
            <ExternalLink size={20} />
          </a>
        </div>

        <div className="space-y-1.5 flex-1">
          <div className="flex items-center gap-1.5">
            <Instagram size={14} className="text-[#FF007F]" />
            <a
              href={post.post_url}
              target="_blank"
              rel="noreferrer"
              className="font-bold text-sm text-white hover:text-[#FF007F] transition-colors truncate"
            >
              @{post.author_username}
            </a>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-[#FF007F] bg-[#FF007F]/10 border border-[#FF007F]/20 px-2.5 py-0.5 rounded-full">
              #{post.hashtag_source}
            </span>

            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                post.status === 'POSTED'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : post.status === 'SKIPPED'
                  ? 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
              }`}
            >
              {post.status}
            </span>
          </div>

          {post.posted_at && (
            <p className="text-[10px] text-gray-400">
              Posted: {new Date(post.posted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      </div>

      {/* Right: Caption & 3 AI Comment Variations */}
      <div className="flex-1 flex flex-col justify-between space-y-4">
        {/* Caption */}
        <div className="bg-[#0A001A] border border-[#2D005A] p-4 rounded-2xl relative">
          <p className="text-xs text-gray-300 leading-relaxed italic">
            "{expandedCaption || post.caption.length <= 150 ? post.caption : `${post.caption.slice(0, 150)}...`}"
          </p>
          {post.caption.length > 150 && (
            <button
              onClick={() => setExpandedCaption(!expandedCaption)}
              className="text-[10px] font-bold text-[#FF007F] hover:underline mt-1 block"
            >
              {expandedCaption ? 'Show less' : 'Read full caption'}
            </button>
          )}
        </div>

        {/* 3 Comment Variations */}
        <div className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
            <Sparkles size={14} className="text-[#FF007F]" />
            <span>Generated Organic Comment Variations</span>
          </p>

          {post.comment_variations?.map(variation => {
            const copyKey = `${post.id}_${variation.id}`;
            const isCopied = copiedMap[copyKey];

            return (
              <div
                key={variation.id}
                className="bg-[#0A001A] border border-[#2D005A] hover:border-[#6A4C93] p-3.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all"
              >
                <div className="flex items-start gap-2.5 flex-1">
                  <span
                    className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-xl border flex-shrink-0 mt-0.5 ${getToneBadgeStyle(
                      variation.tone_label
                    )}`}
                  >
                    {variation.tone_label}
                  </span>
                  <p className="text-xs text-gray-200 leading-normal flex-1">
                    {variation.comment_text}
                  </p>
                </div>

                <button
                  onClick={() => onCopyAndGo(post, variation)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 flex-shrink-0 ${
                    isCopied
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                      : 'bg-gradient-to-r from-[#FF007F] to-[#6A4C93] hover:shadow-[0_0_15px_rgba(255,0,127,0.4)] text-white'
                  }`}
                >
                  {isCopied ? (
                    <>
                      <Check size={14} />
                      <span>Copied & Opened!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>Copy & Go</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Card Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#2D005A]/60">
          <div className="flex items-center gap-3">
            <a
              href={post.post_url}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-gray-400 hover:text-white flex items-center gap-1 transition-colors"
            >
              <span>Open Instagram Post</span>
              <ExternalLink size={12} />
            </a>

            {onToggleCommented && (
              <button
                onClick={() => onToggleCommented(post)}
                className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 ${
                  post.status === 'POSTED'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                    : 'bg-[#2D005A]/40 border-[#6A4C93]/40 text-gray-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                {post.status === 'POSTED' ? (
                  <>
                    <CheckCircle2 size={14} className="text-emerald-400" />
                    <span>Commented Today (Click to Undo)</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} className="text-gray-400" />
                    <span>Mark as Commented</span>
                  </>
                )}
              </button>
            )}
          </div>

          {post.status === 'PENDING' && (
            <button
              onClick={() => onSkip(post.id)}
              className="text-xs text-gray-500 hover:text-red-400 font-medium transition-colors"
            >
              Skip Post
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
