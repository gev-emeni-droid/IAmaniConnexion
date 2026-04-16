import React, { useState, useEffect } from 'react';
import { moduleApi } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { 
    Calendar as CalendarIcon, 
    Plus, 
    Archive, 
    Folder,
    FolderOpen,
    Clock, 
    Users, 
    MapPin, 
    ChevronRight,
    AlertCircle,
    CheckCircle2,
    History,
    X,
    Building2,
    User,
    UserCheck,
    Settings,
    ChevronDown,
    Search,
    Check,
    Save,
    ToggleLeft,
    ToggleRight,
    Send,
    Phone,
    Mail,
    Trash2,
    MoreHorizontal
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { EventForm } from './EventForm';
import { MonthlyCalendar } from './MonthlyCalendar';

interface Calendar {
    id: string;
    month: number;
    year: number;
    status: 'OPEN' | 'ARCHIVED';
    created_at: string;
}

const MONTHS = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

export const EvenementielModule = () => {
    const { user } = useAuth();
    const [calendars, setCalendars] = useState<Calendar[]>([]);
    const [selectedCalendar, setSelectedCalendar] = useState<Calendar | null>(null);
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showEventForm, setShowEventForm] = useState(false);
    const [showNewCalendarModal, setShowNewCalendarModal] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
    const [editingEvent, setEditingEvent] = useState<any | null>(null);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [staffTypes, setStaffTypes] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [mappingByCategory, setMappingByCategory] = useState<Record<string, string[]>>({});
    const [trackTakenBy, setTrackTakenBy] = useState(false);
    const [allowedTakerIds, setAllowedTakerIds] = useState<string[]>([]);
    const [notifyRecipientIds, setNotifyRecipientIds] = useState<string[]>([]);
    const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);
    const [showTakerSelector, setShowTakerSelector] = useState(false);
    const [showNotifySelector, setShowNotifySelector] = useState(false);
    const [takerSearch, setTakerSearch] = useState('');
    const [notifySearch, setNotifySearch] = useState('');
    const [showNotifyModal, setShowNotifyModal] = useState(false);
    const [selectedNotifyIds, setSelectedNotifyIds] = useState<string[]>([]);
    const [sendingNotifications, setSendingNotifications] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [savingMappings, setSavingMappings] = useState(false);
    const [settingsLoading, setSettingsLoading] = useState(false);
    const [settingsError, setSettingsError] = useState('');
    const [newCalendar, setNewCalendar] = useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear() });
    const [configSpaces, setConfigSpaces] = useState<{ id: string; name: string; color: string }[]>([]);
    const [calendarMenuPos, setCalendarMenuPos] = useState<{ id: string; x: number; y: number } | null>(null);
    const [confirmAction, setConfirmAction] = useState<{ type: 'deleteCalendar' | 'archiveCalendar' | 'deleteEvent'; id: string; label: string } | null>(null);
    const [calendarSection, setCalendarSection] = useState<'active' | 'archives'>('active');
    const [openArchiveYears, setOpenArchiveYears] = useState<Record<number, boolean>>({});

    const normalizeIdList = (value: any): string[] => {
        if (!Array.isArray(value)) return [];
        return value
            .map((id) => String(id))
            .filter((id) => id.trim().length > 0);
    };

    const activeCalendars = calendars.filter((c) => c.status !== 'ARCHIVED');
    const archivedCalendars = calendars.filter((c) => c.status === 'ARCHIVED');
    const hasArchivedCalendars = archivedCalendars.length > 0;
    const archivesByYear = archivedCalendars.reduce<Record<number, Calendar[]>>((acc, cal) => {
        if (!acc[cal.year]) acc[cal.year] = [];
        acc[cal.year].push(cal);
        return acc;
    }, {});
    const archiveYears = Object.keys(archivesByYear)
        .map((y) => Number(y))
        .sort((a, b) => b - a);

    useEffect(() => {
        loadCalendars();
    }, []);

    useEffect(() => {
        if (user?.id) {
            loadConfigSpaces();
        }
    }, [user?.id]);

    useEffect(() => {
        if (selectedCalendar) {
            loadEvents(selectedCalendar.id);
        }
    }, [selectedCalendar]);

    useEffect(() => {
        if (showSettingsModal) {
            loadStaffMappings();
        }
    }, [showSettingsModal]);

    useEffect(() => {
        if (!calendarMenuPos) return;
        const close = () => setCalendarMenuPos(null);
        document.addEventListener('click', close);
        return () => document.removeEventListener('click', close);
    }, [calendarMenuPos]);

    useEffect(() => {
        if (calendarSection === 'archives' && !hasArchivedCalendars) {
            setCalendarSection('active');
        }
    }, [calendarSection, hasArchivedCalendars]);

    const loadCalendars = async () => {
        setLoading(true);
        try {
            const data = await moduleApi.getEvenementielCalendars();
            setCalendars(data);
            if (data.length > 0) {
                const refreshedSelected = selectedCalendar ? data.find((c: Calendar) => c.id === selectedCalendar.id) : null;
                if (refreshedSelected) {
                    setSelectedCalendar(refreshedSelected);
                    setCalendarSection(refreshedSelected.status === 'ARCHIVED' ? 'archives' : 'active');
                } else {
                    const defaultCalendar = data.find((c: Calendar) => c.status !== 'ARCHIVED') || data[0];
                    setSelectedCalendar(defaultCalendar);
                    setCalendarSection(defaultCalendar.status === 'ARCHIVED' ? 'archives' : 'active');
                }
            } else {
                setSelectedCalendar(null);
                setCalendarSection('active');
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const loadEvents = async (id: string) => {
        try {
            const data = await moduleApi.getEvenementielCalendarEvents(id);
            setEvents(data);
        } catch (e) {
            console.error(e);
        }
    };

    const loadConfigSpaces = async () => {
        try {
            const [config, directSpaces, emps] = await Promise.all([
                moduleApi.getEvenementielConfig(),
                moduleApi.getEvenementielSpaces().catch(() => []),
                moduleApi.getEmployes().catch(() => [])
            ]);

            const fromConfig = Array.isArray(config?.spaces) ? config.spaces : [];
            const fromDirect = Array.isArray(directSpaces) ? directSpaces : [];
            const merged = fromConfig.length > 0 ? fromConfig : fromDirect;

            const spaces = merged.map((s: any) => ({
                id: String(s.id),
                name: String(s.name || 'Espace'),
                color: String(s.color_hex || s.color || '#3b82f6'),
            }));
            setConfigSpaces(spaces);
            setEmployees(Array.isArray(emps) ? emps : []);
            setNotifyRecipientIds(normalizeIdList(config?.notify_recipient_employee_ids));
        } catch (e) {
            console.error('Erreur chargement espaces config:', e);
        }
    };

    const handleDeleteCalendar = async (id: string) => {
        try {
            await moduleApi.deleteEvenementielCalendar(id);
            setConfirmAction(null);
            if (selectedCalendar?.id === id) setSelectedCalendar(null);
            loadCalendars();
            setToastMessage('Calendrier supprimé.');
            setTimeout(() => setToastMessage(''), 2500);
        } catch (e: any) {
            setToastMessage(e?.message || 'Erreur lors de la suppression.');
            setTimeout(() => setToastMessage(''), 3000);
        }
    };

    const handleToggleArchiveCalendar = async (id: string) => {
        try {
            const result = await moduleApi.archiveEvenementielCalendar(id);
            setConfirmAction(null);
            loadCalendars();
            setToastMessage(result?.status === 'ARCHIVED' ? 'Calendrier archivé.' : 'Calendrier réouvert.');
            setTimeout(() => setToastMessage(''), 2500);
        } catch (e: any) {
            setToastMessage(e?.message || 'Erreur lors de l\'archivage.');
            setTimeout(() => setToastMessage(''), 3000);
        }
    };

    const handleDeleteEvent = async (id: string) => {
        try {
            await moduleApi.deleteEvenementiel(id);
            setConfirmAction(null);
            setSelectedEvent(null);
            if (selectedCalendar) loadEvents(selectedCalendar.id);
            setToastMessage('Privatisation supprimée.');
            setTimeout(() => setToastMessage(''), 2500);
        } catch (e: any) {
            setToastMessage(e?.message || 'Erreur lors de la suppression.');
            setTimeout(() => setToastMessage(''), 3000);
        }
    };

    const loadStaffMappings = async () => {
        setSettingsLoading(true);
        setSettingsError('');
        try {
            const [config, emps, mappings] = await Promise.all([
                moduleApi.getEvenementielConfig(),
                moduleApi.getEmployes(),
                moduleApi.getStaffCategoryMappings()
            ]);

            const staff = config?.authorized_staff_categories || [];

            setStaffTypes(staff);
            setEmployees(emps);
            setTrackTakenBy(!!config?.track_taken_by);
            setAllowedTakerIds(normalizeIdList(config?.allowed_taker_employee_ids));
            setNotifyRecipientIds(normalizeIdList(config?.notify_recipient_employee_ids));

            const grouped: Record<string, string[]> = {};
            staff.forEach((category: any) => {
                grouped[category.id] = [];
            });
            (mappings || []).forEach((row: any) => {
                if (!grouped[row.staff_category_id]) {
                    grouped[row.staff_category_id] = [];
                }
                grouped[row.staff_category_id].push(row.employee_id);
            });
            setMappingByCategory(grouped);
        } catch (e: any) {
            setSettingsError(e?.message || 'Impossible de charger le mapping staff.');
        } finally {
            setSettingsLoading(false);
        }
    };

    const employeeName = (employee: any) => {
        const fullName = [employee.first_name, employee.last_name].filter(Boolean).join(' ').trim();
        return fullName || employee.name || employee.email || employee.id;
    };

    const toggleMappedEmployee = (staffCategoryId: string, employeeId: string) => {
        setMappingByCategory(prev => {
            const current = prev[staffCategoryId] || [];
            const next = current.includes(employeeId)
                ? current.filter(id => id !== employeeId)
                : [...current, employeeId];
            return { ...prev, [staffCategoryId]: next };
        });
    };

    const handleSaveMappings = async () => {
        setSavingMappings(true);
        setSettingsError('');
        try {
            const payload = staffTypes.map((category: any) => ({
                staff_category_id: category.id,
                employee_ids: mappingByCategory[category.id] || []
            }));
            await Promise.all([
                moduleApi.saveStaffCategoryMappings(payload),
                moduleApi.saveEvenementielConfig({
                    track_taken_by: trackTakenBy,
                    allowed_taker_employee_ids: allowedTakerIds,
                    notify_recipient_employee_ids: notifyRecipientIds
                })
            ]);
            setShowSettingsModal(false);
            setToastMessage('Paramètres enregistrés avec succès.');
            setTimeout(() => setToastMessage(''), 2800);
        } catch (e: any) {
            setSettingsError(e?.message || 'Impossible d\'enregistrer le mapping staff.');
        } finally {
            setSavingMappings(false);
        }
    };

    const toggleAllowedTaker = (employeeId: string) => {
        setAllowedTakerIds((prev) => (
            prev.includes(employeeId)
                ? prev.filter((id) => id !== employeeId)
                : [...prev, employeeId]
        ));
    };

    const toggleNotifyRecipient = (employeeId: string) => {
        const normalizedId = String(employeeId);
        setNotifyRecipientIds((prev) => (
            prev.includes(normalizedId)
                ? prev.filter((id) => id !== normalizedId)
                : [...prev, normalizedId]
        ));
    };

    const eligibleNotifyEmployees = employees.filter((emp: any) => {
        const hasEmail = !!String(emp.email || '').trim();
        return hasEmail;
    });

    const filteredTakerEmployees = employees.filter((emp: any) => {
        const term = takerSearch.trim().toLowerCase();
        if (!term) return true;
        const fullName = employeeName(emp).toLowerCase();
        const email = String(emp.email || '').toLowerCase();
        return fullName.includes(term) || email.includes(term);
    });

    const filteredNotifyEmployees = eligibleNotifyEmployees.filter((emp: any) => {
        const term = notifySearch.trim().toLowerCase();
        if (!term) return true;
        const fullName = employeeName(emp).toLowerCase();
        const email = String(emp.email || '').toLowerCase();
        return fullName.includes(term) || email.includes(term);
    });

    const openNotifyModal = () => {
        setSelectedNotifyIds(notifyRecipientIds);
        setShowNotifyModal(true);
    };

    const sendCalendarNotifications = async () => {
        if (!selectedCalendar) return;
        if (selectedNotifyIds.length === 0) {
            setToastMessage('Sélectionnez au moins un destinataire.');
            setTimeout(() => setToastMessage(''), 2800);
            return;
        }

        try {
            setSendingNotifications(true);
            const result = await moduleApi.notifyEvenementielUpdate({
                calendar_id: selectedCalendar.id,
                recipient_ids: selectedNotifyIds
            });
            setShowNotifyModal(false);
            setToastMessage(`Notifications envoyées (${result?.sent || 0}).`);
            setTimeout(() => setToastMessage(''), 3000);
        } catch (e: any) {
            setToastMessage(e?.message || 'Erreur lors de l\'envoi des notifications.');
            setTimeout(() => setToastMessage(''), 3500);
        } finally {
            setSendingNotifications(false);
        }
    };

    const handleCreateCalendar = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await moduleApi.createEvenementielCalendar(newCalendar);
            setShowNewCalendarModal(false);
            loadCalendars();
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleMonthChange = (month: number, year: number) => {
        const cal = calendars.find(c => c.month === month && c.year === year);
        if (cal) {
            setSelectedCalendar(cal);
        } else {
            setNewCalendar({ month, year });
            setShowNewCalendarModal(true);
        }
    };

    return (
        <div className="space-y-10">
            <header className="no-print flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-[var(--text-primary)] tracking-tight">Module Événementiel</h1>
                    <p className="text-[var(--text-muted)] mt-1">
                        Gérez vos privatisations et votre staffing
                        {selectedCalendar && (
                            <span className="ml-2 text-[10px] bg-white/5 px-2 py-0.5 rounded border border-white/5">
                                Créé le {new Date(selectedCalendar.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </span>
                        )}
                    </p>
                </div>
                <div className="flex gap-4">
                    {user?.type !== 'admin' && (
                        <button
                            onClick={() => setShowSettingsModal(true)}
                            className="flex items-center gap-2 px-6 py-3 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] font-bold hover:bg-[var(--interactive-hover)] transition-all"
                        >
                            <Settings size={20} />
                            <span>Paramètres</span>
                        </button>
                    )}
                    <button 
                        onClick={() => setShowNewCalendarModal(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] font-bold hover:bg-[var(--interactive-hover)] transition-all"
                    >
                        <CalendarIcon size={20} />
                        <span>Nouveau Calendrier</span>
                    </button>
                    {selectedCalendar && selectedCalendar.status === 'OPEN' && (
                        <button 
                            onClick={() => {
                                setEditingEvent(null);
                                setShowEventForm(true);
                            }}
                            className="flex items-center gap-2 px-6 py-3 bg-[var(--text-primary)] text-[var(--bg-card)] rounded-xl font-bold hover:opacity-90 transition-all shadow-lg"
                        >
                            <Plus size={20} />
                            <span>Nouvelle Privatisation</span>
                        </button>
                    )}
                </div>
            </header>

            {/* Calendar Sections */}
            <div className="no-print space-y-4">
                <div className="flex items-center gap-2 bg-[var(--bg-card)] p-1 rounded-xl border border-[var(--border-color)] w-fit">
                    <button
                        onClick={() => setCalendarSection('active')}
                        className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${calendarSection === 'active' ? 'bg-[var(--text-primary)] text-[var(--bg-card)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                    >
                        Calendriers Actifs
                    </button>
                    {hasArchivedCalendars && (
                        <button
                            onClick={() => setCalendarSection('archives')}
                            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${calendarSection === 'archives' ? 'bg-[var(--text-primary)] text-[var(--bg-card)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                        >
                            Archives
                        </button>
                    )}
                </div>

                {calendarSection === 'active' && (
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {activeCalendars.map((cal) => (
                            <div key={cal.id} className="flex-shrink-0">
                                <div className={`flex items-center rounded-xl border transition-all text-xs font-bold overflow-hidden ${
                                    selectedCalendar?.id === cal.id
                                        ? 'bg-[var(--text-primary)] border-[var(--text-primary)] text-[var(--bg-card)] shadow-lg'
                                        : 'bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-muted)] hover:border-[var(--text-muted)]'
                                }`}>
                                    <button
                                        onClick={() => {
                                            setSelectedCalendar(cal);
                                            setCalendarSection('active');
                                        }}
                                        className="px-4 py-2"
                                    >
                                        {MONTHS[cal.month - 1]} {cal.year}
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (calendarMenuPos?.id === cal.id) {
                                                setCalendarMenuPos(null);
                                            } else {
                                                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                                setCalendarMenuPos({ id: cal.id, x: rect.left, y: rect.bottom + 4 });
                                            }
                                        }}
                                        className={`px-2 py-2 border-l transition-all ${
                                            selectedCalendar?.id === cal.id ? 'border-black/10 hover:bg-black/10' : 'border-white/10 hover:bg-white/10'
                                        }`}
                                    >
                                        <MoreHorizontal size={12} />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {activeCalendars.length === 0 && (
                            <div className="text-xs text-gray-500 px-2 py-3">Aucun calendrier actif.</div>
                        )}
                    </div>
                )}

                {calendarSection === 'archives' && hasArchivedCalendars && (
                    <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] p-4 space-y-3">
                        {archiveYears.map((year) => {
                            const yearCalendars = [...archivesByYear[year]].sort((a, b) => a.month - b.month);
                            const isOpen = openArchiveYears[year] ?? true;
                            return (
                                <div key={year} className="border border-[var(--border-color)] rounded-xl overflow-hidden">
                                    <button
                                        onClick={() => setOpenArchiveYears((prev) => ({ ...prev, [year]: !isOpen }))}
                                        className="w-full flex items-center justify-between px-4 py-3 bg-[var(--interactive-hover)] hover:brightness-95 transition-all"
                                    >
                                        <div className="flex items-center gap-2">
                                            {isOpen ? <FolderOpen size={16} className="text-amber-400" /> : <Folder size={16} className="text-amber-400" />}
                                            <span className="text-sm font-bold text-[var(--text-primary)]">{year}</span>
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--interactive-hover)] text-[var(--text-muted)]">{yearCalendars.length}</span>
                                        </div>
                                        <ChevronDown size={14} className={`text-[var(--text-muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                                    </button>
                                    {isOpen && (
                                        <div className="p-2 space-y-1 bg-[var(--bg-card)]">
                                            {yearCalendars.map((cal) => (
                                                <div key={cal.id} className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setSelectedCalendar(cal);
                                                            setCalendarSection('archives');
                                                        }}
                                                        className={`flex-1 text-left px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                                                            selectedCalendar?.id === cal.id
                                                                ? 'bg-[var(--text-primary)] text-[var(--bg-card)]'
                                                                : 'bg-transparent text-[var(--text-muted)] hover:bg-[var(--interactive-hover)] hover:text-[var(--text-primary)]'
                                                        }`}
                                                    >
                                                        {MONTHS[cal.month - 1]} {cal.year}
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (calendarMenuPos?.id === cal.id) {
                                                                setCalendarMenuPos(null);
                                                            } else {
                                                                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                                                setCalendarMenuPos({ id: cal.id, x: rect.left, y: rect.bottom + 4 });
                                                            }
                                                        }}
                                                        className="px-2 py-2 rounded-lg border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--interactive-hover)]"
                                                    >
                                                        <MoreHorizontal size={12} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Dropdown menu calendrier (fixed pour échapper au overflow-x-auto) */}
            {calendarMenuPos && (() => {
                const cal = calendars.find(c => c.id === calendarMenuPos.id);
                if (!cal) return null;
                return (
                    <div
                        className="fixed z-50 w-44 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-2xl overflow-hidden"
                        style={{ top: calendarMenuPos.y, left: calendarMenuPos.x }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={() => {
                                setCalendarMenuPos(null);
                                handleToggleArchiveCalendar(cal.id);
                            }}
                            className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-[var(--text-primary)] hover:bg-[var(--interactive-hover)] transition-all"
                        >
                            <Archive size={13} />
                            {cal.status === 'ARCHIVED' ? 'Désarchiver' : 'Archiver'}
                        </button>
                        <button
                            onClick={() => {
                                setCalendarMenuPos(null);
                                setConfirmAction({ type: 'deleteCalendar', id: cal.id, label: `${MONTHS[cal.month - 1]} ${cal.year}` });
                            }}
                            className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-red-400 hover:bg-red-500/10 transition-all"
                        >
                            <Trash2 size={13} />
                            Supprimer
                        </button>
                    </div>
                );
            })()}

            {/* Main Calendar View */}
            {selectedCalendar ? (
                <MonthlyCalendar 
                    month={selectedCalendar.month}
                    year={selectedCalendar.year}
                    events={events}
                    configSpaces={configSpaces}
                    onMonthChange={handleMonthChange}
                    onEventClick={setSelectedEvent}
                    onNotifyUpdate={user?.type !== 'admin' ? openNotifyModal : undefined}
                    notifyDisabled={notifyRecipientIds.length === 0}
                />
            ) : (
                <div className="py-40 text-center bg-[var(--bg-card)] rounded-3xl border border-dashed border-[var(--border-color)]">
                    <CalendarIcon size={48} className="text-gray-700 mx-auto mb-4" />
                    <p className="text-[var(--text-muted)] font-medium">Sélectionnez ou créez un calendrier pour commencer</p>
                </div>
            )}

            {/* Modals */}
            <AnimatePresence>
                {showEventForm && selectedCalendar && (
                    <EventForm 
                        calendarId={selectedCalendar.id}
                        month={selectedCalendar.month}
                        year={selectedCalendar.year}
                        initialEvent={editingEvent}
                        onClose={() => {
                            setShowEventForm(false);
                            setEditingEvent(null);
                        }}
                        onSuccess={() => {
                            setShowEventForm(false);
                            setEditingEvent(null);
                            loadEvents(selectedCalendar.id);
                        }}
                    />
                )}

                {showSettingsModal && (
                    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-6 overflow-y-auto">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="w-full max-w-5xl bg-[var(--bg-card)] rounded-3xl border border-[var(--border-color)] shadow-2xl overflow-hidden"
                        >
                            <div className="p-8 border-b border-[var(--border-color)] bg-[var(--interactive-hover)] flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-bold text-[var(--text-primary)]">Paramètres Événementiel</h2>
                                    <p className="text-sm text-[var(--text-muted)] mt-1">Mapping du Staff entre catégories autorisées et employés internes.</p>
                                </div>
                                <button onClick={() => setShowSettingsModal(false)} className="p-2 rounded-full text-[var(--text-muted)] hover:bg-[var(--interactive-hover)]">
                                    <X size={22} />
                                </button>
                            </div>

                            <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                                {settingsError && (
                                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                                        {settingsError}
                                    </div>
                                )}

                                <section className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400">Mapping du Staff</h3>
                                        <span className="text-xs text-gray-600">{staffTypes.length} catégories</span>
                                    </div>

                                    {settingsLoading ? (
                                        <div className="p-6 rounded-2xl border border-white/10 text-gray-500">Chargement...</div>
                                    ) : staffTypes.length === 0 ? (
                                        <div className="p-6 rounded-2xl border border-white/10 text-gray-500">
                                            Aucune catégorie de staff disponible pour ce client.
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {staffTypes.map((category: any) => {
                                                const selectedIds = mappingByCategory[category.id] || [];
                                                const selectedEmployees = employees.filter((emp: any) => selectedIds.includes(emp.id));

                                                return (
                                                    <div key={category.id} className="bg-black/70 border border-white/10 rounded-2xl p-5 space-y-4">
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <p className="text-white font-bold">{category.name}</p>
                                                                <p className="text-xs text-gray-500">Choisissez les employés autorisés pour cette catégorie.</p>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => setOpenCategoryId(openCategoryId === category.id ? null : category.id)}
                                                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 text-gray-300 hover:bg-white/5 text-xs font-bold"
                                                            >
                                                                <span>Sélectionner</span>
                                                                <ChevronDown size={14} className={`${openCategoryId === category.id ? 'rotate-180' : ''} transition-transform`} />
                                                            </button>
                                                        </div>

                                                        {openCategoryId === category.id && (
                                                            <div className="bg-[#050505] border border-white/10 rounded-xl p-3 max-h-52 overflow-y-auto space-y-2">
                                                                {employees.length === 0 && (
                                                                    <p className="text-xs text-gray-500">Aucun employé client disponible.</p>
                                                                )}
                                                                {employees.map((emp: any) => {
                                                                    const selected = selectedIds.includes(emp.id);
                                                                    return (
                                                                        <button
                                                                            key={emp.id}
                                                                            type="button"
                                                                            onClick={() => toggleMappedEmployee(category.id, emp.id)}
                                                                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-left text-sm transition-all ${
                                                                                selected
                                                                                    ? 'bg-white text-black border-white'
                                                                                    : 'bg-black border-white/10 text-gray-300 hover:bg-white/5'
                                                                            }`}
                                                                        >
                                                                            <span>{employeeName(emp)}</span>
                                                                            {selected && <Check size={14} />}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}

                                                        <div className="flex flex-wrap gap-2">
                                                            {selectedEmployees.length === 0 ? (
                                                                <span className="text-xs text-gray-600">Aucun employé sélectionné.</span>
                                                            ) : selectedEmployees.map((emp: any) => (
                                                                <span key={`${category.id}-${emp.id}`} className="inline-flex items-center px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs text-white font-medium">
                                                                    {employeeName(emp)}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </section>

                                <section className="space-y-4 pt-4 border-t border-white/10">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400">Suivi Pris Par</h3>
                                            <p className="text-xs text-gray-500 mt-1">Active la sélection d'un preneur lors de la création d'une privatisation.</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setTrackTakenBy((prev) => !prev)}
                                            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${trackTakenBy ? 'border-green-400/40 bg-green-500/10 text-green-300' : 'border-white/15 text-gray-300 hover:bg-white/5'}`}
                                        >
                                            {trackTakenBy ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                                            <span className="text-xs font-bold">Activer le suivi 'Pris par'</span>
                                        </button>
                                    </div>

                                    {trackTakenBy && (
                                        <div className="bg-black/70 border border-white/10 rounded-2xl p-5 space-y-4">
                                            <div className="flex items-center justify-between">
                                                <p className="text-white font-bold">Employés autorisés comme "Preneur"</p>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowTakerSelector((prev) => !prev)}
                                                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 text-gray-300 hover:bg-white/5 text-xs font-bold"
                                                >
                                                    <span>Sélectionner</span>
                                                    <ChevronDown size={14} className={`${showTakerSelector ? 'rotate-180' : ''} transition-transform`} />
                                                </button>
                                            </div>

                                            {showTakerSelector && (
                                                <div className="bg-[#050505] border border-white/10 rounded-xl p-3 max-h-52 overflow-y-auto space-y-2">
                                                    <div className="relative mb-2">
                                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                                                        <input
                                                            value={takerSearch}
                                                            onChange={(e) => setTakerSearch(e.target.value)}
                                                            placeholder="Rechercher un employé..."
                                                            className="w-full bg-black border border-white/10 rounded-lg pl-8 pr-3 py-2 text-xs text-white outline-none focus:border-white"
                                                        />
                                                    </div>
                                                    {filteredTakerEmployees.length === 0 && <p className="text-xs text-gray-500">Aucun employé disponible.</p>}
                                                    {filteredTakerEmployees.map((emp: any) => {
                                                        const selected = allowedTakerIds.includes(emp.id);
                                                        return (
                                                            <button
                                                                key={`taker-${emp.id}`}
                                                                type="button"
                                                                onClick={() => toggleAllowedTaker(emp.id)}
                                                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-left text-sm transition-all ${selected ? 'bg-white text-black border-white' : 'bg-black border-white/10 text-gray-300 hover:bg-white/5'}`}
                                                            >
                                                                <span>{employeeName(emp)}</span>
                                                                {selected && <Check size={14} />}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            <div className="flex flex-wrap gap-2">
                                                {allowedTakerIds.length === 0 ? (
                                                    <span className="text-xs text-gray-600">Aucun preneur autorisé sélectionné.</span>
                                                ) : employees
                                                    .filter((emp: any) => allowedTakerIds.includes(emp.id))
                                                    .map((emp: any) => (
                                                        <span key={`badge-taker-${emp.id}`} className="inline-flex items-center px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs text-white font-medium">
                                                            {employeeName(emp)}
                                                        </span>
                                                    ))}
                                            </div>
                                        </div>
                                    )}
                                </section>

                                <section className="space-y-4 pt-4 border-t border-white/10">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400">Destinataires des notifications</h3>
                                            <p className="text-xs text-gray-500 mt-1">Sélectionnez les employés éligibles pour recevoir les emails de mise à jour du calendrier.</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setShowNotifySelector((prev) => !prev)}
                                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 text-gray-300 hover:bg-white/5 text-xs font-bold"
                                        >
                                            <span>Sélectionner</span>
                                            <ChevronDown size={14} className={`${showNotifySelector ? 'rotate-180' : ''} transition-transform`} />
                                        </button>
                                    </div>

                                    {showNotifySelector && (
                                        <div className="bg-[#050505] border border-white/10 rounded-xl p-3 max-h-52 overflow-y-auto space-y-2">
                                            <div className="relative mb-2">
                                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                                                <input
                                                    value={notifySearch}
                                                    onChange={(e) => setNotifySearch(e.target.value)}
                                                    placeholder="Rechercher un destinataire..."
                                                    className="w-full bg-black border border-white/10 rounded-lg pl-8 pr-3 py-2 text-xs text-white outline-none focus:border-white"
                                                />
                                            </div>
                                            {filteredNotifyEmployees.length === 0 && <p className="text-xs text-gray-500">Aucun employé avec email disponible.</p>}
                                            {filteredNotifyEmployees.map((emp: any) => {
                                                const selected = notifyRecipientIds.includes(String(emp.id));
                                                return (
                                                    <button
                                                        key={`notify-${emp.id}`}
                                                        type="button"
                                                        onClick={() => toggleNotifyRecipient(String(emp.id))}
                                                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-left text-sm transition-all ${selected ? 'bg-white text-black border-white' : 'bg-black border-white/10 text-gray-300 hover:bg-white/5'}`}
                                                    >
                                                        <span>{employeeName(emp)} ({emp.email})</span>
                                                        {selected && <Check size={14} />}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}

                                    <div className="flex flex-wrap gap-2">
                                        {notifyRecipientIds.length === 0 ? (
                                            <span className="text-xs text-gray-600">Aucun destinataire sélectionné.</span>
                                        ) : eligibleNotifyEmployees
                                            .filter((emp: any) => notifyRecipientIds.includes(String(emp.id)))
                                            .map((emp: any) => (
                                                <span key={`badge-notify-${emp.id}`} className="inline-flex items-center px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs text-white font-medium">
                                                    {employeeName(emp)}
                                                </span>
                                            ))}
                                    </div>
                                </section>
                            </div>

                            <div className="p-6 border-t border-[var(--border-color)] bg-[var(--interactive-hover)] flex justify-end gap-3">
                                <button
                                    onClick={() => setShowSettingsModal(false)}
                                    className="px-5 py-3 rounded-xl font-bold border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--interactive-hover)]"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={handleSaveMappings}
                                    disabled={savingMappings || settingsLoading}
                                    className="px-5 py-3 rounded-xl font-bold bg-[var(--text-primary)] text-[var(--bg-card)] hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
                                >
                                    <Save size={16} />
                                    <span>{savingMappings ? 'Enregistrement...' : 'Enregistrer le mapping'}</span>
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}

                {selectedEvent && (
                    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-6">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="w-full max-w-2xl bg-[var(--bg-card)] rounded-3xl border border-[var(--border-color)] overflow-hidden shadow-2xl"
                        >
                            <div className="p-8 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--interactive-hover)]">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-[var(--interactive-hover)] rounded-2xl flex items-center justify-center border border-[var(--border-color)]">
                                        {selectedEvent.type === 'PRIVÉ' ? <User className="text-[var(--text-primary)]" /> : <Building2 className="text-[var(--text-primary)]" />}
                                    </div>
                                    <div>
                                        {/* 1. NOM PRENOM/ENTREPRISE */}
                                        <h2 className="text-2xl font-bold text-[var(--text-primary)]">
                                            {selectedEvent.type === 'PRIVÉ' ? `${selectedEvent.first_name} ${selectedEvent.last_name}` : selectedEvent.company_name}
                                        </h2>
                                        {/* 2. NOMBRE DE PERSONNES */}
                                        <p className="text-[var(--text-muted)] text-sm flex items-center gap-2 mt-1">
                                            <Users size={14} />
                                            {selectedEvent.num_people} personnes • {selectedEvent.type}
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedEvent(null)} className="p-2 hover:bg-[var(--interactive-hover)] rounded-full text-[var(--text-muted)]">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="p-8 space-y-8">
                                {selectedCalendar?.status === 'ARCHIVED' && (
                                    <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-sm font-medium">
                                        Ce calendrier est archivé : consultation et impression uniquement (lecture seule).
                                    </div>
                                )}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* 3. HEURE DEBUT ET HEURE FIN */}
                                    <div className="space-y-4">
                                        <h3 className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest flex items-center gap-2">
                                            <Clock size={14} /> Horaires
                                        </h3>
                                        <div className="p-4 bg-[var(--interactive-hover)] rounded-2xl border border-[var(--border-color)]">
                                            <div className="flex items-center justify-between text-[var(--text-primary)]">
                                                <span className="text-[var(--text-muted)] text-xs">Début</span>
                                                <span className="font-bold">{new Date(selectedEvent.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-[var(--text-primary)] mt-2">
                                                <span className="text-[var(--text-muted)] text-xs">Fin</span>
                                                <span className="font-bold">{new Date(selectedEvent.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                            <div className="mt-3 pt-3 border-t border-[var(--border-color)] text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                                                {new Date(selectedEvent.start_time).toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest flex items-center gap-2">
                                            <MapPin size={14} /> Espaces
                                        </h3>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedEvent.spaces?.map((s: any) => (
                                                <span key={s.id} className="px-3 py-1.5 rounded-xl bg-[var(--interactive-hover)] text-xs font-bold border border-[var(--border-color)]" style={{ color: s.color }}>
                                                    {s.name}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <h3 className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Staffing & Assignments</h3>
                                    <div className="space-y-4">
                                        {selectedEvent.staff?.map((s: any, idx: number) => {
                                            const assignments = selectedEvent.assignments?.filter((a: any) => a.staff_type_id === s.staff_type_id) || [];
                                            const extras = Math.max(0, s.count - assignments.length);

                                            return (
                                                <div key={idx} className="bg-[var(--interactive-hover)] rounded-2xl p-6 border border-[var(--border-color)] space-y-4">
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-bold text-[var(--text-primary)] text-lg">{s.name}</span>
                                                        <div className="flex items-center gap-2 px-3 py-1 bg-[var(--interactive-hover)] rounded-lg text-xs font-bold text-[var(--text-muted)] border border-[var(--border-color)]">
                                                            Besoin: {s.count}
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {/* 4. HÔTESSE INTERNE BOOKER */}
                                                        <div className="space-y-2">
                                                            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Internes Booker</p>
                                                            <div className="flex flex-wrap gap-2">
                                                                {assignments.length > 0 ? assignments.map((a: any, i: number) => (
                                                                    <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 text-blue-400 rounded-xl text-[10px] font-bold border border-blue-500/20">
                                                                        <UserCheck size={12} />
                                                                        {a.employee_name}
                                                                    </div>
                                                                )) : (
                                                                    <span className="text-[var(--text-muted)] text-[10px] font-bold italic">Aucun interne</span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* 5. NOMBRE D'HOTESSE EN EXTRA */}
                                                        <div className="space-y-2">
                                                            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Extras à prévoir</p>
                                                            <div className={`inline-flex items-center justify-center px-4 py-1.5 rounded-xl font-bold text-sm ${extras > 0 ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>
                                                                {extras} {extras > 1 ? 'Extras' : 'Extra'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            <div className="p-8 bg-[var(--interactive-hover)] border-t border-[var(--border-color)] flex justify-between gap-4">
                                {selectedCalendar?.status !== 'ARCHIVED' ? (
                                    <button
                                        onClick={() => {
                                            setConfirmAction({ type: 'deleteEvent', id: selectedEvent.id, label: selectedEvent.type === 'PRIVÉ' ? `${selectedEvent.first_name} ${selectedEvent.last_name}` : selectedEvent.company_name });
                                        }}
                                        className="px-5 py-3 rounded-xl font-bold border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all flex items-center gap-2"
                                    >
                                        <Trash2 size={15} />
                                        Supprimer
                                    </button>
                                ) : (
                                    <div />
                                )}
                                <div className="flex gap-4">
                                    <button 
                                        onClick={() => setSelectedEvent(null)}
                                        className="px-6 py-3 rounded-xl font-bold border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--interactive-hover)] transition-all"
                                    >
                                        Fermer
                                    </button>
                                    {selectedCalendar?.status !== 'ARCHIVED' && (
                                        <button 
                                            onClick={() => {
                                                setEditingEvent(selectedEvent);
                                                setSelectedEvent(null);
                                                setShowEventForm(true);
                                            }}
                                            className="px-6 py-3 bg-[var(--text-primary)] text-[var(--bg-card)] rounded-xl font-bold hover:opacity-90 transition-all"
                                        >
                                            Modifier
                                        </button>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}

                {confirmAction && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-6">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="w-full max-w-sm bg-[var(--bg-card)] rounded-2xl p-8 border border-[var(--border-color)] shadow-2xl"
                        >
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-12 h-12 bg-red-500/10 rounded-2xl flex items-center justify-center">
                                    <Trash2 size={22} className="text-red-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-[var(--text-primary)]">
                                        {confirmAction.type === 'deleteCalendar' ? 'Supprimer le calendrier' : 'Supprimer la privatisation'}
                                    </h3>
                                    <p className="text-xs text-[var(--text-muted)] mt-0.5">Cette action est irréversible</p>
                                </div>
                            </div>
                            <p className="text-sm text-[var(--text-muted)] mb-8">
                                {confirmAction.type === 'deleteCalendar'
                                    ? <>Voulez-vous vraiment supprimer le calendrier <strong className="text-[var(--text-primary)]">{confirmAction.label}</strong> et toutes ses privatisations ?</>
                                    : <>Voulez-vous vraiment supprimer la privatisation de <strong className="text-[var(--text-primary)]">{confirmAction.label}</strong> ?</>
                                }
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setConfirmAction(null)}
                                    className="flex-1 px-4 py-3 rounded-xl font-bold border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--interactive-hover)] transition-all text-sm"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={() => {
                                        if (confirmAction.type === 'deleteCalendar') handleDeleteCalendar(confirmAction.id);
                                        else if (confirmAction.type === 'deleteEvent') handleDeleteEvent(confirmAction.id);
                                    }}
                                    className="flex-1 px-4 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-all text-sm"
                                >
                                    Supprimer
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}

                {showNewCalendarModal && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="w-full max-w-md bg-[var(--bg-card)] rounded-2xl p-10 border border-[var(--border-color)] shadow-2xl"
                        >
                            <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-8">Nouveau Calendrier</h2>
                            <form onSubmit={handleCreateCalendar} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Mois</label>
                                    <select 
                                        value={newCalendar.month}
                                        onChange={e => setNewCalendar({...newCalendar, month: parseInt(e.target.value)})}
                                        className="w-full bg-[var(--bg-app)] border border-[var(--border-color)] rounded-lg px-4 py-3 text-[var(--text-primary)] outline-none focus:border-[var(--text-primary)] transition-all"
                                    >
                                        {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Année</label>
                                    <input 
                                        type="number"
                                        value={newCalendar.year}
                                        onChange={e => setNewCalendar({...newCalendar, year: parseInt(e.target.value)})}
                                        className="w-full bg-[var(--bg-app)] border border-[var(--border-color)] rounded-lg px-4 py-3 text-[var(--text-primary)] outline-none focus:border-[var(--text-primary)] transition-all"
                                    />
                                </div>
                                <div className="flex gap-4 pt-4">
                                    <button 
                                        type="button"
                                        onClick={() => setShowNewCalendarModal(false)}
                                        className="flex-1 px-6 py-4 rounded-xl font-bold border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--interactive-hover)] transition-all"
                                    >
                                        Annuler
                                    </button>
                                    <button 
                                        type="submit"
                                        className="flex-1 bg-[var(--text-primary)] text-[var(--bg-card)] px-6 py-4 rounded-xl font-bold hover:opacity-90 transition-all"
                                    >
                                        Créer
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}

                {showNotifyModal && selectedCalendar && (
                    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-6">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.96 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.96 }}
                            className="w-full max-w-xl bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl shadow-2xl overflow-hidden"
                        >
                            <div className="p-6 bg-[var(--interactive-hover)] border-b border-[var(--border-color)] flex items-center justify-between">
                                <h3 className="text-xl font-bold text-[var(--text-primary)]">Envoyer une notification</h3>
                                <button onClick={() => setShowNotifyModal(false)} className="p-2 rounded-lg text-[var(--text-muted)] hover:bg-[var(--interactive-hover)]">
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="p-6 space-y-4 max-h-[55vh] overflow-y-auto">
                                <p className="text-sm text-[var(--text-muted)]">Choisissez les employés à prévenir pour la mise à jour du calendrier.</p>
                                {eligibleNotifyEmployees
                                    .filter((emp: any) => notifyRecipientIds.includes(String(emp.id)))
                                    .map((emp: any) => {
                                        const checked = selectedNotifyIds.includes(String(emp.id));
                                        return (
                                            <button
                                                key={`notify-modal-${emp.id}`}
                                                type="button"
                                                onClick={() => setSelectedNotifyIds((prev) => checked ? prev.filter((id) => id !== String(emp.id)) : [...prev, String(emp.id)])}
                                                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${checked ? 'bg-[var(--text-primary)] text-[var(--bg-card)] border-[var(--text-primary)]' : 'bg-[var(--bg-app)] border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--interactive-hover)]'}`}
                                            >
                                                <span>{employeeName(emp)} ({emp.email})</span>
                                                {checked && <Check size={16} />}
                                            </button>
                                        );
                                    })}
                            </div>

                            <div className="p-6 bg-[var(--interactive-hover)] border-t border-[var(--border-color)] flex justify-end gap-3">
                                <button onClick={() => setShowNotifyModal(false)} className="px-4 py-2.5 rounded-xl border border-[var(--border-color)] text-[var(--text-primary)] font-bold hover:bg-[var(--interactive-hover)]">
                                    Annuler
                                </button>
                                <button
                                    onClick={sendCalendarNotifications}
                                    disabled={sendingNotifications}
                                    className="px-4 py-2.5 rounded-xl bg-[var(--text-primary)] text-[var(--bg-card)] font-bold hover:opacity-90 inline-flex items-center gap-2 disabled:opacity-60"
                                >
                                    <Send size={14} />
                                    <span>{sendingNotifications ? 'Envoi...' : 'Envoyer'}</span>
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {toastMessage && (
                <div className="fixed top-6 right-6 z-[80] px-4 py-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] shadow-2xl">
                    {toastMessage}
                </div>
            )}
        </div>
    );
};
