import React, { useState, useEffect } from 'react';
import { adminApi } from '../../lib/api';
import { Plus, Trash2, Calendar, Settings, ChevronLeft, Save, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
    clientId: string;
    clientName: string;
    onBack: () => void;
}

export const AdminPlanningConfig = ({ clientId, clientName, onBack }: Props) => {
    const [absenceCodes, setAbsenceCodes] = useState<{ code: string; isFullDay: boolean; autoApply: boolean; color?: string }[]>([]);
    const [extraTypes, setExtraTypes] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const [newAbsenceCode, setNewAbsenceCode] = useState('');
    const [newAbsenceColor, setNewAbsenceColor] = useState('#ffe39b');
    const [newExtraType, setNewExtraType] = useState('');

    useEffect(() => {
        loadConfig();
    }, [clientId]);

    const loadConfig = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await adminApi.getClientPlanningConfig(clientId);
            const rawAbsences = Array.isArray(data.absenceCodes) ? data.absenceCodes : [];
            setAbsenceCodes(rawAbsences.map((v: any) => {
                if (typeof v === 'string') return { code: v, isFullDay: true, autoApply: true };
                // Extra safe extraction
                let codeStr = 'ABS';
                if (v && v.code) {
                    if (typeof v.code === 'object') codeStr = String(v.code.code || v.code.label || 'ABS');
                    else codeStr = String(v.code);
                }
                return { 
                    code: codeStr, 
                    isFullDay: !!v?.isFullDay,
                    autoApply: v.autoApply ?? !!v?.isFullDay,
                    color: v.color || '#ffe39b'
                };
            }));
            setExtraTypes(data.extraTypes || []);
        } catch (e) {
            console.error('Failed to load planning config:', e);
            setError('Impossible de charger la configuration.');
        } finally {
            setLoading(false);
        }
    };

    const getDynamicStyles = (hexColor: string) => {
        const hex = (hexColor || '#ffe39b').toUpperCase().replace('#', '');
        const r = parseInt(hex.slice(0, 2), 16) || 0;
        const g = parseInt(hex.slice(2, 4), 16) || 0;
        const b = parseInt(hex.slice(4, 6), 16) || 0;

        if (hex === '000000') return { bg: hexColor, text: '#FFFFFF' };
        if (hex === 'FFFFFF') return { bg: hexColor, text: '#000000' };

        const textR = Math.max(0, Math.floor(r * 0.35));
        const textG = Math.max(0, Math.floor(g * 0.35));
        const textB = Math.max(0, Math.floor(b * 0.35));

        const toHex = (c: number) => c.toString(16).padStart(2, '0');
        return { 
            bg: hexColor, 
            text: `#${toHex(textR)}${toHex(textG)}${toHex(textB)}` 
        };
    };

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        setSuccess(false);
        try {
            await adminApi.saveClientPlanningConfig(clientId, {
                absenceCodes,
                extraTypes
            });
            setSuccess(true);
            // Re-charger les données depuis la base pour confirmer la persistance
            await loadConfig();
            setTimeout(() => setSuccess(false), 3000);
        } catch (e: any) {
            console.error('Failed to save planning config:', e);
            setError(e?.message || 'Erreur lors de l\'enregistrement.');
        } finally {
            setSaving(false);
        }
    };

    const addAbsenceCode = (e: React.FormEvent) => {
        e.preventDefault();
        const code = newAbsenceCode.trim().toUpperCase();
        if (!code) return;
        if (code === 'REPOS') {
            setError('Le code REPOS est réservé et immuable.');
            return;
        }
        if (absenceCodes.some(a => a.code === code)) {
            setError('Ce code existe déjà.');
            return;
        }
        setAbsenceCodes([...absenceCodes, { code, isFullDay: true, autoApply: true, color: newAbsenceColor }]);
        setNewAbsenceCode('');
    };

    const removeAbsenceCode = (code: string) => {
        setAbsenceCodes(absenceCodes.filter(c => c.code !== code));
    };

    const toggleAbsenceFullDay = (code: string) => {
        setAbsenceCodes(prev => prev.map(a => a.code === code ? { ...a, isFullDay: !a.isFullDay } : a));
    };

    const toggleAbsenceAutoApply = (code: string) => {
        setAbsenceCodes(prev => prev.map(a => a.code === code ? { ...a, autoApply: !a.autoApply } : a));
    };

    const updateAbsenceColor = (code: string, color: string) => {
        setAbsenceCodes(prev => prev.map(a => a.code === code ? { ...a, color } : a));
    };

    const addExtraType = (e: React.FormEvent) => {
        e.preventDefault();
        const type = newExtraType.trim();
        if (!type) return;
        if (extraTypes.includes(type)) {
            setError('Ce type existe déjà.');
            return;
        }
        setExtraTypes([...extraTypes, type]);
        setNewExtraType('');
    };

    const removeExtraType = (type: string) => {
        setExtraTypes(extraTypes.filter(t => t !== type));
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500 gap-4">
                <div className="w-10 h-10 border-4 border-white/10 border-t-blue-500 rounded-full animate-spin" />
                <p className="font-medium">Chargement de la configuration...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-5xl mx-auto">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={onBack} 
                        className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 transition-all border border-white/5"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-white tracking-tight">Configuration Planning</h1>
                        <p className="text-sm text-gray-500 font-medium">Client : <span className="text-blue-400">{clientName}</span></p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <AnimatePresence>
                        {success && (
                            <motion.div 
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 10 }}
                                className="flex items-center gap-2 text-green-400 text-sm font-bold bg-green-500/10 px-4 py-2 rounded-xl border border-green-500/20"
                            >
                                <CheckCircle2 size={16} />
                                Enregistré
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <button 
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-blue-600/20 active:scale-95"
                    >
                        {saving ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <Save size={18} />
                        )}
                        Enregistrer les modifications
                    </button>
                </div>
            </header>

            {error && (
                <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 p-4 rounded-2xl text-red-400 text-sm font-medium"
                >
                    <AlertCircle size={20} />
                    {error}
                </motion.div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Codes d'Absence */}
                <section className="bg-white/[0.03] backdrop-blur-xl rounded-3xl border border-white/5 p-8 flex flex-col gap-6 shadow-2xl">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center text-orange-400">
                            <Clock size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Codes d'Absence</h2>
                            <p className="text-xs text-gray-500 font-medium">CP, RTT, Maladie, etc.</p>
                        </div>
                    </div>

                    <form onSubmit={addAbsenceCode} className="flex gap-3">
                        <input 
                            type="color" 
                            value={newAbsenceColor}
                            onChange={(e) => setNewAbsenceColor(e.target.value)}
                            className="w-14 h-12 bg-black/40 border border-white/10 rounded-2xl p-1 cursor-pointer outline-none focus:border-orange-500/50 transition-all"
                            title="Choisir la couleur de fond"
                        />
                        <input 
                            type="text" 
                            value={newAbsenceCode}
                            onChange={(e) => setNewAbsenceCode(e.target.value)}
                            placeholder="Nouveau code (ex: CP)"
                            className="flex-1 bg-black/40 border border-white/10 rounded-2xl px-5 py-3 text-white outline-none focus:border-orange-500/50 transition-all placeholder:text-gray-600 text-sm font-medium"
                        />
                        <button type="submit" className="bg-orange-500 hover:bg-orange-400 text-white p-3 rounded-2xl transition-all shadow-lg shadow-orange-500/20 active:scale-90">
                            <Plus size={24} />
                        </button>
                    </form>

                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        <AnimatePresence mode="popLayout">
                            {absenceCodes.filter(a => a.code !== 'REPOS').map(item => {
                                const styles = getDynamicStyles(item.color || '#ffe39b');
                                return (
                                    <motion.div 
                                        key={item.code}
                                        layout
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        className="flex items-center justify-between p-4 bg-white/[0.02] hover:bg-white/[0.05] rounded-2xl border border-white/5 group transition-all"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div 
                                                className="w-12 py-1.5 rounded-lg flex items-center justify-center font-black tracking-widest text-xs shadow-sm"
                                                style={{ backgroundColor: styles.bg, color: styles.text }}
                                            >
                                                {String(item.code)}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button 
                                                    onClick={() => toggleAbsenceFullDay(item.code)}
                                                    className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${item.isFullDay ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'bg-white/5 text-gray-500 border border-white/5'}`}
                                                    title="Fusionne les segments en une seule ligne d'absence"
                                                >
                                                    Journée
                                                </button>
                                                <button 
                                                    onClick={() => toggleAbsenceAutoApply(item.code)}
                                                    className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${item.autoApply ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-white/5 text-gray-500 border border-white/5'}`}
                                                    title="S'applique automatiquement à tous les segments du jour"
                                                >
                                                    Auto
                                                </button>
                                                <input 
                                                    type="color" 
                                                    value={item.color || '#ffe39b'}
                                                    onChange={(e) => updateAbsenceColor(item.code, e.target.value)}
                                                    className="w-6 h-6 rounded bg-transparent border-none cursor-pointer"
                                                    title="Modifier la couleur"
                                                />
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => removeAbsenceCode(item.code)}
                                            className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                        {absenceCodes.length === 0 && (
                            <div className="text-center py-10 border-2 border-dashed border-white/5 rounded-3xl">
                                <p className="text-gray-600 text-sm italic font-medium">Aucun code configuré</p>
                            </div>
                        )}
                    </div>
                </section>

                {/* Types de Renfort */}
                <section className="bg-white/[0.03] backdrop-blur-xl rounded-3xl border border-white/5 p-8 flex flex-col gap-6 shadow-2xl">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-purple-500/10 rounded-2xl flex items-center justify-center text-purple-400">
                            <Calendar size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Types de Renfort</h2>
                            <p className="text-xs text-gray-500 font-medium">Hôtesse, Sécurité, etc.</p>
                        </div>
                    </div>

                    <form onSubmit={addExtraType} className="flex gap-3">
                        <input 
                            type="text" 
                            value={newExtraType}
                            onChange={(e) => setNewExtraType(e.target.value)}
                            placeholder="Nouveau type (ex: Vigile)"
                            className="flex-1 bg-black/40 border border-white/10 rounded-2xl px-5 py-3 text-white outline-none focus:border-purple-500/50 transition-all placeholder:text-gray-600 text-sm font-medium"
                        />
                        <button type="submit" className="bg-purple-500 hover:bg-purple-400 text-white p-3 rounded-2xl transition-all shadow-lg shadow-purple-500/20 active:scale-90">
                            <Plus size={24} />
                        </button>
                    </form>

                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        <AnimatePresence mode="popLayout">
                            {extraTypes.map(type => (
                                <motion.div 
                                    key={type}
                                    layout
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    className="flex items-center justify-between p-4 bg-white/[0.02] hover:bg-white/[0.05] rounded-2xl border border-white/5 group transition-all"
                                >
                                    <span className="font-bold text-white">{type}</span>
                                    <button 
                                        onClick={() => removeExtraType(type)}
                                        className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                        {extraTypes.length === 0 && (
                            <div className="text-center py-10 border-2 border-dashed border-white/5 rounded-3xl">
                                <p className="text-gray-600 text-sm italic font-medium">Aucun type configuré</p>
                            </div>
                        )}
                    </div>
                </section>
            </div>

            <div className="bg-blue-500/5 border border-blue-500/10 rounded-3xl p-6 flex items-start gap-4">
                <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400">
                    <Settings size={20} />
                </div>
                <div className="text-sm">
                    <p className="text-white font-bold mb-1">Impact sur le client</p>
                    <p className="text-gray-500 leading-relaxed">
                        Ces configurations permettent au client de choisir ces types lors de la création de shifts dans son planning. 
                        Les codes d'absence seront utilisés pour les congés et les types de renfort pour les besoins ponctuels en personnel.
                    </p>
                </div>
            </div>
        </div>
    );
};
