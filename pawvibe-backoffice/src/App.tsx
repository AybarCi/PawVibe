import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import UsersPage from './pages/Users';
import AnalysesPage from './pages/Analyses';
import PurchasesPage from './pages/Purchases';
import SubscriptionsPage from './pages/Subscriptions';
import { supabase } from './lib/supabase';
import { LogIn } from 'lucide-react';

const queryClient = new QueryClient();

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [session, setSession] = useState<any>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    console.log('[App] Initializing Supabase session...');
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        console.log('[App] Session check complete:', session ? 'User logged in' : 'No session');
        setSession(session);
        setLoading(false);
      })
      .catch(err => {
        console.error('[App] Supabase session error:', err);
        setInitError(err.message);
        setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('[App] Auth state changed:', _event, !!session);
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPass,
    });
    if (error) {
      alert(error.message);
    }
  };

  if (initError) return (
    <div className="min-h-screen bg-red-900 text-white flex flex-col justify-center items-center p-10 text-center">
      <h1 className="text-4xl font-bold mb-4">Initialization Error</h1>
      <p className="text-xl max-w-lg">{initError}</p>
      <button onClick={() => window.location.reload()} className="mt-8 bg-white text-black px-6 py-2 rounded-lg font-bold">Reload</button>
    </div>
  );

  if (loading) return (
    <div className="min-h-screen bg-[#0A001A] flex flex-col items-center justify-center">
      <h1 className="text-white mb-6 uppercase tracking-widest opacity-50">Connecting to PawVibe...</h1>
      <div className="w-12 h-12 border-4 border-[#FF007F] border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (!session) {
    return (
      <div className="min-h-screen bg-[#0A001A] flex items-center justify-center p-4">
        <div className="bg-[#15002C] border border-[#2D005A] p-10 rounded-3xl w-full max-w-md shadow-2xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-[#FF007F] to-[#6A4C93] bg-clip-text text-transparent">
              PawVibe Admin
            </h1>
            <p className="text-gray-400 mt-2">Sign in to manage the platform</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="email" placeholder="Admin Email"
              className="w-full bg-[#0A001A] border border-[#2D005A] rounded-xl px-4 py-3 focus:outline-none focus:border-[#FF007F] text-white"
              value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
            />
            <input
              type="password" placeholder="Password"
              className="w-full bg-[#0A001A] border border-[#2D005A] rounded-xl px-4 py-3 focus:outline-none focus:border-[#FF007F] text-white"
              value={loginPass} onChange={e => setLoginPass(e.target.value)}
            />
            <button className="w-full bg-gradient-to-r from-[#FF007F] to-[#6A4C93] py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:shadow-[0_0_20px_rgba(255,0,127,0.3)] transition-all">
              <LogIn size={20} />
              <span>Enter Dashboard</span>
            </button>
          </form>
          <p className="text-[10px] text-center text-gray-600 mt-6 tracking-widest uppercase font-black italic">Security Protected</p>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'users': return <UsersPage />;
      case 'analyses': return <AnalysesPage />;
      case 'purchases': return <PurchasesPage />;
      case 'subscriptions': return <SubscriptionsPage />;
      default: return <Dashboard />;
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
      <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
        {renderContent()}
      </Layout>
    </QueryClientProvider>
  );
}

export default App;
