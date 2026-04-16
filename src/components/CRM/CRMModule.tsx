import React, { useState, useEffect } from 'react';
import { moduleApi } from '../../lib/api';
import { 
    Users, 
    Search, 
    Phone, 
    Mail, 
    Building2, 
    History, 
    Calendar,
    FileText,
    MapPin,
    ChevronRight,
    User,
    ArrowLeft,
    Briefcase,
    Trash2,
    Pencil,
    Save,
    X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type TabType = 'PROFESSIONNEL' | 'PRIVÉ';

export const CRMModule = () => {
    const [contacts, setContacts] = useState<any[]>([]);
    const [selectedContact, setSelectedContact] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>('PROFESSIONNEL');
    const [searchPro, setSearchPro] = useState('');
    const [searchPrive, setSearchPrive] = useState('');
    const [deletingContactId, setDeletingContactId] = useState<string | null>(null);
    const [actionError, setActionError] = useState('');
    const [isEditingContact, setIsEditingContact] = useState(false);
    const [savingContact, setSavingContact] = useState(false);
    const [editForm, setEditForm] = useState({
        type: 'PROFESSIONNEL' as TabType,
        first_name: '',
        last_name: '',
        company_name: '',
        organizer_name: '',
        phone: '',
        email: '',
        address: '',
        postal_code: '',
        city: '',
        country: 'France'
    });

    useEffect(() => {
        loadContacts();
    }, []);

    const loadContacts = async () => {
        setLoading(true);
        try {
            const data = await moduleApi.getCRMContacts();
            setContacts(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteContact = async (contact: any) => {
        const contactLabel = contact.type === 'PRIVÉ'
            ? `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim() || 'ce contact'
            : contact.company_name || contact.organizer_name || 'ce contact';

        if (!window.confirm(`Supprimer ${contactLabel} du CRM ?`)) {
            return;
        }

        setActionError('');
        setDeletingContactId(contact.id);

        try {
            await moduleApi.deleteCRMContact(contact.id);
            if (selectedContact?.id === contact.id) {
                setSelectedContact(null);
            }
            await loadContacts();
        } catch (err: any) {
            setActionError(err.message || 'Impossible de supprimer ce contact.');
        } finally {
            setDeletingContactId(null);
        }
    };

    const loadContactDetail = async (id: string) => {
        try {
            const data = await moduleApi.getCRMContact(id);
            setSelectedContact(data);
            setIsEditingContact(false);
        } catch (e) {
            console.error(e);
        }
    };

    const startEditContact = (contact: any) => {
        setActionError('');
        setEditForm({
            type: contact?.type === 'PRIVÉ' ? 'PRIVÉ' : 'PROFESSIONNEL',
            first_name: contact?.first_name || '',
            last_name: contact?.last_name || '',
            company_name: contact?.company_name || '',
            organizer_name: contact?.organizer_name || '',
            phone: contact?.phone || '',
            email: contact?.email || '',
            address: contact?.address || '',
            postal_code: contact?.postal_code || '',
            city: contact?.city || '',
            country: contact?.country || 'France'
        });
        setIsEditingContact(true);
    };

    const saveEditedContact = async () => {
        if (!selectedContact) return;
        setActionError('');
        setSavingContact(true);
        try {
            await moduleApi.updateCRMContact(selectedContact.id, editForm);
            const refreshed = await moduleApi.getCRMContact(selectedContact.id);
            setSelectedContact(refreshed);
            await loadContacts();
            setIsEditingContact(false);
        } catch (err: any) {
            setActionError(err.message || 'Impossible de modifier ce contact.');
        } finally {
            setSavingContact(false);
        }
    };

    const search = activeTab === 'PROFESSIONNEL' ? searchPro : searchPrive;
    const setSearch = activeTab === 'PROFESSIONNEL' ? setSearchPro : setSearchPrive;

    const proContacts = contacts.filter(c => c.type === 'PROFESSIONNEL');
    const priveContacts = contacts.filter(c => c.type === 'PRIVÉ');

    const filteredContacts = (activeTab === 'PROFESSIONNEL' ? proContacts : priveContacts).filter(c =>
        `${c.first_name ?? ''} ${c.last_name ?? ''} ${c.company_name ?? ''} ${c.phone ?? ''} ${c.address ?? ''} ${c.postal_code ?? ''} ${c.city ?? ''}`
            .toLowerCase()
            .includes(search.toLowerCase())
    );

    if (selectedContact) {
        return (
            <div className="space-y-10">
                <header className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => setSelectedContact(null)}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-500 dark:text-gray-400"
                        >
                            <ArrowLeft size={24} />
                        </button>
                        <div>
                        <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Fiche Contact</h1>
                        <p className="text-slate-600 dark:text-gray-400">Détails et historique des privatisations</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {!isEditingContact && (
                            <button
                                onClick={() => startEditContact(selectedContact)}
                                className="inline-flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-300 transition-all hover:bg-blue-500/20"
                            >
                                <Pencil size={16} />
                                Modifier
                            </button>
                        )}
                        <button
                            onClick={() => handleDeleteContact(selectedContact)}
                            disabled={deletingContactId === selectedContact.id || savingContact}
                            className="inline-flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 transition-all hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <Trash2 size={16} />
                            {deletingContactId === selectedContact.id ? 'Suppression...' : 'Supprimer le contact'}
                        </button>
                    </div>
                </header>

                {actionError && (
                    <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                        {actionError}
                    </div>
                )}

                {isEditingContact && (
                    <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0A0A0A] p-5 space-y-4 transition-colors duration-200">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-widest">Modifier le contact</h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-600 dark:text-gray-400 uppercase tracking-widest">Type</label>
                                <select
                                    value={editForm.type}
                                    onChange={(e) => setEditForm((prev) => ({ ...prev, type: e.target.value as TabType }))}
                                    className="w-full bg-slate-50 dark:bg-black border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none"
                                >
                                    <option value="PROFESSIONNEL">Professionnel</option>
                                    <option value="PRIVÉ">Privé</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-600 dark:text-gray-400 uppercase tracking-widest">Téléphone</label>
                                <input
                                    type="text"
                                    value={editForm.phone}
                                    onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))}
                                    className="w-full bg-slate-50 dark:bg-black border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-600 dark:text-gray-400 uppercase tracking-widest">Prénom</label>
                                <input
                                    type="text"
                                    value={editForm.first_name}
                                    onChange={(e) => setEditForm((prev) => ({ ...prev, first_name: e.target.value }))}
                                    className="w-full bg-slate-50 dark:bg-black border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-600 dark:text-gray-400 uppercase tracking-widest">Nom</label>
                                <input
                                    type="text"
                                    value={editForm.last_name}
                                    onChange={(e) => setEditForm((prev) => ({ ...prev, last_name: e.target.value }))}
                                    className="w-full bg-slate-50 dark:bg-black border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-600 dark:text-gray-400 uppercase tracking-widest">Entreprise</label>
                                <input
                                    type="text"
                                    value={editForm.company_name}
                                    onChange={(e) => setEditForm((prev) => ({ ...prev, company_name: e.target.value }))}
                                    className="w-full bg-slate-50 dark:bg-black border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-600 dark:text-gray-400 uppercase tracking-widest">Organisateur</label>
                                <input
                                    type="text"
                                    value={editForm.organizer_name}
                                    onChange={(e) => setEditForm((prev) => ({ ...prev, organizer_name: e.target.value }))}
                                    className="w-full bg-slate-50 dark:bg-black border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none"
                                />
                            </div>

                            <div className="md:col-span-2 space-y-1">
                                <label className="text-[10px] font-bold text-slate-600 dark:text-gray-400 uppercase tracking-widest">Email</label>
                                <input
                                    type="email"
                                    value={editForm.email}
                                    onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                                    className="w-full bg-slate-50 dark:bg-black border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none"
                                />
                            </div>

                            <div className="md:col-span-2 space-y-1">
                                <label className="text-[10px] font-bold text-slate-600 dark:text-gray-400 uppercase tracking-widest">Adresse postale</label>
                                <input
                                    type="text"
                                    value={editForm.address}
                                    onChange={(e) => setEditForm((prev) => ({ ...prev, address: e.target.value }))}
                                    className="w-full bg-slate-50 dark:bg-black border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-600 dark:text-gray-400 uppercase tracking-widest">Code postal</label>
                                <input
                                    type="text"
                                    value={editForm.postal_code}
                                    onChange={(e) => setEditForm((prev) => ({ ...prev, postal_code: e.target.value }))}
                                    className="w-full bg-slate-50 dark:bg-black border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-600 dark:text-gray-400 uppercase tracking-widest">Ville</label>
                                <input
                                    type="text"
                                    value={editForm.city}
                                    onChange={(e) => setEditForm((prev) => ({ ...prev, city: e.target.value }))}
                                    className="w-full bg-slate-50 dark:bg-black border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none"
                                />
                            </div>

                            <div className="md:col-span-2 space-y-1">
                                <label className="text-[10px] font-bold text-slate-600 dark:text-gray-400 uppercase tracking-widest">Pays</label>
                                <input
                                    type="text"
                                    value={editForm.country}
                                    onChange={(e) => setEditForm((prev) => ({ ...prev, country: e.target.value }))}
                                    className="w-full bg-slate-50 dark:bg-black border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                                type="button"
                                onClick={() => setIsEditingContact(false)}
                                disabled={savingContact}
                                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-white/10 px-3 py-2 text-xs font-bold text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-60"
                            >
                                <X size={14} /> Annuler
                            </button>
                            <button
                                type="button"
                                onClick={saveEditedContact}
                                disabled={savingContact}
                                className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-bold text-black hover:bg-gray-200 disabled:opacity-60"
                            >
                                <Save size={14} /> {savingContact ? 'Enregistrement...' : 'Enregistrer'}
                            </button>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    {/* Profil Card */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white dark:bg-[#111111] rounded-3xl border border-gray-200 dark:border-white/10 p-8 text-center transition-colors duration-200">
                            <div className="w-24 h-24 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-gray-200 dark:border-white/10">
                                <User size={48} className="text-slate-700 dark:text-white" />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                                {selectedContact.type === 'PRIVÉ' ? `${selectedContact.first_name} ${selectedContact.last_name}` : selectedContact.company_name}
                            </h2>
                            <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mt-2">{selectedContact.type}</p>
                            
                            <div className="mt-10 space-y-4 text-left">
                                <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-black rounded-2xl border border-gray-200 dark:border-white/10 transition-colors duration-200">
                                    <Phone size={18} className="text-slate-500 dark:text-gray-500" />
                                    <span className="text-slate-900 dark:text-white font-medium">{selectedContact.phone}</span>
                                </div>
                                <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-black rounded-2xl border border-gray-200 dark:border-white/10 transition-colors duration-200">
                                    <Mail size={18} className="text-slate-500 dark:text-gray-500" />
                                    <span className="text-slate-900 dark:text-white font-medium">{selectedContact.email || 'Non renseigné'}</span>
                                </div>
                                {selectedContact.type === 'PROFESSIONNEL' && (
                                    <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-black rounded-2xl border border-gray-200 dark:border-white/10 transition-colors duration-200">
                                        <Building2 size={18} className="text-slate-500 dark:text-gray-500" />
                                        <span className="text-slate-900 dark:text-white font-medium">{selectedContact.organizer_name}</span>
                                    </div>
                                )}
                                {(selectedContact.address || selectedContact.postal_code || selectedContact.city) && (
                                    <div className="flex items-start gap-4 p-4 bg-slate-50 dark:bg-black rounded-2xl border border-gray-200 dark:border-white/10 transition-colors duration-200">
                                        <MapPin size={18} className="text-slate-500 dark:text-gray-500 mt-0.5" />
                                        <div className="text-slate-900 dark:text-white font-medium text-sm">
                                            <div>{selectedContact.address || 'Adresse non renseignée'}</div>
                                            <div>{[selectedContact.postal_code, selectedContact.city, selectedContact.country].filter(Boolean).join(' ')}</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Historique */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 mb-2">
                                <FileText className="text-slate-900 dark:text-white" size={22} />
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Factures liées</h3>
                            </div>
                            {selectedContact.factures?.length > 0 ? selectedContact.factures.map((facture: any) => (
                                <div key={facture.id} className="bg-white dark:bg-[#111111] rounded-2xl border border-gray-200 dark:border-white/10 p-4 flex items-center justify-between transition-all">
                                    <div>
                                        <p className="text-slate-900 dark:text-white font-bold">{facture.invoice_number || 'Facture'}</p>
                                        <p className="text-xs text-slate-500 dark:text-gray-500 mt-1">{facture.customer_name || 'Client'} • {facture.due_date ? new Date(facture.due_date).toLocaleDateString() : new Date(facture.created_at).toLocaleDateString()}</p>
                                    </div>
                                    <div className="text-sm font-bold text-slate-900 dark:text-white">
                                        {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(facture.total_ttc ?? facture.amount ?? 0))}
                                    </div>
                                </div>
                            )) : (
                                <p className="text-center text-slate-500 dark:text-gray-600 py-4 bg-white dark:bg-[#111111] rounded-2xl border border-dashed border-gray-200 dark:border-white/10">Aucune facture liée</p>
                            )}
                        </div>
                        <div className="flex items-center gap-3 mb-4">
                            <History className="text-slate-900 dark:text-white" size={24} />
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Historique des Événements</h3>
                        </div>

                        <div className="space-y-4">
                            {selectedContact.history?.map((event: any) => (
                                <div key={event.id} className="bg-white dark:bg-[#111111] rounded-2xl border border-gray-200 dark:border-white/10 p-6 flex items-center justify-between group hover:border-gray-300 dark:hover:border-white/20 transition-all">
                                    <div className="flex items-center gap-6">
                                        <div className="w-12 h-12 bg-slate-100 dark:bg-white/5 rounded-xl flex flex-col items-center justify-center text-slate-900 dark:text-white border border-gray-200 dark:border-white/10">
                                            <span className="text-[10px] font-bold uppercase opacity-50">{new Date(event.start_time).toLocaleDateString('fr-FR', { month: 'short' })}</span>
                                            <span className="text-lg font-bold leading-none">{new Date(event.start_time).getDate()}</span>
                                        </div>
                                        <div>
                                            <p className="text-slate-900 dark:text-white font-bold">{event.type === 'PRIVÉ' ? 'Privatisation Particulier' : `Event Pro - ${event.company_name}`}</p>
                                            <div className="flex items-center gap-4 mt-1">
                                                <span className="text-xs text-slate-500 dark:text-gray-500 flex items-center gap-1">
                                                    <Calendar size={12} />
                                                    {event.spaces || 'N/A'}
                                                </span>
                                                <span className="text-xs text-slate-500 dark:text-gray-500 flex items-center gap-1">
                                                    <Users size={12} />
                                                    {event.num_people} pers.
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-slate-500 dark:text-gray-500">{new Date(event.start_time).getFullYear()}</p>
                                        <p className="text-xs font-bold text-slate-900 dark:text-white mt-1">{new Date(event.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                </div>
                            ))}
                            {(!selectedContact.history || selectedContact.history.length === 0) && (
                                <p className="text-center text-slate-500 dark:text-gray-600 py-10 bg-white dark:bg-[#111111] rounded-2xl border border-dashed border-gray-200 dark:border-white/10">Aucun historique trouvé</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {actionError && (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                    {actionError}
                </div>
            )}

            {/* Header */}
            <header className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">CRM Contacts</h1>
                    <p className="text-slate-600 dark:text-gray-400 mt-1">Base de données clients et historique événementiel</p>
                </div>
                <div className="relative w-80">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-gray-500" size={20} />
                    <input
                        type="text"
                        placeholder={activeTab === 'PROFESSIONNEL' ? 'Rechercher un professionnel...' : 'Rechercher un client privé...'}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full bg-white dark:bg-[#111111] border border-gray-300 dark:border-white/10 rounded-xl pl-12 pr-4 py-3 text-slate-900 dark:text-white outline-none focus:border-slate-400 dark:focus:border-white transition-all"
                    />
                </div>
            </header>

            {/* Tabs */}
            <div className="flex gap-1 bg-white dark:bg-[#111111] p-1 rounded-xl border border-gray-200 dark:border-white/10 w-fit transition-colors duration-200">
                {([
                    { key: 'PROFESSIONNEL', label: 'Clients Professionnels', icon: Briefcase, count: proContacts.length },
                    { key: 'PRIVÉ',         label: 'Clients Privés',         icon: User,     count: priveContacts.length },
                ] as { key: TabType; label: string; icon: any; count: number }[]).map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                            activeTab === tab.key
                                ? 'bg-black text-white dark:bg-white dark:text-black shadow'
                                : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                        <tab.icon size={15} />
                        {tab.label}
                        <span className={`ml-1 text-xs font-bold px-2 py-0.5 rounded-full ${
                            activeTab === tab.key ? 'bg-white/20 dark:bg-black/10 text-white dark:text-black' : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-gray-500'
                        }`}>{tab.count}</span>
                    </button>
                ))}
            </div>

            {/* Grid */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18 }}
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                >
                    {filteredContacts.map((contact, i) => (
                        <motion.button
                            key={contact.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04 }}
                            onClick={() => loadContactDetail(contact.id)}
                            className="bg-white dark:bg-[#0A0A0A] p-6 rounded-2xl border border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20 transition-all text-left group"
                        >
                            {activeTab === 'PROFESSIONNEL' ? (
                                /* ── Carte Professionnel ── */
                                <>
                                    <div className="flex items-center gap-4 mb-5">
                                        <div className="w-12 h-12 bg-slate-100 dark:bg-white/5 rounded-xl flex items-center justify-center border border-gray-200 dark:border-white/10 group-hover:bg-black dark:group-hover:bg-white group-hover:text-white dark:group-hover:text-black transition-all shrink-0">
                                            <Building2 size={22} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                                                {contact.company_name || '—'}
                                            </h3>
                                            {contact.organizer_name && (
                                                <p className="text-xs text-slate-500 dark:text-gray-500 truncate">{contact.organizer_name}</p>
                                            )}
                                        </div>
                                        <ChevronRight className="text-slate-400 dark:text-gray-700 group-hover:text-slate-900 dark:group-hover:text-white transition-all shrink-0" size={20} />
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-gray-400">
                                            <Phone size={14} className="text-slate-500 dark:text-gray-600 shrink-0" />
                                            <span>{contact.phone}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-gray-400">
                                            <Mail size={14} className="text-slate-500 dark:text-gray-600 shrink-0" />
                                            <span className="truncate">{contact.email || 'N/A'}</span>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                /* ── Carte Privé ── */
                                <>
                                    <div className="flex items-center gap-4 mb-5">
                                        <div className="w-12 h-12 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center border border-gray-200 dark:border-white/10 group-hover:bg-black dark:group-hover:bg-white group-hover:text-white dark:group-hover:text-black transition-all shrink-0">
                                            <User size={22} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                                                {`${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim() || '—'}
                                            </h3>
                                            <p className="text-xs text-slate-500 dark:text-gray-500 uppercase tracking-widest font-bold">Particulier</p>
                                        </div>
                                        <ChevronRight className="text-slate-400 dark:text-gray-700 group-hover:text-slate-900 dark:group-hover:text-white transition-all shrink-0" size={20} />
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-gray-400">
                                            <Phone size={14} className="text-slate-500 dark:text-gray-600 shrink-0" />
                                            <span>{contact.phone}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-gray-400">
                                            <Mail size={14} className="text-slate-500 dark:text-gray-600 shrink-0" />
                                            <span className="truncate">{contact.email || 'N/A'}</span>
                                        </div>
                                    </div>
                                </>
                            )}

                            <div className="mt-5 pt-5 border-t border-gray-200 dark:border-white/10 flex items-center justify-between">
                                <span className="text-[10px] text-slate-500 dark:text-gray-600 font-bold uppercase tracking-widest">Dernière activité</span>
                                <span className="text-[10px] text-slate-600 dark:text-gray-400 font-bold">{new Date(contact.updated_at).toLocaleDateString()}</span>
                            </div>
                        </motion.button>
                    ))}

                    {filteredContacts.length === 0 && !loading && (
                        <div className="col-span-full py-20 text-center bg-white dark:bg-[#0A0A0A] rounded-3xl border border-dashed border-gray-300 dark:border-white/10 transition-colors duration-200">
                            <Users size={48} className="text-slate-400 dark:text-gray-700 mx-auto mb-4" />
                            <p className="text-slate-500 dark:text-gray-500 font-medium">
                                {search ? 'Aucun résultat pour cette recherche' : 'Aucun contact dans cette catégorie'}
                            </p>
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    );
};
