import React from 'react';
import { Shift, Template, ABSENCE_TYPES } from './types';

interface ShiftCellProps {
    shift?: Shift;
    isDayView?: boolean;
    templates?: Template[];
}

const ShiftCell: React.FC<ShiftCellProps> = ({ shift, isDayView, templates }) => {
    if (!shift || !shift.segments || shift.segments.length === 0) return null;

    // Get note from first segment that has one
    const shiftNote = shift.segments.find(s => s.note)?.note;

    return (
        <div className={`w-full h-full flex items-center justify-center gap-1 ${isDayView ? 'flex-row' : 'flex-col justify-center'}`}>
            {shiftNote && !isDayView && (
                <span className="text-[9px] text-slate-600 font-medium mb-0.5 truncate max-w-full leading-tight">
                    {shiftNote}
                </span>
            )}
            {shift.segments.map((seg, i) => {
                let bg = '#ffffff';
                let textStyle: React.CSSProperties = { color: '#1e293b' };
                let borderClass = 'border-slate-200';

                if (seg.type === 'code') {
                    if (seg.label === 'REPOS') { bg = '#000000'; textStyle = { color: '#FFFFFF', fontWeight: 'bold' }; borderClass = 'border-black'; }
                    else if (seg.label === 'Ecole') { bg = '#EFEBE9'; textStyle = { color: '#5D4037', fontWeight: 'bold' }; borderClass = 'border-stone-300'; }
                    else if (seg.label === 'mise à dispo') { bg = '#5ee8d7'; textStyle = { color: '#FFFFFF', fontWeight: 'bold' }; borderClass = 'border-teal-300'; }
                    else if (seg.label && ABSENCE_TYPES.includes(seg.label as any)) { bg = '#FFEBEE'; textStyle = { color: '#D32F2F', fontWeight: 'bold' }; borderClass = 'border-red-100'; }
                } else if (seg.type === 'horaire') {
                    if (seg.label === 'REPOS') { bg = '#000000'; textStyle = { color: '#FFFFFF', fontWeight: 'bold' }; borderClass = 'border-black'; }
                    else if (seg.label === 'Ecole') { bg = '#EFEBE9'; textStyle = { color: '#5D4037', fontWeight: 'bold' }; borderClass = 'border-stone-300'; }
                    else if (seg.label === 'mise à dispo') { bg = '#5ee8d7'; textStyle = { color: '#FFFFFF', fontWeight: 'bold' }; borderClass = 'border-teal-300'; }
                    else if (seg.label && ABSENCE_TYPES.includes(seg.label as any)) {
                        bg = '#FFEBEE';
                        textStyle = { color: '#D32F2F', fontWeight: 'bold' };
                        borderClass = 'border-red-100';
                    } else if (seg.colorOverride) {
                        bg = seg.colorOverride; borderClass = 'border-transparent';
                    } else if (seg.templateId && templates) {
                        const tpl = templates.find(t => t.id === seg.templateId);
                        if (tpl && tpl.color) {
                            bg = tpl.color;
                            borderClass = 'border-transparent';
                        } else if (seg.color) {
                            bg = seg.color; borderClass = 'border-transparent';
                        }
                    } else if (seg.color) { bg = seg.color; borderClass = 'border-transparent'; }
                    else { bg = '#ffffff'; borderClass = 'border-blue-200'; }
                }
                const content = seg.type === 'horaire' ? (seg.label ? seg.label : `${seg.start}-${seg.end}`) : seg.label;

                return (
                    <div key={i} className="flex flex-col items-center w-full max-w-[90%]">
                        <div className={`rounded px-1.5 py-0.5 text-[10px] whitespace-nowrap border shadow-sm flex items-center justify-center w-full ${borderClass}`} style={{ backgroundColor: bg }}>
                            <span className="truncate" style={textStyle}>{content}</span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default ShiftCell;
