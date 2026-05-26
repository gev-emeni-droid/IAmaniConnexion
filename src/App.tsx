// Liste centralisée des modules disponibles pour tous les formulaires
const ALL_MODULES = [
    { name: 'planning', label: 'Planning' },
    { name: 'evenementiel', label: 'Événementiel' },
    { name: 'facture', label: 'Facture' },
    { name: 'crm', label: 'CRM' },
    { name: 'employes', label: 'Postes & Employés' },
    { name: 'convertisseur', label: 'ConvertisseurPDF' },
    { name: 'support', label: 'Support' },
    { name: 'rh', label: 'RH' }
];

const ACTIONS_TRANSLATION = {
    'PRINT_INVOICE': 'Impression Facture',
    'MODULE_VISIT': 'Navigation Module',
    'PRINT_DOCUMENT': 'Impression Document',
    'DOWNLOAD_DOCUMENT': 'Téléchargement Document'
};

import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate, useParams, useLocation } from 'react-router-dom';
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
    ShieldAlert,
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
    Save,
    FileJson,
    Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { authApi, adminApi, moduleApi, supportApi, dashboardApi, planningApi } from './lib/api';
import { extractRowsFromPdfClient, extractEvenementielRowsFromPdfClient } from './lib/pdfExtractor';
import { resolveLogoUrl } from './lib/resolveLogoUrl';
import { EvenementielModule } from './components/Evenementiel/EvenementielModule';
import { PlanningModule } from './components/Planning/PlanningModule';
import { FacturesModule } from './components/Factures/FacturesModule';
import { CRMModule } from './components/CRM/CRMModule';
import { AdminEvenementielConfig } from './components/Admin/AdminEvenementielConfig';
import { AdminPlanningConfig } from './components/Admin/AdminPlanningConfig';
import { PostesEmployesModule } from './components/Employes/PostesEmployesModule';
import { PlanningTableView } from './components/Planning/PlanningTableView';
import { SupportModal } from './components/Support/SupportModal';
import { InfoModal } from './components/InfoModal';
import { useTheme } from './hooks/useTheme';
import { SentinelJournal } from './components/Admin/SentinelJournal';

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

const ExternalSidebarItem = ({ icon: Icon, label, href, collapsed = false }: any) => (
    <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`group flex items-center ${collapsed ? 'justify-center' : 'gap-2'} ${collapsed ? 'px-0 py-1.5' : 'px-3 py-2'} rounded-lg transition-all text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)] hover:text-[var(--text-primary)]`}
        title={collapsed ? label : undefined}
    >
        <span className={`inline-flex items-center justify-center ${collapsed ? 'w-8 h-8 rounded-lg group-hover:bg-[var(--interactive-hover)]' : 'w-5 h-5'} transition-all`}>
            <Icon className="w-[18px] h-[18px] shrink-0" />
        </span>
        {!collapsed && <span className="font-medium text-[15px] min-w-0 truncate">{label}</span>}
    </a>
);

const ModuleTracker = () => {
    const location = useLocation();
    const { user } = useAuth();
    const lastPathRef = React.useRef(location.pathname);

    React.useEffect(() => {
        if (!user || user.type === 'admin') return;
        
        const path = location.pathname;
        if (path === lastPathRef.current) return;
        
        const modules: Record<string, string> = {
            '/planning': 'Planning',
            '/evenementiel': 'Événementiel',
            '/factures': 'Facturation',
            '/crm': 'CRM',
            '/employes': 'Gestion Staff',
            '/rh': 'RH'
        };
        
        const moduleName = modules[path as keyof typeof modules];
        if (moduleName) {
            adminApi.logAction({
                action: 'MODULE_VISIT',
                category: 'METIER',
                message: `A consulté le module : ${moduleName}`
            }).catch(() => {});
        }
        
        lastPathRef.current = path;
    }, [location.pathname, user]);

    return null;
};

const Layout = ({ children }: any) => {
    const { user, logout, refreshUser, loading } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();

    React.useEffect(() => {
        if (!loading && !user) {
            navigate('/login');
        }
    }, [user, loading, navigate]);

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
    const [showSupportModal, setShowSupportModal] = React.useState(false);
    const [clientSupportUnreadCount, setClientSupportUnreadCount] = React.useState(0);

    React.useEffect(() => {
        try {
            localStorage.setItem('sidebarCollapsed', isCollapsed ? '1' : '0');
        } catch {}
    }, [isCollapsed]);

    const resolvedLogoUrl = resolveLogoUrl(user?.logoUrl);

    const loadModules = React.useCallback(async () => {
        try {
            const modules = await authApi.getMyModules();
            setActiveModules(modules.filter((m: any) => m.is_active === 1).map((m: any) => m.module_name));
        } catch (e) {
            console.error('Failed to load active modules', e);
        }
    }, []);

    const checkStatus = React.useCallback(async () => {
        try {
            const me = await authApi.getMe();
            if (me.status === 'blocked') {
                logout();
                navigate('/login');
            }
        } catch (e) {
            logout();
            navigate('/login');
        }
    }, [logout, navigate]);

    React.useEffect(() => {
        if (user && user.type !== 'admin') {
            loadModules();
            checkStatus();
        }
    }, [user, loadModules, checkStatus]);

    const refreshClientUnreadCount = React.useCallback(async () => {
        if (user && user.type !== 'admin' && user.role !== 'employee') {
            try {
                const data = await supportApi.getClientUnreadCount();
                setClientSupportUnreadCount(Number(data?.count || 0));
            } catch {}
        }
    }, [user]);

    React.useEffect(() => {
        if (!user) return;
        let mounted = true;
        const controller = new AbortController();

        const loadUnread = async () => {
            try {
                if (user.type === 'admin') {
                    const data = await supportApi.getAdminUnreadCount();
                    if (mounted) setSupportUnreadCount(Number(data?.count || 0));
                } else if (user.role !== 'employee') {
                    // Support is only for clients and collaborators, not employees
                    const data = await supportApi.getClientUnreadCount();
                    if (mounted) setClientSupportUnreadCount(Number(data?.count || 0));
                }
            } catch (e: any) {
                // Silently ignore AbortError — it's expected on cleanup/navigation
                if (e?.name === 'AbortError' || e instanceof DOMException) return;
            }
        };
        loadUnread();
        // 60s interval — checking every minute is more than sufficient for unread count
        const timer = setInterval(loadUnread, 60000);
        return () => {
            mounted = false;
            controller.abort();
            clearInterval(timer);
        };
    }, [user]);

    if (loading) return null;
    if (!user) return null;

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
        if (!user) return false;
        if (user.type === 'admin') return false; // Admin uses a separate hardcoded section
        
        // 1. Check live modules fetched from server (most accurate)
        if (activeModules.length > 0) {
            return activeModules.includes(name);
        }

        // 2. Fallback to JWT permissions (immediate display during loading)
        const jwtModules = (user as any).modules || user.modules_access || [];
        return jwtModules.includes(name);
    };

    return (
        <div className="flex min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] transition-colors duration-300">
            {user && user.type !== 'admin' && <ModuleTracker />}
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
                                    alt={user?.company_name || 'Logo client'}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                                    }}
                                />
                            ) : (
                                <ShieldCheck className="text-black" size={20} />
                            )}
                        </div>
                        {!isCollapsed && <span className="font-bold text-[36px] leading-none tracking-tight text-slate-700 dark:text-[var(--text-primary)]">{user?.company_name || "L'IAmani"}</span>}
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
                    
                    {user?.type === 'admin' || user?.role === 'superadmin' ? (
                        <>
                            {!isCollapsed && <div className="mt-5 mb-1 px-3 text-[9px] font-bold text-slate-600 dark:text-gray-400 uppercase tracking-widest">Administration</div>}
                            <SidebarItem icon={Users} label="Gestion Clients" to="/admin/clients" active={window.location.pathname.startsWith('/admin/clients')} collapsed={isCollapsed} />
                            <SidebarItem icon={ShieldAlert} label="Journal Sentinel" to="/admin/sentinel" active={window.location.pathname === '/admin/sentinel'} collapsed={isCollapsed} />
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
                                {!isCollapsed && <span className="font-medium text-[15px] min-w-0 truncate">Support client</span>}
                            </Link>
                        </>
                    ) : user?.type === 'employee' ? (
                        <>
                            {!isCollapsed && <div className="mt-5 mb-1 px-3 text-[9px] font-bold text-slate-600 dark:text-gray-400 uppercase tracking-widest">Espace Salarié</div>}
                            {isModuleActive('planning') && <SidebarItem icon={LayoutDashboard} label="Mon Planning" to="/employe/portal" active={window.location.pathname === '/employe/portal'} collapsed={isCollapsed} />}
                            {isModuleActive('absences') && <SidebarItem icon={Calendar} label="Mes Absences" to="/employe/absences" active={window.location.pathname === '/employe/absences'} collapsed={isCollapsed} />}
                        </>
                    ) : (
                        <>
                            {!isCollapsed && <div className="mt-5 mb-1 px-3 text-[9px] font-bold text-slate-600 dark:text-gray-400 uppercase tracking-widest">Mes Modules</div>}
                            {isModuleActive('planning') && <SidebarItem icon={Calendar} label="Planning" to="/planning" active={window.location.pathname === '/planning'} collapsed={isCollapsed} />}
                            {isModuleActive('evenementiel') && <SidebarItem icon={Briefcase} label="Événementiel" to="/evenementiel" active={window.location.pathname === '/evenementiel'} collapsed={isCollapsed} />}
                            {isModuleActive('crm') && <SidebarItem icon={Users} label="CRM Contacts" to="/crm" active={window.location.pathname === '/crm'} collapsed={isCollapsed} />}
                            {isModuleActive('facture') && <SidebarItem icon={FileText} label="Factures" to="/factures" active={window.location.pathname === '/factures'} collapsed={isCollapsed} />}
                            {isModuleActive('employes') && (
                                <>
                                    <SidebarItem icon={Users} label="Postes & Employés" to="/employes" active={window.location.pathname === '/employes'} collapsed={isCollapsed} />
                                    <SidebarItem icon={Calendar} label="Demandes Absences" to="/absences" active={window.location.pathname === '/absences'} collapsed={isCollapsed} />
                                </>
                            )}
                            {isModuleActive('convertisseur') && <ExternalSidebarItem icon={FileJson} label="ConvertisseurPDF" href="https://monconvertisseur.l-iamani.com" collapsed={isCollapsed} />}
                            {!isCollapsed && <div className="mt-5 mb-1 px-3 text-[9px] font-bold text-slate-600 dark:text-gray-400 uppercase tracking-widest">Support</div>}
                            <button
                                onClick={() => setShowSupportModal(true)}
                                className={`w-full group flex items-center ${isCollapsed ? 'justify-center' : 'gap-2'} ${isCollapsed ? 'px-0 py-1.5' : 'px-3 py-2'} rounded-lg transition-all text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)] hover:text-[var(--text-primary)] relative`}
                                title={isCollapsed ? 'Support' : undefined}
                            >
                                <span className={`inline-flex items-center justify-center ${isCollapsed ? 'w-8 h-8 rounded-lg group-hover:bg-[var(--interactive-hover)]' : 'w-5 h-5'} transition-all relative`}>
                                    <MessageSquare className="w-[18px] h-[18px] shrink-0" />
                                    {clientSupportUnreadCount > 0 && (
                                        <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                                            {clientSupportUnreadCount > 99 ? '99+' : clientSupportUnreadCount}
                                        </span>
                                    )}
                                </span>
                                {!isCollapsed && <span className="font-medium text-[15px] min-w-0 truncate">Support client</span>}
                            </button>
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
                            className="w-full max-w-md bg-white dark:bg-[#0A0A0A] rounded-2xl p-8 shadow-2xl border border-gray-200 dark:border-white/5 transition-colors duration-200"
                        >
                            <h2 className="text-xl font-bold mb-6 text-slate-900 dark:text-white">Mon profil</h2>
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
                {user?.type !== 'admin' && (
                    <SupportModal 
                        open={showSupportModal} 
                        onClose={() => {
                            setShowSupportModal(false);
                            refreshClientUnreadCount();
                        }} 
                        canOpen 
                        onUnreadCountChanged={refreshClientUnreadCount}
                    />
                )}
            </main>
        </div>
    );
}

// --- Views ---

const LoginView = () => {
    const { user, login } = useAuth();
    const navigate = useNavigate();

    React.useEffect(() => {
        if (user) navigate('/');
    }, [user, navigate]);

    const [identifier, setIdentifier] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [error, setError] = React.useState('');
    const [showInfoModal, setShowInfoModal] = React.useState(true);
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
            <InfoModal
                id="login_welcome_v1"
                title="Bienvenue chez L'IAmani"
                message="Bienvenue dans la nouvelle interface de l'IAmani. Veuillez vous connecter avec vos identifiants habituels, ou contacter le développeur du site en cas de besoin."
                isOpen={showInfoModal}
                onClose={() => setShowInfoModal(false)}
            />
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

const DigitalClock = () => {
    const [time, setTime] = React.useState(new Date());

    React.useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const hours = String(time.getHours()).padStart(2, '0');
    const minutes = String(time.getMinutes()).padStart(2, '0');
    const seconds = String(time.getSeconds()).padStart(2, '0');

    return (
        <div className="flex flex-col items-center justify-center h-full">
            <div className="text-[var(--text-muted)] text-[9px] font-bold uppercase tracking-widest mb-1">Heure actuelle</div>
            <div className="flex items-center gap-2 text-3xl md:text-4xl font-black tracking-tighter text-[var(--text-primary)] font-mono">
                <span>{hours}</span>
                <span className="animate-pulse text-[#2f9e9e]">:</span>
                <span>{minutes}</span>
                <span className="animate-pulse text-[#2f9e9e] text-xl md:text-2xl">:</span>
                <span className="text-xl md:text-2xl text-[var(--text-muted)] w-[1.2ch]">{seconds}</span>
            </div>
            <div className="text-[var(--text-muted)] text-[10px] mt-1 font-medium capitalize">
                {time.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
        </div>
    );
};

const DashboardView = () => {
    const { user } = useAuth();
    if (user?.type === 'employee') return <Navigate to="/employe/portal" />;
    const [stats, setStats] = React.useState<any[]>([]);
    const [recentActivity, setRecentActivity] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        if (user) {
            loadStats();
        }
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
                const data = await dashboardApi.getClientStats();
                setStats([
                    { label: 'Employés', value: String(data?.employes ?? 0), icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                    { label: 'Événements', value: String(data?.evenements ?? 0), icon: Calendar, color: 'text-purple-400', bg: 'bg-purple-500/10' },
                    { label: 'Factures', value: String(data?.factures ?? 0), icon: FileText, color: 'text-orange-400', bg: 'bg-green-500/10' },
                    { label: 'Planning', value: String(data?.planning ?? 0), icon: Briefcase, color: 'text-green-400', bg: 'bg-green-500/10' },
                ]);
                setRecentActivity(Array.isArray(data?.recentActivity) ? data.recentActivity : []);
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
                <div className="lg:col-span-2 bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] p-8 transition-colors duration-200 flex flex-col items-center justify-center min-h-[150px]">
                    <DigitalClock />
                </div>
                
                <div className="bg-[var(--bg-card)] text-[var(--text-primary)] rounded-2xl p-10 border border-[var(--border-color)] shadow-2xl relative overflow-hidden flex flex-col justify-between transition-colors duration-200">
                    <div className="relative z-10">
                        <h2 className="text-xl font-bold mb-4">
                            {user?.type === 'admin' ? 'Maintenance Système' : "Support L'IAmani"}
                        </h2>
                        <p className="text-[var(--text-muted)] text-sm leading-relaxed mb-8">
                            {user?.type === 'admin' 
                                ? 'Vérifiez l\'état des serveurs et les logs de sécurité de la plateforme.' 
                                : 'Une question sur le fonctionnement, une demande de modification ou mise à jour, une demande d\'ajout d\'un système de gestion, ou tout ce qui pourrait vous faciliter votre travail ? Contactez le support client.'}
                        </p>
                        {user?.type === 'admin' || user?.role === 'superadmin' ? (
                            <button className="bg-[var(--text-primary)] text-[var(--bg-card)] px-8 py-4 rounded-xl font-bold text-sm hover:opacity-90 transition-all shadow-lg">
                                Voir les logs
                            </button>
                        ) : (
                            <div className="text-[var(--text-muted)] text-sm text-center py-4">
                                Le support est disponible dans la barre latérale.
                            </div>
                        )}
                    </div>
                    <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-[var(--interactive-hover)] rounded-full blur-3xl"></div>
                </div>
            </div>

            {user?.type !== 'admin' && (
                <div className="pt-6">
                    <PlanningTableView />
                </div>
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
            const data = await supportApi.getAdminTickets(status);
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
        const data = await supportApi.getAdminTicketMessages(ticketId);
        setMessages(Array.isArray(data) ? data : (data?.messages || []));
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
                const up = await supportApi.uploadFile(fd);
                fileUrl = up.file_url;
                fileName = up.file_name || file.name;
            }
            await supportApi.sendAdminMessage(selected.id, { message: text.trim() || null, file_url: fileUrl, file_name: fileName });
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
        await supportApi.closeTicket(selected.id);
        setSelected(null);
        setMessages([]);
        await loadTickets();
    };

    const deleteTicket = async () => {
        if (!selected?.id) return;
        if (!confirm('Êtes-vous sûr de vouloir supprimer ce ticket ?')) return;
        try {
            await supportApi.deleteTicket(selected.id);
            setSelected(null);
            setMessages([]);
            await loadTickets();
        } catch (e) {
            alert('Erreur lors de la suppression');
        }
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
                                    className={`w-full text-left p-4 rounded-xl border transition-all ${selected?.id === t.id ? 'border-white/40 bg-white/5 ring-1 ring-white/10' : 'border-white/10 hover:border-white/20'}`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <p className="text-white font-bold truncate flex-1">{t.company_name}</p>
                                        {t.unread_count > 0 && (
                                            <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full ml-2 animate-pulse">{t.unread_count}</span>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-tight mb-1">{t.creator_name || 'Client'}</p>
                                    <p className="text-[10px] text-gray-600">{new Date(t.created_at).toLocaleDateString()}</p>
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
                                <div className="flex gap-2">
                                    {selected.status === 'OPEN' && (
                                        <button onClick={closeTicket} className="px-3 py-2 text-sm rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20">Clôturer l'incident</button>
                                    )}
                                    {selected.status === 'CLOSED' && (
                                        <button onClick={deleteTicket} className="px-3 py-2 text-sm rounded-lg bg-red-600/10 text-red-500 hover:bg-red-600/20">Supprimer</button>
                                    )}
                                </div>
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
    const navigate = useNavigate();
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
        modules: ALL_MODULES.map(m => ({ name: m.name, active: m.name === 'planning' }))
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
                const logoBase64 = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                        const result = `${reader.result ?? ''}`;
                        const base64 = result.includes(',') ? result.split(',')[1] : result;
                        resolve(base64);
                    };
                    reader.onerror = () => reject(new Error('Lecture du logo impossible'));
                    reader.readAsDataURL(newClientLogoFile);
                });
                const upload = await adminApi.uploadLogo(logoBase64, newClientLogoFile.type || 'image/png');
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
                modules: ALL_MODULES.map(m => ({ name: m.name, active: m.name === 'planning' }))
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
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">Gestion des Clients</h1>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="px-4 py-2 rounded-lg bg-black text-white font-bold hover:bg-gray-800"
                >
                    + Ajouter un client
                </button>
            </div>
            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                </div>
            ) : clients.length === 0 ? (
                <div className="bg-[#111111] rounded-2xl border border-white/5 p-20 flex flex-col items-center justify-center text-center">
                    <Users size={40} className="text-gray-700 mb-4" />
                    <h3 className="text-xl font-bold mb-2 text-white">Aucun client</h3>
                    <p className="text-gray-500 max-w-sm">Commencez par ajouter votre premier client IAmani.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {clients.map(client => (
                        <motion.div 
                            key={client.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-[#111111] rounded-2xl border border-white/5 p-6 hover:border-white/20 transition-all cursor-pointer group relative overflow-hidden"
                            onClick={() => navigate(`/admin/clients/${client.id}`)}
                        >
                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center border border-white/10 overflow-hidden">
                                        {client.logo_url ? (
                                            <img src={resolveLogoUrl(client.logo_url)} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <Building2 className="text-gray-500" size={24} />
                                        )}
                                    </div>
                                    <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-widest ${
                                        client.status === 'ACTIVE' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                                    }`}>
                                        {client.status || 'ACTIVE'}
                                    </span>
                                </div>
                                <h3 className="text-xl font-bold text-white mb-1 group-hover:text-blue-400 transition-colors">{client.company_name || client.name}</h3>
                                <p className="text-gray-500 text-sm mb-4 truncate">{client.email}</p>
                                <div className="flex items-center gap-4 text-xs text-gray-400">
                                    <div className="flex items-center gap-1">
                                        <ShieldCheck size={14} />
                                        <span>@{client.username}</span>
                                    </div>
                                </div>
                                <div className="mt-6 pt-4 border-t border-white/5 flex gap-2">
                                    <button
                                        className="flex-1 px-3 py-2 rounded-lg bg-blue-600/10 text-blue-400 text-xs font-bold hover:bg-blue-600 hover:text-white transition-all"
                                        onClick={e => { e.stopPropagation(); handleOpenFactures(client); }}
                                    >
                                        Factures
                                    </button>
                                    <button
                                        className="flex-1 px-3 py-2 rounded-lg bg-white/5 text-white text-xs font-bold hover:bg-white hover:text-black transition-all"
                                        onClick={e => { e.stopPropagation(); handleImpersonate(client.id); }}
                                    >
                                        Se connecter
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* ── Modal Ajouter Client ── */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[#111111] border border-white/10 rounded-2xl p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-white">Nouveau Client</h2>
                            <button onClick={() => setShowAddModal(false)} className="text-gray-500 hover:text-white"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleAddClient} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Nom complet</label>
                                    <input value={newClient.name} onChange={e => setNewClient({...newClient, name: e.target.value})} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-sm" placeholder="Nom du contact" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Établissement</label>
                                    <input value={newClient.company_name} onChange={e => setNewClient({...newClient, company_name: e.target.value})} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-sm" placeholder="Brasserie / Restaurant" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Email</label>
                                <input type="email" value={newClient.email} onChange={e => setNewClient({...newClient, email: e.target.value})} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-sm" placeholder="contact@example.com" required />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Identifiant (username)</label>
                                <input value={newClient.username} onChange={e => setNewClient({...newClient, username: e.target.value})} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-sm" placeholder="brasserie-paris" required />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Logo (fichier)</label>
                                <input type="file" accept="image/*" onChange={e => setNewClientLogoFile(e.target.files?.[0] || null)} className="w-full text-gray-400 text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Taux TVA</label>
                                <div className="flex gap-2 flex-wrap mb-2">
                                    {newClient.tva_rates.map((rate, idx) => (
                                        <span key={idx} className="flex items-center gap-1 bg-white/10 rounded-full px-3 py-1 text-xs text-white">
                                            {rate}%
                                            <button type="button" onClick={() => setNewClient({...newClient, tva_rates: newClient.tva_rates.filter((_, i) => i !== idx)})} className="text-gray-400 hover:text-red-400 ml-1"><X size={10} /></button>
                                        </span>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <input value={newTvaInput} onChange={e => setNewTvaInput(e.target.value)} type="number" className="flex-1 bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-sm" placeholder="Ex: 10" />
                                    <button type="button" onClick={() => { const v = parseFloat(newTvaInput); if (!isNaN(v) && v >= 0) { setNewClient({...newClient, tva_rates: [...newClient.tva_rates, v]}); setNewTvaInput(''); }}} className="px-3 py-2 bg-white/10 text-white rounded-lg text-sm hover:bg-white/20">Ajouter</button>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <input type="checkbox" id="cover-count-new" checked={newClient.enable_cover_count} onChange={e => setNewClient({...newClient, enable_cover_count: e.target.checked})} className="rounded" />
                                <label htmlFor="cover-count-new" className="text-sm text-gray-300">Activer comptage couverts</label>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Modules actifs</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {newClient.modules.map(m => (
                                        <button type="button" key={m.name} onClick={() => toggleModule(m.name)} className={`px-3 py-2 rounded-lg text-xs font-bold capitalize border ${m.active ? 'border-green-500/40 bg-green-500/10 text-green-400' : 'border-white/10 text-gray-500'}`}>
                                            {ALL_MODULES.find(am => am.name === m.name)?.label || m.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-2 rounded-lg border border-white/10 text-gray-400 text-sm hover:text-white">Annuler</button>
                                <button type="submit" className="flex-1 px-4 py-2 rounded-lg bg-white text-black font-bold text-sm hover:bg-gray-200">Créer le client</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Modal Succès Création ── */}
            {successData && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[#111111] border border-green-500/20 rounded-2xl p-8 w-full max-w-md text-center">
                        <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <ShieldCheck size={32} className="text-green-400" />
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">Client créé !</h2>
                        <p className="text-gray-400 text-sm mb-4">{successData.company_name || successData.name} a été ajouté avec succès.</p>
                        {successData.tempPassword && (
                            <div className="bg-black rounded-xl border border-white/10 p-4 mb-4">
                                <p className="text-xs text-gray-500 mb-1">Mot de passe temporaire</p>
                                <p className="text-lg font-mono font-bold text-white">{successData.tempPassword}</p>
                                <p className="text-xs text-yellow-400 mt-1">À communiquer au client et lui demander de le changer.</p>
                            </div>
                        )}
                        <button onClick={() => setSuccessData(null)} className="w-full px-4 py-2 rounded-lg bg-white text-black font-bold hover:bg-gray-200">Fermer</button>
                    </div>
                </div>
            )}

            {/* ── Modal Factures Client ── */}
            {selectedFactureClient && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[#111111] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
                        <div className="flex items-center justify-between p-6 border-b border-white/10">
                            <div>
                                <h2 className="text-lg font-bold text-white">Factures — {selectedFactureClient.company_name || selectedFactureClient.name}</h2>
                                <p className="text-gray-500 text-sm">{clientFactures.length} facture(s)</p>
                            </div>
                            <button onClick={() => { setSelectedFactureClient(null); setClientFactures([]); }} className="text-gray-500 hover:text-white"><X size={20} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {facturesLoading ? (
                                <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" /></div>
                            ) : clientFactures.length === 0 ? (
                                <p className="text-gray-500 text-center py-10">Aucune facture pour ce client.</p>
                            ) : clientFactures.map((f: any) => (
                                <div key={f.id} className="flex items-center justify-between bg-black rounded-xl border border-white/10 p-4">
                                    <div>
                                        <p className="text-white font-bold">{f.invoice_number || 'Facture'}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">{f.customer_name} • {f.due_date ? new Date(f.due_date).toLocaleDateString() : new Date(f.created_at).toLocaleDateString()}</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <p className="text-white font-bold">{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(f.total_ttc ?? f.amount ?? 0))}</p>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${f.status === 'paid' ? 'bg-green-500/10 text-green-400' : 'bg-orange-500/10 text-orange-400'}`}>{f.status}</span>
                                        </div>
                                        <button
                                            disabled={deletingFactureId === String(f.id)}
                                            onClick={() => handleDeleteFacture(f)}
                                            className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const AdminClientDetailView = () => {
    const { user } = useAuth();
    const { id } = useParams();
    const navigate = useNavigate();
    const [client, setClient] = React.useState<any>(null);
    const [showEmployeesModal, setShowEmployeesModal] = React.useState(false);
    const [clientEmployees, setClientEmployees] = React.useState<any[]>([]);
    const [loadingEmployees, setLoadingEmployees] = React.useState(false);
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
        modules_access: ALL_MODULES.map(m => m.name),
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
    const [showEvenementielImportModal, setShowEvenementielImportModal] = React.useState(false);
    const [showPlanningConfig, setShowPlanningConfig] = React.useState(false);
    const [importFile, setImportFile] = React.useState<File | null>(null);
    const [evenementielImportFile, setEvenementielImportFile] = React.useState<File | null>(null);
    const [importLoading, setImportLoading] = React.useState(false);
    const [evenementielImportLoading, setEvenementielImportLoading] = React.useState(false);
    const [importError, setImportError] = React.useState<string | null>(null);
    const [evenementielImportError, setEvenementielImportError] = React.useState<string | null>(null);
    const [importPreview, setImportPreview] = React.useState<any>(null);
    const [evenementielImportPreview, setEvenementielImportPreview] = React.useState<any>(null);
    const [importResult, setImportResult] = React.useState<any>(null);
    const [evenementielImportResult, setEvenementielImportResult] = React.useState<any>(null);
    const isSuperAdmin = user?.type === 'admin' && user?.email === 'gev-emeni@outlook.fr';

    // Employee Actions State
    const [configAbsenceEmp, setConfigAbsenceEmp] = React.useState<any>(null);
    const [clientAbsenceTypes, setClientAbsenceTypes] = React.useState<any[]>([]);
    const [allowedAbsences, setAllowedAbsences] = React.useState<string[]>([]);

    const handleOpenConfigAbsence = async (emp: any) => {
        setConfigAbsenceEmp(emp);
        setAllowedAbsences(emp.allowed_absence_types ? JSON.parse(emp.allowed_absence_types) : []);
        try {
            const settings = await adminApi.getClientPlanningSettings(id!).then(r => r.json());
            if (settings.absenceCodes) {
                setClientAbsenceTypes(settings.absenceCodes);
            } else {
                setClientAbsenceTypes([]);
            }
        } catch (e) {
            console.error("Failed to load client planning settings", e);
            setClientAbsenceTypes([]);
        }
    };

    const handleActivateEmp = async (eid: string) => {
        if (!confirm("Voulez-vous activer le compte de cet employé ?")) return;
        try {
            const res = await adminApi.activateClientEmploye(id!, eid);
            if (res.error) alert(res.error);
            else { alert(`Compte activé ! Identifiant généré : ${res.username}`); handleViewEmployees(); }
        } catch(e) { alert("Erreur d'activation."); }
    };

    const handleDeactivateEmp = async (eid: string) => {
        if (!confirm("Voulez-vous désactiver ce compte ? Il n'aura plus accès à la plateforme.")) return;
        try {
            const res = await adminApi.deactivateClientEmploye(id!, eid);
            if (res.error) alert(res.error);
            else { alert("Compte désactivé."); handleViewEmployees(); }
        } catch(e) { alert("Erreur."); }
    };

    const handleResetPasswordEmp = async (eid: string) => {
        if (!confirm("Voulez-vous réinitialiser le mot de passe de cet employé ?")) return;
        try {
            const res = await adminApi.resetClientEmployePassword(id!, eid);
            if (res.error) alert(res.error);
            else { alert(res.tempPassword ? `Mot de passe généré : ${res.tempPassword}` : "Mot de passe réinitialisé, un email a été envoyé."); }
        } catch(e) { alert("Erreur."); }
    };

    const handleSaveAbsenceConfig = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/admin/clients/${id}/employes/${configAbsenceEmp.id}/absence-config`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ allowed_absence_types: allowedAbsences })
            }).then(r => r.json());
            if (res.error) alert(res.error);
            else { 
                alert("Configuration sauvegardée."); 
                setConfigAbsenceEmp(null); 
                handleViewEmployees(); 
            }
        } catch(e) { alert("Erreur."); }
    };

    React.useEffect(() => {
        if (configAbsenceEmp) {
            try {
                setAllowedAbsences(configAbsenceEmp.allowed_absence_types ? JSON.parse(configAbsenceEmp.allowed_absence_types) : []);
            } catch(e) { setAllowedAbsences([]); }
        }
    }, [configAbsenceEmp]);

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

    const handleCloseEvenementielImportModal = () => {
        setEvenementielImportFile(null);
        setEvenementielImportError(null);
        setEvenementielImportPreview(null);
        setEvenementielImportResult(null);
        setShowEvenementielImportModal(false);
    };

    const handleEvenementielImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setEvenementielImportFile(file);
        setEvenementielImportError(null);
        setEvenementielImportLoading(true);

        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await adminApi.previewImportEvenementiel(id!, formData);
            if (res.error) setEvenementielImportError(res.error);
            else setEvenementielImportPreview(res);
        } catch (e: any) {
            setEvenementielImportError(e.message);
        } finally {
            setEvenementielImportLoading(false);
        }
    };

    const executeEvenementielImport = async () => {
        if (!evenementielImportPreview) return;
        setEvenementielImportLoading(true);
        setEvenementielImportError(null);

        try {
            const res = await adminApi.executeImportEvenementiel(id!, { rows: evenementielImportPreview.rows });
            if (res.error) setEvenementielImportError(res.error);
            else setEvenementielImportResult(res);
        } catch (e: any) {
            setEvenementielImportError(e.message);
        } finally {
            setEvenementielImportLoading(false);
        }
    };

    const handleViewEmployees = async () => {
        setShowEmployeesModal(true);
        setLoadingEmployees(true);
        try {
            const res = await adminApi.getClientEmployes(id!);
            if (res && !res.error) setClientEmployees(res);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingEmployees(false);
        }
    };

    React.useEffect(() => {
        if (id) loadData();
    }, [id]);

    const loadData = async () => {
        try {
            const [currentClient, m, c, s, logs] = await Promise.all([
                adminApi.getClient(id!),
                adminApi.getClientModules(id!),
                adminApi.getCollaborators(id!),
                adminApi.getSpaces(id!),
                adminApi.getClientAuditLogs(id!)
            ]);
            const staff = await adminApi.getStaffTypes(id!);
            setClient(currentClient);
            const parsedRates = (() => {
                try {
                    const raw = currentClient.tva_rates;
                    const arr = Array.isArray(raw) ? raw : (typeof raw === 'string' && raw !== '[object Object]' ? JSON.parse(raw || '[]') : []);
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
            setModules(m || []);
            setCollaborators(c || []);
            setSpaces(s || []);
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
            // Rebuild the modules list from ALL_MODULES to ensure we include new ones
            const updatedModules = ALL_MODULES.map(am => {
                const existing = modules.find(rm => rm.module_name === am.name);
                if (am.name === moduleName) {
                    return { ...existing, module_name: am.name, is_active: active ? 1 : 0 };
                }
                return existing || { module_name: am.name, is_active: 0 };
            });
            
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
                const reader = new FileReader();
                const base64Promise = new Promise<string>((resolve, reject) => {
                    reader.onload = () => {
                        const result = reader.result as string;
                        resolve(result.split(',')[1]);
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(editLogoFile);
                });
                const logoBase64 = await base64Promise;
                const upload = await adminApi.uploadLogo(logoBase64, editLogoFile.type || 'image/png');
                if (!upload.logo_url) {
                    throw new Error(upload.error || 'Erreur upload logo');
                }
                nextLogoUrl = upload.logo_url;
            }

            const payload = { ...editData, logo_url: nextLogoUrl };
            await adminApi.updateClient(id!, payload);
            setClient({ ...client, ...payload });
            setEditData((prev) => ({ ...prev, logo_url: nextLogoUrl }));
            setEditLogoFile(null);
            setEditMode(false);
        } catch (e: any) {
            alert('Erreur lors de la mise à jour du profil: ' + (e?.message || String(e)));
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
            await adminApi.resetCollaboratorPassword(id!, collab.id);
            alert('Les nouveaux identifiants ont été envoyés par email au collaborateur.');
        } catch (e: any) {
            alert(e?.message || 'Erreur lors de la réinitialisation du collaborateur');
        }
    };

    const handleForceResetCollaborator = async (collab: any) => {
        if (!confirm(`Forcer la réinitialisation du mot de passe de ${collab.name || 'ce collaborateur'} ?`)) return;
        try {
            await adminApi.forceResetCollaboratorPassword(id!, collab.id);
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
        setNewCollab({ name: '', username: '', email: '', role: '', modules_access: ALL_MODULES.map(m => m.name), password: '' });
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
            modules_access: ALL_MODULES.filter(m => parsedModules.includes(m.name)).map(m => m.name),
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

    const handleAddStaffType = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!newStaffTypeName.trim()) return;
        if (!id) {
            console.error('No client ID found in URL parameters');
            alert('ID client manquant. Veuillez rafraîchir la page.');
            return;
        }

        try {
            console.log('Creating staff type for client:', id, 'name:', newStaffTypeName.trim());
            await adminApi.createStaffType(id, { name: newStaffTypeName.trim() });
            setNewStaffTypeName('');
            await loadData();
            console.log('Staff type created and data reloaded');
        } catch (e: any) {
            console.error('Error creating staff type:', e);
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

    if (showPlanningConfig) {
        return (
            <div className="min-h-screen bg-[#0A0A0A] p-4 md:p-8">
                <AdminPlanningConfig 
                    clientId={client.id} 
                    clientName={client.company_name || client.name} 
                    onBack={() => setShowPlanningConfig(false)} 
                />
            </div>
        );
    }

    return (
        <div className="space-y-10">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <Link to="/admin/clients" className="text-sm text-gray-500 hover:text-white flex items-center gap-1 mb-2 transition-all">
                        <ChevronRight size={14} className="rotate-180" /> Retour aux clients
                    </Link>
                    <div className="flex items-center gap-4">
                        <h1 className="text-3xl font-bold tracking-tight text-white">{client.name}</h1>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
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
                            </div>
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

                            <button
                                onClick={handleViewEmployees}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#1A1A1A] hover:bg-[#222222] text-white rounded-xl font-bold transition-all border border-white/5 mt-2"
                            >
                                <Users size={16} className="text-blue-400" />
                                👤 Voir la liste des employés du client
                            </button>
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
                            {ALL_MODULES.map((m) => {
                                const isActive = modules.find(rm => rm.module_name === m.name)?.is_active === 1;
                                return (
                                    <div 
                                        key={m.name}
                                        className="flex items-center justify-between p-4 rounded-xl bg-black border border-white/5"
                                    >
                                        <span className="capitalize font-medium text-white">{m.label}</span>
                                        <button 
                                            onClick={() => handleUpdateModules(m.name, !isActive)}
                                            className="transition-all"
                                        >
                                            {isActive ? <ToggleRight size={32} className="text-white" /> : <ToggleLeft size={32} className="text-gray-700" />}
                                        </button>
                                    </div>
                                );
                            })}
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
                    <div className="bg-[#111111] rounded-2xl p-8 border border-white/5 space-y-4">
                        <div>
                            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                                <FileSpreadsheet size={20} className="text-green-400" />
                                Import RH (Employés)
                            </h2>
                            <p className="text-sm text-gray-500 mb-4">Importer des employés et postes en masse (.xlsx).</p>
                            <button
                                onClick={() => setShowImportModal(true)}
                                className="w-full bg-green-500/10 border border-green-500/30 text-green-400 py-3 rounded-xl font-bold hover:bg-green-500/20 transition-all flex items-center justify-center gap-2"
                            >
                                <Upload size={16} />
                                Configurer RH
                            </button>
                        </div>
                        
                        <div className="pt-4 border-t border-white/5">
                            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                                <Calendar size={20} className="text-blue-400" />
                                Import Événementiel
                            </h2>
                            <p className="text-sm text-gray-500 mb-4">Importer des privatisations, clients CRM et staff en masse.</p>
                            <button
                                onClick={() => setShowEvenementielImportModal(true)}
                                className="w-full bg-blue-500/10 border border-blue-500/30 text-blue-400 py-3 rounded-xl font-bold hover:bg-blue-500/20 transition-all flex items-center justify-center gap-2"
                            >
                                <Upload size={16} />
                                Importer Événements
                            </button>
                        </div>

                        <div className="pt-4 border-t border-white/5">
                            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                                <Clock size={20} className="text-orange-400" />
                                Config Planning
                            </h2>
                            <p className="text-sm text-gray-500 mb-4">Gérer les codes d'absence et types de renfort.</p>
                            <button
                                onClick={() => setShowPlanningConfig(true)}
                                className="w-full bg-orange-500/10 border border-orange-500/30 text-orange-400 py-3 rounded-xl font-bold hover:bg-orange-500/20 transition-all flex items-center justify-center gap-2"
                            >
                                <Settings size={16} />
                                Configurer Planning
                            </button>
                        </div>
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
                            <form onSubmit={handleAddStaffType} className="flex items-center gap-2">
                                <input
                                    value={newStaffTypeName}
                                    onChange={(e) => setNewStaffTypeName(e.target.value)}
                                    placeholder="Nouvelle catégorie"
                                    className="bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-white w-48"
                                />
                                <button
                                    type="submit"
                                    disabled={!newStaffTypeName.trim()}
                                    className="text-sm font-bold text-white hover:text-gray-300 flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Plus size={16} /> Ajouter une catégorie
                                </button>
                            </form>
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
                                            {editData?.tva_rates?.map((rate) => (
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
                                                className="w-32 px-3 py-2 rounded-lg bg-slate-50 dark:bg-black border border-gray-300 dark:border-white/10 text-slate-900 dark:text-white focus:border-slate-400 dark:focus:border-white outline-none transition-colors duration-200"
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
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Email <span className="text-gray-600 font-normal normal-case">(optionnel)</span>
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
                                        {ALL_MODULES.map((m) => {
                                            const checked = newCollab.modules_access.includes(m.name);
                                            return (
                                                <label key={m.name} className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-all ${checked ? 'border-slate-300 dark:border-white/30 bg-slate-100 dark:bg-white/5 text-slate-900 dark:text-white' : 'border-gray-300 dark:border-white/10 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'}`}>
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={() => toggleCollaboratorModule(m.name)}
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

            {/* Modal Import Excel */}
            <AnimatePresence>
                {showImportModal && isSuperAdmin && (
                    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-6 transition-colors duration-200">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="w-full max-w-xl max-h-[85vh] bg-white dark:bg-[#0A0A0A] rounded-3xl border border-gray-200 dark:border-white/10 shadow-2xl overflow-hidden flex flex-col transition-colors duration-200"
                        >
                            <div className="p-6 border-b border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center text-green-400">
                                        <FileText size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white">Import Excel — {client?.company_name}</h3>
                                        <p className="text-xs text-gray-500">Employés & Postes en masse</p>
                                    </div>
                                </div>
                                <button onClick={handleCloseImportModal} className="p-2 hover:bg-white/5 rounded-xl text-gray-500 transition-all">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6">
                                {!importResult && (
                                    <div className="space-y-6">
                                        {!importPreview && (
                                            <div>
                                                <p className="text-xs text-gray-500 mb-3 font-bold uppercase tracking-widest">Format attendu</p>
                                                <div className="bg-white/[0.03] rounded-xl border border-white/5 p-4 text-xs text-gray-400 font-mono mb-4">
                                                    <span className="text-white font-bold">Nom</span> · <span className="text-green-400">Prénom</span> · <span className="text-blue-400">Poste</span> · Email · Téléphone
                                                    <br />
                                                    <span className="text-[10px] text-gray-500">(Email et Téléphone optionnels)</span>
                                                </div>
                                                <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-white/10 rounded-2xl cursor-pointer hover:border-blue-500/40 hover:bg-blue-500/5 transition-all">
                                                    <Upload size={32} className="text-gray-500 mb-3" />
                                                    <span className="text-sm text-gray-400 font-medium">
                                                        Cliquer pour sélectionner un fichier Excel
                                                    </span>
                                                    <span className="text-[10px] text-gray-500 mt-1">.xlsx, .xls, .csv</span>
                                                    <input 
                                                        type="file" 
                                                        accept=".xlsx,.xls,.csv" 
                                                        className="hidden" 
                                                        onChange={handleImportFileChange} 
                                                    />
                                                </label>
                                            </div>
                                        )}

                                        {importLoading && (
                                            <div className="flex items-center justify-center gap-3 py-6 text-gray-400">
                                                <div className="w-5 h-5 border-2 border-white/20 border-t-green-400 rounded-full animate-spin" />
                                                <span className="text-sm">{importPreview ? 'Importation en cours...' : 'Analyse du fichier...'}</span>
                                            </div>
                                        )}

                                        {importError && (
                                            <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                                                <AlertCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
                                                <p className="text-sm text-red-400">{importError}</p>
                                            </div>
                                        )}

                                        {importPreview && !importLoading && (
                                            <div className="space-y-4">
                                                <div className="bg-white/[0.03] rounded-2xl border border-white/5 p-5 space-y-3">
                                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Analyse Flash</p>
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
                                            </div>
                                        )}
                                    </div>
                                )}

                                {importResult && (
                                    <div className="py-12 flex flex-col items-center text-center space-y-6">
                                        <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center">
                                            <CheckCircle2 size={40} className="text-green-400" />
                                        </div>
                                        <h4 className="text-2xl font-bold text-white">Importation Terminée !</h4>
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

            {/* Modal Import Événementiel */}
            <AnimatePresence>
                {showEvenementielImportModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={handleCloseEvenementielImportModal} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-[#111111] border border-white/10 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-500/10 rounded-xl">
                                    <Calendar size={20} className="text-blue-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white">Import Événementiel</h3>
                                    <p className="text-xs text-gray-500">Importer des privatisations, clients CRM et staff</p>
                                </div>
                            </div>
                            <button onClick={handleCloseEvenementielImportModal} className="p-2 hover:bg-white/5 rounded-xl text-gray-500 transition-all">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            {!evenementielImportResult && (
                                <div className="space-y-6">
                                    {!evenementielImportPreview && (
                                        <div>
                                            <p className="text-xs text-gray-500 mb-3 font-bold uppercase tracking-widest">Colonnes attendues</p>
                                            <div className="bg-white/[0.03] rounded-xl border border-white/5 p-4 text-[10px] text-gray-400 font-mono mb-4 grid grid-cols-2 gap-x-4 gap-y-1">
                                                <span><span className="text-blue-400">Mois/Année</span> : ex: 05/2026</span>
                                                <span><span className="text-blue-400">Client</span> : Nom de l'entreprise</span>
                                                <span><span className="text-blue-400">Date</span> : ex: 15/05/2026</span>
                                                <span><span className="text-blue-400">Heure Début</span> : ex: 19h</span>
                                                <span><span className="text-blue-400">Heure Fin</span> : ex: 02h</span>
                                                <span><span className="text-blue-400">Espace</span> : ex: Salle</span>
                                                <span><span className="text-gray-500">Staff</span> : Nom Prénom (séparés par ;)</span>
                                                <span><span className="text-gray-500">Nb Pers.</span> : ex: 50</span>
                                            </div>
                                            <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-white/10 rounded-2xl cursor-pointer hover:border-blue-500/40 hover:bg-blue-500/5 transition-all">
                                                <Upload size={32} className="text-gray-500 mb-3" />
                                                <span className="text-sm text-gray-400 font-medium">
                                                    {evenementielImportFile ? evenementielImportFile.name : 'Sélectionner un fichier Excel (.xlsx, .csv)'}
                                                </span>
                                                <input
                                                    type="file"
                                                    accept=".xlsx,.xls,.csv"
                                                    className="hidden"
                                                    onChange={handleEvenementielImportFileChange}
                                                />
                                            </label>
                                        </div>
                                    )}

                                    {evenementielImportLoading && (
                                        <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-3">
                                            <div className="w-8 h-8 border-3 border-white/10 border-t-blue-400 rounded-full animate-spin" />
                                            <p className="text-sm">Traitement en cours...</p>
                                        </div>
                                    )}

                                    {evenementielImportError && (
                                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3">
                                            <AlertCircle size={20} className="text-red-400 flex-shrink-0" />
                                            <p className="text-sm text-red-400">{evenementielImportError}</p>
                                        </div>
                                    )}

                                    {evenementielImportPreview && !evenementielImportLoading && (
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-3 gap-4">
                                                <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                                                    <p className="text-2xl font-bold text-white">{evenementielImportPreview.total}</p>
                                                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Total détecté</p>
                                                </div>
                                                <div className="bg-green-500/5 rounded-2xl p-4 border border-green-500/10">
                                                    <p className="text-2xl font-bold text-green-400">{evenementielImportPreview.valid}</p>
                                                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Prêts à l'import</p>
                                                </div>
                                                <div className="bg-red-500/5 rounded-2xl p-4 border border-red-500/10">
                                                    <p className="text-2xl font-bold text-red-400">{evenementielImportPreview.errors}</p>
                                                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Incomplets</p>
                                                </div>
                                            </div>

                                            <div className="border border-white/10 rounded-2xl overflow-hidden overflow-x-auto">
                                                <table className="w-full text-[11px] text-left">
                                                    <thead className="bg-white/5 text-gray-400 uppercase tracking-widest text-[9px]">
                                                        <tr>
                                                            <th className="px-4 py-3">Date</th>
                                                            <th className="px-4 py-3">Client</th>
                                                            <th className="px-4 py-3">Horaires</th>
                                                            <th className="px-4 py-3">Espace</th>
                                                            <th className="px-4 py-3">Staff</th>
                                                            <th className="px-4 py-3">Statut</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-white/5">
                                                        {evenementielImportPreview.rows.map((r: any, i: number) => (
                                                            <tr key={i} className="text-gray-300">
                                                                <td className="px-4 py-3">{r.date}</td>
                                                                <td className="px-4 py-3 font-bold">{r.client}</td>
                                                                <td className="px-4 py-3">{r.start} - {r.end}</td>
                                                                <td className="px-4 py-3">{r.espace || '-'}</td>
                                                                <td className="px-4 py-3">
                                                                    <div className="flex flex-wrap gap-1">
                                                                        {Array.isArray(r.staffs) && r.staffs.map((s: any, si: number) => (
                                                                            <span key={si} className={`px-1.5 py-0.5 rounded ${s?.id ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'}`}>
                                                                                {s?.name || 'Inconnu'}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    {r.isValid ? (
                                                                        <span className="text-green-400 font-bold">OK</span>
                                                                    ) : (
                                                                        <span className="text-red-400 font-bold">Erreur</span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {evenementielImportResult && (
                                <div className="py-12 flex flex-col items-center text-center space-y-6">
                                    <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center">
                                        <CheckCircle2 size={40} className="text-green-400" />
                                    </div>
                                    <div>
                                        <h4 className="text-2xl font-bold text-white">Importation Terminée !</h4>
                                        <p className="text-gray-500 mt-2">
                                            {evenementielImportResult.createdCount} événement(s) créé(s) avec succès.<br />
                                            {evenementielImportResult.crmCreated} contact(s) CRM ajouté(s).
                                        </p>
                                    </div>
                                    <button onClick={handleCloseEvenementielImportModal} className="px-8 py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-all">
                                        Fermer
                                    </button>
                                </div>
                            )}
                        </div>

                        {!evenementielImportResult && (
                            <div className="p-6 border-t border-white/5 bg-white/[0.02] flex gap-3">
                                <button onClick={handleCloseEvenementielImportModal} className="flex-1 py-3 px-4 border border-white/10 rounded-xl font-bold text-white hover:bg-white/5 transition-all">
                                    Annuler
                                </button>
                                {evenementielImportPreview && !evenementielImportLoading && (
                                    <button
                                        onClick={executeEvenementielImport}
                                        disabled={evenementielImportPreview.valid === 0}
                                        className="flex-[2] py-3 px-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-500 transition-all disabled:opacity-50"
                                    >
                                        Lancer l'importation ({evenementielImportPreview.valid} lignes)
                                    </button>
                                )}
                            </div>
                        )}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>

        {/* Modal Liste des employés */}
        <AnimatePresence>
            {showEmployeesModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-[#111111] rounded-2xl border border-white/10 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
                    >
                        <div className="p-6 border-b border-white/10 flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Users size={24} className="text-blue-400" />
                                    Employés saisis ({clientEmployees.length})
                                </h3>
                                <p className="text-sm text-gray-500 mt-1">Liste en lecture seule des collaborateurs de ce client.</p>
                            </div>
                            <button onClick={() => setShowEmployeesModal(false)} className="text-gray-500 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto flex-1">
                            {loadingEmployees ? (
                                <div className="flex justify-center p-8"><span className="text-white">Chargement...</span></div>
                            ) : clientEmployees.length === 0 ? (
                                <div className="text-center p-8 text-gray-500">Aucun employé saisi.</div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {clientEmployees.map((emp: any) => (
                                        <div key={emp.id} className="bg-black border border-white/5 rounded-xl p-4 flex flex-col gap-2">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-sm uppercase shrink-0">
                                                    {emp.first_name?.[0] || ''}{emp.last_name?.[0] || ''}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-white truncate flex items-center gap-2">
                                                        {emp.first_name} {emp.last_name}
                                                        {emp.is_active ? <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-[10px] rounded uppercase">Actif</span> : <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-[10px] rounded uppercase">Inactif</span>}
                                                    </p>
                                                    <p className="text-xs text-gray-500 truncate">{emp.position || 'Poste non défini'} {emp.username ? `• ${emp.username}` : ''}</p>
                                                </div>
                                            </div>
                                            <div className="text-xs text-gray-400 mt-2 flex flex-col gap-1">
                                                {emp.email && <span className="flex items-center gap-2"><Mail size={12}/> {emp.email}</span>}
                                                {emp.phone && <span className="flex items-center gap-2"><Phone size={12}/> {emp.phone}</span>}
                                                {emp.hire_date && <span>Embauché le : {new Date(emp.hire_date).toLocaleDateString('fr-FR')}</span>}
                                            </div>
                                            <div className="mt-4 flex flex-wrap gap-2 pt-3 border-t border-white/5">
                                                {!emp.is_active ? (
                                                    <button onClick={() => handleActivateEmp(emp.id)} className="px-3 py-1.5 bg-green-500/10 text-green-400 hover:bg-green-500/20 rounded text-xs font-medium transition-colors">
                                                        Activer
                                                    </button>
                                                ) : (
                                                    <>
                                                        <button onClick={() => handleDeactivateEmp(emp.id)} className="px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded text-xs font-medium transition-colors">
                                                            Désactiver
                                                        </button>
                                                        <button onClick={() => handleResetPasswordEmp(emp.id)} className="px-3 py-1.5 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 rounded text-xs font-medium transition-colors">
                                                            Envoyer nouveau MDP par email
                                                        </button>
                                                        <button onClick={() => handleOpenConfigAbsence(emp)} className="px-3 py-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded text-xs font-medium transition-colors">
                                                            Config. Absences
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-white/10 bg-black/50 text-right">
                            <button onClick={() => setShowEmployeesModal(false)} className="px-6 py-2 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition-all">
                                Fermer
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>

        {/* Modal Configuration Absences */}
        <AnimatePresence>
            {configAbsenceEmp && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-[#111111] rounded-2xl border border-white/10 w-full max-w-md p-6"
                    >
                        <h3 className="text-xl font-bold text-white mb-2">Configuration des absences</h3>
                        <p className="text-sm text-gray-400 mb-6">Employé : {configAbsenceEmp.first_name} {configAbsenceEmp.last_name}</p>

                        <div className="space-y-4 mb-8">
                            {clientAbsenceTypes.length > 0 ? clientAbsenceTypes.map((type: any) => (
                                <label key={type.code} className="flex items-center gap-3 text-white cursor-pointer group">
                                    <input 
                                        type="checkbox" 
                                        checked={allowedAbsences.includes(type.code)}
                                        onChange={(e) => {
                                            if (e.target.checked) setAllowedAbsences(prev => [...prev, type.code]);
                                            else setAllowedAbsences(prev => prev.filter(t => t !== type.code));
                                        }}
                                        className="w-5 h-5 rounded border-white/20 bg-black text-blue-500 focus:ring-blue-500/50"
                                    />
                                    <span className="group-hover:text-blue-400 transition-colors">
                                        {type.code}
                                        {type.color && <span className="ml-2 inline-block w-3 h-3 rounded-full" style={{backgroundColor: type.color}}></span>}
                                    </span>
                                </label>
                            )) : (
                                <p className="text-sm text-gray-500">Aucun type d'absence configuré pour ce client.</p>
                            )}
                        </div>

                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setConfigAbsenceEmp(null)} className="px-4 py-2 text-white hover:bg-white/5 rounded-lg transition-colors">
                                Annuler
                            </button>
                            <button onClick={handleSaveAbsenceConfig} className="px-4 py-2 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 transition-colors">
                                Sauvegarder
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>


    </div>
);
}

// --- EMPLOYEE PORTAL COMPONENTS ---
const EmployeePortal = () => {
    const { user } = useAuth();
    const [shifts, setShifts] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const fetchPlanning = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`/api/employe/planning`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }).then(r => r.json());
                if (!res.error && res.shifts) {
                    setShifts(res.shifts.sort((a: any, b: any) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()));
                }
            } catch(e) {} finally { setLoading(false); }
        };
        fetchPlanning();
    }, []);

    const upcoming = shifts.filter(s => new Date(s.endTime) > new Date());

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
                <Calendar className="text-blue-500" size={32} />
                Mon Planning
            </h1>
            <div className="bg-[#111111] rounded-2xl border border-white/10 p-6">
                <h2 className="text-xl font-bold text-white mb-4">Shifts à venir</h2>
                {loading ? <p className="text-gray-400">Chargement...</p> : upcoming.length === 0 ? <p className="text-gray-400">Aucun shift à venir.</p> : (
                    <div className="space-y-3">
                        {upcoming.map((s, i) => (
                            <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-white/5 bg-black" style={{ borderLeftColor: s.color || '#3b82f6', borderLeftWidth: 4 }}>
                                <div>
                                    <p className="font-bold text-white text-lg">{s.title}</p>
                                    <p className="text-sm text-gray-400">
                                        Du {new Date(s.startTime).toLocaleString('fr-FR')} au {new Date(s.endTime).toLocaleString('fr-FR')}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const EmployeeAbsenceModule = () => {
    const { user } = useAuth();
    const [absences, setAbsences] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [showForm, setShowForm] = React.useState(false);
    const allowedAbsences = React.useMemo(() => {
        if (!user?.allowed_absence_types) return [];
        try { return JSON.parse(user.allowed_absence_types); } catch { return []; }
    }, [user]);
    const [form, setForm] = React.useState({ type: allowedAbsences.length > 0 ? allowedAbsences[0] : '', start_date: '', end_date: '', comments: '' });

    React.useEffect(() => {
        if (showForm && !form.type && allowedAbsences.length > 0) {
            setForm(f => ({ ...f, type: allowedAbsences[0] }));
        }
    }, [showForm, allowedAbsences]);

    const fetchAbsences = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/employe/absences`, {
                headers: { 'Authorization': `Bearer ${token}` }
            }).then(r => r.json());
            if (!res.error) setAbsences(res);
        } catch(e) {} finally { setLoading(false); }
    };

    React.useEffect(() => { fetchAbsences(); }, []);

    const handleSubmit = async (e: any) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/employe/absences`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            }).then(r => r.json());
            if (res.error) alert(res.error);
            else { setShowForm(false); setForm({ type: allowedAbsences.length > 0 ? allowedAbsences[0] : '', start_date: '', end_date: '', comments: '' }); fetchAbsences(); }
        } catch(e) {}
    };

    const StatusBadge = ({ status }: { status: string }) => {
        if (status === 'approved') return <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded uppercase">Accepté</span>;
        if (status === 'rejected') return <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded uppercase">Refusé</span>;
        return <span className="px-2 py-1 bg-orange-500/20 text-orange-400 text-xs rounded uppercase">En attente</span>;
    };

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <Calendar className="text-blue-500" size={32} />
                    Mes Absences
                </h1>
                <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 transition-colors">
                    Nouvelle Demande
                </button>
            </div>

            {showForm && (
                <div className="bg-[#111111] rounded-2xl border border-white/10 p-6 mb-6">
                    <h2 className="text-xl font-bold text-white mb-4">Formuler une demande</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Type d'absence</label>
                                <select required value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-white">
                                    {allowedAbsences.length > 0 ? allowedAbsences.map((type: string) => (
                                        <option key={type} value={type}>{type}</option>
                                    )) : (
                                        <option value="">Aucun type d'absence autorisé</option>
                                    )}
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Date de début</label>
                                <input type="date" required value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-white" />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Date de fin</label>
                                <input type="date" required value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-white" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Commentaires</label>
                            <textarea value={form.comments} onChange={e => setForm({...form, comments: e.target.value})} className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-white" rows={3}></textarea>
                        </div>
                        <div className="flex gap-3 justify-end">
                            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-white hover:bg-white/5 rounded-lg">Annuler</button>
                            <button type="submit" className="px-4 py-2 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600">Soumettre</button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-[#111111] rounded-2xl border border-white/10 p-6">
                <h2 className="text-xl font-bold text-white mb-4">Historique des demandes</h2>
                {loading ? <p className="text-gray-400">Chargement...</p> : absences.length === 0 ? <p className="text-gray-400">Aucune demande.</p> : (
                    <div className="space-y-3">
                        {absences.map((a: any) => (
                            <div key={a.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-white/5 bg-black">
                                <div>
                                    <div className="flex items-center gap-3 mb-1">
                                        <p className="font-bold text-white">{a.type}</p>
                                        <StatusBadge status={a.status} />
                                    </div>
                                    <p className="text-sm text-gray-400">Du {new Date(a.start_date).toLocaleDateString('fr-FR')} au {new Date(a.end_date).toLocaleDateString('fr-FR')}</p>
                                </div>
                                <div className="text-right mt-2 sm:mt-0 text-xs text-gray-500">
                                    Créée le {new Date(a.created_at).toLocaleDateString('fr-FR')}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const ClientAbsencesModule = () => {
    const { user } = useAuth();
    const [absences, setAbsences] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);

    const fetchAbsences = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/admin/clients/${user?.client_id || user?.id}/absences`, {
                headers: { 'Authorization': `Bearer ${token}` }
            }).then(r => r.json());
            if (!res.error) setAbsences(res);
        } catch(e) {} finally { setLoading(false); }
    };

    React.useEffect(() => {
        if (user) fetchAbsences();
    }, [user]);

    const handleAction = async (id: string, action: 'accept' | 'reject') => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/admin/clients/${user?.client_id || user?.id}/absences/${id}/${action}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            }).then(r => r.json());
            if (res.error) alert(res.error);
            else fetchAbsences();
        } catch(e) {}
    };

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
                <Calendar className="text-blue-500" size={32} />
                Demandes d'absences (Employés)
            </h1>

            <div className="bg-[#111111] rounded-2xl border border-white/10 p-6">
                {loading ? <p className="text-gray-400">Chargement...</p> : absences.length === 0 ? <p className="text-gray-400">Aucune demande.</p> : (
                    <div className="space-y-3">
                        {absences.map((a: any) => (
                            <div key={a.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border border-white/5 bg-black">
                                <div>
                                    <p className="font-bold text-white flex items-center gap-2">
                                        {a.first_name} {a.last_name} 
                                        <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded uppercase">{a.type}</span>
                                    </p>
                                    <p className="text-sm text-gray-400 mt-1">Du {new Date(a.start_date).toLocaleDateString('fr-FR')} au {new Date(a.end_date).toLocaleDateString('fr-FR')}</p>
                                    {a.comments && <p className="text-xs text-gray-500 mt-2 italic">"{a.comments}"</p>}
                                </div>
                                <div className="mt-4 md:mt-0 flex flex-col md:items-end gap-2">
                                    {a.status === 'pending' ? (
                                        <div className="flex gap-2">
                                            <button onClick={() => handleAction(a.id, 'reject')} className="px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded text-sm transition-colors">
                                                Refuser
                                            </button>
                                            <button onClick={() => handleAction(a.id, 'accept')} className="px-3 py-1.5 bg-green-500/10 text-green-400 hover:bg-green-500/20 rounded text-sm font-bold transition-colors">
                                                Accepter
                                            </button>
                                        </div>
                                    ) : (
                                        <span className={`px-3 py-1.5 rounded text-sm font-bold ${a.status === 'approved' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                            {a.status === 'approved' ? 'Acceptée' : 'Refusée'}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const App = () => (
    <Router>
        <AuthProvider>
            <Routes>
                <Route path="/login" element={<LoginView />} />
                <Route path="/*" element={
                    <Layout>
                        <Routes>
                            <Route path="/" element={<DashboardView />} />
                            <Route path="/planning" element={<PlanningModule />} />
                            <Route path="/crm" element={<CRMModule />} />
                            <Route path="/factures" element={<FacturesModule />} />
                            <Route path="/employe/portal" element={<EmployeePortal />} />
                            <Route path="/employe/absences" element={<EmployeeAbsenceModule />} />
                            <Route path="/employes" element={<PostesEmployesModule />} />
                            <Route path="/absences" element={<ClientAbsencesModule />} />
                            <Route path="/admin/sentinel" element={<SentinelJournal />} />
                            <Route path="/admin/clients" element={<AdminClientsView />} />
                            <Route path="/admin/clients/:id" element={<AdminClientDetailView />} />
                            <Route path="/admin/support" element={<SupportAdminView />} />
                            <Route path="/evenementiel" element={<EvenementielModule />} />
                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                    </Layout>
                } />
            </Routes>
        </AuthProvider>
    </Router>
);

export default App;
