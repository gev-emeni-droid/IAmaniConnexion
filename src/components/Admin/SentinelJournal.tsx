import React, { useState, useEffect } from 'react';
import {
    Shield,
    ShieldAlert,
    ShieldCheck,
    Info,
    Users,
    Search,
    Filter,
    Calendar,
    Clock,
    User,
    Building2,
    Activity,
    Briefcase,
    AlertTriangle,
    Eye,
    ArrowRight,
    RefreshCw,
    Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { adminApi } from '../../lib/api';

interface Log {
    id: string;
    user_id: string;
    target_user_id: string | null;
    client_id: string | null;
    action: string;
    category: 'GLOBAL' | 'SECURITE' | 'METIER' | 'SYSTEME';
    severity: 'success' | 'info' | 'warning' | 'alert';
    old_value: string | null;
    new_value: string | null;
    ip_address: string;
    user_agent: string | null;
    created_at: string;
    actor_name: string;
    actor_email: string;
    client_name: string | null;
    payload_json?: string | null;
    country?: string | null;
    city?: string | null;
}

const ACTION_TRANSLATIONS: Record<string, string> = {
    'LOGIN_SUCCESS': 'Connexion',
    'LOGIN_FAILED': 'Échec de connexion',
    'LOGIN_NOT_FOUND': 'Identifiant Inconnu',
    'LOGOUT': 'Déconnexion',
    'UPDATE_PASSWORD': 'Changement de mot de passe',
    'CREATE_EVENT': 'Nouvelle Réservation',
    'UPDATE_EVENT': 'Modification de réservation',
    'DELETE_EVENT': 'Suppression de réservation',
    'CREATE_INVOICE': 'Génération de facture',
    'SEND_INVOICE_EMAIL': 'Envoi de facture par email',
    'CREATE_EMPLOYE': 'Ajout de personnel',
    'CREATE_EMPLOYEE': 'Ajout de personnel',
    'UPDATE_EMPLOYE': 'Modification de fiche employé',
    'UPDATE_EMPLOYEE': 'Modification de fiche employé',
    'DELETE_EMPLOYE': 'Suppression de personnel',
    'DELETE_EMPLOYEE': 'Suppression de personnel',
    'VIEW_PLANNING': 'Consultation du planning',
    'UPDATE_PLANNING': 'Modification du planning',
    'PRINT_PLANNING': 'Impression de planning',
    'SYSTEM_ERROR': 'Erreur serveur',
    'NOT_FOUND': 'Page non trouvée',
    'DASHBOARD_ACCESS': 'Accès au Dashboard',
    'IMPERSONATE': 'Prise de contrôle admin',
    'UPDATE_IDENTIFIER': "Changement d'identifiant",
    'CREATE_CLIENT': 'Nouveau client plateforme',
    'UPDATE_CLIENT': 'Modification de fiche client',
    'DELETE_CLIENT': 'Suppression de client',
    'RATE_LIMIT': 'Sécurité : Trop de requêtes',
    'BOT_DETECTED': 'Sécurité : Robot détecté',
    'VIEW_CLIENT_CONFIG': 'Consultation de la configuration',
    'UPDATE_SETTINGS': 'Modification des horaires par défaut',
    'SEND_WELCOME_EMAIL': 'Envoi email bienvenue'
};

const getCountryNameAndFlag = (code: string) => {
    const countries: Record<string, { name: string; flag: string }> = {
        'FR': { name: 'France', flag: '🇫🇷' },
        'US': { name: 'États-Unis', flag: '🇺🇸' },
        'GB': { name: 'Royaume-Uni', flag: '🇬🇧' },
        'DE': { name: 'Allemagne', flag: '🇩🇪' },
        'ES': { name: 'Espagne', flag: '🇪🇸' },
        'IT': { name: 'Italie', flag: '🇮🇹' },
        'BE': { name: 'Belgique', flag: '🇧🇪' },
        'CH': { name: 'Suisse', flag: '🇨🇭' },
        'CA': { name: 'Canada', flag: '🇨🇦' },
    };
    const match = countries[code.toUpperCase()];
    if (match) return `${match.flag} ${match.name}`;
    return `🌍 ${code}`;
};

const parseUserAgent = (ua: string | null): string => {
    if (!ua) return 'Client Inconnu';
    const lower = ua.toLowerCase();
    
    let os = 'Machine Inconnue';
    if (lower.includes('macintosh') || lower.includes('mac os')) os = 'MacBook';
    else if (lower.includes('windows')) os = 'PC Windows';
    else if (lower.includes('iphone')) os = 'iPhone';
    else if (lower.includes('ipad')) os = 'iPad';
    else if (lower.includes('android')) os = 'Android';
    else if (lower.includes('linux')) os = 'Linux';

    let browser = 'Navigateur Inconnu';
    if (lower.includes('firefox')) browser = 'Firefox';
    else if (lower.includes('opr/') || lower.includes('opera')) browser = 'Opera';
    else if (lower.includes('edg/')) browser = 'Edge';
    else if (lower.includes('chrome') || lower.includes('chromium')) browser = 'Chrome';
    else if (lower.includes('safari') && !lower.includes('chrome')) browser = 'Safari';

    return `${os} - ${browser}`;
};

const CATEGORIES = [
    { id: 'GLOBAL', label: 'Global', icon: Activity },
    { id: 'SECURITE', label: 'Sécurité', icon: ShieldAlert },
    { id: 'METIER', label: 'Métier', icon: Briefcase },
    { id: 'SYSTEME', label: 'Système', icon: AlertTriangle }
];

// Re-using Briefcase from lucide doesn't always work if not imported, using a local icon or Briefcase if available
function BriefcaseIcon(props: any) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /><rect width="20" height="14" x="2" y="6" rx="2" /></svg>;
}

export const SentinelJournal = () => {
    const [logs, setLogs] = useState<Log[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState('GLOBAL');
    const [clients, setClients] = useState<any[]>([]);
    const [selectedClientId, setSelectedClientId] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

    const handleBanIp = async (ip: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (ip === 'unknown' || ip === '0.0.0.0') return;
        if (!window.confirm(`Êtes-vous sûr de vouloir bloquer définitivement l'adresse IP ${ip} ?\nToutes les requêtes de cette IP seront rejetées.`)) return;
        try {
            await adminApi.banIp(ip, 'Bloqué depuis le Sentinel Journal');
            alert(`L'IP ${ip} a été bannie avec succès.`);
        } catch (error: any) {
            alert('Erreur lors du blocage de l\'IP: ' + error.message);
        }
    };


    useEffect(() => {
        loadClients();
    }, []);

    useEffect(() => {
        let mounted = true;
        const controller = new AbortController();

        const doLoad = async () => {
            if (!mounted) return;
            await loadLogs();
        };

        doLoad();

        if (autoRefresh) {
            // 45s is plenty for a monitoring journal — avoids console spam
            const timer = setInterval(doLoad, 45000);
            return () => {
                mounted = false;
                controller.abort();
                clearInterval(timer);
            };
        }
        return () => {
            mounted = false;
            controller.abort();
        };
    }, [activeCategory, selectedClientId, autoRefresh]);

    const loadClients = async () => {
        try {
            const data = await adminApi.getClients();
            setClients(data);
        } catch (e) {
            console.error('Failed to load clients', e);
        }
    };

    const loadLogs = async () => {
        try {
            const data = await adminApi.getSentinelLogs(activeCategory === 'GLOBAL' ? '' : activeCategory, selectedClientId);
            setLogs(data);
        } catch (e: any) {
            // Silently ignore AbortError (navigation / cleanup)
            if (e?.name === 'AbortError' || e instanceof DOMException) return;
            // Only log genuine failures
            console.error('Failed to load logs', e);
        } finally {
            setLoading(false);
        }
    };

    const getSeverityStyles = (severity: string) => {
        switch (severity) {
            case 'success': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
            case 'warning': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
            case 'alert': return 'bg-red-500/10 text-red-500 border-red-500/20';
            default: return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
        }
    };

    const getSeverityDot = (severity: string) => {
        switch (severity) {
            case 'success': return 'bg-emerald-500';
            case 'warning': return 'bg-amber-500';
            case 'alert': return 'bg-red-500';
            default: return 'bg-blue-500';
        }
    };

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    const filteredLogs = logs.filter(log => {
        const search = searchTerm.toLowerCase();
        return (
            log.action.toLowerCase().includes(search) ||
            log.actor_name.toLowerCase().includes(search) ||
            log.actor_email.toLowerCase().includes(search) ||
            (log.client_name?.toLowerCase().includes(search)) ||
            (ACTION_TRANSLATIONS[log.action]?.toLowerCase().includes(search))
        );
    });

    return (
        <div className="space-y-6">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                            <Shield className="text-blue-500" size={20} />
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Journal Sentinel</h1>
                    </div>
                    <p className="text-[var(--text-muted)] text-sm">Centre de surveillance et audit en temps réel.</p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setAutoRefresh(!autoRefresh)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${autoRefresh
                                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                : 'bg-[var(--bg-soft)] text-[var(--text-muted)] border border-[var(--border-color)]'
                            }`}
                    >
                        <RefreshCw size={12} className={autoRefresh ? 'animate-spin' : ''} />
                        {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
                    </button>
                    <button className="p-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all">
                        <Download size={18} />
                    </button>
                </div>
            </header>

            {/* Filters Bar */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-4 shadow-sm">
                <div className="flex flex-col lg:flex-row gap-4">
                    {/* Tabs */}
                    <div className="flex bg-[var(--bg-app)] p-1 rounded-xl border border-[var(--border-color)] shrink-0">
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setActiveCategory(cat.id)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeCategory === cat.id
                                        ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                    }`}
                            >
                                <cat.icon size={16} />
                                {cat.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex-1 flex gap-3">
                        {/* Search */}
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={16} />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Rechercher un acteur, un client ou une action..."
                                className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-app)] border border-[var(--border-color)] rounded-xl text-sm outline-none focus:border-[var(--accent)] transition-all"
                            />
                        </div>

                        {/* Client Selector */}
                        <div className="w-64 relative">
                            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={16} />
                            <select
                                value={selectedClientId}
                                onChange={(e) => setSelectedClientId(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-app)] border border-[var(--border-color)] rounded-xl text-sm outline-none appearance-none cursor-pointer focus:border-[var(--accent)]"
                            >
                                <option value="">Tous les établissements</option>
                                {clients.map(c => (
                                    <option key={c.id} value={c.id}>{c.company_name || c.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Logs Table */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-[var(--bg-soft)]/50 border-b border-[var(--border-color)]">
                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Horodatage</th>
                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Action</th>
                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Acteur</th>
                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Établissement</th>
                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Détails</th>
                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] text-right">IP</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-color)]">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-20 text-center">
                                        <RefreshCw className="mx-auto animate-spin text-[var(--text-muted)] mb-3" size={24} />
                                        <p className="text-[var(--text-muted)] text-sm">Chargement des logs...</p>
                                    </td>
                                </tr>
                            ) : filteredLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-20 text-center">
                                        <Info className="mx-auto text-[var(--text-muted)] mb-3" size={32} />
                                        <p className="text-[var(--text-muted)] text-sm">Aucun événement détecté.</p>
                                    </td>
                                </tr>
                            ) : filteredLogs.map((log) => (
                                <React.Fragment key={log.id}>
                                <motion.tr
                                    layout
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                                    className="hover:bg-[var(--bg-soft)]/30 transition-colors group cursor-pointer"
                                >
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-1.5 h-1.5 rounded-full ${getSeverityDot(log.severity)}`} />
                                            <div>
                                                <div className="text-sm font-bold text-[var(--text-primary)]">{formatDate(log.created_at).split(' ')[1]}</div>
                                                <div className="text-[10px] text-[var(--text-muted)]">{formatDate(log.created_at).split(' ')[0]}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getSeverityStyles(log.severity)}`}>
                                            {ACTION_TRANSLATIONS[log.action] || 'Action système'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-[var(--bg-app)] border border-[var(--border-color)] flex items-center justify-center">
                                                <User size={14} className="text-[var(--text-muted)]" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-sm font-bold text-[var(--text-primary)] truncate">
                                                    {log.actor_name === 'system' || log.user_id === 'system' || log.user_id === 'système' ? 'Système' : log.actor_name}
                                                </div>
                                                <div className="text-[10px] text-[var(--text-muted)] truncate">
                                                    {log.actor_email && log.actor_email !== 'system@iamani.com' ? log.actor_email : ''}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {log.client_name ? (
                                            <div className="flex items-center gap-2 text-[var(--text-primary)]">
                                                <Building2 size={14} className="text-blue-500" />
                                                <span className="text-sm font-medium">{log.client_name}</span>
                                            </div>
                                        ) : (
                                            <span className="text-[var(--text-muted)] text-xs italic">Plateforme</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm text-[var(--text-primary)] max-w-md">
                                            {log.new_value || 'Aucun détail disponible'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex flex-col items-end gap-1">
                                            <div className="flex items-center gap-2">
                                                <div className="text-[10px] font-mono text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors">
                                                    {log.ip_address === 'unknown' || log.ip_address === '0.0.0.0' ? 'Non renseignée' : log.ip_address}
                                                </div>
                                                {log.ip_address && log.ip_address !== 'unknown' && log.ip_address !== '0.0.0.0' && (
                                                    <button 
                                                        onClick={(e) => handleBanIp(log.ip_address, e)}
                                                        className="text-red-500 hover:bg-red-500/10 p-1 rounded transition-colors"
                                                        title="Bannir cette IP"
                                                    >
                                                        <ShieldAlert size={14} />
                                                    </button>
                                                )}
                                            </div>
                                             <div className="text-[10px] text-[var(--text-muted)] flex flex-col items-end gap-0.5" title={log.user_agent || ''}>
                                                 <div>
                                                     {log.country ? getCountryNameAndFlag(log.country) : ''}
                                                     {log.city ? ` (${log.city})` : ''}
                                                 </div>
                                                 <div>{parseUserAgent(log.user_agent)}</div>
                                             </div>
                                         </div>
                                    </td>
                                </motion.tr>
                                {expandedLogId === log.id && (
                                    <tr className="bg-[var(--bg-soft)]/20 border-b border-[var(--border-color)]">
                                        <td colSpan={6} className="px-6 py-4">
                                            <div className="text-xs text-[var(--text-muted)] mb-2 font-bold uppercase tracking-wider">Payload / Détails (JSON)</div>
                                            <pre className="text-[10px] font-mono bg-[var(--bg-app)] text-[var(--text-primary)] p-4 rounded-xl overflow-x-auto whitespace-pre-wrap break-all border border-[var(--border-color)]">
                                                {log.payload_json ? (
                                                    JSON.stringify(JSON.parse(log.payload_json), null, 2)
                                                ) : (
                                                    log.new_value || 'Aucun détail JSON disponible pour cette action.'
                                                )}
                                            </pre>
                                        </td>
                                    </tr>
                                )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
