import React, { useState } from 'react';
import { LayoutDashboard, Users, Shield, ShoppingBag, Settings, LogOut, Menu, X } from 'lucide-react';

interface LayoutProps {
    children: React.ReactNode;
    activeTab: string;
    setActiveTab: (tab: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab }) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
    const closeSidebar = () => setIsSidebarOpen(false);

    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
        closeSidebar();
    };

    return (
        <div className="flex h-screen bg-[#0A001A] text-white relative overflow-hidden">
            {/* Mobile Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm transition-opacity"
                    onClick={closeSidebar}
                />
            )}

            {/* Mobile Header */}
            <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[#15002C] border-b border-[#2D005A] flex items-center justify-between px-6 z-30">
                <h1 className="text-xl font-bold bg-gradient-to-r from-[#FF007F] to-[#6A4C93] bg-clip-text text-transparent">
                    PawVibe Admin
                </h1>
                <button
                    onClick={toggleSidebar}
                    className="p-2 text-[#FF007F] hover:bg-[#FF007F]/10 rounded-lg transition-colors"
                >
                    {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </header>

            {/* Sidebar */}
            <aside className={`
                fixed inset-y-0 left-0 z-50 w-72 bg-[#15002C] border-r border-[#2D005A] flex flex-col transform transition-transform duration-300 ease-in-out
                lg:relative lg:translate-x-0
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                <div className="p-8 text-center hidden lg:block">
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-[#FF007F] to-[#6A4C93] bg-clip-text text-transparent">
                        PawVibe Admin
                    </h1>
                    <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mt-1">Backoffice v1.2</p>
                </div>

                <div className="p-6 lg:hidden flex justify-between items-center border-b border-[#2D005A]">
                    <span className="text-xs font-black tracking-[0.2em] text-[#6A4C93] uppercase">Menu</span>
                    <button onClick={closeSidebar} className="text-gray-500 hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                <nav className="flex-1 px-4 space-y-2 mt-6">
                    <NavItem
                        icon={<LayoutDashboard size={20} />}
                        label="Dashboard"
                        active={activeTab === 'dashboard'}
                        onClick={() => handleTabChange('dashboard')}
                    />
                    <NavItem
                        icon={<Users size={20} />}
                        label="User Management"
                        active={activeTab === 'users'}
                        onClick={() => handleTabChange('users')}
                    />
                    <NavItem
                        icon={<ShoppingBag size={20} />}
                        label="Credit Purchases"
                        active={activeTab === 'purchases'}
                        onClick={() => handleTabChange('purchases')}
                    />
                    <NavItem
                        icon={<Shield size={20} />}
                        label="Subscriptions"
                        active={activeTab === 'subscriptions'}
                        onClick={() => handleTabChange('subscriptions')}
                    />
                    <NavItem
                        icon={<Settings size={20} />}
                        label="Settings"
                        disabled
                    />
                </nav>

                <div className="p-6 border-t border-[#2D005A]">
                    <button
                        className="flex items-center space-x-3 text-red-500 hover:text-red-400 w-full px-4 py-3 rounded-xl transition-colors text-sm font-bold bg-red-500/5 hover:bg-red-500/10"
                        onClick={() => window.location.reload()}
                    >
                        <LogOut size={18} />
                        <span>Sign Out</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto p-4 lg:p-10 pt-20 lg:pt-10 transition-all duration-300">
                <div className="max-w-7xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
};

const NavItem = ({ icon, label, active = false, onClick, disabled = false }: any) => (
    <button
        disabled={disabled}
        onClick={onClick}
        className={`flex items-center space-x-3 w-full px-4 py-4 rounded-2xl transition-all duration-200 ${active
            ? 'bg-gradient-to-r from-[#FF007F]/20 to-transparent text-[#FF007F] border-l-4 border-[#FF007F] shadow-[0_0_20px_rgba(255,0,127,0.1)]'
            : disabled ? 'opacity-30 cursor-not-allowed text-gray-600' : 'text-gray-400 hover:bg-white/5 hover:text-white'
            }`}
    >
        <span className={`${active ? 'scale-110' : ''} transition-transform`}>{icon}</span>
        <span className={`font-semibold text-sm ${active ? 'tracking-wide' : ''}`}>{label}</span>
    </button>
);

export default Layout;
