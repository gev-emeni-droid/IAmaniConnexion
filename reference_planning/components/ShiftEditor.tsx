import React, { useState, useEffect } from 'react';
import { X, ChevronDown, Palette, Clock } from 'lucide-react';
import { Shift, ShiftSegment, ABSENCE_TYPES, ShiftServiceType, Template } from '../types';
import { getTemplates } from '../services/storage';

interface ShiftEditorProps {
    shift: Shift;
    employeeName: string;
    employeeRoleId: string;
    onSave: (updated: Shift) => void;
    onBatchSave?: (dates: string[], shift: Shift) => void;
    onClose: () => void;
    position: { x: number, y: number };
    currentDate: string;
}

const ShiftEditor: React.FC<ShiftEditorProps> = ({ shift, employeeName, employeeRoleId, onSave, onClose, position }) => {
    const [availableTemplates, setAvailableTemplates] = useState<Template[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

    // Manage segments locally
    const [segments, setSegments] = useState<ShiftSegment[]>([]);
    const [globalNote, setGlobalNote] = useState<string>('');

    // Initialize state from shift
    useEffect(() => {
        if (shift && shift.segments.length > 0) {
            setSegments(shift.segments);
            const firstSeg = shift.segments[0];
            if (firstSeg.templateId) setSelectedTemplateId(firstSeg.templateId);
            if (firstSeg.note) setGlobalNote(firstSeg.note);
        } else {
            // Default state
            setSegments([{ type: 'horaire', start: '10:00', end: '15:00' }]);
        }
    }, [shift]);

    useEffect(() => {
        const loadTemplates = async () => {
            try {
                const allTemplates = await getTemplates();
                const normalizeRole = (r: string) => r.trim().replace(/\/$/, '').trim();
                const filtered = (Array.isArray(allTemplates) ? allTemplates : []).filter(t => normalizeRole(t.role) === 'GENERAL' || normalizeRole(t.role) === normalizeRole(employeeRoleId));
                setAvailableTemplates(filtered);
            } catch (err) {
                console.error('Failed to load templates:', err);
            }
        };
        loadTemplates();
    }, [employeeRoleId]);

    // Update segments when template changes
    useEffect(() => {
        if (selectedTemplateId) {
            const tpl = availableTemplates.find(t => t.id === selectedTemplateId);
            if (tpl) {
                const newSegs = tpl.slots.map(slot => ({
                    type: 'horaire' as const,
                    start: slot.start,
                    end: slot.end,
                    templateId: tpl.id,
                    hasOverride: false,
                    colorOverride: tpl.color,
                    note: globalNote // Preserve note
                }));
                setSegments(newSegs);
            }
        }
    }, [selectedTemplateId, availableTemplates]);

    const handleAddSegment = () => {
        setSegments([...segments, { type: 'horaire', start: '18:00', end: '23:00', note: globalNote }]);
    };

    const handleRemoveSegment = (index: number) => {
        const newSegs = [...segments];
        newSegs.splice(index, 1);
        setSegments(newSegs);
    };

    const updateSegment = (index: number, field: keyof ShiftSegment, value: any) => {
        const newSegs = [...segments];
        newSegs[index] = { ...newSegs[index], [field]: value, hasOverride: true };
        setSegments(newSegs);
    };

    const handleSave = () => {
        let finalSegments = [...segments];
        let type: 'travail' | 'repos' | 'absence' = 'travail';
        let serviceType: ShiftServiceType = 'none';

        // Apply global note to all segments
        if (finalSegments.length > 0) {
            finalSegments = finalSegments.map(s => ({ ...s, note: globalNote }));
        }

        // Determine service type
        const hasMidi = finalSegments.some(s => s.start && s.start < "16:00");
        const hasSoir = finalSegments.some(s => s.end && (s.end >= "16:00" || s.end < s.start));
        if (hasMidi && hasSoir) serviceType = 'midi+soir';
        else if (hasMidi) serviceType = 'midi';
        else if (hasSoir) serviceType = 'soir';

        onSave({
            ...shift,
            type,
            serviceType,
            segments: finalSegments
        });
        onClose();
    };

    const style: React.CSSProperties = {
        position: 'absolute',
        top: position.y,
        left: Math.min(position.x, window.innerWidth - 320),
        zIndex: 70
    };

    // Color palette
    const colors = [
        '#60b4ff', // Bleu clair
        '#c7d0e9', // Lilas
        '#ffe39b', // Jaune clair
        '#7fd13b', // Vert
        '#94efe3', // Cyan
        '#ff0000', // Rouge
    ];

    return (
        <>
            <div className="fixed inset-0 z-40 bg-transparent" onClick={onClose}></div>
            <div style={style} className="bg-white rounded-xl shadow-2xl border border-slate-200 w-80 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100 font-sans">

                {/* Header */}
                <div className="px-4 py-3 border-b flex justify-between items-center bg-white">
                    <h4 className="font-bold text-slate-800 uppercase text-sm tracking-wide">{employeeName}</h4>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4 bg-white flex-1 overflow-y-auto max-h-[60vh]">

                    {/* Template Select */}
                    <div>
                        <label className="text-[11px] font-bold text-slate-500 uppercase mb-1.5 block tracking-wide">Modèle Horaire</label>
                        <div className="relative">
                            <select
                                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm appearance-none bg-white hover:border-slate-300 focus:ring-1 focus:ring-blue-500 outline-none pr-8 text-slate-700 transition-colors"
                                value={selectedTemplateId}
                                onChange={(e) => setSelectedTemplateId(e.target.value)}
                            >
                                <option value="">-- Sélectionner --</option>
                                {availableTemplates.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                    </div>

                    {/* Note Input */}
                    <div>
                        <label className="text-[11px] font-bold text-slate-500 uppercase mb-1.5 block tracking-wide">Note (Optionnelle)</label>
                        <div className="relative">
                            <select
                                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white hover:border-slate-300 focus:ring-1 focus:ring-blue-500 outline-none text-slate-700 transition-colors appearance-none"
                                value={globalNote}
                                onChange={(e) => setGlobalNote(e.target.value)}
                            >
                                <option value="">Sélectionner...</option>
                                <option value="Hôtesse">Hôtesse</option>
                                <option value="Polpo Nord">Polpo Nord</option>
                                <option value="Polpo Plage">Polpo Plage</option>
                            </select>
                            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                    </div>

                    {/* Segment Editor Box */}
                    <div className="border border-slate-200 rounded-lg p-3 space-y-3 relative group">
                        <div className="space-y-3">
                            {segments.map((seg, idx) => (
                                <div key={idx} className="relative p-2 bg-slate-50 rounded border border-slate-100">
                                    {segments.length > 1 && (
                                        <button onClick={() => handleRemoveSegment(idx)} className="absolute -top-2 -right-2 bg-white text-slate-400 hover:text-red-500 rounded-full p-0.5 shadow border"><X size={12} /></button>
                                    )}

                                    {/* Time Inputs */}
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="relative flex-1">
                                            <input
                                                type="time"
                                                className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm text-center focus:ring-1 focus:ring-blue-500 outline-none"
                                                value={seg.start || ''}
                                                onChange={e => updateSegment(idx, 'start', e.target.value)}
                                            />
                                            <Clock size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                        </div>
                                        <span className="text-slate-300">-</span>
                                        <div className="relative flex-1">
                                            <input
                                                type="time"
                                                className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm text-center focus:ring-1 focus:ring-blue-500 outline-none"
                                                value={seg.end || ''}
                                                onChange={e => updateSegment(idx, 'end', e.target.value)}
                                            />
                                            <Clock size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                        </div>
                                    </div>

                                    {/* Coupure/Absence Dropdown */}
                                    <div className="mb-2 relative">
                                        <select
                                            className="w-full border border-slate-200 rounded px-3 py-1.5 text-sm appearance-none bg-white hover:border-slate-300 focus:ring-1 focus:ring-blue-500 outline-none text-slate-700 transition-colors"
                                            value={seg.label || ''}
                                            onChange={(e) => updateSegment(idx, 'label', e.target.value || undefined)}
                                        >
                                            <option value="">Pas de coupure</option>
                                            <option value="REPOS">REPOS</option>
                                            <option value="Ecole">Ecole</option>
                                            <optgroup label="Absences">
                                                {ABSENCE_TYPES.map(a => (
                                                    <option key={a} value={a}>{a}</option>
                                                ))}
                                            </optgroup>
                                        </select>
                                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    </div>

                                    {/* Color Picker Row */}
                                    <div className="flex items-center gap-2 border border-slate-200 rounded px-3 py-2 bg-white cursor-pointer hover:border-slate-300 relative group/color">
                                        <div className="w-4 h-4 rounded-full border border-slate-200" style={{ backgroundColor: seg.colorOverride || '#e0e7ff' }}></div>
                                        <span className="text-xs text-slate-600 flex-1">Couleur</span>
                                        <Palette size={14} className="text-slate-400" />

                                        {/* Color Popover */}
                                        <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 shadow-lg rounded-lg p-2 grid grid-cols-5 gap-1 z-50 hidden group-hover/color:grid w-full">
                                            {colors.map(c => (
                                                <button
                                                    key={c}
                                                    className="w-6 h-6 rounded-full border border-slate-100 hover:scale-110 transition-transform"
                                                    style={{ backgroundColor: c }}
                                                    onClick={() => updateSegment(idx, 'colorOverride', c)}
                                                />
                                            ))}
                                            <button
                                                className="w-6 h-6 rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-400 hover:text-red-500"
                                                onClick={() => updateSegment(idx, 'colorOverride', undefined)}
                                                title="Reset"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Add Segment Button */}
                    <button
                        onClick={handleAddSegment}
                        className="w-full border border-dashed border-blue-300 text-blue-600 rounded-lg py-2 text-xs font-semibold hover:bg-blue-50 transition-colors flex items-center justify-center gap-1"
                    >
                        + Ajouter un segment
                    </button>

                </div>

                {/* Footer Button */}
                <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                    <button
                        onClick={handleSave}
                        className="w-full bg-blue-600 text-white py-3 rounded-lg text-sm font-bold hover:bg-blue-700 shadow-sm transition-all active:scale-95"
                    >
                        Valider pour ce jour
                    </button>
                </div>
            </div>
        </>
    );
};

export default ShiftEditor;
