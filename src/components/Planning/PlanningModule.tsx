import React, { useState, useEffect } from 'react';
import { moduleApi } from '../../lib/api';
import { 
    Calendar as CalendarIcon, 
    Users, 
    Clock, 
    Search,
    Building2,
    User,
    UserCheck,
    AlertCircle
} from 'lucide-react';
import { motion } from 'motion/react';

export const PlanningModule = () => {
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
            setEvents(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const filteredEvents = events.filter(event => {
        const name = event.type === 'PRIVÉ' ? `${event.first_name} ${event.last_name}` : event.company_name;
        return name.toLowerCase().includes(searchTerm.toLowerCase());
    });

    return (
        <div className="space-y-10">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Planning Événementiel</h1>
                    <p className="text-gray-500 mt-1">Vue d'ensemble de toutes vos privatisations</p>
                </div>
                <div className="flex gap-4">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                        <input 
                            type="text"
                            placeholder="Rechercher..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-12 pr-6 py-3 bg-[#111111] border border-white/5 rounded-xl text-white outline-none focus:border-white/20 transition-all w-64"
                        />
                    </div>
                </div>
            </header>

            <div className="bg-[#111111] rounded-3xl border border-white/5 overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white/[0.02] border-b border-white/5">
                                <th className="px-8 py-6 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Nom / Entreprise</th>
                                <th className="px-8 py-6 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-center">Nombre de Personnes</th>
                                <th className="px-8 py-6 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Heure Début / Fin</th>
                                <th className="px-8 py-6 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Hôtesse Interne Booker</th>
                                <th className="px-8 py-6 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-center">Extras Hôtesses</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-8 py-20 text-center text-gray-500">Chargement du planning...</td>
                                </tr>
                            ) : filteredEvents.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-8 py-20 text-center text-gray-500">Aucune privatisation trouvée</td>
                                </tr>
                            ) : filteredEvents.map((event) => {
                                const clientName = event.type === 'PRIVÉ' ? `${event.first_name} ${event.last_name}` : event.company_name;
                                
                                // Find "Hôtesse" staff info
                                const hotesseStaff = event.staff?.find((s: any) => s.name.toLowerCase().includes('hôtesse'));
                                const hotesseAssignments = event.assignments?.filter((a: any) => a.staff_type_name.toLowerCase().includes('hôtesse')) || [];
                                
                                const needed = hotesseStaff?.count || 0;
                                const assigned = hotesseAssignments.length;
                                const extras = Math.max(0, needed - assigned);

                                return (
                                    <motion.tr 
                                        key={event.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="hover:bg-white/[0.01] transition-all group"
                                    >
                                        {/* 1. NOM PRENOM/ENTREPRISE */}
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center group-hover:bg-white/10 transition-all">
                                                    {event.type === 'PRIVÉ' ? <User size={18} className="text-gray-400" /> : <Building2 size={18} className="text-gray-400" />}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-white">{clientName}</p>
                                                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">{event.type}</p>
                                                </div>
                                            </div>
                                        </td>

                                        {/* 2. NOMBRE DE PERSONNES */}
                                        <td className="px-8 py-6 text-center">
                                            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg text-white font-bold">
                                                <Users size={14} className="text-gray-500" />
                                                <span>{event.num_people}</span>
                                            </div>
                                        </td>

                                        {/* 3. HEURE DEBUT ET HEURE FIN */}
                                        <td className="px-8 py-6">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2 text-white font-bold">
                                                    <Clock size={14} className="text-gray-500" />
                                                    <span>{new Date(event.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                    <span className="text-gray-600">—</span>
                                                    <span>{new Date(event.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                                                    {new Date(event.start_time).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </p>
                                            </div>
                                        </td>

                                        {/* 4. HÔTESSE INTERNE BOOKER */}
                                        <td className="px-8 py-6">
                                            <div className="flex flex-wrap gap-1.5">
                                                {hotesseAssignments.length > 0 ? (
                                                    hotesseAssignments.map((a: any, i: number) => (
                                                        <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 text-blue-400 rounded-lg text-[10px] font-bold border border-blue-500/20">
                                                            <UserCheck size={10} />
                                                            {a.employee_name}
                                                        </div>
                                                    ))
                                                ) : (
                                                    <span className="text-gray-600 text-[10px] font-bold italic">Aucun interne</span>
                                                )}
                                            </div>
                                        </td>

                                        {/* 5. NOMBRE D'HOTESSE EN EXTRA */}
                                        <td className="px-8 py-6 text-center">
                                            <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl font-bold text-base ${extras > 0 ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20 shadow-lg shadow-orange-500/5' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>
                                                {extras}
                                            </div>
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
