import React, { useMemo, useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
    format,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isSameMonth,
    parseISO,
    addMonths,
    subMonths,
    addWeeks,
    subWeeks,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Clock, AlertCircle, FileText, Send, Printer, X } from 'lucide-react';

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
    note_text?: string;
    documents?: any[];
    period?: 'midi' | 'soir';
    color?: string;
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

const getContrastColor = (hexColor: string) => {
    if (!hexColor || hexColor === 'transparent') return '#000000';
    let color = hexColor.replace('#', '');
    if (color.length === 3) color = color.split('').map(c => c + c).join('');
    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 4), 16);
    const b = parseInt(color.substring(4, 6), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 128 ? '#000000' : '#ffffff';
};

export const MonthlyCalendar = ({ month, year, events, configSpaces = [], onMonthChange, onEventClick, onNotifyUpdate, notifyDisabled = false }: Props) => {
    const { user } = useAuth();
    const currentMonth = useMemo(() => new Date(year, month - 1), [month, year]);
    const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
    const [activeSpaceId, setActiveSpaceId] = useState<string>('ALL');
    const [weekAnchor, setWeekAnchor] = useState<Date>(startOfWeek(new Date(year, month - 1), { weekStartsOn: 1 }));
    const [notePopup, setNotePopup] = useState<{ text: string } | null>(null);

    const spaces = useMemo(() => {
        const map = new Map<string, { id: string; name: string; color: string }>();
        configSpaces.forEach(s => map.set(s.id, s));
        return Array.from(map.values());
    }, [configSpaces]);

    const filteredEvents = useMemo(() => {
        if (activeSpaceId === 'ALL') return events;
        return events.filter((e) => (e.spaces || []).some((s: any) => String(s.id) === activeSpaceId));
    }, [events, activeSpaceId]);

    const days = useMemo(() => {
        const start = viewMode === 'month' 
            ? startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 })
            : startOfWeek(weekAnchor, { weekStartsOn: 1 });
        const end = viewMode === 'month'
            ? endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 })
            : endOfWeek(weekAnchor, { weekStartsOn: 1 });
        return eachDayOfInterval({ start, end });
    }, [currentMonth, viewMode, weekAnchor]);

    const eventsByDay = useMemo(() => {
        const map: Record<string, Event[]> = {};
        filteredEvents.forEach((event) => {
            const key = format(parseISO(event.start_time), 'yyyy-MM-dd');
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
        setWeekAnchor(w => subWeeks(w, 1));
    };

    const handleNext = () => {
        if (viewMode === 'month') {
            const next = addMonths(currentMonth, 1);
            onMonthChange(next.getMonth() + 1, next.getFullYear());
            return;
        }
        setWeekAnchor(w => addWeeks(w, 1));
    };

    const exportPrint = () => window.print();

    return (
        <>
            <style>{`
                @media print {
                    @page { size: landscape; margin: 5mm; }
                    body * { visibility: hidden !important; }
                    #print-calendar-panel, #print-calendar-panel * { 
                        visibility: visible !important; 
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    #print-calendar-panel { 
                        position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; 
                        display: block !important; background: white !important;
                    }
                    .no-print { display: none !important; }
                }
            `}</style>

            {/* --- UI ÉCRAN --- */}
            <div className="no-print rounded-3xl border overflow-hidden shadow-2xl bg-[var(--bg-sidebar)] border-[var(--border-color)] text-[var(--text-primary)] transition-colors duration-300">
                <div className="p-6 md:p-8 border-b bg-[var(--bg-card)] border-[var(--border-color)] transition-colors duration-300">
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                            <h2 className="text-2xl font-bold text-[var(--text-primary)] capitalize">
                                {viewMode === 'month' 
                                    ? format(currentMonth, 'MMMM yyyy', { locale: fr })
                                    : `Semaine du ${format(days[0], 'd MMM', { locale: fr })}`}
                            </h2>
                            <div className="flex gap-2 items-center flex-wrap">
                                {onNotifyUpdate && (
                                    <button onClick={onNotifyUpdate} disabled={notifyDisabled} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border-color)] text-xs font-bold text-[var(--text-primary)] hover:bg-[var(--interactive-hover)] disabled:opacity-50 transition-colors duration-300">
                                        <Send size={14} /> <span>Notifier</span>
                                    </button>
                                )}
                                <button onClick={exportPrint} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors duration-300">
                                    <Printer size={14} /> <span>Exporter PDF</span>
                                </button>
                                <div className="inline-flex rounded-lg border border-[var(--border-color)] overflow-hidden">
                                    <button onClick={() => setViewMode('month')} className={`px-3 py-2 text-xs font-bold transition-all ${viewMode === 'month' ? 'bg-[var(--text-primary)] text-[var(--bg-card)]' : 'bg-transparent text-[var(--text-muted)]'}`}>Mensuelle</button>
                                    <button onClick={() => setViewMode('week')} className={`px-3 py-2 text-xs font-bold transition-all ${viewMode === 'week' ? 'bg-[var(--text-primary)] text-[var(--bg-card)]' : 'bg-transparent text-[var(--text-muted)]'}`}>Hebdo</button>
                                </div>
                                <button onClick={handlePrev} className="p-2 hover:bg-[var(--interactive-hover)] rounded-lg text-[var(--text-muted)]"><ChevronLeft size={22} /></button>
                                <button onClick={handleNext} className="p-2 hover:bg-[var(--interactive-hover)] rounded-lg text-[var(--text-muted)]"><ChevronRight size={22} /></button>
                            </div>
                        </div>

                        {spaces.length > 0 && (
                            <div className="flex items-center gap-2 flex-wrap">
                                <button
                                    onClick={() => setActiveSpaceId('ALL')}
                                    className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-colors ${activeSpaceId === 'ALL' ? 'bg-[var(--text-primary)] text-[var(--bg-card)]' : 'bg-[var(--bg-soft)] text-[var(--text-secondary)]'}`}
                                >
                                    Tous les espaces
                                </button>
                                {spaces.map((space) => (
                                    <button
                                        key={space.id}
                                        onClick={() => setActiveSpaceId(space.id)}
                                        className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-colors ${activeSpaceId === space.id ? 'text-white' : 'text-[var(--text-secondary)]'}`}
                                        style={{ backgroundColor: activeSpaceId === space.id ? space.color : 'transparent', borderColor: activeSpaceId === space.id ? space.color : 'var(--border-color)' }}
                                    >
                                        {space.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-7 border-b border-[var(--border-color)] bg-[var(--bg-soft)]">
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
                            <div key={i} className={`border-r border-b border-[var(--border-color)] p-3 flex flex-col ${!isCurrentMonth ? 'opacity-50 bg-[var(--bg-soft)]' : ''}`}>
                                <span className="text-xs font-bold text-[var(--text-secondary)] mb-2">{format(day, 'd')}</span>
                                <div className="flex flex-col gap-2">
                                    {dayEvents.map((event) => {
                                        const staffByType: Record<string, string[]> = {};
                                        event.assignments?.forEach((a: any) => {
                                            if (!staffByType[a.staff_type_name]) staffByType[a.staff_type_name] = [];
                                            staffByType[a.staff_type_name].push((a.employee_name || '').split(' ')[0]);
                                        });
                                        const staffLines = Object.entries(staffByType).map(([typeName, names]) => {
                                            const staffItem = event.staff?.find((s: any) => s.name === typeName);
                                            const extraCount = Math.max(0, (staffItem?.count || 0) - names.length);
                                            const namesList = names.join(' + ');
                                            const extraStr = extraCount > 0 ? ` + ${extraCount} EXTRAS` : '';
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
                                                <div className="uppercase font-black break-words" style={{ color: spaceColor }}>{identity}</div>
                                                <div className="opacity-75 text-[var(--text-primary)]">{event.num_people} pers.</div>
                                                <div className="opacity-75 flex items-center gap-1 justify-center text-[var(--text-primary)]">
                                                    <Clock size={10} className="flex-shrink-0" />
                                                    <span>{format(parseISO(event.start_time), 'HH:mm')} - {format(parseISO(event.end_time), 'HH:mm')}</span>
                                                </div>
                                                {staffLines.map((line, idx) => (
                                                    <div key={idx} className="opacity-75 break-words text-[var(--text-primary)]">{line}</div>
                                                ))}
                                                {event.taken_by_name && (
                                                    <div className="opacity-75 italic text-[9px] break-words text-[var(--text-primary)]">Prise par : {event.taken_by_name}</div>
                                                )}
                                            </button>
                                            {(Boolean((event.note_text || '').trim()) || (event.documents && event.documents.length > 0)) && (
                                                <div className="flex items-center gap-1 px-1 pb-0.5">
                                                    {Boolean((event.note_text || '').trim()) && (
                                                        <button onClick={(e) => { e.stopPropagation(); setNotePopup({ text: event.note_text || '' }); }} className="w-4 h-4 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center flex-shrink-0 transition-colors shadow-sm"><AlertCircle size={9} className="text-white" /></button>
                                                    )}
                                                    {(event.documents && event.documents.length > 0) && (
                                                        <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 shadow-sm"><FileText size={9} className="text-white" /></div>
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

            {/* --- ZONE D'IMPRESSION PDF MAGNIFIQUE (Version Full Couleurs) --- */}
            <div id="print-calendar-panel" className="hidden print:block print:w-full print:bg-white print:p-0">
                <div className="print:text-center print:border-b-2 print:border-black print:pb-2 print:mb-2">
                    <div className="print:text-[8px] print:text-gray-500 uppercase font-bold">Privatisation du mois de</div>
                    <div className="print:text-2xl print:font-black print:text-[#163667] uppercase">
                        {format(currentMonth, 'MMMM yyyy', { locale: fr })}
                    </div>
                </div>

                <div className="grid grid-cols-7 gap-px bg-gray-300 border border-gray-300">
                    {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => (
                        <div key={d} className="bg-[#163667] text-white font-bold text-center py-1.5 text-[9px] uppercase">{d}</div>
                    ))}

                    {days.map((day, i) => {
                        const dayEvents = eventsByDay[format(day, 'yyyy-MM-dd')] || [];
                        const isCurrentMonth = isSameMonth(day, currentMonth);
                        return (
                            <div key={i} className={`print:min-h-[90px] p-1 bg-white flex flex-col ${!isCurrentMonth ? 'opacity-30' : ''}`} style={{ border: '0.5px solid #d1d5db' }}>
                                <div className="font-bold print:text-[9px] mb-1 print:text-black">{day.getDate()}</div>
                                <div className="space-y-1 flex-1">
                                    {dayEvents.map((event) => {
                                        const staffByType: Record<string, string[]> = {};
                                        event.assignments?.forEach((a: any) => {
                                            if (!staffByType[a.staff_type_name]) staffByType[a.staff_type_name] = [];
                                            staffByType[a.staff_type_name].push((a.employee_name || '').split(' ')[0]);
                                        });
                                        const staffLines = Object.entries(staffByType).map(([typeName, names]) => {
                                            const staffItem = event.staff?.find((s: any) => s.name === typeName);
                                            const extraCount = Math.max(0, (staffItem?.count || 0) - names.length);
                                            const namesList = names.join('+');
                                            const extraStr = extraCount > 0 ? `+${extraCount} EXTRAS` : '';
                                            return `${typeName}: ${namesList}${extraStr}`;
                                        });

                                        const bgColor = event.spaces?.[0]?.color || '#3b82f6';
                                        const textColor = getContrastColor(bgColor);
                                        return (
                                            <div key={event.id} className="p-1 rounded-sm border-l-2 text-[8px] leading-tight print-priv" 
                                                 style={{ backgroundColor: bgColor, color: textColor, borderColor: 'rgba(0,0,0,0.1)' }}>
                                                <div className="font-black uppercase">{event.type === 'PRIVÉ' ? `${event.first_name} ${event.last_name}` : event.company_name}</div>
                                                <div className="font-bold">{format(parseISO(event.start_time), 'HH:mm')}-{format(parseISO(event.end_time), 'HH:mm')} • {event.num_people}p</div>
                                                {staffLines.length > 0 && (
                                                    <div className="mt-0.5 border-t border-current/10 pt-0.5">
                                                        {staffLines.map((line, idx) => <div key={idx}>{line}</div>)}
                                                    </div>
                                                )}
                                                {event.taken_by_name && <div className="italic opacity-80">Par: {event.taken_by_name}</div>}

                                            </div>
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setNotePopup(null)}>
                    <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-8 h-8 bg-red-500/10 rounded-xl flex items-center justify-center flex-shrink-0"><AlertCircle size={16} className="text-red-400" /></div>
                            <h3 className="font-bold text-[var(--text-primary)] flex-1">Note / Message</h3>
                            <button onClick={() => setNotePopup(null)} className="p-1 hover:bg-[var(--interactive-hover)] rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={16} /></button>
                        </div>
                        <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">{notePopup.text || '(Note vide)'}</p>
                    </div>
                </div>
            )}
        </>
    );
};