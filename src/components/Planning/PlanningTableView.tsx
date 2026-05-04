import React, { useState, useEffect } from 'react';
import { moduleApi } from '../../lib/api';
import { 
    Search,
    Users,
    Clock,
    AlertCircle,
    Building2,
    User
} from 'lucide-react';
import { motion } from 'framer-motion';

export const PlanningTableView = () => {
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadEvents();
    }, []);

    const loadEvents = async () => {
        setLoading(true);
        try {
            const data = await moduleApi.getEvenementiel();
            setEvents(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const filteredEvents = events.filter(event => {
        const name = event.type === 'PRIVÉ' ? `${event.first_name || ''} ${event.last_name || ''}` : (event.company_name || '');
        return name.toLowerCase().includes(searchTerm.toLowerCase());
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-[var(--text-primary)]">Planning Événementiel</h2>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                    <input 
                        type="text"
                        placeholder="Rechercher..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 bg-[var(--bg-soft)] border border-[var(--border-color)] rounded-xl text-sm text-[var(--text-primary)] outline-none focus:border-white/20 transition-all w-64"
                    />
                </div>
            </div>

            <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-[var(--bg-soft)] border-b border-[var(--border-color)]">
                                <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Nom / Entreprise</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-center">Pax</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Horaires</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Hôtesse Interne</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-center">Extras Hôtesses</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-color)]">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-[var(--text-muted)]">Chargement...</td>
                                </tr>
                            ) : filteredEvents.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-[var(--text-muted)]">Aucune privatisation trouvée</td>
                                </tr>
                            ) : filteredEvents.map((event) => {
                                const clientName = event.type === 'PRIVÉ'
                                    ? `${event.first_name || ''} ${event.last_name || ''}`.trim()
                                    : (event.company_name || '—');
                                
                                const hotesseStaff = event.staff?.find((s: any) => s.name?.toLowerCase().includes('hôtesse'));
                                const hotesseAssignments = event.assignments?.filter((a: any) => a.staff_type_name?.toLowerCase().includes('hôtesse')) || [];
                                
                                const needed = hotesseStaff?.count || 0;
                                const assigned = hotesseAssignments.length;
                                const extras = Math.max(0, needed - assigned);

                                const startTime = event.start_time
                                    ? new Date(event.start_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                                    : '--:--';
                                const endTime = event.end_time
                                    ? new Date(event.end_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                                    : '--:--';

                                return (
                                    <motion.tr 
                                        key={event.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="hover:bg-[var(--interactive-hover)] transition-all text-sm"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
                                                    {event.type === 'PRIVÉ' ? <User size={14} /> : <Building2 size={14} />}
                                                </div>
                                                <span className="font-bold text-[var(--text-primary)]">{clientName}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-500/10 text-slate-400 text-xs font-bold">
                                                <Users size={12} />
                                                {event.num_people || 0}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-[var(--text-muted)] text-xs">
                                                <Clock size={12} />
                                                {startTime} → {endTime}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-1">
                                                {hotesseAssignments.length === 0 ? (
                                                    <span className="text-gray-600 italic text-xs">Aucune</span>
                                                ) : hotesseAssignments.map((a: any, i: number) => (
                                                    <span key={i} className="px-2 py-0.5 rounded bg-green-500/10 text-green-400 text-[10px] font-bold">
                                                        {a.employee_name}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {extras > 0 ? (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-orange-500/10 text-orange-400 text-xs font-bold border border-orange-500/20">
                                                    <AlertCircle size={12} />
                                                    {extras}
                                                </span>
                                            ) : (
                                                <span className="text-gray-600 text-xs">—</span>
                                            )}
                                        </td>
                                    </motion.tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
