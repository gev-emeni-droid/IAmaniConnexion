import React, { useEffect, useMemo, useState } from 'react';
import { X, Users, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, isToday, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Shift } from './types';

interface AddShiftModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (data: {
        mode: 'extra' | 'absenceRange';
        employeeId?: string;
        employeeName?: string;
        employeeRole?: string;
        isExtra?: boolean;
        date?: string;
        shift: Shift;
        extraCount?: number;
        extraType?: string;
        absenceType?: string;
        startDate?: string;
        endDate?: string;
    }) => void;
    employees: { id: string, name: string, role: string }[];
    currentDate: string;
    weekDates: string[];
    extraTypes: string[];
    absenceTypes: { code: string; isFullDay: boolean }[];
}

const AddShiftModal: React.FC<AddShiftModalProps> = ({ isOpen, onClose, onAdd, employees, currentDate, weekDates, extraTypes, absenceTypes }) => {
    const [tab, setTab] = useState<'extra' | 'absence'>('extra');

    const [extraType, setExtraType] = useState('');
    const [extraCount, setExtraCount] = useState(1);
    const [startTime, setStartTime] = useState('18:00');
    const [endTime, setEndTime] = useState('23:00');
    const [selectedDate, setSelectedDate] = useState(currentDate);

    const [selectedEmpId, setSelectedEmpId] = useState('');
    const [absenceType, setAbsenceType] = useState('');
    const [absenceStartDate, setAbsenceStartDate] = useState(currentDate);
    const [absenceEndDate, setAbsenceEndDate] = useState(currentDate);

    const effectiveExtraTypes = useMemo(() => {
        const list = Array.isArray(extraTypes) && extraTypes.length > 0 ? extraTypes : ['Renfort'];
        return list;
    }, [extraTypes]);

    const effectiveAbsenceTypes = useMemo(() => {
        const list = Array.isArray(absenceTypes) && absenceTypes.length > 0 ? absenceTypes : [{ code: 'CP', isFullDay: true, color: '#FFEBEE' }];
        return list;
    }, [absenceTypes]);

    React.useEffect(() => {
        if (!extraType && effectiveExtraTypes.length > 0) setExtraType(effectiveExtraTypes[0]);
    }, [extraType, effectiveExtraTypes]);

    React.useEffect(() => {
        if ((!absenceType || !effectiveAbsenceTypes.some(a => a.code === absenceType)) && effectiveAbsenceTypes.length > 0) {
            setAbsenceType(effectiveAbsenceTypes[0].code);
        }
    }, [absenceType, effectiveAbsenceTypes]);

    if (!isOpen) return null;

    const handleSubmit = () => {
        if (tab === 'extra') {
            let serviceType: 'midi' | 'soir' | 'midi+soir' | 'none' = 'none';
            if (startTime < '16:00') serviceType = endTime >= '16:00' ? 'midi+soir' : 'midi';
            else serviceType = 'soir';

            const shift: Shift = {
                date: selectedDate,
                type: 'travail',
                serviceType,
                segments: [{ type: 'horaire', start: startTime, end: endTime }]
            };
            onAdd({
                mode: 'extra',
                employeeId: `extra_${crypto.randomUUID()}`,
                employeeName: `${extraType || 'Renfort'} (Extra)`,
                employeeRole: 'EXTRA',
                isExtra: true,
                date: selectedDate,
                shift,
                extraCount,
                extraType
            });
        } else {
            if (!selectedEmpId) return alert('Sélectionnez un employé');
            if (!absenceStartDate || !absenceEndDate) return alert('Sélectionnez les dates de début et de fin');
            if (absenceEndDate < absenceStartDate) return alert('La date de fin doit être >= date de début');
            const emp = employees.find(e => e.id === selectedEmpId);
            const shift: Shift = {
                date: absenceStartDate,
                type: 'absence',
                serviceType: 'none',
                segments: [{ type: 'code', label: absenceType || 'CP' }]
            };
            if (emp) {
                onAdd({
                    mode: 'absenceRange',
                    employeeId: emp.id,
                    employeeName: emp.name,
                    employeeRole: emp.role,
                    isExtra: false,
                    date: absenceStartDate,
                    shift,
                    absenceType: absenceType || 'CP',
                    startDate: absenceStartDate,
                    endDate: absenceEndDate
                });
            }
        }
        onClose();
    };

    const WeekCalendar = ({ selected, onSelect, dates }: { selected: string, onSelect: (d: string) => void, dates: string[] }) => (
        <div className="grid grid-cols-7 gap-1">
            {dates.map((d) => {
                const date = parseISO(d);
                const isSelected = d === selected;
                return (
                    <button
                        key={d}
                        onClick={() => onSelect(d)}
                        className={`flex flex-col items-center py-2 rounded-lg transition-all ${isSelected ? 'bg-[#8B3AE8] text-white shadow-lg scale-105' : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/5'}`}
                    >
                        <span className="text-[10px] uppercase font-bold opacity-70">{format(date, 'EEE', { locale: fr })}</span>
                        <span className="text-sm font-bold">{format(date, 'd')}</span>
                    </button>
                );
            })}
        </div>
    );

    const FullCalendar = ({ value, onChange }: { value: string, onChange: (d: string) => void }) => {
        const [viewDate, setViewDate] = useState(new Date(value || currentDate));
        const days = useMemo(() => {
            const start = startOfWeek(startOfMonth(viewDate), { weekStartsOn: 1 });
            const end = endOfWeek(endOfMonth(viewDate), { weekStartsOn: 1 });
            return eachDayOfInterval({ start, end });
        }, [viewDate]);

        return (
            <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-white/5">
                <div className="flex items-center justify-between mb-3 px-1">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200 capitalize">{format(viewDate, 'MMMM yyyy', { locale: fr })}</span>
                    <div className="flex gap-1">
                        <button onClick={() => setViewDate(subMonths(viewDate, 1))} className="p-1 hover:bg-slate-200 dark:hover:bg-white/5 rounded-md text-slate-500 dark:text-slate-400"><ChevronLeft size={16} /></button>
                        <button onClick={() => setViewDate(addMonths(viewDate, 1))} className="p-1 hover:bg-slate-200 dark:hover:bg-white/5 rounded-md text-slate-500 dark:text-slate-400"><ChevronRight size={16} /></button>
                    </div>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center mb-1">
                    {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(l => <span key={l} className="text-[10px] font-bold text-slate-400">{l}</span>)}
                </div>
                <div className="grid grid-cols-7 gap-1">
                    {days.map((day, i) => {
                        const isCurrentMonth = day.getMonth() === viewDate.getMonth();
                        const isSelected = value && isSameDay(day, parseISO(value));
                        const dStr = format(day, 'yyyy-MM-dd');
                        return (
                            <button
                                key={i}
                                onClick={() => onChange(dStr)}
                                className={`h-8 w-8 text-xs font-bold rounded-lg flex items-center justify-center transition-all ${
                                    isSelected ? 'bg-[#E11D2A] text-white shadow-md' : 
                                    isCurrentMonth ? 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/5' : 'text-slate-300 dark:text-slate-600'
                                } ${isToday(day) && !isSelected ? 'border border-[#E11D2A]/30 text-[#E11D2A]' : ''}`}
                            >
                                {format(day, 'd')}
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className={`bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full ${tab === 'absence' ? 'max-w-2xl' : 'max-w-lg'} max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-white/10 transition-all duration-300`}>
                <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 dark:border-white/5 shrink-0">
                    <h3 className="font-bold text-lg text-slate-800 dark:text-white">Ajouter au planning</h3>
                    <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"><X size={20} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-5 text-sm">
                    <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl shrink-0">
                        <button onClick={() => setTab('extra')} className={`flex-1 py-1.5 text-xs uppercase tracking-wide font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${tab === 'extra' ? 'bg-white dark:bg-slate-700 shadow text-[#4AA3A2]' : 'text-slate-500 dark:text-slate-500'}`}><Users size={14} /> Extra / Renfort</button>
                        <button onClick={() => setTab('absence')} className={`flex-1 py-1.5 text-xs uppercase tracking-wide font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${tab === 'absence' ? 'bg-white dark:bg-slate-700 shadow text-[#4AA3A2]' : 'text-slate-500 dark:text-slate-500'}`}><CalendarDays size={14} /> Absence longue</button>
                    </div>

                    {tab === 'extra' ? (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1.5 block ml-2">Type de renfort</label>
                                    <select value={extraType} onChange={e => setExtraType(e.target.value)} className="w-full h-10 border-2 border-slate-100 dark:border-white/5 bg-white dark:bg-slate-900 rounded-xl px-4 text-sm font-bold text-slate-700 dark:text-white outline-none focus:border-[#4AA3A2] focus:ring-2 focus:ring-[#4AA3A2]/5 transition-all appearance-none cursor-pointer">
                                        {effectiveExtraTypes.map((type) => (
                                            <option key={type} value={type}>{type}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1.5 block ml-2">Nombre</label>
                                    <input type="number" min="1" value={extraCount} onChange={e => setExtraCount(parseInt(e.target.value) || 1)} className="w-full h-10 border-2 border-slate-100 dark:border-white/5 bg-white dark:bg-slate-900 rounded-xl px-4 text-sm font-bold text-slate-700 dark:text-white outline-none focus:border-[#4AA3A2] focus:ring-2 focus:ring-[#4AA3A2]/5 transition-all" />
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 block ml-2">Date du renfort</label>
                                <WeekCalendar selected={selectedDate} onSelect={setSelectedDate} dates={weekDates} />
                            </div>

                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1.5 block ml-2">Heure de début</label>
                                    <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full h-10 border-2 border-slate-100 dark:border-white/5 bg-white dark:bg-slate-900 rounded-xl px-4 text-sm font-bold text-slate-700 dark:text-white outline-none focus:border-[#4AA3A2] focus:ring-2 focus:ring-[#4AA3A2]/5 transition-all" />
                                </div>
                                <div className="flex-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1.5 block ml-2">Heure de fin</label>
                                    <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full h-10 border-2 border-slate-100 dark:border-white/5 bg-white dark:bg-slate-900 rounded-xl px-4 text-sm font-bold text-slate-700 dark:text-white outline-none focus:border-[#4AA3A2] focus:ring-2 focus:ring-[#4AA3A2]/5 transition-all" />
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1.5 block ml-2">Employé</label>
                                <select 
                                    value={selectedEmpId} 
                                    onChange={e => setSelectedEmpId(e.target.value)} 
                                    className="w-full h-10 border-2 border-slate-100 dark:border-white/5 bg-white dark:bg-slate-900 rounded-xl px-4 text-sm font-bold text-slate-700 dark:text-white outline-none focus:border-[#4AA3A2] focus:ring-2 focus:ring-[#4AA3A2]/5 transition-all appearance-none cursor-pointer"
                                >
                                    <option value="">-- Choisir un employé --</option>
                                    {employees.map(e => <option key={e.id} value={e.id}>{e.name.toUpperCase()}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 block ml-2">Type d'absence</label>
                                <div className="flex flex-wrap gap-2 px-2">
                                    {effectiveAbsenceTypes.map((item) => {
                                        const isSelected = absenceType === item.code;
                                        const styles = {
                                            bg: item.color || '#ffe39b',
                                            text: '#000000'
                                        };
                                        const hex = styles.bg.toUpperCase().replace('#', '');
                                        const r = parseInt(hex.slice(0, 2), 16) || 0;
                                        const g = parseInt(hex.slice(2, 4), 16) || 0;
                                        const b = parseInt(hex.slice(4, 6), 16) || 0;
                                        const textR = Math.max(0, Math.floor(r * 0.35));
                                        const textG = Math.max(0, Math.floor(g * 0.35));
                                        const textB = Math.max(0, Math.floor(b * 0.35));
                                        const toHex = (c: number) => c.toString(16).padStart(2, '0');
                                        styles.text = (hex === '000000') ? '#FFFFFF' : `#${toHex(textR)}${toHex(textG)}${toHex(textB)}`;

                                        return (
                                            <button
                                                key={item.code}
                                                onClick={() => setAbsenceType(item.code)}
                                                className={`px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider border transition-all ${isSelected ? 'shadow-lg scale-105 ring-2 ring-[#4AA3A2]/20' : 'bg-slate-50 dark:bg-slate-900 text-slate-400 border-slate-100 dark:border-white/5 hover:border-slate-300'}`}
                                                style={isSelected ? { backgroundColor: styles.bg, color: styles.text, borderColor: 'transparent' } : {}}
                                            >
                                                {item.code}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <div className="flex-1 text-center">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 block">Début d'absence</label>
                                    <FullCalendar value={absenceStartDate} onChange={setAbsenceStartDate} />
                                </div>
                                <div className="flex-1 text-center">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 block">Fin d'absence</label>
                                    <FullCalendar value={absenceEndDate} onChange={setAbsenceEndDate} />
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className="px-6 py-4 border-t border-slate-200 dark:border-white/5 flex gap-3 shrink-0">
                    <button 
                        onClick={onClose} 
                        className="flex-1 h-10 rounded-xl font-bold text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all uppercase text-[10px] tracking-widest"
                    >
                        Annuler
                    </button>
                    <button 
                        onClick={handleSubmit} 
                        className="flex-1 h-10 rounded-xl font-bold bg-[#4AA3A2] text-white shadow-lg shadow-[#4AA3A2]/20 hover:brightness-110 active:scale-[0.98] transition-all uppercase text-[10px] tracking-widest"
                    >
                        Confirmer
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddShiftModal;
