import { Shift, Template, ABSENCE_TYPES, getContrastColor } from './types';

interface ShiftCellProps {
    shift?: Shift;
    isDayView?: boolean;
    templates?: Template[];
    absenceTypes?: { code: string; color?: string }[];
}

const ShiftCell: React.FC<ShiftCellProps> = ({ shift, isDayView, templates, absenceTypes }) => {
    if (!shift || !shift.segments || shift.segments.length === 0) return null;

    const getAbsenceStyle = (label: string) => {
        if (label === 'REPOS') {
            return { bg: '#000000', text: '#FFFFFF', border: 'border-black' };
        }

        const type = absenceTypes?.find(t => t.code === label);
        const bgColor = type?.color || '#FFEBEE';
        const textColor = getContrastColor(bgColor);

        return { bg: bgColor, text: textColor, border: 'border-transparent shadow-sm ring-1 ring-black/5' };
    };

    return (
        <div className={`w-full h-full flex items-center justify-center gap-1 ${isDayView ? 'flex-row' : 'flex-col justify-center'}`}>
            {shift.segments.map((seg, i) => {
                let bg = 'var(--bg-planning-cell)';
                let textStyle: React.CSSProperties = { color: 'var(--text-planning-cell)' };
                let borderClass = 'border-slate-200 dark:border-white/10';

                const isAbsence = seg.label === 'REPOS' || (seg.label && absenceTypes?.some(t => t.code === seg.label));

                if (isAbsence && seg.label) {
                    const style = getAbsenceStyle(seg.label);
                    bg = style.bg;
                    textStyle = { color: style.text, fontWeight: 'bold' };
                    borderClass = style.border;
                } else if (seg.type === 'horaire') {
                    if (seg.colorOverride) {
                        bg = seg.colorOverride; borderClass = 'border-transparent';
                    } else if (seg.templateId && templates) {
                        const tpl = templates.find(t => t.id === seg.templateId);
                        if (tpl && tpl.color) {
                            bg = tpl.color;
                            borderClass = 'border-transparent';
                        } else if (seg.color) {
                            bg = seg.color; borderClass = 'border-transparent';
                        }
                    } else if (seg.color) { 
                        bg = seg.color; borderClass = 'border-transparent'; 
                    } else { 
                        bg = 'var(--bg-planning-cell)'; borderClass = 'border-blue-200 dark:border-blue-900/30'; 
                    }
                    
                    if (bg !== 'var(--bg-planning-cell)') {
                        textStyle = { color: getContrastColor(bg), fontWeight: 'bold' };
                    }
                }
                const content = seg.type === 'horaire' ? (seg.label ? seg.label : `${seg.start}-${seg.end}`) : seg.label;

                return (
                    <div key={i} className="flex flex-col items-center w-full max-w-[90%]">
                        {seg.note && !isDayView && (
                            <span className="text-[8px] text-slate-500 font-medium mb-0.5 truncate max-w-full leading-tight">
                                {seg.note}
                            </span>
                        )}
                        <div className={`rounded px-1.5 py-0.5 text-[10px] whitespace-nowrap border flex items-center justify-center w-full ${borderClass}`} style={{ backgroundColor: bg }}>
                            <span className="truncate" style={textStyle}>{content}</span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default ShiftCell;
