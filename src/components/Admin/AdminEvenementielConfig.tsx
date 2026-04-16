import React, { useState, useEffect } from 'react';
import { adminApi } from '../../lib/api';
import { Plus, Trash2, Palette, Users, ChevronLeft, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Space {
    id: string;
    name: string;
    color: string;
}

interface StaffType {
    id: string;
    name: string;
}

interface Props {
    clientId: string;
    clientName: string;
    onBack: () => void;
}

export const AdminEvenementielConfig = ({ clientId, clientName, onBack }: Props) => {
    const [spaces, setSpaces] = useState<Space[]>([]);
    const [staffTypes, setStaffTypes] = useState<StaffType[]>([]);
    const [loading, setLoading] = useState(true);
    const [newSpace, setNewSpace] = useState({ name: '', color: '#FFFFFF' });
    const [newStaffType, setNewStaffType] = useState('');
    const [spaceEdits, setSpaceEdits] = useState<Record<string, { name: string; color: string }>>({});
    const [savingSpaceId, setSavingSpaceId] = useState<string | null>(null);
    // ...existing code...

    useEffect(() => {
        loadConfig();
    }, [clientId]);

    const loadConfig = async () => {
        setLoading(true);
        try {
            const [s, st] = await Promise.all([
                adminApi.getSpaces(clientId),
                adminApi.getStaffTypes(clientId)
            ]);
            setSpaces(s);
            setStaffTypes(st);
            const initialEdits: Record<string, { name: string; color: string }> = {};
            (s || []).forEach((space: any) => {
                initialEdits[space.id] = {
                    name: String(space.name || ''),
                    color: String(space.color || space.color_hex || '#FFFFFF')
                };
            });
            setSpaceEdits(initialEdits);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleAddSpace = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newSpace.name) return;
        try {
            await adminApi.createSpace(clientId, newSpace);
            setNewSpace({ name: '', color: '#FFFFFF' });
            loadConfig();
        } catch (e) {
            console.error(e);
        }
    };

    const handleDeleteSpace = async (id: string) => {
        if (!confirm('Supprimer cet espace ?')) return;
        try {
            await adminApi.deleteSpace(clientId, id);
            loadConfig();
        } catch (e) {
            console.error(e);
        }
    };

    const handleSaveSpace = async (spaceId: string) => {
        const draft = spaceEdits[spaceId];
        if (!draft) return;

        const cleanName = String(draft.name || '').trim();
        const cleanColor = String(draft.color || '').trim();

        if (!cleanName) {
            alert('Le nom de l\'espace est obligatoire.');
            return;
        }
        if (!/^#[0-9A-Fa-f]{6}$/.test(cleanColor)) {
            alert('Le code couleur doit etre au format #RRGGBB.');
            return;
        }

        try {
            setSavingSpaceId(spaceId);
            await adminApi.updateSpace(clientId, spaceId, { name: cleanName, color: cleanColor });
            await loadConfig();
        } catch (e) {
            console.error(e);
            alert('Impossible de modifier cet espace.');
        } finally {
            setSavingSpaceId(null);
        }
    };

    const handleAddStaffType = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newStaffType) return;
        try {
            await adminApi.createStaffType(clientId, { name: newStaffType });
            setNewStaffType('');
            loadConfig();
        } catch (e) {
            console.error(e);
        }
    };

    const handleDeleteStaffType = async (id: string) => {
        if (!confirm('Supprimer cette catégorie ?')) return;
        try {
            await adminApi.deleteStaffType(clientId, id);
            loadConfig();
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="space-y-10">
            <header className="flex items-center gap-4">
                <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-lg text-gray-400">
                    <ChevronLeft size={24} />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-white">Configuration Événementiel</h1>
                    <p className="text-gray-500">Client : {clientName}</p>
                </div>
                {/* ...existing code... */}
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                {/* Gestion des Espaces */}
                <section className="bg-[#111111] rounded-2xl border border-white/5 p-8">
                    <div className="flex items-center gap-3 mb-8">
                        <Palette className="text-blue-400" size={24} />
                        <h2 className="text-xl font-bold text-white">Espaces</h2>
                    </div>

                    <form onSubmit={handleAddSpace} className="flex gap-4 mb-8">
                        <input 
                            type="text" 
                            value={newSpace.name}
                            onChange={(e) => setNewSpace({ ...newSpace, name: e.target.value })}
                            placeholder="Nom de l'espace (ex: RDC)"
                            className="flex-1 bg-black border border-white/10 rounded-lg px-4 py-2 text-white outline-none focus:border-white transition-all"
                        />
                        <input 
                            type="color" 
                            value={newSpace.color}
                            onChange={(e) => setNewSpace({ ...newSpace, color: e.target.value })}
                            className="w-12 h-10 bg-black border border-white/10 rounded-lg p-1 cursor-pointer"
                        />
                        <button type="submit" className="bg-white text-black px-4 py-2 rounded-lg font-bold hover:bg-gray-200 transition-all">
                            <Plus size={20} />
                        </button>
                    </form>

                    <div className="space-y-3">
                        {spaces.map(space => (
                            <div key={space.id} className="flex items-center justify-between p-4 bg-black/40 rounded-xl border border-white/5 group">
                                <div className="flex items-center gap-4 flex-1">
                                    <input
                                        type="color"
                                        value={spaceEdits[space.id]?.color || '#FFFFFF'}
                                        onChange={(e) => setSpaceEdits((prev) => ({
                                            ...prev,
                                            [space.id]: {
                                                name: prev[space.id]?.name ?? space.name,
                                                color: e.target.value
                                            }
                                        }))}
                                        className="w-10 h-9 bg-black border border-white/10 rounded-lg p-1 cursor-pointer"
                                    />
                                    <input
                                        type="text"
                                        value={spaceEdits[space.id]?.name || ''}
                                        onChange={(e) => setSpaceEdits((prev) => ({
                                            ...prev,
                                            [space.id]: {
                                                name: e.target.value,
                                                color: prev[space.id]?.color ?? space.color
                                            }
                                        }))}
                                        className="flex-1 bg-black border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-white transition-all"
                                    />
                                </div>
                                <div className="flex items-center gap-2 ml-3">
                                    <button
                                        onClick={() => handleSaveSpace(space.id)}
                                        disabled={savingSpaceId === space.id}
                                        className="p-2 text-gray-400 hover:text-green-400 disabled:opacity-50 transition-all"
                                        title="Enregistrer"
                                    >
                                        <Save size={18} />
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteSpace(space.id)}
                                        className="p-2 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                        title="Supprimer"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {spaces.length === 0 && !loading && <p className="text-center text-gray-600 py-4">Aucun espace configuré</p>}
                    </div>
                </section>

                {/* Gestion des Catégories de Staff */}
                <section className="bg-[#111111] rounded-2xl border border-white/5 p-8">
                    <div className="flex items-center gap-3 mb-8">
                        <Users className="text-purple-400" size={24} />
                        <h2 className="text-xl font-bold text-white">Catégories de Staff</h2>
                    </div>

                    <form onSubmit={handleAddStaffType} className="flex gap-4 mb-8">
                        <input 
                            type="text" 
                            value={newStaffType}
                            onChange={(e) => setNewStaffType(e.target.value)}
                            placeholder="Intitulé du poste (ex: Hôtesse)"
                            className="flex-1 bg-black border border-white/10 rounded-lg px-4 py-2 text-white outline-none focus:border-white transition-all"
                        />
                        <button type="submit" className="bg-white text-black px-4 py-2 rounded-lg font-bold hover:bg-gray-200 transition-all">
                            <Plus size={20} />
                        </button>
                    </form>

                    <div className="space-y-3">
                        {staffTypes.map(type => (
                            <div key={type.id} className="flex items-center justify-between p-4 bg-black/40 rounded-xl border border-white/5 group">
                                <span className="font-medium text-white">{type.name}</span>
                                <button 
                                    onClick={() => handleDeleteStaffType(type.id)}
                                    className="p-2 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        ))}
                        {staffTypes.length === 0 && !loading && <p className="text-center text-gray-600 py-4">Aucune catégorie configurée</p>}
                    </div>
                </section>
            </div>
        </div>
    );
};
