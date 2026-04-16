import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { moduleApi } from '../../lib/api';
import { Briefcase, Plus, Trash2, Users, FileText, Pencil, Save, X, Search } from 'lucide-react';

type TabKey = 'posts' | 'employees';

interface JobPost {
    id: string;
    title: string;
}

interface EmployeeDocument {
    id?: string;
    display_name: string;
    file_name: string;
    mime_type?: string;
    file_size?: number;
    storage_key?: string;
}

interface Employee {
    id: string;
    first_name: string;
    last_name: string;
    email?: string;
    phone?: string;
    address?: string;
    position: string;
    job_post_title?: string;
    documents?: EmployeeDocument[];
}

const tabButton = (active: boolean) =>
    `px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${active ? 'bg-black text-white dark:bg-white dark:text-black' : 'text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-white/5'}`;

export const PostesEmployesModule = () => {
    const [activeTab, setActiveTab] = useState<TabKey>('posts');
    const [loading, setLoading] = useState(true);

    const [jobPosts, setJobPosts] = useState<JobPost[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);

    const [newPostTitle, setNewPostTitle] = useState('');
    const [showEmployeeModal, setShowEmployeeModal] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

    const [form, setForm] = useState({
        first_name: '',
        last_name: '',
        position: '',
        email: '',
        phone: '',
        address: ''
    });
    const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [employeeSearch, setEmployeeSearch] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [posts, emps] = await Promise.all([moduleApi.getJobPosts(), moduleApi.getEmployes()]);
            setJobPosts(posts || []);
            setEmployees(emps || []);
        } catch (e: any) {
            setError(e?.message || 'Erreur de chargement.');
        } finally {
            setLoading(false);
        }
    };

    const employeesByPost = useMemo(() => {
        const map: Record<string, number> = {};
        employees.forEach((emp) => {
            map[emp.position] = (map[emp.position] || 0) + 1;
        });
        return map;
    }, [employees]);

    const filteredEmployees = useMemo(() => {
        const term = employeeSearch.trim().toLowerCase();
        if (!term) return employees;
        return employees.filter((employee) => {
            const fullName = `${employee.first_name || ''} ${employee.last_name || ''}`.toLowerCase();
            const email = String(employee.email || '').toLowerCase();
            const phone = String(employee.phone || '').toLowerCase();
            const post = String(employee.job_post_title || '').toLowerCase();
            return fullName.includes(term) || email.includes(term) || phone.includes(term) || post.includes(term);
        });
    }, [employees, employeeSearch]);

    const resetForm = () => {
        setForm({ first_name: '', last_name: '', position: '', email: '', phone: '', address: '' });
        setDocuments([]);
        setEditingEmployee(null);
        setError('');
    };

    const openCreateEmployee = () => {
        resetForm();
        setShowEmployeeModal(true);
    };

    const openEditEmployee = (employee: Employee) => {
        setEditingEmployee(employee);
        setForm({
            first_name: employee.first_name || '',
            last_name: employee.last_name || '',
            position: employee.position || '',
            email: employee.email || '',
            phone: employee.phone || '',
            address: employee.address || ''
        });
        setDocuments(Array.isArray(employee.documents) ? employee.documents : []);
        setError('');
        setShowEmployeeModal(true);
    };

    const addPost = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPostTitle.trim()) return;
        try {
            await moduleApi.createJobPost({ title: newPostTitle.trim() });
            setNewPostTitle('');
            await loadData();
        } catch (err: any) {
            setError(err?.message || 'Impossible de créer le poste.');
        }
    };

    const removePost = async (id: string) => {
        if (!confirm('Supprimer ce poste ?')) return;
        try {
            await moduleApi.deleteJobPost(id);
            await loadData();
        } catch (err: any) {
            setError(err?.message || 'Impossible de supprimer ce poste.');
        }
    };

    const addDocuments = (files: FileList | null) => {
        if (!files) return;
        const next: EmployeeDocument[] = Array.from(files).map((file) => ({
            display_name: file.name,
            file_name: file.name,
            mime_type: file.type,
            file_size: file.size,
            storage_key: URL.createObjectURL(file)
        }));
        setDocuments((prev) => [...next, ...prev]);
    };

    const updateDocumentName = (index: number, value: string) => {
        setDocuments((prev) => prev.map((doc, i) => (i === index ? { ...doc, display_name: value } : doc)));
    };

    const removeDocument = (index: number) => {
        setDocuments((prev) => prev.filter((_, i) => i !== index));
    };

    const saveEmployee = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!form.first_name.trim() || !form.last_name.trim() || !form.position) {
            setError('Nom, prénom et poste sont obligatoires.');
            return;
        }

        const cleanDocs = documents
            .map((doc) => ({ ...doc, display_name: String(doc.display_name || '').trim() }))
            .filter((doc) => doc.display_name && doc.file_name);

        setSaving(true);
        try {
            const payload = {
                ...form,
                first_name: form.first_name.trim(),
                last_name: form.last_name.trim(),
                email: form.email.trim(),
                phone: form.phone.trim(),
                address: form.address.trim(),
                documents: cleanDocs
            };

            if (editingEmployee) {
                await moduleApi.updateEmploye(editingEmployee.id, payload);
            } else {
                await moduleApi.createEmploye(payload);
            }

            setShowEmployeeModal(false);
            resetForm();
            await loadData();
        } catch (err: any) {
            setError(err?.message || 'Impossible d\'enregistrer l\'employé.');
        } finally {
            setSaving(false);
        }
    };

    const deleteEmployee = async (id: string) => {
        if (!confirm('Supprimer cet employé ?')) return;
        try {
            await moduleApi.deleteEmploye(id);
            await loadData();
        } catch (err: any) {
            setError(err?.message || 'Impossible de supprimer cet employé.');
        }
    };

    return (
        <div className="space-y-8">
            <header className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Postes & Employés</h1>
                    <p className="text-slate-600 dark:text-gray-400 mt-1">Gestion RH complète: postes, profils collaborateurs et documents.</p>
                </div>
            </header>

            <div className="bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-white/10 rounded-2xl p-2 inline-flex gap-2 transition-colors duration-200">
                <button className={tabButton(activeTab === 'posts')} onClick={() => setActiveTab('posts')}>
                    Gestion des Postes
                </button>
                <button className={tabButton(activeTab === 'employees')} onClick={() => setActiveTab('employees')}>
                    Liste des Employés
                </button>
            </div>

            {error && <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}

            {activeTab === 'posts' && (
                <section className="space-y-6">
                    <div className="bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-white/10 rounded-2xl p-6 transition-colors duration-200">
                        <form onSubmit={addPost} className="flex gap-3">
                            <input
                                value={newPostTitle}
                                onChange={(e) => setNewPostTitle(e.target.value)}
                                placeholder="Intitulé du poste (ex: Hôtesse, Commercial...)"
                                className="flex-1 bg-slate-50 dark:bg-black border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white outline-none focus:border-slate-400 dark:focus:border-white transition-colors duration-200"
                            />
                            <button className="px-5 py-3 rounded-xl bg-black text-white dark:bg-white dark:text-black font-bold hover:opacity-90 inline-flex items-center gap-2 transition-colors duration-200">
                                <Plus size={16} /> Ajouter
                            </button>
                        </form>
                    </div>

                    <div className="bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden transition-colors duration-200">
                        <table className="w-full text-left">
                            <thead className="bg-slate-100 dark:bg-black/60 border-b border-gray-200 dark:border-white/10">
                                <tr>
                                    <th className="px-6 py-4 text-xs uppercase tracking-widest text-slate-700 dark:text-gray-500">Poste</th>
                                    <th className="px-6 py-4 text-xs uppercase tracking-widest text-slate-700 dark:text-gray-500">Employés liés</th>
                                    <th className="px-6 py-4 text-xs uppercase tracking-widest text-slate-700 dark:text-gray-500 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                                {!loading && jobPosts.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="px-6 py-12 text-center text-slate-500 dark:text-gray-500">Aucun poste créé.</td>
                                    </tr>
                                )}
                                {jobPosts.map((post) => (
                                    <tr key={post.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors duration-200">
                                        <td className="px-6 py-4 text-slate-900 dark:text-white font-medium">{post.title}</td>
                                        <td className="px-6 py-4 text-slate-700 dark:text-gray-400">{employeesByPost[post.id] || 0}</td>
                                        <td className="px-6 py-4 text-right">
                                            <button onClick={() => removePost(post.id)} className="p-2 rounded-lg text-red-400 hover:bg-red-500/10">
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {activeTab === 'employees' && (
                <section className="space-y-6">
                    <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
                        <div className="relative w-full md:max-w-sm">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-gray-500" />
                            <input
                                value={employeeSearch}
                                onChange={(e) => setEmployeeSearch(e.target.value)}
                                placeholder="Rechercher un employé, email, téléphone, poste..."
                                className="w-full bg-slate-50 dark:bg-black border border-gray-200 dark:border-white/10 rounded-xl pl-9 pr-4 py-3 text-slate-900 dark:text-white outline-none focus:border-slate-400 dark:focus:border-white text-sm transition-colors duration-200"
                            />
                        </div>
                        <button onClick={openCreateEmployee} className="px-5 py-3 rounded-xl bg-black text-white dark:bg-white dark:text-black font-bold hover:opacity-90 inline-flex items-center gap-2 transition-colors duration-200">
                            <Plus size={16} /> Ajouter un employé
                        </button>
                    </div>

                    <div className="bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden transition-colors duration-200">
                        <table className="w-full text-left">
                            <thead className="bg-slate-100 dark:bg-black/60 border-b border-gray-200 dark:border-white/10">
                                <tr>
                                    <th className="px-6 py-4 text-xs uppercase tracking-widest text-slate-700 dark:text-gray-500">Employé</th>
                                    <th className="px-6 py-4 text-xs uppercase tracking-widest text-slate-700 dark:text-gray-500">Poste</th>
                                    <th className="px-6 py-4 text-xs uppercase tracking-widest text-slate-700 dark:text-gray-500">Contact</th>
                                    <th className="px-6 py-4 text-xs uppercase tracking-widest text-slate-700 dark:text-gray-500">Documents</th>
                                    <th className="px-6 py-4 text-xs uppercase tracking-widest text-slate-700 dark:text-gray-500 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                                {!loading && filteredEmployees.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500 dark:text-gray-500">
                                            {employeeSearch.trim() ? 'Aucun résultat pour cette recherche.' : 'Aucun employé enregistré.'}
                                        </td>
                                    </tr>
                                )}
                                {filteredEmployees.map((employee) => (
                                    <tr key={employee.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors duration-200">
                                        <td className="px-6 py-4">
                                            <p className="text-slate-900 dark:text-white font-medium">{employee.first_name} {employee.last_name}</p>
                                            <p className="text-xs text-slate-500 dark:text-gray-500">ID {employee.id}</p>
                                        </td>
                                        <td className="px-6 py-4 text-slate-800 dark:text-gray-300">{employee.job_post_title || '-'}</td>
                                        <td className="px-6 py-4 text-slate-700 dark:text-gray-400 text-sm">
                                            <div>{employee.email || '-'}</div>
                                            <div>{employee.phone || '-'}</div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-800 dark:text-gray-300">{employee.documents?.length || 0}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => openEditEmployee(employee)} className="p-2 rounded-lg text-slate-700 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors duration-200">
                                                    <Pencil size={16} />
                                                </button>
                                                <button onClick={() => deleteEmployee(employee.id)} className="p-2 rounded-lg text-red-400 hover:bg-red-500/10">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            <AnimatePresence>
                {showEmployeeModal && (
                    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-6 overflow-y-auto">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.96 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.96 }}
                            className="w-full max-w-3xl bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden transition-colors duration-200"
                        >
                            <div className="p-6 bg-slate-100 dark:bg-black border-b border-gray-200 dark:border-white/10 flex items-center justify-between transition-colors duration-200">
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{editingEmployee ? 'Modifier Employé' : 'Nouvel Employé'}</h2>
                                <button onClick={() => setShowEmployeeModal(false)} className="p-2 rounded-lg text-slate-500 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-white/5 transition-colors duration-200">
                                    <X size={18} />
                                </button>
                            </div>

                            <form onSubmit={saveEmployee} className="p-6 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs uppercase tracking-widest text-slate-600 dark:text-gray-500 font-bold">Prénom *</label>
                                        <input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className="w-full bg-slate-50 dark:bg-black border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white outline-none focus:border-slate-400 dark:focus:border-white transition-colors duration-200" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs uppercase tracking-widest text-slate-600 dark:text-gray-500 font-bold">Nom *</label>
                                        <input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className="w-full bg-slate-50 dark:bg-black border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white outline-none focus:border-slate-400 dark:focus:border-white transition-colors duration-200" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs uppercase tracking-widest text-slate-600 dark:text-gray-500 font-bold">Poste *</label>
                                        <select value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} className="w-full bg-slate-50 dark:bg-black border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white outline-none focus:border-slate-400 dark:focus:border-white transition-colors duration-200">
                                            <option value="">Sélectionner un poste</option>
                                            {jobPosts.map((post) => (
                                                <option key={post.id} value={post.id}>{post.title}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs uppercase tracking-widest text-slate-600 dark:text-gray-500 font-bold">Adresse mail</label>
                                        <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full bg-slate-50 dark:bg-black border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white outline-none focus:border-slate-400 dark:focus:border-white transition-colors duration-200" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs uppercase tracking-widest text-slate-600 dark:text-gray-500 font-bold">Téléphone</label>
                                        <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full bg-slate-50 dark:bg-black border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white outline-none focus:border-slate-400 dark:focus:border-white transition-colors duration-200" />
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
                                        <label className="text-xs uppercase tracking-widest text-slate-600 dark:text-gray-500 font-bold">Adresse postale</label>
                                        <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full bg-slate-50 dark:bg-black border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white outline-none focus:border-slate-400 dark:focus:border-white transition-colors duration-200" />
                                    </div>
                                </div>

                                <div className="space-y-4 border border-gray-200 dark:border-white/10 rounded-2xl p-4 bg-slate-50 dark:bg-black/50 transition-colors duration-200">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-white inline-flex items-center gap-2"><FileText size={14} /> Documents</h3>
                                        <label className="px-3 py-2 rounded-lg bg-black text-white dark:bg-white dark:text-black text-xs font-bold cursor-pointer hover:opacity-90 transition-colors duration-200">
                                            Ajouter fichier
                                            <input type="file" multiple className="hidden" onChange={(e) => addDocuments(e.target.files)} />
                                        </label>
                                    </div>

                                    {documents.length === 0 && <p className="text-xs text-slate-500 dark:text-gray-500">Aucun document lié.</p>}

                                    <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                                        {documents.map((doc, idx) => (
                                            <div key={`${doc.file_name}-${idx}`} className="grid grid-cols-1 md:grid-cols-[1fr_220px_auto] gap-2 items-center p-3 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-[#0A0A0A] transition-colors duration-200">
                                                <p className="text-sm text-slate-700 dark:text-gray-300 truncate">{doc.file_name}</p>
                                                <input
                                                    value={doc.display_name}
                                                    onChange={(e) => updateDocumentName(idx, e.target.value)}
                                                    placeholder="Nom personnalisé"
                                                    className="bg-slate-50 dark:bg-black border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm outline-none focus:border-slate-400 dark:focus:border-white transition-colors duration-200"
                                                />
                                                <button type="button" onClick={() => removeDocument(idx)} className="p-2 rounded-lg text-red-400 hover:bg-red-500/10">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 pt-2">
                                    <button type="button" onClick={() => setShowEmployeeModal(false)} className="px-5 py-3 rounded-xl border border-gray-200 dark:border-white/10 text-slate-900 dark:text-white font-bold hover:bg-slate-100 dark:hover:bg-white/5 transition-colors duration-200">
                                        Annuler
                                    </button>
                                    <button disabled={saving} className="px-5 py-3 rounded-xl bg-black text-white dark:bg-white dark:text-black font-bold hover:opacity-90 inline-flex items-center gap-2 disabled:opacity-60 transition-colors duration-200">
                                        <Save size={15} /> {saving ? 'Enregistrement...' : 'Enregistrer'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};
