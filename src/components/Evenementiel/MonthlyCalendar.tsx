import React, { useMemo, useState, useEffect } from 'react';
import {
    format,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isSameMonth,
    addMonths,
    subMonths,
    addWeeks,
    subWeeks,
    parseISO,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Clock, Users, AlertCircle, FileText, Send, Printer, X } from 'lucide-react';
import { motion } from 'framer-motion';

interface Event {
    id: string;
    type: 'PRIVÉ' | 'PROFESSIONNEL';
    first_name?: string;
    last_name?: string;
    company_name?: string;
    organizer_name?: string;
    start_time: string;
    end_time: string;
    num_people: number;
    spaces: any[];
    staff: any[];
    assignments?: any[];
    taken_by_name?: string | null;
    has_note?: boolean;
    has_documents?: boolean;
    note_text?: string;
}

interface SpaceConfig {
    id: string;
    name: string;
    color: string;
}

interface Props {
    month: number;
    year: number;
    events: Event[];
    configSpaces?: SpaceConfig[];
    onMonthChange: (month: number, year: number) => void;
    onEventClick: (event: Event) => void;
    onNotifyUpdate?: () => void;
    notifyDisabled?: boolean;
}

export const MonthlyCalendar = ({ month, year, events, configSpaces = [], onMonthChange, onEventClick, onNotifyUpdate, notifyDisabled = false }: Props) => {
    const currentMonth = useMemo(() => new Date(year, month - 1), [month, year]);
    const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
    const [activeSpaceId, setActiveSpaceId] = useState<string>('ALL');
    const [weekAnchor, setWeekAnchor] = useState<Date>(startOfWeek(new Date(year, month - 1), { weekStartsOn: 1 }));
    const [notePopup, setNotePopup] = useState<{ text: string } | null>(null);

    useEffect(() => {
        setWeekAnchor(startOfWeek(new Date(year, month - 1), { weekStartsOn: 1 }));
    }, [month, year]);

    const spaces = useMemo(() => {
        const map = new Map<string, { id: string; name: string; color: string }>();
        configSpaces.forEach((s) => {
            map.set(s.id, { id: s.id, name: s.name, color: s.color });
        });
        events.forEach((e) => {
            (e.spaces || []).forEach((s: any) => {
                if (s?.id) {
                    map.set(String(s.id), {
                        id: String(s.id),
                        name: String(s.name || map.get(String(s.id))?.name || 'Espace'),
                        color: String(s.color || map.get(String(s.id))?.color || '#3b82f6'),
                    });
                }
            });
        });
        return Array.from(map.values());
    }, [events, configSpaces]);

    const filteredEvents = useMemo(() => {
        if (activeSpaceId === 'ALL') return events;
        return events.filter((e) => (e.spaces || []).some((s: any) => String(s.id) === activeSpaceId));
    }, [events, activeSpaceId]);

    const days = useMemo(() => {
        if (viewMode === 'month') {
            const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
            const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
            return eachDayOfInterval({ start, end });
        }
        const start = startOfWeek(weekAnchor, { weekStartsOn: 1 });
        const end = endOfWeek(weekAnchor, { weekStartsOn: 1 });
        return eachDayOfInterval({ start, end });
    }, [currentMonth, viewMode, weekAnchor]);

    const eventsByDay = useMemo(() => {
        const map: Record<string, Event[]> = {};
        filteredEvents.forEach((event) => {
            const start = parseISO(event.start_time);
            const key = format(start, 'yyyy-MM-dd');
            if (!map[key]) map[key] = [];
            map[key].push(event);
        });
        return map;
    }, [filteredEvents]);

    const handlePrev = () => {
        if (viewMode === 'month') {
            const prev = subMonths(currentMonth, 1);
            onMonthChange(prev.getMonth() + 1, prev.getFullYear());
            return;
        }
        setWeekAnchor((w) => subWeeks(w, 1));
    };

    const handleNext = () => {
        if (viewMode === 'month') {
            const next = addMonths(currentMonth, 1);
            onMonthChange(next.getMonth() + 1, next.getFullYear());
            return;
        }
        setWeekAnchor((w) => addWeeks(w, 1));
    };

    const exportPrint = () => {
        window.print();
    };

    const headerTitle = viewMode === 'month'
        ? format(currentMonth, 'MMMM yyyy', { locale: fr })
        : `Semaine du ${format(startOfWeek(weekAnchor, { weekStartsOn: 1 }), 'd MMM', { locale: fr })} au ${format(endOfWeek(weekAnchor, { weekStartsOn: 1 }), 'd MMM yyyy', { locale: fr })}`;
    const printRowCount = Math.max(1, Math.ceil(days.length / 7));

    return (
        <>
            <style>{`
                #print-area { display: none !important; }

                @media print {
                    @page {
                        size: A4 landscape;
                        margin: 10mm;
                    }

                    /* Reset total : élimine ombres et bordures arrondies parasites */
                    * {
                        box-shadow: none !important;
                        border-radius: 0 !important;
                    }

                    html, body {
                        margin: 0 !important;
                        padding: 0 !important;
                        height: 100% !important;
                        overflow: hidden !important;
                    }

                    body * { visibility: hidden !important; }
                    aside, .no-print, header, nav, button { display: none !important; }

                    /* Isolation totale du conteneur d'impression */
                    #print-area {
                        visibility: visible !important;
                        display: flex !important;
                        position: absolute !important;
                        inset: 0 !important;
                        background: white !important;
                        border: none !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        color: #1e3a8a !important;
                        font-family: 'Segoe UI', Arial, sans-serif !important;
                        flex-direction: column !important;
                        height: 100% !important;
                        max-height: 100vh !important;
                        overflow: hidden !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }

                    #print-area * { visibility: visible !important; }

                    /* BANDE TITRE HORIZONTALE AU DESSUS */
                    .print-top-header {
                        width: 100% !important;
                        border-bottom: 3px solid #1e3a8a !important;
                        padding: 8px 0 !important;
                        text-align: center !important;
                        display: flex !important;
                        flex-direction: column !important;
                        align-items: center !important;
                        gap: 2px !important;
                    }

                    .print-label-top {
                        font-size: 8pt !important;
                        font-weight: 700 !important;
                        text-transform: uppercase !important;
                        letter-spacing: 2px !important;
                        color: #64748b !important;
                    }

                    .print-month-title {
                        font-size: 24pt !important;
                        font-weight: 900 !important;
                        text-transform: uppercase !important;
                        color: #1e3a8a !important;
                        margin: 0 !important;
                    }

                    /* BANDEAU JOURS : bleu marine avec texte blanc (fonctionne avec "Graphiques d'arrière-plan") */
                    .print-days-row {
                        display: grid !important;
                        grid-template-columns: repeat(7, 1fr) !important;
                        border-left: 1px solid #1e3a8a !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }

                    .print-day-name {
                        text-align: center !important;
                        padding: 4px !important;
                        font-weight: 800 !important;
                        font-size: 7pt !important;
                        text-transform: uppercase !important;
                        background-color: #1e3a8a !important;
                        color: white !important;
                        border-right: 1px solid #1e3a8a !important;
                        border-bottom: 1px solid #1e3a8a !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }

                    /* GRILLE DU CALENDRIER : s'adapte au contenu */
                    .print-calendar-grid {
                        flex-grow: 1 !important;
                        min-height: 0 !important;
                        display: grid !important;
                        grid-template-columns: repeat(7, 1fr) !important;
                        grid-auto-rows: minmax(50px, auto) !important;
                        align-content: start !important;
                        overflow: visible !important;
                        border-top: 1px solid #1e3a8a !important;
                        border-left: 1px solid #1e3a8a !important;
                    }

                    .print-day-cell {
                        border-right: 1px solid #1e3a8a !important;
                        border-bottom: 1px solid #1e3a8a !important;
                        padding: 3px !important;
                        display: flex !important;
                        flex-direction: column !important;
                        background: white !important;
                        min-height: 0 !important;
                        overflow: visible !important;
                        gap: 2px !important;
                    }

                    .print-day-number {
                        font-weight: 900 !important;
                        font-size: 11pt !important;
                        margin-bottom: 3px !important;
                        color: #1e3a8a !important;
                    }

                    /* Cellules hors mois en cours : fond grisé propre */
                    .print-day-cell-muted {
                        background-color: #f1f5f9 !important;
                        opacity: 0.5 !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }

                    /* ÉVÉNEMENTS */
                    .print-event-item {
                        border-left: 3px solid #1e3a8a !important;
                        padding-left: 5px !important;
                        margin-bottom: 2px !important;
                        page-break-inside: avoid !important;
                        overflow: visible !important;
                    }

                    .print-event-title {
                        font-weight: 900 !important;
                        font-size: 7.5pt !important;
                        text-transform: uppercase !important;
                        margin-bottom: 2px !important;
                        white-space: normal !important;
                        overflow: visible !important;
                        text-overflow: clip !important;
                        line-height: 1.1 !important;
                    }

                    .print-event-info {
                        font-size: 6.5pt !important;
                        line-height: 1.1 !important;
                        color: #334155 !important;
                        white-space: normal !important;
                        overflow: visible !important;
                        text-overflow: clip !important;
                        margin-bottom: 2px !important;
                    }

                    .print-event-staff {
                        font-family: 'Segoe UI', sans-serif !important;
                        font-size: 6pt !important;
                        margin-top: 1px !important;
                        color: #475569 !important;
                        white-space: normal !important;
                        overflow: visible !important;
                        text-overflow: clip !important;
                        line-height: 1.1 !important;
                        word-break: break-word !important;
                    }

                    .print-event-taken {
                        font-style: italic !important;
                        font-size: 5.5pt !important;
                        margin-top: 1px !important;
                        color: #64748b !important;
                        text-align: right !important;
                        white-space: nowrap !important;
                        overflow: hidden !important;
                        text-overflow: ellipsis !important;
                    }
                }
            `}</style>

            <div className="calendar-print-scope no-print rounded-3xl border overflow-hidden shadow-2xl bg-[var(--bg-sidebar)] border-[var(--border-color)] text-[var(--text-primary)] transition-colors duration-300">
                {/* --- HEADER ÉCRAN --- */}
                <div className="p-6 md:p-8 border-b bg-[var(--bg-card)] border-[var(--border-color)] transition-colors duration-300">
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                            <h2 className="text-2xl font-bold text-[var(--text-primary)] capitalize">{headerTitle}</h2>
                            <div className="flex gap-2 items-center flex-wrap">
                                {onNotifyUpdate && (
                                    <button onClick={onNotifyUpdate} disabled={notifyDisabled} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border-color)] text-xs font-bold text-[var(--text-primary)] hover:bg-[var(--interactive-hover)] disabled:opacity-50 transition-colors duration-300">
                                        <Send size={14} /> <span>Notifier</span>
                                    </button>
                                )}
                                <button onClick={exportPrint} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border-color)] text-xs font-bold text-[var(--text-primary)] hover:bg-[var(--interactive-hover)] transition-colors duration-300">
                                    <Printer size={14} /> <span>Exporter PDF</span>
                                </button>
                                <div className="inline-flex rounded-lg border border-[var(--border-color)] overflow-hidden">
                                    <button onClick={() => setViewMode('month')} className={`px-3 py-2 text-xs font-bold transition-all ${viewMode === 'month' ? 'bg-[var(--text-primary)] text-[var(--bg-card)]' : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--interactive-hover)]'}`}>Mensuelle</button>
                                    <button onClick={() => setViewMode('week')} className={`px-3 py-2 text-xs font-bold transition-all ${viewMode === 'week' ? 'bg-[var(--text-primary)] text-[var(--bg-card)]' : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--interactive-hover)]'}`}>Hebdo</button>
                                </div>
                                <button onClick={handlePrev} className="p-2 hover:bg-[var(--interactive-hover)] rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors duration-300"><ChevronLeft size={22} /></button>
                                <button onClick={handleNext} className="p-2 hover:bg-[var(--interactive-hover)] rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors duration-300"><ChevronRight size={22} /></button>
                            </div>
                        </div>

                        {spaces.length > 0 && (
                            <div className="flex items-center gap-2 flex-wrap">
                                <button
                                    onClick={() => setActiveSpaceId('ALL')}
                                    className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-colors ${activeSpaceId === 'ALL' ? 'bg-[var(--text-primary)] text-[var(--bg-card)] border-[var(--text-primary)]' : 'bg-[var(--bg-soft)] text-[var(--text-secondary)] border-[var(--border-color)] hover:bg-[var(--interactive-hover)]'}`}
                                >
                                    Tous les espaces
                                </button>
                                {spaces.map((space) => (
                                    <button
                                        key={space.id}
                                        onClick={() => setActiveSpaceId(space.id)}
                                        className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-colors ${activeSpaceId === space.id ? 'text-[var(--bg-card)]' : 'text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)]'}`}
                                        style={{
                                            backgroundColor: activeSpaceId === space.id ? space.color : 'var(--bg-soft)',
                                            borderColor: activeSpaceId === space.id ? space.color : 'var(--border-color)'
                                        }}
                                    >
                                        {space.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* --- GRILLE ÉCRAN --- */}
                <div className="grid grid-cols-7 border-b border-[var(--border-color)] bg-[var(--bg-soft)] transition-colors duration-300">
                    {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day) => (
                        <div key={day} className="py-4 text-center text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">{day}</div>
                    ))}
                </div>

                <div className="grid grid-cols-7 [grid-auto-rows:minmax(150px,auto)]">
                    {days.map((day, i) => {
                        const dayKey = format(day, 'yyyy-MM-dd');
                        const dayEvents = eventsByDay[dayKey] || [];
                        const isCurrentMonth = isSameMonth(day, currentMonth);
                        return (
                            <div key={i} className={`border-r border-b border-[var(--border-color)] p-3 flex flex-col transition-colors duration-300 ${viewMode === 'month' && !isCurrentMonth ? 'opacity-50 bg-[var(--bg-soft)]' : 'bg-transparent'}`}>
                                <span className="text-xs font-bold text-[var(--text-secondary)]">{format(day, 'd')}</span>
                                <div className="mt-2 flex flex-col gap-2">
                                    {dayEvents.map((event) => {
                                        // Group assignments by staff type
                                        const staffByType: Record<string, string[]> = {};
                                        event.assignments?.forEach((a: any) => {
                                            if (!staffByType[a.staff_type_name]) {
                                                staffByType[a.staff_type_name] = [];
                                            }
                                            staffByType[a.staff_type_name].push((a.employee_name || '').split(' ')[0]);
                                        });

                                        // Format staff lines
                                        const staffLines = Object.entries(staffByType).map(([typeName, names]) => {
                                            const staffItem = event.staff?.find((s: any) => s.name === typeName);
                                            const extraCount = Math.max(0, (staffItem?.count || 0) - names.length);
                                            const namesList = names.join(' + ');
                                            const extraStr = extraCount > 0 ? ` + ${extraCount} Extra${extraCount > 1 ? 's' : ''}` : '';
                                            return `${typeName} : ${namesList}${extraStr}`;
                                        });

                                        const spaceColor = event.spaces?.[0]?.color || '#3b82f6';
                                        const identity = event.type === 'PRIVÉ' ? `${event.first_name} ${event.last_name}` : event.company_name;

                                        return (
                                            <React.Fragment key={event.id}>
                                            <button
                                                onClick={() => onEventClick(event)}
                                                className="w-full text-center rounded-lg p-2 text-[10px] border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)] transition-colors duration-300 flex flex-col gap-1 items-center"
                                                style={{ borderLeftWidth: '4px', borderLeftColor: spaceColor }}
                                            >
                                                {/* Line 1: Identity */}
                                                <div className="uppercase font-black break-words" style={{ color: spaceColor }}>{identity}</div>

                                                {/* Line 2: Number of people */}
                                                <div className="opacity-75 text-[var(--text-primary)]">{event.num_people} pers.</div>

                                                {/* Line 3: Times with clock icon */}
                                                <div className="opacity-75 flex items-center gap-1 justify-center text-[var(--text-primary)]">
                                                    <Clock size={10} className="flex-shrink-0" />
                                                    <span>{format(parseISO(event.start_time), 'HH:mm')} - {format(parseISO(event.end_time), 'HH:mm')}</span>
                                                </div>

                                                {/* Lines 4+: Staff by category */}
                                                {staffLines.length > 0 && (
                                                    staffLines.map((line, idx) => (
                                                        <div key={idx} className="opacity-75 break-words text-[var(--text-primary)]">{line}</div>
                                                    ))
                                                )}

                                                {/* Last line: Taken by info */}
                                                {event.taken_by_name && (
                                                    <div className="opacity-75 italic text-[9px] break-words text-[var(--text-primary)]">Pris par : {event.taken_by_name}</div>
                                                )}
                                            </button>
                                            {(event.has_note || event.has_documents) && (
                                                <div className="flex items-center gap-1 px-1 pb-0.5">
                                                    {event.has_note && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setNotePopup({ text: event.note_text || '' }); }}
                                                            className="w-4 h-4 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center flex-shrink-0 transition-colors"
                                                            title="Voir la note"
                                                        >
                                                            <AlertCircle size={9} className="text-white" />
                                                        </button>
                                                    )}
                                                    {event.has_documents && (
                                                        <div className="w-4 h-4 rounded bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0" title="Documents joints">
                                                            <FileText size={9} className="text-blue-400" />
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            </React.Fragment>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* --- POPUP NOTE --- */}
            {notePopup && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                    onClick={() => setNotePopup(null)}
                >
                    <div
                        className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-8 h-8 bg-red-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                                <AlertCircle size={16} className="text-red-400" />
                            </div>
                            <h3 className="font-bold text-[var(--text-primary)] flex-1">Note / Message</h3>
                            <button
                                onClick={() => setNotePopup(null)}
                                className="p-1 hover:bg-[var(--interactive-hover)] rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">
                            {notePopup.text || '(Note vide)'}
                        </p>
                    </div>
                </div>
            )}

            {/* --- ZONE D'IMPRESSION PDF (Design Bleu Marine & Titre en haut) --- */}
            <div id="print-area">
                <div className="print-top-header">
                    <span className="print-label-top">PRIVATISATION DU MOIS DE</span>
                    <h1 className="print-month-title">{format(currentMonth, 'MMMM yyyy', { locale: fr })}</h1>
                </div>

                <div className="print-days-row">
                    {['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'].map((d) => (
                        <div key={d} className="print-day-name">{d}</div>
                    ))}
                </div>

                <div className="print-calendar-grid" style={{ gridTemplateRows: `repeat(${printRowCount}, minmax(0, 1fr))` }}>
                    {days.map((day, i) => {
                        const dayKey = format(day, 'yyyy-MM-dd');
                        const dayEvents = eventsByDay[dayKey] || [];
                        const isCurrentMonth = isSameMonth(day, currentMonth);

                        return (
                            <div key={i} className={`print-day-cell ${!isCurrentMonth ? 'print-day-cell-muted' : ''}`}>
                                <span className="print-day-number">{format(day, 'd')}</span>
                                {dayEvents.map((event) => {
                                    const spaceColor = event.spaces?.[0]?.color || '#1e3a8a';
                                    const title = event.type === 'PRIVÉ' ? `${event.first_name} ${event.last_name}` : event.company_name;

                                    return (
                                        <div key={event.id} className="print-event-item" style={{ borderLeftColor: spaceColor }}>
                                            <div className="print-event-title" style={{ color: spaceColor }}>{title}</div>
                                            <div className="print-event-info">
                                                {format(parseISO(event.start_time), 'HH:mm')} - {format(parseISO(event.end_time), 'HH:mm')} · {event.num_people} pers.
                                            </div>
                                            <div className="print-event-staff">
                                                {event.staff?.map((s: any) => {
                                                    const assignments = event.assignments?.filter((a: any) => a.staff_type_id === s.staff_type_id) || [];
                                                    const extras = Math.max(0, s.count - assignments.length);
                                                    const firstNames = assignments.map((a: any) => (a.employee_name || '').split(' ')[0]).join(' + ');
                                                    const extraStr = extras > 0 ? `${extras} Extra${extras > 1 ? 's' : ''}` : '';
                                                    const allNames = [firstNames, extraStr].filter(Boolean).join(' + ');
                                                    return [s.name, allNames].filter(Boolean).join(' : ');
                                                }).join(' | ')}
                                            </div>
                                            {event.taken_by_name && <div className="print-event-taken">Par : {event.taken_by_name}</div>}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            </div>
        </>
    );
};