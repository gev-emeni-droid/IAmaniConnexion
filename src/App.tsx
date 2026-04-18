import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { 
    LayoutDashboard, 
    Users, 
    Calendar, 
    Briefcase, 
    FileText, 
    Settings, 
    LogOut, 
    Plus, 
    CheckCircle, 
    XCircle,
    ChevronRight,
    ShieldCheck,
    Lock,
    Mail,
    Trash2,
    ToggleLeft,
    ToggleRight,
    Search,
    Filter,
    Download,
    MapPin,
    UserCheck,
    Palette,
    Building2,
    Phone,
    MessageSquare,
    Paperclip,
    FileSpreadsheet,
    Upload,
    AlertCircle,
    CheckCircle2,
    X,
    Sun,
    Moon,
    Save
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { authApi, moduleApi, adminApi } from './lib/api';
import { EvenementielModule } from './components/Evenementiel/EvenementielModule';
import { FacturesModule } from './components/Factures/FacturesModule';
import { CRMModule } from './components/CRM/CRMModule';
import { AdminEvenementielConfig } from './components/Admin/AdminEvenementielConfig';
import { PostesEmployesModule } from './components/Employes/PostesEmployesModule';
import { SupportModal } from './components/Support/SupportModal';
import { useTheme } from './hooks/useTheme';

// --- Components ---

const SidebarItem = ({ icon: Icon, label, to, active, collapsed = false }: any) => (
    <Link 
        to={to} 
        className={`group flex items-center ${collapsed ? 'justify-center' : 'gap-2'} ${collapsed ? 'px-0 py-1.5' : 'px-3 py-2'} rounded-lg transition-all ${
            active
                ? 'bg-[var(--text-primary)] text-[var(--bg-card)] shadow'
                : 'text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)] hover:text-[var(--text-primary)]'
        }`}
        title={collapsed ? label : undefined}
    >
        <span className={`inline-flex items-center justify-center ${collapsed ? 'w-8 h-8 rounded-lg group-hover:bg-[var(--interactive-hover)]' : 'w-5 h-5'} transition-all`}>
            <Icon className="w-[18px] h-[18px] shrink-0" />
        </span>
        {!collapsed && <span className="font-medium text-[15px] min-w-0 truncate">{label}</span>}
    </Link>
);

const Layout = ({ children }: any) => {
    const { user, logout, refreshUser } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const [activeModules, setActiveModules] = React.useState<string[]>([]);
    const [showProfileModal, setShowProfileModal] = React.useState(false);
    const [profileForm, setProfileForm] = React.useState({
        email: '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [profileError, setProfileError] = React.useState('');
    const [profileSuccess, setProfileSuccess] = React.useState('');
    const [savingProfile, setSavingProfile] = React.useState(false);
    const [isCollapsed, setIsCollapsed] = React.useState(() => {
        try {
            const saved = localStorage.getItem('sidebarCollapsed');
            return saved === '1';
        } catch {
            return false;
        }
    });
    const [supportUnreadCount, setSupportUnreadCount] = React.useState(0);

    React.useEffect(() => {
        try {
            localStorage.setItem('sidebarCollapsed', isCollapsed ? '1' : '0');
        } catch {}
    }, [isCollapsed]);

    const resolvedLogoUrl = user?.logoUrl
        ? (String(user.logoUrl).startsWith('http') ? String(user.logoUrl) : `${window.location.origin}${String(user.logoUrl)}`)
        : null;

    React.useEffect(() => {
        if (user && user.type !== 'admin') {
            loadModules();
            checkStatus();
        }
    }, [user]);

    React.useEffect(() => {
        if (!user || user.type !== 'admin') return;
        let mounted = true;
        const loadUnread = async () => {
            try {
                // const data = await supportApi.getAdminUnreadCount();
                const data = { count: 0 };
                if (mounted) setSupportUnreadCount(Number(data?.count || 0));
            } catch {}
        };
        loadUnread();
        const timer = setInterval(loadUnread, 15000);
        return () => {
            mounted = false;
            clearInterval(timer);
        };
    }, [user]);

    const checkStatus = async () => {
        try {
            const me = await authApi.getMe();
            if (me.status === 'blocked') {
                logout();
                navigate('/login');
            }
        } catch (e) {
            // If 401/403, logout
            logout();
            navigate('/login');
        }
    };

    const loadModules = async () => {
        try {
            // For clients/collaborators, we fetch their active modules via the /me/modules endpoint
            const modules = await authApi.getMyModules();
            const safeModules = Array.isArray(modules) ? modules : [];
            setActiveModules(safeModules.filter((m: any) => m.is_active === 1).map((m: any) => m.module_name));
        } catch (e) {
            console.error('Failed to load active modules', e);
            setActiveModules([]);
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const openProfileModal = () => {
        setProfileError('');
        setProfileSuccess('');
        setProfileForm({
            email: user?.email || '',
            currentPassword: '',
            newPassword: '',
            confirmPassword: ''
        });
        setShowProfileModal(true);
    };

    const emailChanged = (profileForm.email || '').trim() !== String(user?.email || '').trim();
    const wantsPasswordChange = profileForm.newPassword.length > 0 || profileForm.confirmPassword.length > 0;
    const isEmailRequired = user?.type !== 'collaborator';
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const emailError = profileForm.email.trim()
        ? (!emailPattern.test(profileForm.email.trim()) ? 'Format email invalide.' : '')
        : (isEmailRequired ? 'Email obligatoire pour ce compte.' : '');
    const passwordError = wantsPasswordChange && profileForm.newPassword.length < 8
        ? 'Le mot de passe doit contenir au moins 8 caractères.'
        : '';
    const confirmError = wantsPasswordChange && profileForm.newPassword !== profileForm.confirmPassword
        ? 'La confirmation du mot de passe ne correspond pas.'
        : '';
    const currentPasswordError = wantsPasswordChange && !profileForm.currentPassword
        ? 'Mot de passe actuel requis pour changer le mot de passe.'
        : '';
    const profileHasChanges = emailChanged || wantsPasswordChange;
    const canSaveProfile = profileHasChanges && !emailError && !passwordError && !confirmError && !currentPasswordError;

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setProfileError('');
        setProfileSuccess('');
        if (!canSaveProfile) return;
        try {
            setSavingProfile(true);
            await authApi.updateProfile({
                newEmail: (profileForm.email || '').trim(),
                currentPassword: profileForm.currentPassword || undefined,
                newPassword: profileForm.newPassword || undefined
            });
            await refreshUser();
            setProfileSuccess('Profil mis à jour avec succès.');
            setProfileForm(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
        } catch (e: any) {
            setProfileError(e?.message || 'Erreur lors de la mise à jour du profil.');
        } finally {
            setSavingProfile(false);
        }
    };

    const isModuleActive = (name: string) => {
        if (user?.type === 'admin') return false; // Admin doesn't use modules
        return activeModules.includes(name);
    };

    return (
        <div className="flex min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] transition-colors duration-300">
            {/* Sidebar */}
            <motion.aside
                animate={{ width: isCollapsed ? 72 : 248 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="bg-[var(--bg-sidebar)] border-r border-[var(--border-color)] p-3 md:p-4 flex flex-col h-screen sticky top-0 transition-colors duration-200"
            >
                <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} mb-4`}>
                    <div className={`flex items-center ${isCollapsed ? '' : 'gap-2'} px-2`}>
                        <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center overflow-hidden">
                            {resolvedLogoUrl ? (
                                <img
                                    src={resolvedLogoUrl}
                                    alt={user?.companyName || 'Logo client'}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                                    }}
                                />
                            ) : (
                                <ShieldCheck className="text-black" size={20} />
                            )}
                        </div>
                        {!isCollapsed && <span className="font-bold text-[36px] leading-none tracking-tight text-slate-700 dark:text-[var(--text-primary)]">{user?.companyName || "L'IAmani"}</span>}
                    </div>
                    {!isCollapsed && (
                        <button
                            onClick={() => setIsCollapsed((prev) => !prev)}
                            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--interactive-hover)] transition-all"
                            aria-label="Réduire la barre latérale"
                        >
                            <ChevronRight className={`${isCollapsed ? 'rotate-180' : ''} transition-transform`} size={16} />
                        </button>
                    )}
                </div>

                {isCollapsed && (
                    <button
                        onClick={() => setIsCollapsed((prev) => !prev)}
                        className="mb-3 p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--interactive-hover)] transition-all mx-auto"
                        aria-label="Étendre la barre latérale"
                    >
                        <ChevronRight className={`${isCollapsed ? 'rotate-180' : ''} transition-transform`} size={16} />
                    </button>
                )}

                <nav className="flex-1 space-y-0.5 overflow-y-hidden">
                    <SidebarItem icon={LayoutDashboard} label="Dashboard" to="/" active={window.location.pathname === '/'} collapsed={isCollapsed} />
                    
                    {user?.type === 'admin' ? (
                        <>
                            {!isCollapsed && <div className="mt-5 mb-1 px-3 text-[9px] font-bold text-slate-600 dark:text-gray-400 uppercase tracking-widest">Administration</div>}
                            <SidebarItem icon={Users} label="Gestion Clients" to="/admin/clients" active={window.location.pathname.startsWith('/admin/clients')} collapsed={isCollapsed} />
                            <Link
                                to="/admin/support"
                                className={`group flex items-center ${isCollapsed ? 'justify-center' : 'gap-2'} ${isCollapsed ? 'px-0 py-1.5' : 'px-3 py-2'} rounded-lg transition-all ${
                                    window.location.pathname === '/admin/support' ? 'bg-white text-black' : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                }`}
                                title={isCollapsed ? 'Support Client' : undefined}
                            >
                                <span className={`inline-flex items-center justify-center ${isCollapsed ? 'w-8 h-8 rounded-lg group-hover:bg-white/10' : 'w-5 h-5'} transition-all relative`}>
                                    <MessageSquare className="w-[18px] h-[18px] shrink-0" />
                                    {supportUnreadCount > 0 && (
                                        <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                                            {supportUnreadCount > 99 ? '99+' : supportUnreadCount}
                                        </span>
                                    )}
                                </span>
                                {!isCollapsed && <span className="font-medium text-[15px] min-w-0 truncate">Support Client</span>}
                            </Link>
                        </>
                    ) : (
                        <>
                            {!isCollapsed && <div className="mt-5 mb-1 px-3 text-[9px] font-bold text-slate-600 dark:text-gray-400 uppercase tracking-widest">Mes Modules</div>}
                            {isModuleActive('planning') && <SidebarItem icon={Calendar} label="Planning" to="/planning" active={window.location.pathname === '/planning'} collapsed={isCollapsed} />}
                            {isModuleActive('evenementiel') && <SidebarItem icon={Briefcase} label="Événementiel" to="/evenementiel" active={window.location.pathname === '/evenementiel'} collapsed={isCollapsed} />}
                            {isModuleActive('crm') && <SidebarItem icon={Users} label="CRM Contacts" to="/crm" active={window.location.pathname === '/crm'} collapsed={isCollapsed} />}
                            {isModuleActive('facture') && <SidebarItem icon={FileText} label="Factures" to="/factures" active={window.location.pathname === '/factures'} collapsed={isCollapsed} />}
                            {isModuleActive('employes') && <SidebarItem icon={Users} label="Postes & Employés" to="/employes" active={window.location.pathname === '/employes'} collapsed={isCollapsed} />}
                        </>
                    )}
                </nav>

                <div className="mt-auto pt-3 border-t border-[var(--border-color)]">
                    <button
                        onClick={toggleTheme}
                        className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-2'} px-3 py-2 text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)] hover:text-[var(--text-primary)] rounded-lg transition-all font-medium mb-2`}
                        title={isCollapsed ? (theme === 'dark' ? 'Passer en clair' : 'Passer en sombre') : undefined}
                    >
                        {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
                        {!isCollapsed && <span className="text-[14px]">{theme === 'dark' ? 'Mode clair' : 'Mode sombre'}</span>}
                    </button>

                    <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2'} px-2 mb-3`}>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-[var(--text-primary)] border border-[var(--border-color)] bg-[var(--bg-soft)]">
                            {user?.name ? user.name[0].toUpperCase() : '?'}
                        </div>
                        {!isCollapsed && (
                            <div className="flex-1 min-w-0">
                                <p className="text-[15px] font-bold truncate text-[var(--text-primary)]">{user?.name}</p>
                                <p className="text-[11px] text-[var(--text-muted)] truncate capitalize">{user?.type}</p>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={openProfileModal}
                        className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-2'} px-3 py-2 text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)] rounded-lg transition-all font-medium mb-1`}
                        title={isCollapsed ? 'Profil' : undefined}
                    >
                        <Settings size={17} />
                        {!isCollapsed && <span className="text-[14px]">Profil</span>}
                    </button>
                    <button 
                        onClick={handleLogout}
                        className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-2'} px-3 py-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-all font-medium`}
                        title={isCollapsed ? 'Déconnexion' : undefined}
                    >
                        <LogOut size={17} />
                        {!isCollapsed && <span className="text-[14px]">Déconnexion</span>}
                    </button>
                </div>
            </motion.aside>

            <AnimatePresence>
                {showProfileModal && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 transition-colors duration-200">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="w-full max-w-md bg-white dark:bg-[#0A0A0A] rounded-2xl p-8 border border-gray-200 dark:border-white/5 transition-colors duration-200"
                        >
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Mon Profil</h2>
                            <form onSubmit={handleSaveProfile} className="space-y-4">
                                {profileError && (
                                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm">{profileError}</div>
                                )}
                                {profileSuccess && (
                                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-300 text-sm">{profileSuccess}</div>
                                )}

                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-500 dark:text-gray-500 uppercase tracking-widest">Email</label>
                                    <input
                                        type="email"
                                        value={profileForm.email}
                                        onChange={(e) => setProfileForm(prev => ({ ...prev, email: e.target.value }))}
                                        className="w-full px-4 py-3 rounded-lg bg-slate-50 dark:bg-black border border-gray-300 dark:border-white/10 text-slate-900 dark:text-white focus:border-slate-400 dark:focus:border-white outline-none transition-colors duration-200"
                                        placeholder="nom@exemple.com"
                                    />
                                    {emailError && <p className="text-xs text-red-400">{emailError}</p>}
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-500 dark:text-gray-500 uppercase tracking-widest">Mot de passe actuel</label>
                                    <input
                                        type="password"
                                        value={profileForm.currentPassword}
                                        onChange={(e) => setProfileForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                                        className="w-full px-4 py-3 rounded-lg bg-slate-50 dark:bg-black border border-gray-300 dark:border-white/10 text-slate-900 dark:text-white focus:border-slate-400 dark:focus:border-white outline-none transition-colors duration-200"
                                        placeholder="Requis si changement de mot de passe"
                                    />
                                    {currentPasswordError && <p className="text-xs text-red-400">{currentPasswordError}</p>}
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-500 dark:text-gray-500 uppercase tracking-widest">Nouveau mot de passe</label>
                                    <input
                                        type="password"
                                        value={profileForm.newPassword}
                                        onChange={(e) => setProfileForm(prev => ({ ...prev, newPassword: e.target.value }))}
                                        className="w-full px-4 py-3 rounded-lg bg-slate-50 dark:bg-black border border-gray-300 dark:border-white/10 text-slate-900 dark:text-white focus:border-slate-400 dark:focus:border-white outline-none transition-colors duration-200"
                                        placeholder="Minimum 8 caractères"
                                    />
                                    {passwordError && <p className="text-xs text-red-400">{passwordError}</p>}
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-500 dark:text-gray-500 uppercase tracking-widest">Confirmer le nouveau mot de passe</label>
                                    <input
                                        type="password"
                                        value={profileForm.confirmPassword}
                                        onChange={(e) => setProfileForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                        className="w-full px-4 py-3 rounded-lg bg-slate-50 dark:bg-black border border-gray-300 dark:border-white/10 text-slate-900 dark:text-white focus:border-slate-400 dark:focus:border-white outline-none transition-colors duration-200"
                                    />
                                    {confirmError && <p className="text-xs text-red-400">{confirmError}</p>}
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowProfileModal(false)}
                                        className="flex-1 px-4 py-3 rounded-lg border border-gray-300 dark:border-white/10 text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors duration-200"
                                        disabled={savingProfile}
                                    >
                                        Fermer
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={!canSaveProfile || savingProfile}
                                        className="flex-1 px-4 py-3 rounded-lg bg-white text-black font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {savingProfile ? 'Enregistrement...' : 'Enregistrer'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Main Content */}
            <main className="flex-1 min-w-0 p-10 overflow-auto transition-colors duration-200">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                >
                    {children}
                </motion.div>
            </main>
        </div>
    );
};

// --- Views ---

const LoginView = () => {
    const [identifier, setIdentifier] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [error, setError] = React.useState('');
    const { login } = useAuth();
    const navigate = useNavigate();
    const stars = React.useMemo(() => Array.from({ length: 160 }, (_, i) => ({
        id: i,
        left: `${(i * 7.17) % 100}%`,
        top: `${(i * 11.43) % 100}%`,
        size: 1.5 + (i % 4),
        duration: 7 + (i % 7),
        delay: (i % 18) * 0.35,
        drift: ((i % 7) - 3) * 10,
        glow: 7 + (i % 5) * 3,
    })), []);
    const meteors = React.useMemo(() => Array.from({ length: 16 }, (_, i) => ({
        id: i,
        left: `${4 + i * 6.2}%`,
        delay: i * 0.9,
        duration: 3.4 + (i % 3) * 0.7,
    })), []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            const data = await authApi.login({ identifier, password });
            login(data.token, data.user);
            navigate('/');
        } catch (err: any) {
            setError(err.message);
        }
    };

    return (
        <div className="min-h-screen relative overflow-hidden bg-[#030712] flex items-center justify-center p-6">
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.16),transparent_0%,transparent_42%),radial-gradient(circle_at_bottom,_rgba(99,102,241,0.16),transparent_0%,transparent_48%)]" />
                {stars.map((star) => (
                    <motion.span
                        key={star.id}
                        className="absolute rounded-full bg-white/90"
                        style={{ left: star.left, top: star.top, width: star.size, height: star.size, boxShadow: `0 0 ${star.glow}px rgba(255,255,255,0.8)` }}
                        animate={{ y: [-30, 820], x: [0, star.drift], opacity: [0, 0.95, 0.65, 0] }}
                        transition={{ duration: star.duration, repeat: Infinity, ease: 'linear', delay: star.delay }}
                    />
                ))}
                {meteors.map((meteor) => (
                    <motion.div
                        key={`meteor-${meteor.id}`}
                        className="absolute h-px rounded-full bg-gradient-to-r from-white via-cyan-200 to-transparent"
                        style={{ left: meteor.left, top: '-10%', width: 140 }}
                        animate={{ x: [0, -180], y: [0, 520], opacity: [0, 1, 0] }}
                        transition={{ duration: meteor.duration, repeat: Infinity, ease: 'easeIn', delay: meteor.delay }}
                    />
                ))}
            </div>

            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative z-10 w-full max-w-md bg-[#111111]/90 backdrop-blur-md rounded-2xl shadow-2xl p-10 border border-white/10"
            >
                <div className="flex flex-col items-center mb-10">
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-cyan-400/20">
                        <ShieldCheck className="text-black" size={28} />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-white">Connexion L'IAmani</h1>
                    <p className="text-gray-400 text-sm mt-2 text-center">Entrez vos identifiants pour accéder à la plateforme L'IAmani</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {error && (
                        <div className="p-4 bg-red-500/10 text-red-400 text-sm rounded-lg flex items-center gap-2 border border-red-500/20">
                            <XCircle size={16} />
                            {error}
                        </div>
                    )}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Identifiant</label>
                        <input 
                            type="text" 
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg bg-black border border-white/10 text-white focus:border-white focus:ring-0 transition-all outline-none"
                            placeholder="Email ou Pseudo"
                            required
                            autoComplete="username"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Mot de passe</label>
                        <input 
                            type="password" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg bg-black border border-white/10 text-white focus:border-white focus:ring-0 transition-all outline-none"
                            placeholder="••••••••"
                            required
                        />
                    </div>
                    <button 
                        type="submit"
                        className="w-full bg-white text-black py-4 rounded-lg font-bold hover:bg-gray-200 transition-all shadow-lg shadow-white/5"
                    >
                        Se connecter
                    </button>
                </form>

                <div className="mt-8 pt-8 border-t border-white/5 text-center">
                    <p className="text-xs text-gray-500">
                        Plateforme sécurisée réservée aux clients et collaborateurs autorisés.
                    </p>
                </div>
            </motion.div>
        </div>
    );
};

const DashboardView = () => {
    const { user } = useAuth();
    const [stats, setStats] = React.useState<any[]>([]);
    const [recentActivity, setRecentActivity] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [showSupportModal, setShowSupportModal] = React.useState(false);
    const [supportUnreadCount, setSupportUnreadCount] = React.useState(0);

    React.useEffect(() => {
        if (user) {
            loadStats();
        }
    }, [user]);

    React.useEffect(() => {
        if (!user || user.type === 'admin') return;
        let mounted = true;
        const loadUnread = async () => {
            try {
                // const data = await supportApi.getClientUnreadCount();
                const data = { count: 0 };
                if (mounted) setSupportUnreadCount(Number(data?.count || 0));
            } catch {}
        };
        loadUnread();
        const timer = setInterval(loadUnread, 15000);
        return () => {
            mounted = false;
            clearInterval(timer);
        };
    }, [user]);

    const loadStats = async () => {
        try {
            if (user?.type === 'admin') {
                const data = await adminApi.getStats();
                setStats([
                    { label: 'Clients Actifs', value: data.clientsCount.toString(), icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                    { label: 'Revenus Mensuels', value: data.revenue, icon: FileText, color: 'text-green-400', bg: 'bg-green-500/10' },
                    { label: 'Modules Activés', value: data.activeModulesCount.toString(), icon: Settings, color: 'text-purple-400', bg: 'bg-purple-500/10' },
                    { label: 'Collaborateurs', value: data.collaboratorsCount.toString(), icon: ShieldCheck, color: 'text-orange-400', bg: 'bg-orange-500/10' },
                ]);
                setRecentActivity([]);
            } else {
                // const data = await dashboardApi.getClientStats();
                const data = { employes: 0, evenements: 0, factures: 0, planning: 0, recentActivity: [] };
                setStats([
                    { label: 'Employés', value: String(data.employes ?? 0), icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                    { label: 'Événements', value: String(data.evenements ?? 0), icon: Calendar, color: 'text-purple-400', bg: 'bg-purple-500/10' },
                    { label: 'Factures', value: String(data.factures ?? 0), icon: FileText, color: 'text-orange-400', bg: 'bg-green-500/10' },
                    { label: 'Planning', value: String(data.planning ?? 0), icon: Briefcase, color: 'text-green-400', bg: 'bg-green-500/10' },
                ]);
                setRecentActivity(Array.isArray(data.recentActivity) ? data.recentActivity : []);
            }
        } catch (e) {
            console.error(e);
            setRecentActivity([]);
        } finally {
            setLoading(false);
        }
    };

    const formatRelativeTime = (value?: string) => {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        const diffMs = Date.now() - date.getTime();
        const diffMin = Math.max(1, Math.floor(diffMs / 60000));
        if (diffMin < 60) return `Il y a ${diffMin} min`;
        const diffHours = Math.floor(diffMin / 60);
        if (diffHours < 24) return `Il y a ${diffHours} h`;
        const diffDays = Math.floor(diffHours / 24);
        if (diffDays < 30) return `Il y a ${diffDays} j`;
        return date.toLocaleDateString();
    };

    const formatActivityDetail = (value?: string) => {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return value;
        return date.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });
    };

    const getActivityPresentation = (type?: string) => {
        switch (type) {
            case 'facture':
                return { icon: FileText, color: 'text-emerald-500' };
            case 'evenement':
                return { icon: Calendar, color: 'text-violet-500' };
            case 'employe':
                return { icon: Users, color: 'text-sky-500' };
            case 'planning':
                return { icon: Briefcase, color: 'text-amber-500' };
            default:
                return { icon: ChevronRight, color: 'text-[var(--text-muted)]' };
        }
    };

    return (
        <div className="space-y-10">
            <header>
                <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">Tableau de bord</h1>
                <p className="text-[var(--text-muted)] mt-1">
                    {user?.type === 'admin' 
                        ? 'Vue d\'ensemble de la plateforme L\'IAmani.' 
                        : `Bienvenue sur votre espace de gestion, ${user?.name}.`}
                </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, i) => (
                    <motion.div 
                        key={i} 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="bg-[var(--bg-card)] p-8 rounded-2xl border border-[var(--border-color)] shadow-sm transition-colors duration-200"
                    >
                        <div className={`w-12 h-12 ${stat.bg} rounded-xl flex items-center justify-center mb-6`}>
                            <stat.icon className={stat.color} size={24} />
                        </div>
                        <p className="text-[var(--text-muted)] text-xs font-bold uppercase tracking-widest">{stat.label}</p>
                        <p className="text-3xl font-bold mt-2 text-[var(--text-primary)]">{stat.value}</p>
                    </motion.div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <div className="lg:col-span-2 bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] p-8 transition-colors duration-200">
                    <h2 className="text-lg font-bold mb-8 text-[var(--text-primary)]">Activité récente</h2>
                    <div className="space-y-8">
                        {user?.type === 'admin' ? (
                            [1, 2, 3].map((_, i) => (
                                <div key={i} className="flex items-center gap-6 pb-8 border-b border-[var(--border-color)] last:border-0 last:pb-0">
                                    <div className="w-12 h-12 bg-[var(--bg-soft)] rounded-full flex items-center justify-center">
                                        <ChevronRight size={18} className="text-[var(--text-muted)]" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-[var(--text-primary)]">Nouveau client créé</p>
                                        <p className="text-xs text-[var(--text-muted)] mt-1">Activité administration</p>
                                    </div>
                                    <div className="text-sm font-bold text-green-400">Actif</div>
                                </div>
                            ))
                        ) : loading ? (
                            <div className="text-sm text-[var(--text-muted)]">Chargement des activités...</div>
                        ) : recentActivity.length === 0 ? (
                            <div className="text-sm text-[var(--text-muted)]">Aucune activité récente pour le moment.</div>
                        ) : recentActivity.map((item) => {
                            const presentation = getActivityPresentation(item.type);
                            const ActivityIcon = presentation.icon;
                            return (
                                <div key={item.id} className="flex items-center gap-6 pb-8 border-b border-[var(--border-color)] last:border-0 last:pb-0">
                                    <div className="w-12 h-12 bg-[var(--bg-soft)] rounded-full flex items-center justify-center">
                                        <ActivityIcon size={18} className={presentation.color} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-[var(--text-primary)]">{item.title}</p>
                                        <p className="text-xs text-[var(--text-muted)] mt-1 truncate">
                                            {formatRelativeTime(item.created_at)}{item.subject ? ` • ${item.subject}` : ''}{item.detail ? ` • ${formatActivityDetail(item.detail)}` : ''}
                                        </p>
                                    </div>
                                    <div className="text-sm font-bold text-green-400 shrink-0">
                                        {typeof item.value === 'number' && item.value > 0
                                            ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(item.value)
                                            : '—'}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
                
                <div className="bg-[var(--bg-card)] text-[var(--text-primary)] rounded-2xl p-10 border border-[var(--border-color)] shadow-2xl relative overflow-hidden flex flex-col justify-between transition-colors duration-200">
                    <div className="relative z-10">
                        <h2 className="text-xl font-bold mb-4">
                            {user?.type === 'admin' ? 'Maintenance Système' : "Support L'IAmani"}
                        </h2>
                        <p className="text-[var(--text-muted)] text-sm leading-relaxed mb-8">
                            {user?.type === 'admin' 
                                ? 'Vérifiez l\'état des serveurs et les logs de sécurité de la plateforme.' 
                                : 'Besoin d\'aide pour configurer vos modules ? Notre équipe est là pour vous.'}
                        </p>
                        {user?.type === 'admin' ? (
                            <button className="bg-[var(--text-primary)] text-[var(--bg-card)] px-8 py-4 rounded-xl font-bold text-sm hover:opacity-90 transition-all shadow-lg">
                                Voir les logs
                            </button>
                        ) : (
                            <button
                                onClick={() => setShowSupportModal(true)}
                                className="bg-[var(--text-primary)] text-[var(--bg-card)] px-8 py-4 rounded-xl font-bold text-sm hover:opacity-90 transition-all shadow-lg inline-flex items-center gap-2 relative"
                            >
                                {supportUnreadCount > 0 && (
                                    <span className="absolute -top-2 -right-2 min-w-6 h-6 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                                        {supportUnreadCount > 99 ? '99+' : supportUnreadCount}
                                    </span>
                                )}
                                Contacter l'admin
                            </button>
                        )}
                    </div>
                    <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-[var(--interactive-hover)] rounded-full blur-3xl"></div>
                </div>
            </div>

            {user?.type !== 'admin' && (
                <SupportModal open={showSupportModal} onClose={() => setShowSupportModal(false)} canOpen />
            )}
        </div>
    );
};

const SupportAdminView = () => {
    const [status, setStatus] = React.useState<'OPEN' | 'CLOSED'>('OPEN');
    const [tickets, setTickets] = React.useState<any[]>([]);
    const [selected, setSelected] = React.useState<any | null>(null);
    const [messages, setMessages] = React.useState<any[]>([]);
    const [text, setText] = React.useState('');
    const [file, setFile] = React.useState<File | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [sending, setSending] = React.useState(false);

    const loadTickets = React.useCallback(async () => {
        setLoading(true);
        try {
            // const data = await supportApi.getAdminTickets(status);
            const data: any[] = [];
            setTickets(data || []);
            if (data?.length && !selected) {
                setSelected(data[0]);
            }
            if (!data?.length) {
                setSelected(null);
                setMessages([]);
            }
        } finally {
            setLoading(false);
        }
    }, [status, selected]);

    const loadMessages = React.useCallback(async (ticketId: string) => {
        // const data = await supportApi.getAdminTicketMessages(ticketId);
        const data = { messages: [] };
        setMessages(data?.messages || []);
    }, []);

    React.useEffect(() => { loadTickets(); }, [loadTickets]);
    React.useEffect(() => {
        if (selected?.id) loadMessages(selected.id);
    }, [selected?.id, loadMessages]);

    const send = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selected?.id || (!text.trim() && !file)) return;
        try {
            setSending(true);
            let fileUrl: string | null = null;
            let fileName: string | null = null;
            if (file) {
                const fd = new FormData();
                fd.append('file', file);
                // const up = await supportApi.uploadFile(fd);
                const up = { file_url: '', file_name: '' };
                fileUrl = up.file_url;
                fileName = up.file_name || file.name;
            }
            // await supportApi.sendAdminMessage(selected.id, { message: text.trim() || null, file_url: fileUrl, file_name: fileName });
            setText('');
            setFile(null);
            await loadMessages(selected.id);
            await loadTickets();
        } finally {
            setSending(false);
        }
    };

    const closeTicket = async () => {
        if (!selected?.id) return;
        // await supportApi.closeTicket(selected.id);
        setSelected(null);
        setMessages([]);
        await loadTickets();
    };

    const isImage = (url?: string) => {
        const u = (url || '').toLowerCase();
        return u.endsWith('.png') || u.endsWith('.jpg') || u.endsWith('.jpeg') || u.endsWith('.gif') || u.endsWith('.webp') || u.endsWith('.svg');
    };
    const resolveUrl = (url: string) => (url.startsWith('http') ? url : `${window.location.origin}${url}`);

    return (
        <div className="space-y-6">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white">Support Client</h1>
                    <p className="text-gray-500 mt-1">Tickets ouverts et archivés.</p>
                </div>
                <div className="flex gap-2 bg-[#111111] p-1 rounded-xl border border-white/10">
                    <button onClick={() => setStatus('OPEN')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${status === 'OPEN' ? 'bg-white text-black' : 'text-gray-400'}`}>Ouverts</button>
                    <button onClick={() => setStatus('CLOSED')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${status === 'CLOSED' ? 'bg-white text-black' : 'text-gray-400'}`}>Clôturés</button>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-[#111111] border border-white/5 rounded-2xl p-4 lg:col-span-1">
                    {loading ? <p className="text-gray-500">Chargement...</p> : (
                        <div className="space-y-2 max-h-[70vh] overflow-auto">
                            {tickets.length === 0 && <p className="text-gray-500 text-sm p-3">Aucun ticket.</p>}
                            {tickets.map((t) => (
                                <button
                                    key={t.id}
                                    onClick={() => setSelected(t)}
                                    className={`w-full text-left p-3 rounded-xl border ${selected?.id === t.id ? 'border-white/40 bg-white/5' : 'border-white/10 hover:border-white/20'}`}
                                >
                                    <p className="text-white font-semibold truncate">{t.company_name || t.client_name}</p>
                                    <p className="text-xs text-gray-500">{t.unread_count || 0} non lus</p>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl lg:col-span-2 flex flex-col h-[70vh] overflow-hidden">
                    {!selected ? (
                        <div className="flex-1 flex items-center justify-center text-gray-500">Sélectionnez un ticket</div>
                    ) : (
                        <>
                            <div className="px-4 py-3 border-b border-white/10 bg-black flex items-center justify-between">
                                <div>
                                    <p className="text-white font-bold">{selected.company_name || selected.client_name}</p>
                                    <p className="text-xs text-gray-500">Ticket: {selected.id}</p>
                                </div>
                                {selected.status === 'OPEN' && (
                                    <button onClick={closeTicket} className="px-3 py-2 text-sm rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20">Clôturer l'incident</button>
                                )}
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                {messages.map((m) => (
                                    <div key={m.id} className={`flex ${m.sender_type === 'admin' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[78%] rounded-2xl px-4 py-3 border ${m.sender_type === 'admin' ? 'bg-black border-[#C8AA6E]/50 text-white' : 'bg-[#1A1A1A] border-white/10 text-white'}`}>
                                            {m.message && <p className="text-sm whitespace-pre-wrap">{m.message}</p>}
                                            {m.file_url && (
                                                <a href={resolveUrl(m.file_url)} target="_blank" rel="noreferrer" className="block mt-2 rounded-lg border border-white/10 p-2 hover:bg-white/5">
                                                    {isImage(m.file_url) ? (
                                                        <img src={resolveUrl(m.file_url)} className="max-h-40 rounded-md object-contain" />
                                                    ) : (
                                                        <p className="text-sm text-gray-300">{m.file_name || 'Pièce jointe'}</p>
                                                    )}
                                                </a>
                                            )}
                                            <p className="mt-1 text-[10px] text-gray-500">{new Date(m.created_at).toLocaleString()}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {selected.status === 'OPEN' && (
                                <form onSubmit={send} className="p-4 border-t border-white/10 bg-black">
                                    <div className="flex items-end gap-2">
                                        <label className="p-2 rounded-lg border border-white/10 text-gray-300 hover:bg-white/5 cursor-pointer">
                                            <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                                            <Paperclip size={16} />
                                        </label>
                                        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} className="flex-1 resize-none px-3 py-2 rounded-lg bg-[#111111] border border-white/10 text-white outline-none focus:border-white" placeholder="Répondre au client..." />
                                        <button disabled={sending || (!text.trim() && !file)} className="px-4 py-2 rounded-lg bg-white text-black font-bold disabled:opacity-50">Envoyer</button>
                                    </div>
                                    {file && <p className="text-xs text-gray-500 mt-2">Pièce jointe: {file.name}</p>}
                                </form>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

const AdminClientsView = () => {
    const { user } = useAuth();
    const [clients, setClients] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [showAddModal, setShowAddModal] = React.useState(false);
    const [successData, setSuccessData] = React.useState<any>(null);
    const [selectedFactureClient, setSelectedFactureClient] = React.useState<any | null>(null);
    const [clientFactures, setClientFactures] = React.useState<any[]>([]);
    const [facturesLoading, setFacturesLoading] = React.useState(false);
    const [deletingFactureId, setDeletingFactureId] = React.useState<string | null>(null);
    const [newClientLogoFile, setNewClientLogoFile] = React.useState<File | null>(null);
    const [newTvaInput, setNewTvaInput] = React.useState('');
    const [newClient, setNewClient] = React.useState({ 
        name: '', 
        email: '',
        username: '',
        company_name: '',
        logo_url: '',
        tva_rates: [20] as number[],
        enable_cover_count: false,
        modules: [
            { name: 'planning', active: true },
            { name: 'evenementiel', active: false },
            { name: 'facture', active: false },
            { name: 'employes', active: false },
            { name: 'crm', active: false }
        ]
    });

    React.useEffect(() => {
        if (user) {
            loadClients();
        }
    }, [user]);

    const toCurrency = (value: number) =>
        new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number.isFinite(value) ? value : 0);

    const loadClients = async () => {
        try {
            const data = await adminApi.getClients();
            setClients(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleAddClient = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            let uploadedLogoUrl = (newClient.logo_url || '').trim() || null;
            if (newClientLogoFile) {
                const formData = new FormData();
                formData.append('logo', newClientLogoFile);
                formData.append('client_id', newClient.username || 'client');
                const upload = await adminApi.uploadLogo(formData);
                uploadedLogoUrl = upload.logo_url;
            }

            const payload = {
                ...newClient,
                logo_url: uploadedLogoUrl,
                modules: newClient.modules.filter(m => m.active).map(m => m.name)
            };
            const result = await adminApi.createClient(payload);
            setSuccessData({ ...newClient, tempPassword: result.tempPassword });
            setShowAddModal(false);
            setNewClientLogoFile(null);
            setNewTvaInput('');
            setNewClient({ 
                name: '', 
                email: '',
                username: '',
                company_name: '',
                logo_url: '',
                tva_rates: [20],
                enable_cover_count: false,
                modules: [
                    { name: 'planning', active: true },
                    { name: 'evenementiel', active: false },
                    { name: 'facture', active: false },
                    { name: 'employes', active: false },
                    { name: 'crm', active: false }
                ]
            });
            loadClients();
        } catch (e: any) {
            console.error(e);
            alert(e.message || 'Erreur lors de la création du client');
        }
    };

    const toggleModule = (name: string) => {
        setNewClient({
            ...newClient,
            modules: newClient.modules.map(m => m.name === name ? { ...m, active: !m.active } : m)
        });
    };

    const handleImpersonate = async (clientId: string) => {
        try {
            const data = await adminApi.impersonateClient(clientId);
            localStorage.setItem('token', data.token);
            window.location.href = '/';
        } catch (e) {
            alert('Erreur lors de la connexion virtuelle');
        }
    };

    const handleOpenFactures = async (clientRow: any) => {
        setSelectedFactureClient(clientRow);
        setFacturesLoading(true);
        try {
            const data = await adminApi.getClientFactures(clientRow.id);
            setClientFactures(Array.isArray(data) ? data : []);
        } catch (e: any) {
            console.error(e);
            setClientFactures([]);
            alert(e?.message || 'Erreur lors du chargement des factures du client');
        } finally {
            setFacturesLoading(false);
        }
    };

    const handleDeleteFacture = async (facture: any) => {
        if (!selectedFactureClient?.id || !facture?.id) return;
        if (!confirm(`Supprimer définitivement la facture ${facture.invoice_number || ''} de ${selectedFactureClient.name} ?`)) return;

        try {
            setDeletingFactureId(String(facture.id));
            await adminApi.deleteClientFacture(selectedFactureClient.id, String(facture.id));
            setClientFactures((current) => current.filter((item) => String(item.id) !== String(facture.id)));
        } catch (e: any) {
            alert(e?.message || 'Erreur lors de la suppression de la facture');
        } finally {
            setDeletingFactureId(null);
        }
    };

    // ...existing code...

    return (
        <div className="p-8">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-2xl font-bold">Gestion des Clients</h1>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="px-4 py-2 rounded-lg bg-black text-white font-bold hover:bg-gray-800"
                >
                    + Ajouter un client
                </button>
            </div>
            {loading ? (
                <div>Chargement...</div>
            ) : clients.length === 0 ? (
                <div className="text-gray-500">Aucun client trouvé.</div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                    {clients.map(client => {
                        const logoUrl = client.logo_url
                            ? (String(client.logo_url).startsWith('http') ? client.logo_url : `${window.location.origin}${client.logo_url}`)
                            : null;
                        return (
                            <motion.div
                                key={client.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                whileHover={{ scale: 1.03 }}
                                className="bg-[#111111] rounded-2xl border border-white/10 p-7 flex flex-col items-center shadow-lg hover:border-white/30 transition-all group relative"
                            >
                                <Link
                                    to={`/admin/clients/${client.id}`}
                                    className="flex flex-col items-center w-full"
                                    style={{ textDecoration: 'none' }}
                                >
                                    <div className="w-20 h-20 bg-white rounded-xl flex items-center justify-center mb-4 overflow-hidden border border-white/20 shadow-lg">
                                        {logoUrl ? (
                                            <img
                                                src={logoUrl}
                                                alt={client.company_name || client.name}
                                                className="w-full h-full object-contain"
                                                onError={e => (e.currentTarget as HTMLImageElement).style.display = 'none'}
                                            />
                                        ) : (
                                            <ShieldCheck className="text-black opacity-60" size={36} />
                                        )}
                                    </div>
                                    <h2 className="text-lg font-bold text-white text-center truncate w-full mb-1">{client.company_name || client.name}</h2>
                                    <p className="text-xs text-gray-400 text-center w-full truncate mb-2">{client.email}</p>
                                    <span className="text-[11px] font-mono text-gray-500 bg-white/5 rounded px-2 py-0.5 mb-2">{client.username}</span>
                                </Link>
                                <div className="flex gap-2 mt-2 w-full">
                                    <button
                                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-all"
                                        onClick={() => handleOpenFactures(client)}
                                        title="Voir les factures"
                                    >
                                        <FileText size={18} />
                                    </button>
                                    <button
                                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gray-700 text-white text-xs font-bold hover:bg-gray-800 transition-all"
                                        onClick={() => handleImpersonate(client.id)}
                                        title="Connexion virtuelle"
                                    >
                                        <UserCheck size={18} />
                                    </button>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}

            {/* Modals */}
            {/* Modal Nouveau Client, Factures, Succès Création */}
            {/* Modal Factures Client */}
            <AnimatePresence>
                {selectedFactureClient && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 overflow-y-auto transition-colors duration-200">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="w-full max-w-3xl bg-white dark:bg-[#0A0A0A] rounded-2xl p-8 shadow-2xl border border-gray-200 dark:border-white/5 my-auto transition-colors duration-200"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Factures de {selectedFactureClient.name}</h2>
                                <button onClick={() => setSelectedFactureClient(null)} className="text-gray-400 hover:text-black dark:hover:text-white transition-all text-lg font-bold">✕</button>
                            </div>
                            {facturesLoading ? (
                                <div className="text-center text-gray-500 py-10">Chargement...</div>
                            ) : clientFactures.length === 0 ? (
                                <div className="text-center text-gray-500 py-10">Aucune facture générée.</div>
                            ) : (
                                <table className="w-full text-left border-separate border-spacing-y-2">
                                    <thead>
                                        <tr className="text-xs text-gray-500 uppercase tracking-widest">
                                            <th className="pb-2">N°</th>
                                            <th className="pb-2">Date</th>
                                            <th className="pb-2">Montant</th>
                                            <th className="pb-2">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {clientFactures.map((facture) => (
                                            <tr key={facture.id} className="bg-white dark:bg-black rounded-xl shadow border border-gray-200 dark:border-white/10">
                                                <td className="py-2 px-3 font-mono text-xs">{facture.invoice_number}</td>
                                                <td className="py-2 px-3 text-xs">{facture.created_at ? new Date(facture.created_at).toLocaleDateString() : ''}</td>
                                                <td className="py-2 px-3 text-xs">{toCurrency(facture.total)}</td>
                                                <td className="py-2 px-3 flex gap-2">
                                                    <a href={facture.pdf_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-xs font-bold">PDF</a>
                                                    {user?.type === 'admin' && user?.email === 'gev-emeni@outlook.fr' && (
                                                        <button
                                                            onClick={() => handleDeleteFacture(facture)}
                                                            className="text-red-500 hover:text-red-700 text-xs font-bold disabled:opacity-50"
                                                            disabled={deletingFactureId === String(facture.id)}
                                                        >
                                                            {deletingFactureId === String(facture.id) ? 'Suppression...' : 'Supprimer'}
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

const AdminClientDetailView = () => {
    const { user } = useAuth();
    const { id } = useParams();
    const navigate = useNavigate();
    const [client, setClient] = React.useState<any>(null);
    const [modules, setModules] = React.useState<any[]>([]);
    const [collaborators, setCollaborators] = React.useState<any[]>([]);
    const [spaces, setSpaces] = React.useState<any[]>([]);
    const [staffTypes, setStaffTypes] = React.useState<any[]>([]);
    const [auditLogs, setAuditLogs] = React.useState<any[]>([]);
    const [activeTab, setActiveTab] = React.useState<'collaborators' | 'spaces' | 'staff' | 'audit'>('collaborators');
    const [loading, setLoading] = React.useState(true);
    const [showCollabModal, setShowCollabModal] = React.useState(false);
    const [showSpaceModal, setShowSpaceModal] = React.useState(false);
    const [editingCollaboratorId, setEditingCollaboratorId] = React.useState<string | null>(null);
    const [newCollab, setNewCollab] = React.useState({
        name: '',
        username: '',
        email: '',
        role: '',
        modules_access: ['planning'] as string[],
        password: ''
    });
    const [newSpace, setNewSpace] = React.useState({ name: '', color: '#ffffff' });
    const [editLogoFile, setEditLogoFile] = React.useState<File | null>(null);
    const [editMode, setEditMode] = React.useState(false);
    const [editData, setEditData] = React.useState({
        name: '',
        email: '',
        username: '',
        company_name: '',
        logo_url: '',
        tva_rates: [] as number[],
        enable_cover_count: false,
        account_manager_first_name: '',
        account_manager_last_name: '',
        account_manager_phone: '',
        account_manager_email: '',
        legal_form: '',
        siret: '',
        vat_number: '',
        company_address: '',
        company_postal_code: '',
        company_city: '',
        company_country: 'France',
        company_employee_count: 0,
    });
    const [editTvaInput, setEditTvaInput] = React.useState('');
    const [newStaffTypeName, setNewStaffTypeName] = React.useState('');
    const [editingStaffTypeId, setEditingStaffTypeId] = React.useState<string | null>(null);
    const [editingStaffTypeName, setEditingStaffTypeName] = React.useState('');
    const [spaceEdits, setSpaceEdits] = React.useState<Record<string, { name: string; color: string }>>({});
    const [savingSpaceId, setSavingSpaceId] = React.useState<string | null>(null);

    // ── Import Excel state ──────────────────────────────────────────────────────
    const [showImportModal, setShowImportModal] = React.useState(false);
    const [importFile, setImportFile] = React.useState<File | null>(null);
    const [importPreview, setImportPreview] = React.useState<any | null>(null);
    const [importLoading, setImportLoading] = React.useState(false);
    const [importResult, setImportResult] = React.useState<any | null>(null);
    const [importError, setImportError] = React.useState('');
    const isSuperAdmin = user?.type === 'admin' && user?.email === 'gev-emeni@outlook.fr';

    const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] ?? null;
        setImportFile(file);
        setImportPreview(null);
        setImportResult(null);
        setImportError('');
        if (!file) return;
        setImportLoading(true);
        try {
            const fd = new FormData();
            fd.append('file', file);
            const data = await adminApi.previewImportExcel(id!, fd);
            setImportPreview(data);
        } catch (e: any) {
            setImportError(e?.message || 'Erreur lors de l\'analyse du fichier.');
        } finally {
            setImportLoading(false);
        }
    };

    const handleExecuteImport = async () => {
        if (!importFile) return;
        setImportLoading(true);
        setImportError('');
        try {
            const fd = new FormData();
            fd.append('file', importFile);
            const result = await adminApi.executeImportExcel(id!, fd);
            setImportResult(result);
            setImportPreview(null);
        } catch (e: any) {
            setImportError(e?.message || 'Erreur lors de l\'importation.');
        } finally {
            setImportLoading(false);
        }
    };

    const handleCloseImportModal = () => {
        setShowImportModal(false);
        setImportFile(null);
        setImportPreview(null);
        setImportResult(null);
        setImportError('');
    };

    React.useEffect(() => {
        if (id) loadData();
    }, [id]);

    const loadData = async () => {
        try {
            const [clients, m, c, s, logs] = await Promise.all([
                adminApi.getClients(),
                adminApi.getClientModules(id!),
                adminApi.getCollaborators(id!),
                adminApi.getSpaces(id!),
                adminApi.getClientAuditLogs(id!)
            ]);
            const staff = await adminApi.getStaffTypes(id!);
            const currentClient = clients.find((cl: any) => cl.id === id);
            setClient(currentClient);
            const parsedRates = (() => {
                try {
                    const arr = JSON.parse(currentClient.tva_rates || '[]');
                    if (Array.isArray(arr) && arr.length > 0) return arr.map(Number).filter((n: number) => Number.isFinite(n) && n >= 0);
                } catch {}
                return [20];
            })();
            const hasExplicitManagerName = Boolean(String(currentClient.account_manager_first_name || '').trim() || String(currentClient.account_manager_last_name || '').trim());
            const normalizedManagerPhone = String(currentClient.account_manager_phone || '').trim();
            const normalizedManagerEmail = String(currentClient.account_manager_email || '').trim().toLowerCase();
            const normalizedCompanyPhone = String(currentClient.company_phone || '').trim();
            const normalizedCompanyEmail = String(currentClient.company_email || '').trim().toLowerCase();
            const shouldHideAutoManagerPhone = !hasExplicitManagerName && normalizedManagerPhone && normalizedManagerPhone === normalizedCompanyPhone;
            const shouldHideAutoManagerEmail = !hasExplicitManagerName && normalizedManagerEmail && normalizedManagerEmail === normalizedCompanyEmail;

            setEditData({
                name: currentClient.name,
                email: currentClient.email,
                username: currentClient.username || '',
                company_name: currentClient.company_name || currentClient.name || '',
                logo_url: currentClient.logo_url || '',
                tva_rates: parsedRates,
                enable_cover_count: Boolean(currentClient.enable_cover_count),
                account_manager_first_name: currentClient.account_manager_first_name || '',
                account_manager_last_name: currentClient.account_manager_last_name || '',
                account_manager_phone: shouldHideAutoManagerPhone ? '' : (currentClient.account_manager_phone || ''),
                account_manager_email: shouldHideAutoManagerEmail ? '' : (currentClient.account_manager_email || ''),
                legal_form: currentClient.legal_form || '',
                siret: currentClient.siret || '',
                vat_number: currentClient.vat_number || '',
                company_address: currentClient.company_address || '',
                company_postal_code: currentClient.company_postal_code || '',
                company_city: currentClient.company_city || '',
                company_country: currentClient.company_country || 'France',
                company_employee_count: Number(currentClient.company_employee_count || 0),
            });
            setModules(m);
            setCollaborators(c);
            setSpaces(s);
            setStaffTypes(staff || []);
            setAuditLogs(logs || []);
            const edits: Record<string, { name: string; color: string }> = {};
            (s || []).forEach((sp: any) => {
                edits[sp.id] = { name: String(sp.name || ''), color: String(sp.color || '#ffffff') };
            });
            setSpaceEdits(edits);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateModules = async (moduleName: string, active: boolean) => {
        try {
            const updatedModules = modules.map(m => 
                m.module_name === moduleName ? { ...m, is_active: active ? 1 : 0 } : m
            );
            await adminApi.updateClientModules(id!, updatedModules.map(m => ({
                name: m.module_name,
                active: m.is_active === 1
            })));
            setModules(updatedModules);
        } catch (e) {
            alert('Erreur lors de la mise à jour des modules');
        }
    };

    const handleUpdateStatus = async (status: string) => {
        try {
            await adminApi.updateClient(id!, { status });
            setClient({ ...client, status });
        } catch (e) {
            alert('Erreur lors de la mise à jour du statut');
        }
    };

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            let nextLogoUrl = editData.logo_url;
            if (editLogoFile) {
                const formData = new FormData();
                formData.append('logo', editLogoFile);
                formData.append('client_id', id || 'client');
                const upload = await adminApi.uploadLogo(formData);
                nextLogoUrl = upload.logo_url;
            }

            const payload = { ...editData, logo_url: nextLogoUrl };
            await adminApi.updateClient(id!, payload);
            setClient({ ...client, ...payload });
            setEditData((prev) => ({ ...prev, logo_url: nextLogoUrl }));
            setEditLogoFile(null);
            setEditMode(false);
        } catch (e) {
            alert('Erreur lors de la mise à jour du profil');
        }
    };

    const handleDeleteClient = async () => {
        if (!confirm('Êtes-vous sûr de vouloir supprimer ce client ? Cette action est irréversible et supprimera TOUTES les données associées.')) return;
        try {
            await adminApi.deleteClient(id!);
            navigate('/admin/clients');
        } catch (e) {
            alert('Erreur lors de la suppression');
        }
    };

    const handleResetPassword = async () => {
        if (!confirm('Renvoyer un nouveau mot de passe temporaire au client ?')) return;
        try {
            await adminApi.resetClientPassword(id!);
            alert('Un nouveau mot de passe a été envoyé par email.');
        } catch (e) {
            alert('Erreur lors de la réinitialisation');
        }
    };

    const handleForceReset = async () => {
        if (!confirm('Générer un lien de réinitialisation et l\'envoyer au client ?')) return;
        try {
            await adminApi.forceResetClientPassword(id!);
            alert('Un lien de réinitialisation a été envoyé par email.');
        } catch (e) {
            alert('Erreur lors de l\'envoi du lien');
        }
    };

    const handleResetCollaboratorPassword = async (collab: any) => {
        if (!confirm(`Renvoyer de nouveaux identifiants temporaires à ${collab.name || 'ce collaborateur'} ?`)) return;
        try {
            alert('Les nouveaux identifiants ont été envoyés par email au collaborateur.');
        } catch (e: any) {
            alert(e?.message || 'Erreur lors de la réinitialisation du collaborateur');
        }
    };

    const handleForceResetCollaborator = async (collab: any) => {
        if (!confirm(`Forcer la réinitialisation du mot de passe de ${collab.name || 'ce collaborateur'} ?`)) return;
        try {
            alert('La réinitialisation du mot de passe a été forcée et envoyée par email.');
        } catch (e: any) {
            alert(e?.message || 'Erreur lors de l\'envoi du lien de réinitialisation');
        }
    };

    const handleAddCollab = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingCollaboratorId) {
                await adminApi.updateCollaborator(id!, editingCollaboratorId, newCollab);
            } else {
                await adminApi.createCollaborator(id!, newCollab);
            }
            setShowCollabModal(false);
            setEditingCollaboratorId(null);
            setNewCollab({ name: '', username: '', email: '', role: '', modules_access: ['planning'], password: '' });
            loadData();
        } catch (e: any) {
            alert(e?.message || 'Erreur lors de l\'enregistrement du collaborateur');
        }
    };

    const handleOpenCreateCollab = () => {
        setEditingCollaboratorId(null);
        setNewCollab({ name: '', username: '', email: '', role: '', modules_access: ['planning'], password: '' });
        setShowCollabModal(true);
    };

    const handleOpenEditCollab = (collab: any) => {
        let parsedModules: string[] = [];
        try {
            const raw = collab?.modules_access;
            if (Array.isArray(raw)) {
                parsedModules = raw.map((m: any) => String(m));
            } else if (typeof raw === 'string') {
                const decoded = JSON.parse(raw || '[]');
                parsedModules = Array.isArray(decoded) ? decoded.map((m: any) => String(m)) : [];
            }
        } catch {
            parsedModules = [];
        }

        setEditingCollaboratorId(String(collab.id));
        setNewCollab({
            name: String(collab.name || ''),
            username: String(collab.username || ''),
            email: String(collab.email || ''),
            role: String(collab.role || ''),
            modules_access: parsedModules,
            password: ''
        });
        setShowCollabModal(true);
    };

    const handleDeleteCollaborator = async (collaboratorId: string) => {
        if (!confirm('Supprimer ce collaborateur définitivement ? Cette action est irréversible.')) return;
        try {
            await adminApi.deleteCollaborator(id!, collaboratorId);
            loadData();
        } catch (e: any) {
            alert(e?.message || 'Erreur lors de la suppression du collaborateur');
        }
    };

    const toggleCollaboratorModule = (moduleName: string) => {
        setNewCollab((prev) => {
            const hasModule = prev.modules_access.includes(moduleName);
            return {
                ...prev,
                modules_access: hasModule
                    ? prev.modules_access.filter((m) => m !== moduleName)
                    : [...prev.modules_access, moduleName]
            };
        });
    };

    const handleAddSpace = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await adminApi.createSpace(id!, newSpace);
            setShowSpaceModal(false);
            setNewSpace({ name: '', color: '#ffffff' });
            loadData();
        } catch (e) {
            alert('Erreur lors de la création de l\'espace');
        }
    };

    const handleDeleteSpace = async (spaceId: string) => {
        if (!confirm('Supprimer cet espace ?')) return;
        try {
            await adminApi.deleteSpace(id!, spaceId);
            loadData();
        } catch (e) {
            alert('Erreur lors de la suppression');
        }
    };

    const handleSaveSpace = async (spaceId: string) => {
        const edit = spaceEdits[spaceId];
        if (!edit) return;
        if (!edit.name.trim()) { alert("Le nom de l'espace est requis."); return; }
        setSavingSpaceId(spaceId);
        try {
            await adminApi.updateSpace(id!, spaceId, { name: edit.name.trim(), color: edit.color });
            loadData();
        } catch (e) {
            alert("Erreur lors de la sauvegarde de l'espace");
        } finally {
            setSavingSpaceId(null);
        }
    };

    if (loading) return <div className="text-center py-20 text-gray-500">Chargement...</div>;
    if (!client) return <div className="text-center py-20 text-gray-500">Client introuvable</div>;

    const handleAddStaffType = async () => {
        if (!newStaffTypeName.trim()) return;
        try {
            await adminApi.createStaffType(id!, { name: newStaffTypeName.trim() });
            setNewStaffTypeName('');
            loadData();
        } catch (e: any) {
            alert(e?.message || 'Erreur lors de la création de la catégorie.');
        }
    };

    const handleEditStaffType = (type: any) => {
        setEditingStaffTypeId(type.id);
        setEditingStaffTypeName(String(type.name || ''));
    };

    const handleSaveStaffType = async () => {
        if (!editingStaffTypeId || !editingStaffTypeName.trim()) return;
        try {
            await adminApi.createStaffType(id!, { id: editingStaffTypeId, name: editingStaffTypeName.trim() });
            setEditingStaffTypeId(null);
            setEditingStaffTypeName('');
            loadData();
        } catch (e: any) {
            alert(e?.message || 'Erreur lors de la modification.');
        }
    };

    const handleDeleteStaffType = async (staffId: string) => {
        if (!confirm('Supprimer cette catégorie de staff ?')) return;
        try {
            await adminApi.deleteStaffType(id!, staffId);
            loadData();
        } catch (e: any) {
            alert(e?.message || 'Erreur lors de la suppression.');
        }
    };

    const displayValue = (value: any, fallback = 'Non renseigné') => {
        const text = String(value ?? '').trim();
        return text || fallback;
    };

    const companyAddressLine = [
        client.company_address,
        [client.company_postal_code, client.company_city].filter(Boolean).join(' '),
        client.company_country,
    ].map((v: any) => String(v || '').trim()).filter(Boolean).join(', ');

    const legalDetailsLine = [
        client.capital ? `Capital ${client.capital}` : '',
        client.ape ? `APE ${client.ape}` : '',
        client.rcs_ville && client.rcs_numero ? `RCS ${client.rcs_ville} ${client.rcs_numero}` : '',
    ].filter(Boolean).join(' • ');

    const managerHasIdentity = Boolean(String(client.account_manager_first_name || '').trim() || String(client.account_manager_last_name || '').trim());
    const managerPhoneValue = !managerHasIdentity && String(client.account_manager_phone || '').trim() === String(client.company_phone || '').trim()
        ? ''
        : String(client.account_manager_phone || '').trim();
    const managerEmailValue = !managerHasIdentity && String(client.account_manager_email || '').trim().toLowerCase() === String(client.company_email || '').trim().toLowerCase()
        ? ''
        : String(client.account_manager_email || '').trim();

    const statBadges = [
        { label: 'Employés saisis', value: Number(client.employees_count || 0) },
        { label: 'Collaborateurs', value: collaborators.length },
        { label: 'Calendriers', value: Number(client.calendars_count || 0) },
        { label: 'Modules actifs', value: modules.filter((m) => Number(m.is_active) === 1).length },
    ];

    return (
        <div className="space-y-10">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <Link to="/admin/clients" className="text-sm text-gray-500 hover:text-white flex items-center gap-1 mb-2 transition-all">
                        <ChevronRight size={14} className="rotate-180" /> Retour aux clients
                    </Link>
                    <div className="flex items-center gap-4">
                        <h1 className="text-3xl font-bold tracking-tight text-white">{client.name}</h1>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            client.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                        }`}>
                            {client.status === 'active' ? 'Actif' : 'Bloqué'}
                        </span>
                    </div>
                    <p className="text-gray-500 mt-1">ID: {client.id} • Email: {client.email}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <button 
                        onClick={() => handleUpdateStatus(client.status === 'active' ? 'blocked' : 'active')}
                        className={`px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${
                            client.status === 'active' 
                                ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' 
                                : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                        }`}
                    >
                        {client.status === 'active' ? <Lock size={16} /> : <ShieldCheck size={16} />}
                        {client.status === 'active' ? 'Bloquer le compte' : 'Débloquer le compte'}
                    </button>
                    <button 
                        onClick={handleResetPassword}
                        className="bg-white/5 border border-white/10 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-white/10 transition-all flex items-center gap-2"
                        title="Renvoyer un mot de passe temporaire"
                    >
                        <Mail size={16} />
                        Renvoyer Identifiants
                    </button>
                    <button 
                        onClick={handleForceReset}
                        className="bg-white/5 border border-white/10 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-white/10 transition-all flex items-center gap-2"
                        title="Envoyer un lien de réinitialisation"
                    >
                        <ShieldCheck size={16} />
                        Forcer Reset MDP
                    </button>
                    <button 
                        onClick={() => setEditMode(true)}
                        className="bg-white/5 border border-white/10 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-white/10 transition-all flex items-center gap-2"
                    >
                        <Settings size={16} />
                        Éditer Profil
                    </button>
                    <button 
                        onClick={handleDeleteClient}
                        className="bg-red-500/10 text-red-400 px-4 py-2 rounded-lg font-bold text-sm hover:bg-red-500/20 transition-all flex items-center gap-2"
                    >
                        <Trash2 size={16} />
                        Supprimer
                    </button>
                </div>
            </header>

            <div className="space-y-6">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <div className="bg-[#111111] rounded-2xl p-6 md:p-7 border border-white/5">
                        <div className="flex items-start justify-between gap-4 mb-5">
                            <div>
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <ShieldCheck size={20} className="text-cyan-400" />
                                    Contact gestionnaire
                                </h2>
                                <p className="text-xs text-cyan-300/80 mt-1">Visible uniquement par vous en tant que superadmin.</p>
                            </div>
                            <button
                                onClick={() => setEditMode(true)}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all"
                            >
                                Modifier
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div className="rounded-xl bg-black border border-white/5 p-4">
                                <p className="text-[11px] uppercase tracking-widest text-gray-500 mb-1">Nom</p>
                                <p className="text-white font-semibold">{displayValue([client.account_manager_first_name, client.account_manager_last_name].filter(Boolean).join(' '))}</p>
                            </div>
                            <div className="rounded-xl bg-black border border-white/5 p-4">
                                <p className="text-[11px] uppercase tracking-widest text-gray-500 mb-1 flex items-center gap-2"><Phone size={13} />Téléphone</p>
                                <p className="text-white font-semibold">{displayValue(managerPhoneValue)}</p>
                            </div>
                            <div className="rounded-xl bg-black border border-white/5 p-4 md:col-span-2">
                                <p className="text-[11px] uppercase tracking-widest text-gray-500 mb-1 flex items-center gap-2"><Mail size={13} />Adresse email</p>
                                <p className="text-white font-semibold break-all">{displayValue(managerEmailValue)}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#111111] rounded-2xl p-6 md:p-7 border border-white/5">
                        <div className="flex items-start justify-between gap-4 mb-5">
                            <div>
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Building2 size={20} className="text-violet-400" />
                                    Fiche entreprise
                                </h2>
                                <p className="text-sm text-gray-500 mt-1">Vue synthétique, claire et modifiable à tout moment.</p>
                            </div>
                            <button
                                onClick={() => setEditMode(true)}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all"
                            >
                                Mettre à jour
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                <div className="rounded-xl bg-black border border-white/5 p-4">
                                    <p className="text-[11px] uppercase tracking-widest text-gray-500 mb-1">Nom commercial</p>
                                    <p className="text-white font-semibold">{displayValue(client.company_name || client.name)}</p>
                                </div>
                                <div className="rounded-xl bg-black border border-white/5 p-4">
                                    <p className="text-[11px] uppercase tracking-widest text-gray-500 mb-1">Forme juridique</p>
                                    <p className="text-white font-semibold">{displayValue(client.legal_form)}</p>
                                </div>
                                <div className="rounded-xl bg-black border border-white/5 p-4 md:col-span-2">
                                    <p className="text-[11px] uppercase tracking-widest text-gray-500 mb-1 flex items-center gap-2"><MapPin size={13} />Adresse postale</p>
                                    <p className="text-white font-semibold">{displayValue(companyAddressLine)}</p>
                                </div>
                                <div className="rounded-xl bg-black border border-white/5 p-4">
                                    <p className="text-[11px] uppercase tracking-widest text-gray-500 mb-1 flex items-center gap-2"><Phone size={13} />Téléphone entreprise</p>
                                    <p className="text-white font-semibold">{displayValue(client.company_phone)}</p>
                                </div>
                                <div className="rounded-xl bg-black border border-white/5 p-4">
                                    <p className="text-[11px] uppercase tracking-widest text-gray-500 mb-1 flex items-center gap-2"><Mail size={13} />Email entreprise</p>
                                    <p className="text-white font-semibold break-all">{displayValue(client.company_email)}</p>
                                </div>
                                <div className="rounded-xl bg-black border border-white/5 p-4">
                                    <p className="text-[11px] uppercase tracking-widest text-gray-500 mb-1">SIRET</p>
                                    <p className="text-white font-semibold">{displayValue(client.siret)}</p>
                                </div>
                                <div className="rounded-xl bg-black border border-white/5 p-4">
                                    <p className="text-[11px] uppercase tracking-widest text-gray-500 mb-1">TVA intracom</p>
                                    <p className="text-white font-semibold">{displayValue(client.vat_number)}</p>
                                </div>
                                <div className="rounded-xl bg-black border border-white/5 p-4 md:col-span-2">
                                    <p className="text-[11px] uppercase tracking-widest text-gray-500 mb-1">Mentions légales</p>
                                    <p className="text-white font-semibold">{displayValue(legalDetailsLine)}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {statBadges.map((item) => (
                                    <div key={item.label} className="rounded-xl bg-white/5 border border-white/5 p-3 text-center">
                                        <p className="text-xl font-bold text-white">{item.value}</p>
                                        <p className="text-[11px] text-gray-400 mt-1">{item.label}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="rounded-xl bg-black border border-white/5 p-4 text-sm">
                                <div className="flex justify-between gap-3">
                                    <span className="text-gray-500">Effectif déclaré</span>
                                    <span className="text-white font-semibold">{Number(client.company_employee_count || 0)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="bg-[#111111] rounded-2xl p-8 border border-white/5">
                        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <Settings size={20} className="text-purple-400" />
                            Provisioning
                        </h2>
                        <div className="space-y-4">
                            {modules.map((m) => (
                                <div 
                                    key={m.module_name}
                                    className="flex items-center justify-between p-4 rounded-xl bg-black border border-white/5"
                                >
                                    <span className="capitalize font-medium text-white">{m.module_name}</span>
                                    <button 
                                        onClick={() => handleUpdateModules(m.module_name, m.is_active === 0)}
                                        className="transition-all"
                                    >
                                        {m.is_active === 1 ? <ToggleRight size={32} className="text-white" /> : <ToggleLeft size={32} className="text-gray-700" />}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-[#111111] rounded-2xl p-8 border border-white/5">
                        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <ShieldCheck size={20} className="text-blue-400" />
                            Audit & Sécurité
                        </h2>
                        <div className="space-y-4 text-sm">
                            <div className="flex justify-between py-2 border-b border-white/5">
                                <span className="text-gray-500">Dernière Connexion</span>
                                <span className="text-white font-medium">{client.last_login ? new Date(client.last_login).toLocaleString() : 'Jamais'}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-white/5">
                                <span className="text-gray-500">Date de Création</span>
                                <span className="text-white font-medium">{new Date(client.created_at).toLocaleDateString()}</span>
                            </div>
                            <div className="flex justify-between py-2">
                                <span className="text-gray-500">Type de Compte</span>
                                <span className="text-white font-medium uppercase tracking-widest text-[10px] bg-white/5 px-2 py-0.5 rounded">Client SaaS</span>
                            </div>
                        </div>
                    </div>

                    {/* Import Excel/PDF (SuperAdmin only) */}
                    {isSuperAdmin && (
                    <div className="bg-[#111111] rounded-2xl p-8 border border-white/5">
                        <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                            <FileSpreadsheet size={20} className="text-green-400" />
                            Import Données Excel
                        </h2>
                        <p className="text-sm text-gray-500 mb-6">Importer des employés et postes en masse depuis un fichier Excel ou PDF (.xlsx, .xls, .csv, .pdf).</p>
                        <button
                            onClick={() => setShowImportModal(true)}
                            className="w-full bg-green-500/10 border border-green-500/30 text-green-400 py-3 rounded-xl font-bold hover:bg-green-500/20 transition-all flex items-center justify-center gap-2"
                        >
                            <Upload size={16} />
                            Configurer Data (Excel)
                        </button>
                    </div>
                    )}
                </div>

                <div className="space-y-6">
                    <div className="flex gap-2 bg-[#111111] rounded-xl p-1 border border-white/5 w-fit">
                        <button
                            onClick={() => setActiveTab('collaborators')}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'collaborators' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}
                        >
                            Collaborateurs
                        </button>
                        <button
                            onClick={() => setActiveTab('spaces')}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'spaces' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}
                        >
                            Espaces
                        </button>
                        <button
                            onClick={() => setActiveTab('staff')}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'staff' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}
                        >
                            Staff
                        </button>
                        <button
                            onClick={() => setActiveTab('audit')}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'audit' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}
                        >
                            Journal d'activité
                        </button>
                    </div>

                    {activeTab === 'collaborators' && (
                    <div className="bg-[#111111] rounded-2xl p-8 border border-white/5">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Users size={20} className="text-green-400" />
                                Collaborateurs
                            </h2>
                            <button 
                                onClick={handleOpenCreateCollab}
                                className="text-sm font-bold text-white hover:text-gray-300 flex items-center gap-2 transition-all"
                            >
                                <Plus size={16} /> Ajouter
                            </button>
                        </div>

                        <div className="overflow-hidden">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-white/5">
                                        <th className="pb-4">Nom</th>
                                        <th className="pb-4">Pseudo</th>
                                        <th className="pb-4">Email</th>
                                        <th className="pb-4">Rôle</th>
                                        <th className="pb-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {collaborators.length === 0 ? (
                                        <tr><td colSpan={5} className="py-10 text-center text-gray-500">Aucun collaborateur.</td></tr>
                                    ) : collaborators.map((collab) => (
                                        <tr key={collab.id}>
                                            <td className="py-4 font-bold text-white">{collab.name}</td>
                                            <td className="py-4 text-gray-300 font-mono text-sm">{collab.username || <span className="text-gray-600 italic">—</span>}</td>
                                            <td className="py-4 text-gray-400">{collab.email || <span className="text-gray-600 italic">—</span>}</td>
                                            <td className="py-4">
                                                <span className="text-[10px] font-bold uppercase tracking-widest bg-white/5 px-2 py-1 rounded text-gray-400">
                                                    {collab.role || 'Collaborateur'}
                                                </span>
                                            </td>
                                            <td className="py-4 text-right">
                                                <div className="flex items-center justify-end gap-2 flex-wrap">
                                                    {isSuperAdmin && (
                                                        <>
                                                            <button
                                                                onClick={() => handleResetCollaboratorPassword(collab)}
                                                                className="text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all"
                                                            >
                                                                Identifiants
                                                            </button>
                                                            <button
                                                                onClick={() => handleForceResetCollaborator(collab)}
                                                                className="text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-all"
                                                            >
                                                                Forcer MDP
                                                            </button>
                                                        </>
                                                    )}
                                                    <button
                                                        onClick={() => handleOpenEditCollab(collab)}
                                                        className="text-gray-400 hover:text-white transition-all text-sm"
                                                    >
                                                        Modifier
                                                    </button>
                                                    <button onClick={() => handleDeleteCollaborator(collab.id)} className="text-gray-600 hover:text-red-500 transition-all">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    )}

                    {activeTab === 'staff' && (
                    <div className="bg-[#111111] rounded-2xl p-8 border border-white/5">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Briefcase size={20} className="text-orange-400" />
                                Catégories de Staff
                            </h2>
                            <div className="flex items-center gap-2">
                                <input
                                    value={newStaffTypeName}
                                    onChange={(e) => setNewStaffTypeName(e.target.value)}
                                    placeholder="Nouvelle catégorie"
                                    className="bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-white"
                                />
                                <button
                                    onClick={handleAddStaffType}
                                    className="text-sm font-bold text-white hover:text-gray-300 flex items-center gap-2 transition-all"
                                >
                                    <Plus size={16} /> Ajouter une catégorie
                                </button>
                            </div>
                        </div>

                        <div className="overflow-hidden">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-white/5">
                                        <th className="pb-4">Nom</th>
                                        <th className="pb-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {staffTypes.length === 0 ? (
                                        <tr><td colSpan={2} className="py-10 text-center text-gray-500">Aucune catégorie de staff.</td></tr>
                                    ) : staffTypes.map((type: any) => (
                                        <tr key={type.id} className="bg-[#0A0A0A]">
                                            <td className="py-4 text-white font-medium">
                                                {editingStaffTypeId === type.id ? (
                                                    <input
                                                        value={editingStaffTypeName}
                                                        onChange={(e) => setEditingStaffTypeName(e.target.value)}
                                                        className="bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-white w-full max-w-md"
                                                    />
                                                ) : (
                                                    type.name
                                                )}
                                            </td>
                                            <td className="py-4 text-right">
                                                {editingStaffTypeId === type.id ? (
                                                    <div className="inline-flex gap-3">
                                                        <button onClick={handleSaveStaffType} className="text-gray-300 hover:text-white text-sm">Enregistrer</button>
                                                        <button onClick={() => { setEditingStaffTypeId(null); setEditingStaffTypeName(''); }} className="text-gray-600 hover:text-gray-400 text-sm">Annuler</button>
                                                    </div>
                                                ) : (
                                                    <div className="inline-flex gap-3">
                                                        <button onClick={() => handleEditStaffType(type)} className="text-gray-400 hover:text-white text-sm">Modifier</button>
                                                        <button onClick={() => handleDeleteStaffType(type.id)} className="text-gray-600 hover:text-red-500 transition-all">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    )}

                    {activeTab === 'spaces' && (
                    <div className="bg-[#111111] rounded-2xl p-8 border border-white/5">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <MapPin size={20} className="text-orange-400" />
                                Espaces
                            </h2>
                            <button 
                                onClick={() => setShowSpaceModal(true)}
                                className="text-sm font-bold text-white hover:text-gray-300 flex items-center gap-2 transition-all"
                            >
                                <Plus size={16} /> Ajouter un espace
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {spaces.length === 0 ? (
                                <p className="col-span-full py-10 text-center text-gray-500">Aucun espace configuré.</p>
                            ) : spaces.map((space) => (
                                <div key={space.id} className="flex items-center gap-3 p-4 rounded-xl bg-black border border-white/5">
                                    <input
                                        type="color"
                                        value={spaceEdits[space.id]?.color || space.color}
                                        onChange={(e) => setSpaceEdits(prev => ({ ...prev, [space.id]: { ...prev[space.id], color: e.target.value } }))}
                                        className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent flex-shrink-0"
                                        title="Changer la couleur"
                                    />
                                    <input
                                        type="text"
                                        value={spaceEdits[space.id]?.name ?? space.name}
                                        onChange={(e) => setSpaceEdits(prev => ({ ...prev, [space.id]: { ...prev[space.id], name: e.target.value } }))}
                                        className="flex-1 bg-transparent text-white font-bold text-sm outline-none border-b border-white/10 focus:border-white/40 transition-colors py-1"
                                        placeholder="Nom de l'espace"
                                    />
                                    <button
                                        onClick={() => handleSaveSpace(space.id)}
                                        disabled={savingSpaceId === space.id}
                                        className="text-gray-500 hover:text-green-400 transition-all disabled:opacity-50"
                                        title="Enregistrer"
                                    >
                                        <Save size={15} />
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteSpace(space.id)}
                                        className="text-gray-600 hover:text-red-500 transition-all"
                                        title="Supprimer"
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                    )}

                    {activeTab === 'audit' && (
                    <div className="bg-[#111111] rounded-2xl p-8 border border-white/5">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <ShieldCheck size={20} className="text-blue-400" />
                                Journal d'activité
                            </h2>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left min-w-[840px]">
                                <thead>
                                    <tr className="text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-white/5">
                                        <th className="pb-4">Date</th>
                                        <th className="pb-4">Action</th>
                                        <th className="pb-4">Par</th>
                                        <th className="pb-4">Cible</th>
                                        <th className="pb-4">Ancienne valeur</th>
                                        <th className="pb-4">Nouvelle valeur</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {auditLogs.length === 0 ? (
                                        <tr><td colSpan={6} className="py-10 text-center text-gray-500">Aucune activité enregistrée.</td></tr>
                                    ) : auditLogs.map((log: any) => (
                                        <tr key={log.id}>
                                            <td className="py-3 text-gray-400 text-sm">{new Date(log.created_at).toLocaleString()}</td>
                                            <td className="py-3 text-white font-medium">{log.action}</td>
                                            <td className="py-3 text-gray-300">{log.actor_name || log.user_id}</td>
                                            <td className="py-3 text-gray-300">{log.target_name || log.target_user_id}</td>
                                            <td className="py-3 text-gray-500 break-all">{log.old_value || '—'}</td>
                                            <td className="py-3 text-gray-500 break-all">{log.new_value || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    )}
                </div>
            </div>

            {/* Modal Édition Profil */}
            <AnimatePresence>
                {editMode && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto transition-colors duration-200">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="w-full max-w-4xl bg-white dark:bg-[#0A0A0A] rounded-2xl p-5 md:p-6 shadow-2xl border border-gray-200 dark:border-white/5 my-auto transition-colors duration-200"
                        >
                            <h2 className="text-xl font-bold mb-6 text-slate-900 dark:text-white">Éditer la fiche client</h2>
                            <form onSubmit={handleUpdateProfile} className="space-y-6">
                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                                    <div className="space-y-5 rounded-2xl border border-gray-200 dark:border-white/5 p-4">
                                        <div>
                                            <p className="text-sm font-bold text-slate-900 dark:text-white">Compte client</p>
                                            <p className="text-xs text-slate-500 dark:text-gray-500">Identifiants et marque blanche visibles par le client.</p>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Nom du compte</label>
                                            <input 
                                                type="text" required
                                                value={editData.name}
                                                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                                                className="w-full px-4 py-3 rounded-lg bg-slate-50 dark:bg-black border border-gray-300 dark:border-white/10 text-slate-900 dark:text-white focus:border-slate-400 dark:focus:border-white outline-none transition-colors duration-200"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Email de connexion</label>
                                            <input 
                                                type="email" required
                                                value={editData.email}
                                                onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                                                className="w-full px-4 py-3 rounded-lg bg-slate-50 dark:bg-black border border-gray-300 dark:border-white/10 text-slate-900 dark:text-white focus:border-slate-400 dark:focus:border-white outline-none transition-colors duration-200"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Pseudo de connexion</label>
                                            <input 
                                                type="text" required
                                                value={editData.username}
                                                onChange={(e) => setEditData({ ...editData, username: e.target.value.toLowerCase().replace(/\s+/g, '.') })}
                                                className="w-full px-4 py-3 rounded-lg bg-slate-50 dark:bg-black border border-gray-300 dark:border-white/10 text-slate-900 dark:text-white focus:border-slate-400 dark:focus:border-white outline-none transition-colors duration-200 font-mono"
                                                placeholder="ex: polpo.hotesse"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Nom marque blanche</label>
                                            <input 
                                                type="text"
                                                value={editData.company_name}
                                                onChange={(e) => setEditData({ ...editData, company_name: e.target.value })}
                                                className="w-full px-4 py-3 rounded-lg bg-slate-50 dark:bg-black border border-gray-300 dark:border-white/10 text-slate-900 dark:text-white focus:border-slate-400 dark:focus:border-white outline-none transition-colors duration-200"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-5 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                                        <div>
                                            <p className="text-sm font-bold text-slate-900 dark:text-white">Contact privé superadmin</p>
                                            <p className="text-xs text-slate-500 dark:text-gray-500">Ces infos sont destinées à votre pilotage interne uniquement.</p>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Prénom</label>
                                                <input type="text" value={editData.account_manager_first_name} onChange={(e) => setEditData({ ...editData, account_manager_first_name: e.target.value })} className="w-full px-4 py-3 rounded-lg bg-slate-50 dark:bg-black border border-gray-300 dark:border-white/10 text-slate-900 dark:text-white focus:border-slate-400 dark:focus:border-white outline-none transition-colors duration-200" />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Nom</label>
                                                <input type="text" value={editData.account_manager_last_name} onChange={(e) => setEditData({ ...editData, account_manager_last_name: e.target.value })} className="w-full px-4 py-3 rounded-lg bg-slate-50 dark:bg-black border border-gray-300 dark:border-white/10 text-slate-900 dark:text-white focus:border-slate-400 dark:focus:border-white outline-none transition-colors duration-200" />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Téléphone</label>
                                                <input type="text" value={editData.account_manager_phone} onChange={(e) => setEditData({ ...editData, account_manager_phone: e.target.value })} className="w-full px-4 py-3 rounded-lg bg-slate-50 dark:bg-black border border-gray-300 dark:border-white/10 text-slate-900 dark:text-white focus:border-slate-400 dark:focus:border-white outline-none transition-colors duration-200" />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Adresse email</label>
                                                <input type="email" value={editData.account_manager_email} onChange={(e) => setEditData({ ...editData, account_manager_email: e.target.value })} className="w-full px-4 py-3 rounded-lg bg-slate-50 dark:bg-black border border-gray-300 dark:border-white/10 text-slate-900 dark:text-white focus:border-slate-400 dark:focus:border-white outline-none transition-colors duration-200" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                                    <div className="space-y-3">
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Taux de TVA</label>
                                        <div className="flex flex-wrap gap-2 min-h-[32px]">
                                            {editData.tva_rates.map((rate) => (
                                                <span key={rate} className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white border border-slate-300 dark:border-white/20">
                                                    {rate}%
                                                    <button type="button" onClick={() => setEditData({ ...editData, tva_rates: editData.tva_rates.filter(r => r !== rate) })} className="ml-1 text-slate-500 hover:text-red-500 transition-colors font-normal leading-none">×</button>
                                                </span>
                                            ))}
                                            {editData.tva_rates.length === 0 && <span className="text-sm text-slate-400 dark:text-gray-600">Aucun taux configuré</span>}
                                        </div>
                                        <div className="flex gap-2 flex-wrap">
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={editTvaInput}
                                                onChange={(e) => setEditTvaInput(e.target.value)}
                                                placeholder="Ex: 20"
                                                className="w-32 px-3 py-2 rounded-lg bg-slate-50 dark:bg-black border border-gray-300 dark:border-white/10 text-slate-900 dark:text-white focus:border-slate-400 dark:focus:border-white outline-none text-sm transition-colors duration-200"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        const val = parseFloat(editTvaInput);
                                                        if (!Number.isFinite(val) || val < 0) return;
                                                        if (editData.tva_rates.includes(val)) return;
                                                        setEditData({ ...editData, tva_rates: [...editData.tva_rates, val].sort((a, b) => a - b) });
                                                        setEditTvaInput('');
                                                    }
                                                }}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const val = parseFloat(editTvaInput);
                                                    if (!Number.isFinite(val) || val < 0) return;
                                                    if (editData.tva_rates.includes(val)) return;
                                                    setEditData({ ...editData, tva_rates: [...editData.tva_rates, val].sort((a, b) => a - b) });
                                                    setEditTvaInput('');
                                                }}
                                                className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-black font-bold text-sm hover:opacity-80 transition-opacity"
                                            >
                                                + Ajouter
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Champ facture supplémentaire</label>
                                        <button
                                            type="button"
                                            onClick={() => setEditData({ ...editData, enable_cover_count: !editData.enable_cover_count })}
                                            className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
                                                editData.enable_cover_count
                                                    ? 'bg-slate-100 dark:bg-white/5 border-slate-300 dark:border-white/20 text-slate-900 dark:text-white'
                                                    : 'bg-slate-50 dark:bg-black border-gray-300 dark:border-white/5 text-slate-500 dark:text-gray-600'
                                            }`}
                                        >
                                            <span className="font-medium">Activer “Nombre de couverts”</span>
                                            {editData.enable_cover_count ? <ToggleRight size={24} className="text-slate-900 dark:text-white" /> : <ToggleLeft size={24} />}
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Logo Client (.jpg, .png, .svg)</label>
                                    <input 
                                        type="file"
                                        accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                                        onChange={(e) => setEditLogoFile(e.target.files?.[0] || null)}
                                        className="w-full px-4 py-3 rounded-lg bg-slate-50 dark:bg-black border border-gray-300 dark:border-white/10 text-slate-900 dark:text-white file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border-0 file:bg-black file:text-white dark:file:bg-white dark:file:text-black transition-colors duration-200"
                                    />
                                    {editLogoFile ? (
                                        <p className="text-xs text-gray-500">Nouveau fichier: {editLogoFile.name}</p>
                                    ) : editData.logo_url ? (
                                        <p className="text-xs text-gray-500 break-all">Logo actuel: {editData.logo_url}</p>
                                    ) : null}
                                </div>

                                <div className="flex gap-4 pt-4">
                                    <button 
                                        type="button"
                                        onClick={() => setEditMode(false)}
                                        className="flex-1 px-6 py-4 rounded-lg font-bold border border-gray-300 dark:border-white/10 text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors duration-200"
                                    >
                                        Annuler
                                    </button>
                                    <button 
                                        type="submit"
                                        className="flex-1 bg-white text-black px-6 py-4 rounded-lg font-bold hover:bg-gray-200 transition-all"
                                    >
                                        Enregistrer
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Modal Collaborateur */}
            <style>{`
                .collab-modal-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .collab-modal-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .collab-modal-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.15);
                    border-radius: 3px;
                }
                .collab-modal-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.25);
                }
                .collab-modal-scrollbar {
                    scrollbar-width: thin;
                    scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
                }
            `}</style>
            <AnimatePresence>
                {showCollabModal && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-6 overflow-y-auto transition-colors duration-200">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className="w-full max-w-md bg-white dark:bg-[#0A0A0A] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/5 my-auto flex flex-col max-h-[90vh] transition-colors duration-200"
                        >
                            {/* Contenu défilable */}
                            <div className="overflow-y-auto collab-modal-scrollbar flex-1">
                                <div className="p-8">
                                    <h2 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white">{editingCollaboratorId ? 'Modifier Collaborateur' : 'Nouveau Collaborateur'}</h2>
                                    <form id="collab-form" onSubmit={handleAddCollab} className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Nom complet</label>
                                    <input 
                                        type="text" required
                                        value={newCollab.name}
                                        onChange={(e) => setNewCollab({ ...newCollab, name: e.target.value })}
                                        className="w-full px-4 py-3 rounded-lg bg-slate-50 dark:bg-black border border-gray-300 dark:border-white/10 text-slate-900 dark:text-white focus:border-slate-400 dark:focus:border-white outline-none transition-colors duration-200"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                                        Pseudo de connexion <span className="text-red-400">*</span>
                                    </label>
                                    <input 
                                        type="text" required
                                        value={newCollab.username}
                                        onChange={(e) => setNewCollab({ ...newCollab, username: e.target.value.toLowerCase().replace(/\s+/g, '.') })}
                                        className="w-full px-4 py-3 rounded-lg bg-slate-50 dark:bg-black border border-gray-300 dark:border-white/10 text-slate-900 dark:text-white focus:border-slate-400 dark:focus:border-white outline-none transition-colors duration-200 font-mono"
                                        placeholder="ex: polpo.hotesse"
                                        autoComplete="off"
                                    />
                                    <p className="text-[11px] text-gray-600">Utilisé pour se connecter à la place de l'email.</p>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                                        Email <span className="text-gray-600 font-normal normal-case">(optionnel)</span>
                                    </label>
                                    <input 
                                        type="email"
                                        value={newCollab.email}
                                        onChange={(e) => setNewCollab({ ...newCollab, email: e.target.value })}
                                        className="w-full px-4 py-3 rounded-lg bg-slate-50 dark:bg-black border border-gray-300 dark:border-white/10 text-slate-900 dark:text-white focus:border-slate-400 dark:focus:border-white outline-none transition-colors duration-200"
                                        placeholder="nom@exemple.com"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Rôle</label>
                                    <input 
                                        type="text"
                                        value={newCollab.role}
                                        onChange={(e) => setNewCollab({ ...newCollab, role: e.target.value })}
                                        className="w-full px-4 py-3 rounded-lg bg-slate-50 dark:bg-black border border-gray-300 dark:border-white/10 text-slate-900 dark:text-white focus:border-slate-400 dark:focus:border-white outline-none transition-colors duration-200"
                                        placeholder="ex: Manager, Hôtesse..."
                                    />
                                </div>
                                {!editingCollaboratorId && (
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                                            Mot de passe <span className="text-red-400">*</span>
                                        </label>
                                        <input 
                                            type="password"
                                            required={!editingCollaboratorId}
                                            value={(newCollab as any).password || ''}
                                            onChange={(e) => setNewCollab({ ...newCollab, password: e.target.value } as any)}
                                            className="w-full px-4 py-3 rounded-lg bg-slate-50 dark:bg-black border border-gray-300 dark:border-white/10 text-slate-900 dark:text-white focus:border-slate-400 dark:focus:border-white outline-none transition-colors duration-200"
                                            placeholder="Minimum 8 caractères"
                                        />
                                        <p className="text-[11px] text-gray-600">Le collaborateur devra changer ce mot de passe à sa première connexion.</p>
                                    </div>
                                )}
                                <div className="space-y-3 pt-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Accès Modules</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {[
                                            { value: 'planning', label: 'Planning' },
                                            { value: 'evenementiel', label: 'Événementiel' },
                                            { value: 'crm', label: 'CRM' },
                                            { value: 'facture', label: 'Factures' },
                                            { value: 'employes', label: 'RH' }
                                        ].map((m) => {
                                            const checked = newCollab.modules_access.includes(m.value);
                                            return (
                                                <label key={m.value} className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-all ${checked ? 'border-slate-300 dark:border-white/30 bg-slate-100 dark:bg-white/5 text-slate-900 dark:text-white' : 'border-gray-300 dark:border-white/10 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'}`}>
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={() => toggleCollaboratorModule(m.value)}
                                                        className="accent-white"
                                                    />
                                                    <span className="text-sm font-medium">{m.label}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            </form>
                                </div>
                            </div>

                            {/* Footer sticky avec boutons */}
                            <div className="sticky bottom-0 border-t border-gray-200 dark:border-white/5 bg-white dark:bg-[#0A0A0A] p-6 flex gap-4 transition-colors duration-200">
                                <button 
                                    type="button"
                                    onClick={() => {
                                        setShowCollabModal(false);
                                        setEditingCollaboratorId(null);
                                    }}
                                    className="flex-1 px-6 py-3 rounded-lg font-bold border border-gray-300 dark:border-white/10 text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors duration-200"
                                >
                                    Annuler
                                </button>
                                <button 
                                    type="submit"
                                    form="collab-form"
                                    className="flex-1 bg-white text-black px-6 py-3 rounded-lg font-bold hover:bg-gray-200 transition-all"
                                >
                                    {editingCollaboratorId ? 'Enregistrer' : 'Créer'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Modal Espace */}
            <AnimatePresence>
                {showSpaceModal && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 transition-colors duration-200">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="w-full max-w-md bg-white dark:bg-[#0A0A0A] rounded-2xl p-10 shadow-2xl border border-gray-200 dark:border-white/5 transition-colors duration-200"
                        >
                            <h2 className="text-2xl font-bold mb-8 text-slate-900 dark:text-white">Nouvel Espace</h2>
                            <form onSubmit={handleAddSpace} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Nom de l'espace</label>
                                    <input 
                                        type="text" required
                                        value={newSpace.name}
                                        onChange={(e) => setNewSpace({ ...newSpace, name: e.target.value })}
                                        className="w-full px-4 py-3 rounded-lg bg-slate-50 dark:bg-black border border-gray-300 dark:border-white/10 text-slate-900 dark:text-white focus:border-slate-400 dark:focus:border-white outline-none transition-colors duration-200"
                                        placeholder="ex: RDC, Salon VIP..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Couleur sur le calendrier</label>
                                    <div className="flex gap-3">
                                        <input 
                                            type="color"
                                            value={newSpace.color}
                                            onChange={(e) => setNewSpace({ ...newSpace, color: e.target.value })}
                                            className="w-12 h-12 rounded bg-slate-50 dark:bg-black border border-gray-300 dark:border-white/10 cursor-pointer transition-colors duration-200"
                                        />
                                        <input 
                                            type="text"
                                            value={newSpace.color}
                                            onChange={(e) => setNewSpace({ ...newSpace, color: e.target.value })}
                                            className="flex-1 px-4 py-3 rounded-lg bg-slate-50 dark:bg-black border border-gray-300 dark:border-white/10 text-slate-900 dark:text-white focus:border-slate-400 dark:focus:border-white outline-none transition-colors duration-200 font-mono"
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-4 pt-4">
                                    <button 
                                        type="button"
                                        onClick={() => setShowSpaceModal(false)}
                                        className="flex-1 px-6 py-4 rounded-lg font-bold border border-gray-300 dark:border-white/10 text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors duration-200"
                                    >
                                        Annuler
                                    </button>
                                    <button 
                                        type="submit"
                                        className="flex-1 bg-white text-black px-6 py-4 rounded-lg font-bold hover:bg-gray-200 transition-all"
                                    >
                                        Ajouter
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Modal Import Excel/PDF */}
            <AnimatePresence>
                {showImportModal && isSuperAdmin && (
                    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-6 transition-colors duration-200">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="w-full max-w-xl max-h-[85vh] bg-white dark:bg-[#0A0A0A] rounded-3xl border border-gray-200 dark:border-white/10 shadow-2xl overflow-hidden flex flex-col transition-colors duration-200"
                        >
                            <div className="p-6 bg-slate-100 dark:bg-[#111111] border-b border-gray-200 dark:border-white/5 flex items-center justify-between transition-colors duration-200">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center">
                                        <FileSpreadsheet size={20} className="text-green-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Import Excel / PDF — {client.name}</h3>
                                        <p className="text-xs text-slate-500 dark:text-gray-500">Employés & Postes en masse</p>
                                    </div>
                                </div>
                                <button onClick={handleCloseImportModal} className="p-2 rounded-lg text-slate-500 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-white/5 transition-colors duration-200">
                                    <X size={18} />
                                </button>
                            </div>

                            <div
                                className="p-6 pr-2 space-y-6 flex-1 min-h-0 overflow-y-auto"
                                style={{ scrollbarWidth: 'thin', scrollbarColor: '#333 transparent' }}
                            >
                                {/* Zone de dépôt du fichier */}
                                {!importResult && (
                                    <div>
                                        <p className="text-xs text-gray-500 mb-3 font-bold uppercase tracking-widest">Format attendu</p>
                                        <div className="bg-white/[0.03] rounded-xl border border-white/5 p-4 text-xs text-gray-400 font-mono mb-4">
                                            <span className="text-green-400">Nom</span> · <span className="text-green-400">Prénom</span> · <span className="text-green-400">Poste</span> · <span className="text-gray-500">Email</span> · <span className="text-gray-500">Téléphone</span>
                                            <br /><span className="text-gray-600">(Email et Téléphone optionnels)</span>
                                        </div>
                                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/10 rounded-2xl cursor-pointer hover:border-green-500/40 hover:bg-green-500/5 transition-all">
                                            <Upload size={24} className="text-gray-500 mb-2" />
                                            <span className="text-sm text-gray-400 font-medium">
                                                {importFile ? importFile.name : 'Cliquer pour sélectionner un fichier Excel ou PDF'}
                                            </span>
                                            <span className="text-xs text-gray-600 mt-1">.xlsx · .xls · .csv · .pdf</span>
                                            <input
                                                type="file"
                                                accept=".xlsx,.xls,.csv,.pdf"
                                                className="hidden"
                                                onChange={handleImportFileChange}
                                            />
                                        </label>
                                    </div>
                                )}

                                {/* Chargement */}
                                {importLoading && (
                                    <div className="flex items-center justify-center gap-3 py-6 text-gray-400">
                                        <div className="w-5 h-5 border-2 border-white/20 border-t-green-400 rounded-full animate-spin" />
                                        <span className="text-sm">{importPreview ? 'Importation en cours...' : 'Analyse du fichier...'}</span>
                                    </div>
                                )}

                                {/* Erreur */}
                                {importError && (
                                    <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                                        <AlertCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
                                        <p className="text-sm text-red-400">{importError}</p>
                                    </div>
                                )}

                                {/* Résumé preview */}
                                {importPreview && !importLoading && (
                                    <div className="space-y-4">
                                        <div className="bg-white/[0.03] rounded-2xl border border-white/5 p-5 space-y-3">
                                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Analyse Flash</p>
                                            <p className="text-[11px] text-gray-500">Source détectée : <span className="text-white font-bold uppercase">{importPreview.source_type || 'excel'}</span></p>
                                            <div className="grid grid-cols-3 gap-4">
                                                <div className="text-center">
                                                    <p className="text-2xl font-bold text-white">{importPreview.valid_employees}</p>
                                                    <p className="text-xs text-gray-500 mt-1">Employés</p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-2xl font-bold text-green-400">{importPreview.new_posts?.length ?? 0}</p>
                                                    <p className="text-xs text-gray-500 mt-1">Nouveaux postes</p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-2xl font-bold text-orange-400">{importPreview.errors?.length ?? 0}</p>
                                                    <p className="text-xs text-gray-500 mt-1">Avertissements</p>
                                                </div>
                                            </div>
                                        </div>
                                        {importPreview.new_posts?.length > 0 && (
                                            <div>
                                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Postes à créer</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {importPreview.new_posts.map((p: string) => (
                                                        <span key={p} className="px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full text-xs font-bold text-green-400">{p}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {importPreview.errors?.length > 0 && (
                                            <div>
                                                <p className="text-xs font-bold text-orange-400/80 uppercase tracking-widest mb-2">Avertissements</p>
                                                <div className="space-y-1 max-h-24 overflow-y-auto">
                                                    {importPreview.errors.map((err: string, i: number) => (
                                                        <p key={i} className="text-xs text-orange-400/70">{err}</p>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {importPreview.detected_employees?.length > 0 && (
                                            <div>
                                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Aperçu des employés détectés</p>
                                                <div className="border border-white/10 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                                                    <table className="w-full text-xs">
                                                        <thead className="bg-white/5 sticky top-0">
                                                            <tr className="text-left text-gray-400">
                                                                <th className="px-3 py-2">Nom</th>
                                                                <th className="px-3 py-2">Prénom</th>
                                                                <th className="px-3 py-2">Poste</th>
                                                                <th className="px-3 py-2">Tel</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {importPreview.detected_employees.map((emp: any, i: number) => (
                                                                <tr key={i} className="border-t border-white/5 text-gray-200">
                                                                    <td className="px-3 py-2">{emp.last_name}</td>
                                                                    <td className="px-3 py-2">{emp.first_name}</td>
                                                                    <td className="px-3 py-2">{emp.position}</td>
                                                                    <td className="px-3 py-2">{emp.phone || '-'}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Résultat final */}
                                {importResult && (
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                                            <CheckCircle2 size={20} className="text-green-400 flex-shrink-0" />
                                            <div>
                                                <p className="text-sm font-bold text-white">Importation réussie</p>
                                                <p className="text-xs text-gray-400 mt-0.5">
                                                    {importResult.employees_created} employé{importResult.employees_created > 1 ? 's' : ''} ajouté{importResult.employees_created > 1 ? 's' : ''} · {importResult.posts_created} poste{importResult.posts_created > 1 ? 's' : ''} créé{importResult.posts_created > 1 ? 's' : ''}
                                                </p>
                                                {typeof importResult.duplicates_skipped === 'number' && importResult.duplicates_skipped > 0 && (
                                                    <p className="text-xs text-amber-300 mt-1">
                                                        {importResult.duplicates_skipped} doublon{importResult.duplicates_skipped > 1 ? 's' : ''} ignoré{importResult.duplicates_skipped > 1 ? 's' : ''}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        {importResult.errors?.length > 0 && (
                                            <div>
                                                <p className="text-xs font-bold text-orange-400/80 uppercase tracking-widest mb-2">Lignes ignorées</p>
                                                <div className="space-y-1 max-h-24 overflow-y-auto">
                                                    {importResult.errors.map((err: string, i: number) => (
                                                        <p key={i} className="text-xs text-orange-400/70">{err}</p>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="p-5 bg-[#0A0A0A] border-t border-white/5 flex gap-3 sticky bottom-0">
                                <button onClick={handleCloseImportModal} className="flex-1 px-4 py-3 rounded-xl font-bold border border-white/10 text-white hover:bg-white/5 transition-all text-sm">
                                    {importResult ? 'Fermer' : 'Annuler'}
                                </button>
                                {importPreview && !importLoading && !importResult && (
                                    <button
                                        onClick={handleExecuteImport}
                                        className="flex-1 px-4 py-3 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 transition-all text-sm flex items-center justify-center gap-2"
                                    >
                                        <Upload size={15} />
                                        Lancer l'intégration
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

const EvenementielView = () => {
    const { user } = useAuth();
    const [calendars, setCalendars] = React.useState<any[]>([]);
    const [selectedCalendar, setSelectedCalendar] = React.useState<any | null>(null);
    const [events, setEvents] = React.useState<any[]>([]);
    const [spaces, setSpaces] = React.useState<any[]>([]);
    const [staffTypes, setStaffTypes] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [showEventModal, setShowEventModal] = React.useState(false);
    const [showCalendarModal, setShowCalendarModal] = React.useState(false);
    const [showSettingsModal, setShowSettingsModal] = React.useState(false);
    const [filter, setFilter] = React.useState('ALL');
    const [spaceFilter, setSpaceFilter] = React.useState('ALL');
    const [creationStep, setCreationStep] = React.useState(1);
    
    // Settings state
    const [newSpace, setNewSpace] = React.useState({ name: '', color: '#ffffff' });
    const [newStaffType, setNewStaffType] = React.useState({ name: '' });

    const [newCalendar, setNewCalendar] = React.useState({
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear()
    });

    const [newEvent, setNewEvent] = React.useState<any>({
        type: 'PRIVÉ',
        phone: '',
        email: '',
        address: '',
        start_time: '',
        end_time: '',
        num_people: '',
        staff_requests: {}, // { staff_type_id: count }
        first_name: '',
        last_name: '',
        company_name: '',
        organizer_name: '',
        space_ids: []
    });

    React.useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        try {
            setLoading(true);
            const [cals, sps, stf] = await Promise.all([
                moduleApi.getEvenementielCalendars(),
                moduleApi.getEvenementielSpaces(),
                moduleApi.getEvenementielStaffTypes()
            ]);
            setCalendars(cals);
            setSpaces(sps);
            setStaffTypes(stf);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const loadEvents = async (calendarId: string) => {
        try {
            setLoading(true);
            const data = await moduleApi.getEvenementielCalendarEvents(calendarId);
            setEvents(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenCalendar = (calendar: any) => {
        setSelectedCalendar(calendar);
        loadEvents(calendar.id);
    };

    const handleCreateCalendar = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await moduleApi.createEvenementielCalendar(newCalendar);
            setShowCalendarModal(false);
            loadInitialData();
        } catch (e) {
            alert('Erreur lors de la création du calendrier');
        }
    };

    const handleCreateStaffType = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await moduleApi.createEvenementielStaffType(newStaffType);
            setNewStaffType({ name: '' });
            loadInitialData();
        } catch (e) {
            alert('Erreur lors de la création du type de staff');
        }
    };

    const handleDeleteStaffType = async (id: string) => {
        if (!confirm('Supprimer ce type de staff ?')) return;
        try {
            await moduleApi.deleteEvenementielStaffType(id);
            loadInitialData();
        } catch (e) {
            alert('Erreur lors de la suppression');
        }
    };

    const handleCreateEvent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCalendar) return;
        try {
            await moduleApi.createEvenementiel({
                ...newEvent,
                calendar_id: selectedCalendar.id
            });
            setShowEventModal(false);
            setCreationStep(1);
            setNewEvent({
                type: 'PRIVÉ',
                phone: '',
                email: '',
                address: '',
                start_time: '',
                end_time: '',
                num_people: '',
                staff_requests: {},
                first_name: '',
                last_name: '',
                company_name: '',
                organizer_name: '',
                space_ids: []
            });
            loadEvents(selectedCalendar.id);
        } catch (e: any) {
            alert(e.message || 'Erreur lors de la création de l\'événement');
        }
    };

    const handleDeleteEvent = async (id: string) => {
        if (!confirm('Supprimer cet événement ?')) return;
        try {
            await moduleApi.deleteEvenementiel(id);
            if (selectedCalendar) loadEvents(selectedCalendar.id);
        } catch (e) {
            alert('Erreur lors de la suppression');
        }
    };

    const months = [
        "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
        "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
    ];

    const filteredEvents = events.filter(e => {
        const typeMatch = filter === 'ALL' || e.type === filter;
        const spaceMatch = spaceFilter === 'ALL' || (e.spaces && e.spaces.some((s: any) => s.id === spaceFilter));
        return typeMatch && spaceMatch;
    });

    if (!selectedCalendar) {
        return (
            <div className="space-y-8">
                <header className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white">Événementiel</h1>
                        <p className="text-gray-500 mt-1">Sélectionnez un calendrier mensuel pour gérer vos événements.</p>
                    </div>
                    <div className="flex gap-3">
                        <button 
                            onClick={() => setShowSettingsModal(true)}
                            className="bg-[#111111] border border-white/10 text-white px-4 py-3 rounded-lg font-bold flex items-center gap-2 hover:bg-white/5 transition-all"
                        >
                            <Settings size={20} />
                            <span>Configuration</span>
                        </button>
                        <button 
                            onClick={() => setShowCalendarModal(true)}
                            className="bg-white text-black px-6 py-3 rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-white/5 hover:bg-gray-200 transition-all"
                        >
                            <Plus size={20} />
                            <span>Nouveau Calendrier</span>
                        </button>
                    </div>
                </header>

                {loading ? (
                    <div className="flex justify-center py-20 text-gray-500">Chargement...</div>
                ) : calendars.length === 0 ? (
                    <div className="bg-[#111111] rounded-2xl border border-white/5 p-20 flex flex-col items-center justify-center text-center">
                        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
                            <Calendar size={40} className="text-gray-700" />
                        </div>
                        <h3 className="text-xl font-bold mb-2 text-white">Aucun calendrier</h3>
                        <p className="text-gray-500 max-w-sm">Créez votre premier calendrier mensuel pour commencer à ajouter des privatisations.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {calendars.map((cal) => (
                            <motion.div 
                                key={cal.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                onClick={() => handleOpenCalendar(cal)}
                                className="bg-[#111111] rounded-2xl border border-white/5 p-8 hover:border-white/20 transition-all cursor-pointer group relative overflow-hidden"
                            >
                                <div className="relative z-10">
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center border border-white/10">
                                            <Calendar className="text-white" size={24} />
                                        </div>
                                        <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-widest ${
                                            cal.status === 'OPEN' ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'
                                        }`}>
                                            {cal.status === 'OPEN' ? 'Ouvert' : 'Archivé'}
                                        </span>
                                    </div>
                                    <h3 className="text-2xl font-bold text-white">{months[cal.month - 1]}</h3>
                                    <p className="text-gray-500 font-medium">{cal.year}</p>
                                    
                                    <div className="mt-8 flex items-center gap-2 text-sm font-bold text-white group-hover:translate-x-1 transition-all">
                                        Ouvrir le planning <ChevronRight size={16} />
                                    </div>
                                </div>
                                <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-all"></div>
                            </motion.div>
                        ))}
                    </div>
                )}

                {/* Modal Nouveau Calendrier */}
                <AnimatePresence>
                    {showCalendarModal && (
                        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="w-full max-w-md bg-[#111111] rounded-2xl p-10 shadow-2xl border border-white/5"
                            >
                                <h2 className="text-2xl font-bold mb-8 text-white">Nouveau Calendrier</h2>
                                <form onSubmit={handleCreateCalendar} className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Mois</label>
                                        <select 
                                            value={newCalendar.month}
                                            onChange={(e) => setNewCalendar({...newCalendar, month: parseInt(e.target.value)})}
                                            className="w-full px-4 py-3 rounded-lg bg-black border border-white/10 text-white focus:border-white outline-none transition-all"
                                        >
                                            {months.map((m, i) => (
                                                <option key={i} value={i + 1}>{m}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Année</label>
                                        <input 
                                            type="number" required
                                            value={newCalendar.year}
                                            onChange={(e) => setNewCalendar({...newCalendar, year: parseInt(e.target.value)})}
                                            className="w-full px-4 py-3 rounded-lg bg-black border border-white/10 text-white focus:border-white outline-none transition-all"
                                        />
                                    </div>
                                    <div className="flex gap-4 pt-4">
                                        <button 
                                            type="button"
                                            onClick={() => setShowCalendarModal(false)}
                                            className="flex-1 px-6 py-4 rounded-lg font-bold border border-white/10 text-white hover:bg-white/5 transition-all"
                                        >
                                            Annuler
                                        </button>
                                        <button 
                                            type="submit"
                                            className="flex-1 bg-white text-black px-6 py-4 rounded-lg font-bold hover:bg-gray-200 transition-all"
                                        >
                                            Créer
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        </div>
                    )}

                    {showSettingsModal && (
                        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 overflow-y-auto">
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="w-full max-w-4xl bg-[#111111] rounded-2xl p-10 shadow-2xl border border-white/5 my-auto"
                            >
                                <div className="flex justify-between items-center mb-8">
                                    <h2 className="text-2xl font-bold text-white">Configuration du module</h2>
                                    <button onClick={() => setShowSettingsModal(false)} className="text-gray-500 hover:text-white">Fermer</button>
                                </div>

                                <div className="grid grid-cols-1 gap-12">
                                    {/* Gestion du Staff */}
                                    <div className="space-y-6">
                                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                            <UserCheck size={20} className="text-purple-400" />
                                            Types de Staff
                                        </h3>
                                        <form onSubmit={handleCreateStaffType} className="flex gap-2">
                                            <input 
                                                type="text" required placeholder="ex: Serveur, Sécurité..."
                                                value={newStaffType.name}
                                                onChange={(e) => setNewStaffType({...newStaffType, name: e.target.value})}
                                                className="flex-1 px-4 py-2 rounded-lg bg-black border border-white/10 text-white focus:border-white outline-none transition-all text-sm"
                                            />
                                            <button type="submit" className="bg-white text-black px-4 py-2 rounded-lg font-bold text-sm hover:bg-gray-200 transition-all">
                                                Ajouter
                                            </button>
                                        </form>
                                        <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                                            {staffTypes.map(st => (
                                                <div key={st.id} className="flex items-center justify-between p-3 bg-black rounded-lg border border-white/5">
                                                    <span className="text-white text-sm">{st.name}</span>
                                                    <button onClick={() => handleDeleteStaffType(st.id)} className="text-gray-600 hover:text-red-500 transition-all">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <button 
                        onClick={() => setSelectedCalendar(null)}
                        className="text-sm text-gray-500 hover:text-white flex items-center gap-1 mb-2 transition-all"
                    >
                        <ChevronRight size={14} className="rotate-180" /> Retour aux calendriers
                    </button>
                    <h1 className="text-3xl font-bold tracking-tight text-white">
                        Planning {months[selectedCalendar.month - 1]} {selectedCalendar.year}
                    </h1>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={`w-2 h-2 rounded-full ${selectedCalendar.status === 'OPEN' ? 'bg-green-500' : 'bg-gray-500'}`}></span>
                        <p className="text-gray-500 text-sm font-medium">
                            Statut: {selectedCalendar.status === 'OPEN' ? 'Ouvert (Modifications autorisées)' : 'Archivé (Lecture seule)'}
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-3">
                    <select 
                        value={spaceFilter}
                        onChange={(e) => setSpaceFilter(e.target.value)}
                        className="bg-[#111111] border border-white/10 text-white px-4 py-2 rounded-lg outline-none focus:border-white transition-all text-sm font-medium"
                    >
                        <option value="ALL">Tous les espaces</option>
                        {spaces.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                    <select 
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="bg-[#111111] border border-white/10 text-white px-4 py-2 rounded-lg outline-none focus:border-white transition-all text-sm font-medium"
                    >
                        <option value="ALL">Tous les types</option>
                        <option value="PRIVÉ">Privé</option>
                        <option value="PROFESSIONNEL">Professionnel</option>
                    </select>
                    {selectedCalendar.status === 'OPEN' && (
                        <button 
                            onClick={() => setShowEventModal(true)}
                            className="bg-white text-black px-6 py-3 rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-white/5 hover:bg-gray-200 transition-all"
                        >
                            <Plus size={20} />
                            <span>Nouvelle Privatisation</span>
                        </button>
                    )}
                </div>
            </header>

            {loading ? (
                <div className="flex justify-center py-20 text-gray-500">Chargement...</div>
            ) : filteredEvents.length === 0 ? (
                <div className="bg-[#111111] rounded-2xl border border-white/5 p-20 flex flex-col items-center justify-center text-center">
                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
                        <Briefcase size={40} className="text-gray-700" />
                    </div>
                    <h3 className="text-xl font-bold mb-2 text-white">Aucun événement ce mois-ci</h3>
                    <p className="text-gray-500 max-w-sm">
                        {selectedCalendar.status === 'OPEN' 
                            ? 'Commencez par ajouter votre première privatisation pour ce calendrier.' 
                            : 'Ce calendrier est archivé et ne contient aucun événement.'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredEvents.map((event) => (
                        <motion.div 
                            key={event.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-[#111111] rounded-2xl border border-white/5 p-6 hover:border-white/20 transition-all group"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex flex-wrap gap-1">
                                    <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-widest ${
                                        event.type === 'PRIVÉ' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'
                                    }`}>
                                        {event.type}
                                    </span>
                                    {event.spaces?.map((s: any) => (
                                        <span key={s.id} className="text-[10px] font-bold px-2 py-1 rounded uppercase tracking-widest bg-white/5 text-white flex items-center gap-1">
                                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }}></div>
                                            {s.name}
                                        </span>
                                    ))}
                                </div>
                                {selectedCalendar.status === 'OPEN' && (
                                    <button 
                                        onClick={() => handleDeleteEvent(event.id)}
                                        className="text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                            
                            <h3 className="text-lg font-bold text-white mb-1">
                                {event.type === 'PRIVÉ' ? `${event.first_name} ${event.last_name}` : event.company_name}
                            </h3>
                            {event.type === 'PROFESSIONNEL' && (
                                <p className="text-xs text-gray-500 mb-3">Org: {event.organizer_name}</p>
                            )}
                            
                            <div className="space-y-3 mt-4">
                                <div className="flex items-center gap-3 text-sm text-gray-400">
                                    <Calendar size={14} />
                                    <span>{new Date(event.start_time).toLocaleDateString()}</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-gray-400">
                                    <FileText size={14} />
                                    <span>{new Date(event.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {new Date(event.end_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                </div>
                                {event.num_people && (
                                    <div className="flex items-center gap-3 text-sm text-gray-400">
                                        <Users size={14} />
                                        <span>{event.num_people} personnes</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-3 text-sm text-gray-400">
                                    <Mail size={14} />
                                    <span>{event.phone}</span>
                                </div>
                                {event.staff?.length > 0 && (
                                    <div className="pt-3 border-t border-white/5 mt-3">
                                        <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-2">Staff demandé</p>
                                        <div className="flex flex-wrap gap-2">
                                            {event.staff.map((s: any, i: number) => (
                                                <span key={i} className="text-[10px] text-gray-400 bg-white/5 px-2 py-1 rounded">
                                                    {s.count}x {s.name}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Modal de création d'événement */}
            <AnimatePresence>
                {showEventModal && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 overflow-y-auto">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="w-full max-w-2xl bg-[#111111] rounded-2xl p-10 shadow-2xl border border-white/5 my-auto"
                        >
                            <div className="flex justify-between items-center mb-8">
                                <div>
                                    <h2 className="text-2xl font-bold text-white">Nouvelle Privatisation</h2>
                                    <p className="text-gray-500 text-sm">Étape {creationStep} sur 2</p>
                                </div>
                                <button onClick={() => { setShowEventModal(false); setCreationStep(1); }} className="text-gray-500 hover:text-white">Fermer</button>
                            </div>

                            {creationStep === 1 ? (
                                <div className="space-y-8">
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                            <MapPin size={20} className="text-blue-400" />
                                            1. Sélection des espaces (Obligatoire)
                                        </h3>
                                        <p className="text-gray-500 text-sm">Choisissez un ou plusieurs espaces pour cet événement.</p>
                                        <div className="grid grid-cols-2 gap-4">
                                            {spaces.map(space => (
                                                <button
                                                    key={space.id}
                                                    type="button"
                                                    onClick={() => {
                                                        const ids = newEvent.space_ids.includes(space.id)
                                                            ? newEvent.space_ids.filter((id: string) => id !== space.id)
                                                            : [...newEvent.space_ids, space.id];
                                                        setNewEvent({...newEvent, space_ids: ids});
                                                    }}
                                                    className={`p-4 rounded-xl border transition-all text-left flex items-center gap-3 ${
                                                        newEvent.space_ids.includes(space.id)
                                                            ? 'bg-white/10 border-white text-white'
                                                            : 'bg-black border-white/5 text-gray-500 hover:border-white/20'
                                                    }`}
                                                >
                                                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: space.color }}></div>
                                                    <span className="font-bold">{space.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                        {spaces.length === 0 && (
                                            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400 text-sm">
                                                Aucun espace configuré. Contactez l'administrateur pour configurer vos espaces.
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        disabled={newEvent.space_ids.length === 0}
                                        onClick={() => setCreationStep(2)}
                                        className="w-full bg-white text-black py-4 rounded-lg font-bold hover:bg-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Continuer vers les détails
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={handleCreateEvent} className="space-y-8">
                                    <div className="space-y-6">
                                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                            <FileText size={20} className="text-purple-400" />
                                            2. Détails de l'événement
                                        </h3>
                                        
                                        <div className="flex gap-4 p-1 bg-black rounded-xl border border-white/5">
                                            <button 
                                                type="button"
                                                onClick={() => setNewEvent({...newEvent, type: 'PRIVÉ'})}
                                                className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${newEvent.type === 'PRIVÉ' ? 'bg-white text-black' : 'text-gray-500 hover:text-white'}`}
                                            >
                                                Événement PRIVÉ
                                            </button>
                                            <button 
                                                type="button"
                                                onClick={() => setNewEvent({...newEvent, type: 'PROFESSIONNEL'})}
                                                className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${newEvent.type === 'PROFESSIONNEL' ? 'bg-white text-black' : 'text-gray-500 hover:text-white'}`}
                                            >
                                                Événement PROFESSIONNEL
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {newEvent.type === 'PRIVÉ' ? (
                                                <>
                                                    <div className="space-y-2">
                                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Prénom *</label>
                                                        <input 
                                                            type="text" required
                                                            value={newEvent.first_name}
                                                            onChange={(e) => setNewEvent({...newEvent, first_name: e.target.value})}
                                                            className="w-full px-4 py-3 rounded-lg bg-black border border-white/10 text-white focus:border-white outline-none transition-all"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Nom *</label>
                                                        <input 
                                                            type="text" required
                                                            value={newEvent.last_name}
                                                            onChange={(e) => setNewEvent({...newEvent, last_name: e.target.value})}
                                                            className="w-full px-4 py-3 rounded-lg bg-black border border-white/10 text-white focus:border-white outline-none transition-all"
                                                        />
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="space-y-2">
                                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Nom Entreprise *</label>
                                                        <input 
                                                            type="text" required
                                                            value={newEvent.company_name}
                                                            onChange={(e) => setNewEvent({...newEvent, company_name: e.target.value})}
                                                            className="w-full px-4 py-3 rounded-lg bg-black border border-white/10 text-white focus:border-white outline-none transition-all"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Nom Organisateur *</label>
                                                        <input 
                                                            type="text" required
                                                            value={newEvent.organizer_name}
                                                            onChange={(e) => setNewEvent({...newEvent, organizer_name: e.target.value})}
                                                            className="w-full px-4 py-3 rounded-lg bg-black border border-white/10 text-white focus:border-white outline-none transition-all"
                                                        />
                                                    </div>
                                                </>
                                            )}

                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Téléphone *</label>
                                                <input 
                                                    type="tel" required
                                                    value={newEvent.phone}
                                                    onChange={(e) => setNewEvent({...newEvent, phone: e.target.value})}
                                                    className="w-full px-4 py-3 rounded-lg bg-black border border-white/10 text-white focus:border-white outline-none transition-all"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Nombre de personnes {newEvent.type === 'PRIVÉ' ? '*' : ''}</label>
                                                <input 
                                                    type="number" required={newEvent.type === 'PRIVÉ'}
                                                    value={newEvent.num_people}
                                                    onChange={(e) => setNewEvent({...newEvent, num_people: e.target.value})}
                                                    className="w-full px-4 py-3 rounded-lg bg-black border border-white/10 text-white focus:border-white outline-none transition-all"
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Heure Début *</label>
                                                <input 
                                                    type="datetime-local" required
                                                    value={newEvent.start_time}
                                                    onChange={(e) => setNewEvent({...newEvent, start_time: e.target.value})}
                                                    className="w-full px-4 py-3 rounded-lg bg-black border border-white/10 text-white focus:border-white outline-none transition-all"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Heure Fin *</label>
                                                <input 
                                                    type="datetime-local" required
                                                    value={newEvent.end_time}
                                                    onChange={(e) => setNewEvent({...newEvent, end_time: e.target.value})}
                                                    className="w-full px-4 py-3 rounded-lg bg-black border border-white/10 text-white focus:border-white outline-none transition-all"
                                                />
                                            </div>
                                        </div>

                                        {/* Staff Requests */}
                                        <div className="space-y-4 pt-4 border-t border-white/5">
                                            <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                                <UserCheck size={16} className="text-gray-400" />
                                                Demandes de Staff
                                            </h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                {staffTypes.map(st => (
                                                    <div key={st.id} className="flex items-center justify-between p-3 bg-black rounded-lg border border-white/5">
                                                        <span className="text-xs text-gray-400">{st.name}</span>
                                                        <input 
                                                            type="number" min="0"
                                                            value={newEvent.staff_requests[st.id] || 0}
                                                            onChange={(e) => setNewEvent({
                                                                ...newEvent, 
                                                                staff_requests: {
                                                                    ...newEvent.staff_requests,
                                                                    [st.id]: parseInt(e.target.value) || 0
                                                                }
                                                            })}
                                                            className="w-16 px-2 py-1 rounded bg-[#111111] border border-white/10 text-white text-xs outline-none focus:border-white"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-4 pt-4">
                                        <button 
                                            type="button"
                                            onClick={() => setCreationStep(1)}
                                            className="flex-1 px-6 py-4 rounded-lg font-bold border border-white/10 text-white hover:bg-white/5 transition-all"
                                        >
                                            Retour
                                        </button>
                                        <button 
                                            type="submit"
                                            className="flex-1 bg-white text-black px-6 py-4 rounded-lg font-bold hover:bg-gray-200 transition-all"
                                        >
                                            Enregistrer
                                        </button>
                                    </div>
                                </form>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

const ModulePlaceholder = ({ title, icon: Icon }: any) => (
    <div className="space-y-8">
        <header className="flex items-center justify-between">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-white">{title}</h1>
                <p className="text-gray-500 mt-1">Gérez vos données de {title.toLowerCase()}.</p>
            </div>
            <div className="flex gap-3">
                <button className="bg-[#111111] border border-white/5 p-3 rounded-lg hover:bg-white/5 transition-all text-white">
                    <Filter size={20} className="text-gray-500" />
                </button>
                <button className="bg-[#111111] border border-white/5 p-3 rounded-lg hover:bg-white/5 transition-all text-white">
                    <Download size={20} className="text-gray-500" />
                </button>
                <button className="bg-white text-black px-6 py-3 rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-white/5 hover:bg-gray-200 transition-all">
                    <Plus size={20} />
                    <span>Nouveau</span>
                </button>
            </div>
        </header>

        <div className="bg-[#111111] rounded-2xl border border-white/5 shadow-sm p-12 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/10">
                <Icon size={40} className="text-gray-600" />
            </div>
            <h3 className="text-xl font-bold mb-2 text-white">Aucune donnée trouvée</h3>
            <p className="text-gray-500 max-w-sm">Commencez par ajouter votre premier élément de {title.toLowerCase()} pour voir les statistiques et graphiques.</p>
        </div>
    </div>
);

const ChangePasswordView = () => {
    const [newPassword, setNewPassword] = React.useState('');
    const [confirmPassword, setConfirmPassword] = React.useState('');
    const [error, setError] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const strength = (() => {
        if (newPassword.length === 0) return 0;
        let s = 0;
        if (newPassword.length >= 8) s++;
        if (/[A-Z]/.test(newPassword)) s++;
        if (/[0-9]/.test(newPassword)) s++;
        if (/[^A-Za-z0-9]/.test(newPassword)) s++;
        return s;
    })();
    const strengthLabel = ['', 'Faible', 'Moyen', 'Bon', 'Fort'][strength];
    const strengthColor = ['', '#ef4444', '#f97316', '#eab308', '#22c55e'][strength];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (newPassword.length < 8) {
            setError('Le mot de passe doit contenir au moins 8 caractères.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('Les mots de passe ne correspondent pas.');
            return;
        }
        setLoading(true);
        try {
            const data = await authApi.forceChangePassword(newPassword);
            login(data.token, data.user);
            navigate('/');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-6">
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="w-full max-w-md"
            >
                {/* Logo */}
                <div className="flex flex-col items-center mb-10">
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-white/10">
                        <span className="text-black font-black text-2xl tracking-tighter">A</span>
                    </div>
                    <h1 className="text-3xl font-black tracking-tight text-white">L'IAmani</h1>
                    <p className="text-gray-500 text-xs mt-1 uppercase tracking-widest font-bold">Platform</p>
                </div>

                {/* Card */}
                <div className="bg-[#111111] rounded-2xl border border-white/5 shadow-2xl overflow-hidden">
                    {/* Banner */}
                    <div className="bg-white/[0.04] border-b border-white/5 px-8 py-5 flex items-start gap-3">
                        <div className="mt-0.5 w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                            <Lock size={15} className="text-amber-400" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-white leading-snug">Sécurité du compte</p>
                            <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                                Pour des raisons de sécurité, veuillez définir votre mot de passe personnel avant de continuer.
                            </p>
                        </div>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="p-8 space-y-5">
                        {error && (
                            <div className="p-3 bg-red-500/10 text-red-400 text-xs rounded-lg flex items-center gap-2 border border-red-500/20">
                                <XCircle size={14} />
                                {error}
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Nouveau mot de passe</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full px-4 py-3 rounded-lg bg-black border border-white/10 text-white focus:border-white/40 focus:ring-0 transition-all outline-none text-sm"
                                placeholder="Min. 8 caractères"
                                required
                                autoComplete="new-password"
                            />
                            {newPassword.length > 0 && (
                                <div className="flex items-center gap-2 mt-1.5">
                                    <div className="flex gap-1 flex-1">
                                        {[1,2,3,4].map((i) => (
                                            <div
                                                key={i}
                                                className="h-1 flex-1 rounded-full transition-all"
                                                style={{ background: i <= strength ? strengthColor : 'rgba(255,255,255,0.08)' }}
                                            />
                                        ))}
                                    </div>
                                    <span className="text-[10px] font-bold" style={{ color: strengthColor }}>{strengthLabel}</span>
                                </div>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Confirmer le mot de passe</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full px-4 py-3 rounded-lg bg-black border border-white/10 text-white focus:border-white/40 focus:ring-0 transition-all outline-none text-sm"
                                placeholder="Répétez le mot de passe"
                                required
                                autoComplete="new-password"
                            />
                            {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                                <p className="text-[10px] text-red-400 mt-1">Les mots de passe ne correspondent pas</p>
                            )}
                            {confirmPassword.length > 0 && newPassword === confirmPassword && (
                                <p className="text-[10px] text-green-400 mt-1 flex items-center gap-1"><CheckCircle size={10} /> Mots de passe identiques</p>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-white text-black py-3.5 rounded-lg font-bold hover:bg-gray-100 transition-all shadow-lg shadow-white/5 text-sm disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                        >
                            {loading ? 'Validation...' : 'Définir mon mot de passe'}
                        </button>
                    </form>
                </div>

                <p className="text-center text-[10px] text-gray-600 mt-6">
                    Cette étape est obligatoire et ne peut pas être ignorée.
                </p>
            </motion.div>
        </div>
    );
};

// --- App Component ---

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
    const { token, user, loading } = useAuth();
    if (loading) return <div>Chargement...</div>;
    
    if (!token) return <Navigate to="/login" />;
    
    // Force password change if temporary
    const payload = JSON.parse(atob(token.split('.')[1]));
    if ((payload.isTemporary || payload.mustChangePassword) && window.location.pathname !== '/change-password') {
        return <Navigate to="/change-password" />;
    }

    if (user?.type === 'collaborator') {
        const path = window.location.pathname;
        const routeModuleMap: Record<string, string> = {
            '/planning': 'planning',
            '/evenementiel': 'evenementiel',
            '/crm': 'crm',
            '/factures': 'facture',
            '/employes': 'employes'
        };
        const requiredModule = routeModuleMap[path];
        if (requiredModule) {
            const allowed = Array.isArray(user.modules_access) ? user.modules_access : [];
            if (!allowed.includes(requiredModule)) {
                return <Navigate to="/" />;
            }
        }
    }
    
    return <Layout>{children}</Layout>;
};

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
    constructor(props: any) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: any) {
        return { hasError: true, error };
    }

    componentDidCatch(error: any, errorInfo: any) {
        console.error("Uncaught error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-10 text-center">
                    <XCircle size={48} className="text-red-500 mb-4" />
                    <h1 className="text-2xl font-bold mb-2">Une erreur est survenue</h1>
                    <p className="text-gray-400 mb-6 max-w-md">
                        L'application n'a pas pu se charger correctement. 
                        Veuillez rafraîchir la page ou contacter le support si le problème persiste.
                    </p>
                    <pre className="bg-white/5 p-4 rounded-lg text-xs text-left overflow-auto max-w-full mb-6">
                        {this.state.error?.message || String(this.state.error)}
                    </pre>
                    <button 
                        onClick={() => window.location.reload()}
                        className="bg-white text-black px-6 py-3 rounded-lg font-bold"
                    >
                        Rafraîchir la page
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default function App() {
    return (
        <ErrorBoundary>
            <AuthProvider>
                <Router>
                    <Routes>
                        <Route path="/login" element={<LoginView />} />
                        <Route path="/change-password" element={<ChangePasswordView />} />
                        <Route path="/" element={<PrivateRoute><DashboardView /></PrivateRoute>} />
                        <Route path="/admin/clients" element={<PrivateRoute><AdminClientsView /></PrivateRoute>} />
                        <Route path="/admin/clients/:id" element={<PrivateRoute><AdminClientDetailView /></PrivateRoute>} />
                        <Route path="/admin/support" element={<PrivateRoute><SupportAdminView /></PrivateRoute>} />
                        
                        {/* Modules */}
                        <Route path="/planning" element={<PrivateRoute><ModulePlaceholder title="Planning" icon={Calendar} /></PrivateRoute>} />
                        <Route path="/evenementiel" element={<PrivateRoute><EvenementielModule /></PrivateRoute>} />
                        <Route path="/crm" element={<PrivateRoute><CRMModule /></PrivateRoute>} />
                        <Route path="/factures" element={<PrivateRoute><FacturesModule /></PrivateRoute>} />
                        <Route path="/employes" element={<PrivateRoute><PostesEmployesModule /></PrivateRoute>} />
                        
                        {/* Fallback */}
                        <Route path="*" element={<Navigate to="/" />} />
                    </Routes>
                </Router>
            </AuthProvider>
        </ErrorBoundary>
    );
}
