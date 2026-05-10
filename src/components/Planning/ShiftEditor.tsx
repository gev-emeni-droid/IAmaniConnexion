import React, { useState, useEffect, useMemo } from 'react';
import { X, ChevronDown, Clock, MessageSquare, Palette } from 'lucide-react';
import { Shift, ShiftSegment, ShiftServiceType, Template, getContrastColor } from './types';

interface ShiftEditorProps {
    shift: Shift;
    employeeName: string;
    employeeRoleId: string;
    availableTemplates: Template[];
    onSave: (updated: Shift) => void;
    onBatchSave?: (dates: string[], shift: Shift) => void;
    onClose: () => void;
    position: { x: number, y: number };
    currentDate: string;
    absenceTypes: { code: string; isFullDay: boolean; autoApply: boolean; color?: string }[];
}

const ShiftEditor: React.FC<ShiftEditorProps> = ({ 
    shift, employeeName, employeeRoleId, availableTemplates, onSave, onClose, position, currentDate, absenceTypes = [] 
}) => {
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
    const [segments, setSegments] = useState<ShiftSegment[]>([]);

    const effectiveAbsenceTypes = useMemo(() => {
        return Array.isArray(absenceTypes) ? absenceTypes : [];
    }, [absenceTypes]);

    useEffect(() => {
        if (shift && shift.segments && shift.segments.length > 0) {
            setSegments(shift.segments);
            const firstSeg = shift.segments[0];
            if (firstSeg.templateId) setSelectedTemplateId(firstSeg.templateId);
        } else {
            setSegments([{ type: 'horaire', start: '10:00', end: '15:00', note: '' }]);
        }
    }, [shift]);

    const handleTemplateChange = (templateId: string) => {
        setSelectedTemplateId(templateId);
        if (templateId) {
            const tpl = availableTemplates.find(t => t.id === templateId);
            if (tpl) {
                const newSegs = tpl.slots.map(slot => ({
                    type: 'horaire' as const,
                    start: slot.start,
                    end: slot.end,
                    templateId: tpl.id,
                    hasOverride: false,
                    colorOverride: tpl.color,
                    note: ''
                }));
                setSegments(newSegs);
            }
        }
    };

    const handleAddSegment = () => {
        setSegments([...segments, { type: 'horaire', start: '18:00', end: '23:00', note: '' }]);
    };

    const handleRemoveSegment = (index: number) => {
        const newSegs = [...segments];
        newSegs.splice(index, 1);
        setSegments(newSegs);
    };

    const updateSegment = (index: number, field: keyof ShiftSegment, value: any) => {
        const newSegs = [...segments];
        
        let isFullDayAbsence = false;
        // Si on sélectionne un code d'absence "Journée Entière", on remplace tout
        if (field === 'label' && value) {
            const abs = absenceTypes.find(a => a.code === value);
            if (abs?.isFullDay) {
                isFullDayAbsence = true;
                setSegments([{ type: 'code', label: value, note: '' }]);
                return;
            }
        }

        newSegs[index] = { ...newSegs[index], [field]: value, hasOverride: true };

        // Si on change un label d'absence (non full-day)
        if (field === 'label' && value && !isFullDayAbsence && value !== 'REPOS') {
            const abs = absenceTypes.find(a => a.code === value);
            if (abs?.autoApply) {
                newSegs.forEach((seg, i) => {
                    newSegs[i] = { ...seg, label: value, hasOverride: true };
                });
            }
        }

        setSegments(newSegs);
    };

    const handleSave = () => {
        let finalSegments = [...segments];
        let type: 'travail' | 'repos' | 'absence' = 'travail';
        let serviceType: ShiftServiceType = 'none';

        const hasMidi = finalSegments.some(s => s.start && s.start < "16:00");
        const hasSoir = finalSegments.some(s => s.end && (s.end >= "16:00" || s.end < s.start));
        if (hasMidi && hasSoir) serviceType = 'midi+soir';
        else if (hasMidi) serviceType = 'midi';
        else if (hasSoir) serviceType = 'soir';

        // Détection du type global
        if (finalSegments.length === 1) {
            const seg = finalSegments[0];
            if (seg.label === 'REPOS') type = 'repos';
            else if (seg.label && absenceTypes.some(a => a.code === seg.label && a.isFullDay)) type = 'absence';
        }
        
        // Si au moins un segment a un label d'absence flexible
        if (type === 'travail' && finalSegments.some(s => s.label && s.label !== 'REPOS')) {
            // On reste en type travail car il y a des horaires, mais le PDF devra gérer les labels rouges
        }

        onSave({
            ...shift,
            type,
            serviceType,
            segments: finalSegments,
            isManual: true
        });
        onClose();
    };

    const style: React.CSSProperties = {
        position: 'absolute',
        top: position.y,
        left: Math.min(position.x, window.innerWidth - 320),
        zIndex: 100
    };

    const colors = ['#60b4ff', '#c7d0e9', '#ffe39b', '#7fd13b', '#94efe3', '#ff0000'];

    return (
        <>
            <div className="fixed inset-0 z-[90] bg-black/10" onClick={onClose}></div>
            <div style={style} className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 w-80 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100 font-sans">
                <div className="px-4 py-3 border-b border-slate-200 dark:border-white/5 flex justify-between items-center bg-white dark:bg-slate-900">
                    <h4 className="font-bold text-slate-800 dark:text-white uppercase text-sm tracking-wide">{employeeName}</h4>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"><X size={18} /></button>
                </div>

                <div className="p-4 space-y-4 bg-white dark:bg-slate-800 flex-1 overflow-y-auto max-h-[60vh] text-sm">
                    <div>
                        <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5 block tracking-wide">Modèle Horaire</label>
                        <div className="relative">
                            <select
                                className="w-full h-9 border-2 border-slate-100 dark:border-white/5 rounded-lg px-3 text-sm appearance-none bg-slate-50 dark:bg-slate-900/50 hover:border-[#4AA3A2]/30 dark:hover:border-[#4AA3A2]/20 focus:border-[#4AA3A2] focus:ring-4 focus:ring-[#4AA3A2]/5 outline-none pr-10 text-slate-700 dark:text-slate-200 transition-all font-medium cursor-pointer"
                                value={selectedTemplateId}
                                onChange={(e) => handleTemplateChange(e.target.value)}
                            >
                                <option value="">-- Sélectionner un modèle --</option>
                                {availableTemplates
                                    .filter(t => !employeeRoleId || !t.role || t.role === employeeRoleId)
                                    .map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                            </select>
                            <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                    </div>

                    <div className="space-y-4">
                        {segments.map((seg, idx) => (
                            <div key={idx} className="relative p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-white/5 shadow-sm">
                                {segments.length > 1 && (
                                    <button onClick={() => handleRemoveSegment(idx)} className="absolute -top-2 -right-2 bg-white dark:bg-slate-800 text-slate-400 hover:text-red-500 rounded-full p-1 shadow border border-slate-200 dark:border-white/10"><X size={12} /></button>
                                )}
                                
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="relative flex-1">
                                        <input
                                            type="time"
                                            className="w-full h-9 border border-slate-200 dark:border-white/10 rounded px-2 text-sm text-center bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:ring-1 focus:ring-[#4AA3A2] outline-none"
                                            value={seg.start || ''}
                                            onChange={e => updateSegment(idx, 'start', e.target.value)}
                                        />
                                        <Clock size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    </div>
                                    <span className="text-slate-300 dark:text-slate-600">-</span>
                                    <div className="relative flex-1">
                                        <input
                                            type="time"
                                            className="w-full h-9 border border-slate-200 dark:border-white/10 rounded px-2 text-sm text-center bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:ring-1 focus:ring-[#4AA3A2] outline-none"
                                            value={seg.end || ''}
                                            onChange={e => updateSegment(idx, 'end', e.target.value)}
                                        />
                                        <Clock size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    </div>
                                </div>

                                <div className="mb-3">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block tracking-wide">Type d'absence</label>
                                    <div className="flex flex-wrap gap-1.5">
                                        <button
                                            onClick={() => updateSegment(idx, 'label', seg.label === 'REPOS' ? undefined : 'REPOS')}
                                            className={`px-2 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${seg.label === 'REPOS' ? 'bg-black text-white border-black shadow-md scale-105' : 'bg-white dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-white/10 hover:border-slate-300'}`}
                                        >
                                            REPOS
                                        </button>
                                        {absenceTypes.map(a => {
                                            const isSelected = seg.label === a.code;
                                            const styles = {
                                                bg: a.color || '#ffe39b',
                                                text: getContrastColor(a.color || '#ffe39b')
                                            };

                                            return (
                                                <button
                                                    key={a.code}
                                                    onClick={() => updateSegment(idx, 'label', isSelected ? undefined : a.code)}
                                                    className={`px-2 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${isSelected ? 'shadow-md scale-105 ring-2 ring-black/5' : 'bg-white dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-white/10 hover:border-slate-300'}`}
                                                    style={isSelected ? { backgroundColor: styles.bg, color: styles.text, borderColor: 'transparent' } : {}}
                                                >
                                                    {a.code}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="mb-3 relative">
                                    <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded px-3 py-1.5 focus-within:ring-1 focus-within:ring-[#4AA3A2] transition-all">
                                        <MessageSquare size={14} className="text-slate-400 shrink-0" />
                                        <input
                                            type="text"
                                            placeholder="Note pour ce segment..."
                                            className="w-full text-xs outline-none bg-transparent text-slate-600 dark:text-slate-300"
                                            value={seg.note || ''}
                                            onChange={e => updateSegment(idx, 'note', e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 border border-slate-200 dark:border-white/10 rounded px-3 py-2 bg-white dark:bg-slate-900 cursor-pointer hover:border-slate-300 dark:hover:border-white/20 transition-all relative group/color">
                                    <div className="w-4 h-4 rounded-full border border-slate-200 dark:border-white/10" style={{ backgroundColor: seg.colorOverride || '#e0e7ff' }}></div>
                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex-1 uppercase tracking-wider">Couleur</span>
                                    <Palette size={14} className="text-slate-400" />

                                    <div className="absolute top-full left-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 shadow-lg rounded-xl p-2 grid grid-cols-5 gap-1 z-50 hidden group-hover/color:grid w-full">
                                        {colors.map(c => (
                                            <button
                                                key={c}
                                                className="w-6 h-6 rounded-full border border-slate-100 dark:border-white/5 hover:scale-110 transition-transform"
                                                style={{ backgroundColor: c }}
                                                onClick={() => updateSegment(idx, 'colorOverride', c)}
                                            />
                                        ))}
                                        <button
                                            className="w-6 h-6 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors"
                                            onClick={() => updateSegment(idx, 'colorOverride', undefined)}
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <button onClick={handleAddSegment} className="w-full border border-dashed border-[#4AA3A2]/60 text-[#4AA3A2] rounded-lg py-2.5 text-xs font-bold hover:bg-[#4AA3A2]/10 transition-colors flex items-center justify-center gap-1.5">
                        + AJOUTER UN SEGMENT
                    </button>
                </div>

                <div className="p-4 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-slate-900/50">
                    <button onClick={handleSave} className="w-full h-11 bg-[#4AA3A2] text-white rounded-lg text-sm font-bold hover:brightness-95 shadow-md transition-all active:scale-95 uppercase tracking-wider">
                        Valider pour ce jour
                    </button>
                </div>
            </div>
        </>
    );
};

export default ShiftEditor;
