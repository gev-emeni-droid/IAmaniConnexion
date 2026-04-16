import React, { useMemo, useState, useEffect } from 'react';
import { moduleApi } from '../../lib/api';
import {
    X,
    Users,
    MapPin,
    Clock,
    CheckCircle2,
    AlertCircle,
    User,
    Building2,
    FileText,
    MessageSquare,
    Eye,
    Trash2,
    Paperclip
} from 'lucide-react';
import { motion } from 'motion/react';

interface Props {
    calendarId: string;
    month: number;
    year: number;
    onClose: () => void;
    onSuccess: () => void;
    initialEvent?: any | null;
}

interface StaffingRequirement {
    staffTypeId: string;
    staffTypeName: string;
    needed: number;
    assignedEmployeeIds: string[];
}

interface EventDocument {
    id?: string;
    file_name: string;
    mime_type?: string;
    file_size?: number;
    storage_key?: string;
}

interface AllowedTakerEmployee {
    id: string;
    first_name?: string;
    last_name?: string;
    email?: string;
}

interface CRMContactSuggestion {
    id: string;
    type?: 'PRIVÉ' | 'PROFESSIONNEL';
    first_name?: string;
    last_name?: string;
    company_name?: string;
    organizer_name?: string;
    phone?: string;
    email?: string;
}

export const EventForm = ({ calendarId, month, year, onClose, onSuccess, initialEvent = null }: Props) => {
    const isEditMode = !!initialEvent;
    const [activeTab, setActiveTab] = useState<'infos' | 'documents' | 'notes'>('infos');
    const [type, setType] = useState<'PRIVÉ' | 'PROFESSIONNEL'>('PRIVÉ');
    
    // Calculate min and max dates for the month
    const minDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const maxDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    // Default date: today if it's in the month, otherwise the first of the month
    const getDefaultDate = () => {
        const today = new Date();
        if (today.getFullYear() === year && today.getMonth() + 1 === month) {
            return today.toISOString().split('T')[0];
        }
        return minDate;
    };

    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        companyName: '',
        organizerName: '',
        phone: '',
        email: '',
        date: getDefaultDate(),
        startTime: '19:00',
        endTime: '02:00',
        numPeople: '',
        selectedSpaceId: ''
    });

    const [spaces, setSpaces] = useState<any[]>([]);
    const [staffTypes, setStaffTypes] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [staffingRequirements, setStaffingRequirements] = useState<StaffingRequirement[]>([]);
    const [allowedEmployeesByCategory, setAllowedEmployeesByCategory] = useState<Record<string, string[]>>({});
    const [documents, setDocuments] = useState<EventDocument[]>([]);
    const [noteText, setNoteText] = useState('');
    const [trackTakenBy, setTrackTakenBy] = useState(false);
    const [allowedTakenByEmployees, setAllowedTakenByEmployees] = useState<AllowedTakerEmployee[]>([]);
    const [takenById, setTakenById] = useState('');
    const [lookupTerm, setLookupTerm] = useState('');
    const [lookupField, setLookupField] = useState<'firstName' | 'lastName' | 'companyName' | 'phone' | 'email' | null>(null);
    const [lookupLoading, setLookupLoading] = useState(false);
    const [crmSuggestions, setCrmSuggestions] = useState<CRMContactSuggestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        const q = lookupTerm.trim();
        if (q.length < 2) {
            setCrmSuggestions([]);
            setLookupLoading(false);
            return;
        }

        let cancelled = false;
        setLookupLoading(true);

        const timer = setTimeout(async () => {
            try {
                const items = await moduleApi.searchCRMContacts(q);
                if (!cancelled) {
                    setCrmSuggestions(Array.isArray(items) ? items : []);
                }
            } catch {
                if (!cancelled) {
                    setCrmSuggestions([]);
                }
            } finally {
                if (!cancelled) {
                    setLookupLoading(false);
                }
            }
        }, 250);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [lookupTerm]);

    const loadData = async () => {
        try {
            const [config, e, mappings] = await Promise.all([
                moduleApi.getEvenementielConfig(),
                moduleApi.getEmployes(),
                moduleApi.getStaffCategoryMappings()
            ]);
            const configuredSpaces = config?.spaces || [];
            const authorizedCategories = config?.authorized_staff_categories || [];
            const allowedTakers = config?.allowed_taken_by_employees || [];

            setSpaces(configuredSpaces);
            setStaffTypes(authorizedCategories);
            setEmployees(e);
            setTrackTakenBy(!!config?.track_taken_by);
            setAllowedTakenByEmployees(allowedTakers);

            const groupedMappings: Record<string, string[]> = {};
            (mappings || []).forEach((row: any) => {
                if (!groupedMappings[row.staff_category_id]) {
                    groupedMappings[row.staff_category_id] = [];
                }
                groupedMappings[row.staff_category_id].push(row.employee_id);
            });
            setAllowedEmployeesByCategory(groupedMappings);
            
            setStaffingRequirements(authorizedCategories.map((type: any) => ({
                staffTypeId: type.id,
                staffTypeName: type.name,
                needed: 0,
                assignedEmployeeIds: []
            })));

            if (initialEvent) {
                const start = new Date(initialEvent.start_time);
                const end = new Date(initialEvent.end_time);

                setType(initialEvent.type || 'PRIVÉ');
                setFormData({
                    firstName: initialEvent.first_name || '',
                    lastName: initialEvent.last_name || '',
                    companyName: initialEvent.company_name || '',
                    organizerName: initialEvent.organizer_name || '',
                    phone: initialEvent.phone || '',
                    email: initialEvent.email || '',
                    date: start.toISOString().slice(0, 10),
                    startTime: start.toTimeString().slice(0, 5),
                    endTime: end.toTimeString().slice(0, 5),
                    numPeople: String(initialEvent.num_people || ''),
                    selectedSpaceId: initialEvent.spaces?.[0]?.id || ''
                });

                setDocuments(Array.isArray(initialEvent.documents) ? initialEvent.documents : []);
                setNoteText(initialEvent.note_text || '');
                setTakenById(initialEvent.taken_by_id || '');

                const requirementsByType: Record<string, StaffingRequirement> = {};
                authorizedCategories.forEach((staffType: any) => {
                    requirementsByType[staffType.id] = {
                        staffTypeId: staffType.id,
                        staffTypeName: staffType.name,
                        needed: 0,
                        assignedEmployeeIds: []
                    };
                });

                (initialEvent.staff || []).forEach((item: any) => {
                    if (!requirementsByType[item.staff_type_id]) return;
                    requirementsByType[item.staff_type_id].needed = Number(item.count || 0);
                });

                (initialEvent.assignments || []).forEach((assignment: any) => {
                    const req = requirementsByType[assignment.staff_type_id];
                    if (req && assignment.employee_id) {
                        req.assignedEmployeeIds.push(assignment.employee_id);
                    }
                });

                setStaffingRequirements(Object.values(requirementsByType));
            }
        } catch (err) {
            console.error(err);
        }
    };

    const updateStaffingNeed = (staffTypeId: string, needed: number) => {
        setStaffingRequirements(prev => prev.map(req => 
            req.staffTypeId === staffTypeId ? { ...req, needed } : req
        ));
    };

    const toggleAssignment = (employeeId: string, staffTypeId: string) => {
        setStaffingRequirements(prev => prev.map(req => {
            if (req.staffTypeId === staffTypeId) {
                const isAssigned = req.assignedEmployeeIds.includes(employeeId);
                return {
                    ...req,
                    assignedEmployeeIds: isAssigned
                        ? req.assignedEmployeeIds.filter(id => id !== employeeId)
                        : [...req.assignedEmployeeIds, employeeId]
                };
            }
            return req;
        }));
    };

    const addFiles = (files: FileList | null) => {
        if (!files) return;
        const nextDocs: EventDocument[] = [];
        for (const file of Array.from(files)) {
            nextDocs.push({
                file_name: file.name,
                mime_type: file.type,
                file_size: file.size,
                storage_key: URL.createObjectURL(file)
            });
        }
        setDocuments(prev => [...nextDocs, ...prev]);
    };

    const removeDocument = (index: number) => {
        setDocuments(prev => prev.filter((_, i) => i !== index));
    };

    const openDocument = (doc: EventDocument) => {
        if (!doc.storage_key) {
            alert('Document sans URL de visualisation.');
            return;
        }
        window.open(doc.storage_key, '_blank');
    };

    const triggerLookup = (field: 'firstName' | 'lastName' | 'companyName' | 'phone' | 'email', value: string) => {
        setLookupField(field);
        setLookupTerm(value);
    };

    const applyCRMContact = (contact: CRMContactSuggestion) => {
        if (contact.type === 'PRIVÉ' || contact.type === 'PROFESSIONNEL') {
            setType(contact.type);
        }

        setFormData(prev => ({
            ...prev,
            firstName: contact.first_name || prev.firstName,
            lastName: contact.last_name || prev.lastName,
            companyName: contact.company_name || prev.companyName,
            organizerName: contact.organizer_name || prev.organizerName,
            phone: contact.phone || prev.phone,
            email: contact.email || prev.email,
        }));

        setCrmSuggestions([]);
        setLookupTerm('');
        setLookupField(null);
    };

    const renderCRMSearchSuggestions = (field: 'firstName' | 'lastName' | 'companyName' | 'phone' | 'email') => {
        if (lookupField !== field) return null;
        if (!lookupLoading && crmSuggestions.length === 0) return null;

        return (
            <div className="mt-1 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-black shadow-lg max-h-48 overflow-y-auto">
                {lookupLoading && (
                    <div className="px-3 py-2 text-[10px] text-slate-500 dark:text-gray-400">Recherche CRM...</div>
                )}
                {!lookupLoading && crmSuggestions.map((contact) => {
                    const title = contact.type === 'PROFESSIONNEL'
                        ? (contact.company_name || 'Entreprise')
                        : [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim() || 'Particulier';
                    const secondaryParts = [contact.phone, contact.email].filter(Boolean);

                    return (
                        <button
                            key={contact.id}
                            type="button"
                            onMouseDown={() => applyCRMContact(contact)}
                            className="w-full text-left px-3 py-2 border-b last:border-b-0 border-gray-200 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                        >
                            <div className="text-[10px] font-bold text-slate-900 dark:text-white uppercase truncate">{title}</div>
                            {!!contact.organizer_name && (
                                <div className="text-[10px] text-slate-600 dark:text-gray-400 truncate">Organisateur: {contact.organizer_name}</div>
                            )}
                            {secondaryParts.length > 0 && (
                                <div className="text-[10px] text-slate-500 dark:text-gray-500 truncate">{secondaryParts.join(' • ')}</div>
                            )}
                        </button>
                    );
                })}
            </div>
        );
    };

    const normalizedEmployees = useMemo(() => {
        return employees.map((emp: any) => {
            let tags: string[] = [];
            if (Array.isArray(emp.tags)) {
                tags = emp.tags;
            } else if (typeof emp.tags === 'string' && emp.tags.trim()) {
                try {
                    const parsed = JSON.parse(emp.tags);
                    tags = Array.isArray(parsed) ? parsed : [];
                } catch {
                    tags = [emp.tags];
                }
            }
            const displayName = [emp.first_name, emp.last_name].filter(Boolean).join(' ').trim() || emp.name || emp.email || emp.id;
            return { ...emp, parsedTags: tags.map((t: string) => String(t).toLowerCase()), displayName };
        });
    }, [employees]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const staff_requests: Record<string, number> = {};
            const assignments: any[] = [];

            staffingRequirements.forEach(req => {
                if (req.needed > 0) {
                    staff_requests[req.staffTypeId] = req.needed;
                    req.assignedEmployeeIds.forEach(empId => {
                        assignments.push({ employee_id: empId, staff_type_id: req.staffTypeId });
                    });
                }
            });

            // Combine date and times
            const start_time = `${formData.date}T${formData.startTime}:00`;
            let end_time = `${formData.date}T${formData.endTime}:00`;

            // If end time is earlier than start time, assume it's the next day
            if (formData.endTime < formData.startTime) {
                const endDate = new Date(formData.date);
                endDate.setDate(endDate.getDate() + 1);
                end_time = `${endDate.toISOString().split('T')[0]}T${formData.endTime}:00`;
            }

            const requiresSpaceSelection = spaces.length > 0;
            const fallbackSpaceId = String(formData.selectedSpaceId || '').trim();
            if (requiresSpaceSelection && !fallbackSpaceId) {
                setError('Veuillez sélectionner un espace pour cette privatisation.');
                setActiveTab('infos');
                setLoading(false);
                return;
            }

            const payload = {
                calendar_id: calendarId,
                type,
                phone: formData.phone,
                email: formData.email,
                first_name: formData.firstName,
                last_name: formData.lastName,
                company_name: formData.companyName,
                organizer_name: formData.organizerName,
                start_time,
                end_time,
                num_people: formData.numPeople.trim() ? (parseInt(formData.numPeople) || 0) : null,
                space_ids: fallbackSpaceId ? [fallbackSpaceId] : [],
                staff_requests,
                assignments,
                note_text: noteText,
                documents,
                taken_by_id: trackTakenBy ? (takenById || null) : null
            };

            if (isEditMode) {
                await moduleApi.updateEvenementiel(initialEvent.id, payload);
            } else {
                await moduleApi.createEvenementiel(payload);
            }
            onSuccess();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const totalExtras = staffingRequirements.reduce((acc, req) => {
        return acc + Math.max(0, req.needed - req.assignedEmployeeIds.length);
    }, 0);

    const tabs = [
        { id: 'infos', label: 'Infos & Staffing', icon: User },
        { id: 'documents', label: 'Documents', icon: FileText },
        { id: 'notes', label: 'Messages / Notes', icon: MessageSquare }
    ] as const;

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 transition-colors duration-200">
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-5xl max-h-[90vh] bg-white dark:bg-[#0A0A0A] rounded-3xl border border-gray-200 dark:border-white/5 shadow-2xl overflow-hidden flex flex-col transition-colors duration-200"
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 dark:border-white/5 flex items-center justify-between bg-slate-100 dark:bg-[#111111] transition-colors duration-200 shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">{isEditMode ? 'Modifier la Privatisation' : 'Nouvelle Privatisation'}</h2>
                        <div className="flex gap-4 mt-2">
                            <button 
                                onClick={() => setType('PRIVÉ')}
                                className={`text-xs font-bold uppercase tracking-widest pb-1 border-b-2 transition-all ${type === 'PRIVÉ' ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white' : 'border-transparent text-slate-500 dark:text-gray-500'}`}
                            >
                                Particulier
                            </button>
                            <button 
                                onClick={() => setType('PROFESSIONNEL')}
                                className={`text-xs font-bold uppercase tracking-widest pb-1 border-b-2 transition-all ${type === 'PROFESSIONNEL' ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white' : 'border-transparent text-slate-500 dark:text-gray-500'}`}
                            >
                                Professionnel
                            </button>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-white/5 rounded-full text-slate-500 dark:text-gray-400 transition-colors duration-200">
                        <X size={24} />
                    </button>
                </div>

                <div className="px-6 py-4 overflow-y-auto flex-1">
                    <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-black p-1.5 rounded-xl border border-gray-300 dark:border-white/10 transition-colors duration-200 mb-4">
                        {tabs.map(tab => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[10px] font-bold transition-all ${
                                        activeTab === tab.id
                                            ? 'bg-black text-white dark:bg-white dark:text-black'
                                            : 'text-slate-500 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-white/5'
                                    }`}
                                >
                                    <Icon size={14} />
                                    <span>{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="px-6 py-4 space-y-3 overflow-y-auto flex-1">
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex items-center gap-2 text-sm">
                            <AlertCircle size={16} />
                            <p className="font-medium">{error}</p>
                        </div>
                    )}

                    {activeTab === 'infos' && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2 space-y-4">
                            <section className="space-y-2">
                                <h3 className="text-[11px] font-bold text-slate-600 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                    <User size={12} /> Infos Client
                                </h3>
                                <div className="grid grid-cols-2 gap-2">
                                    {type === 'PRIVÉ' ? (
                                        <>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-700 dark:text-gray-600 uppercase tracking-widest">Prénom</label>
                                                <input 
                                                    type="text"
                                                    value={formData.firstName}
                                                    onChange={e => {
                                                        const value = e.target.value;
                                                        setFormData({...formData, firstName: value});
                                                        triggerLookup('firstName', value);
                                                    }}
                                                    onBlur={() => setTimeout(() => setLookupField(null), 120)}
                                                    className="w-full bg-slate-50 dark:bg-black border border-gray-300 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-slate-400 dark:focus:border-white transition-colors duration-200"
                                                />
                                                {renderCRMSearchSuggestions('firstName')}
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-600 dark:text-gray-600 uppercase tracking-widest">Nom</label>
                                                <input 
                                                    type="text" required
                                                    value={formData.lastName}
                                                    onChange={e => {
                                                        const value = e.target.value;
                                                        setFormData({...formData, lastName: value});
                                                        triggerLookup('lastName', value);
                                                    }}
                                                    onBlur={() => setTimeout(() => setLookupField(null), 120)}
                                                    className="w-full bg-slate-50 dark:bg-black border border-gray-300 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-slate-400 dark:focus:border-white transition-colors duration-200"
                                                />
                                                {renderCRMSearchSuggestions('lastName')}
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-600 dark:text-gray-600 uppercase tracking-widest">Entreprise</label>
                                                <input 
                                                    type="text" required
                                                    value={formData.companyName}
                                                    onChange={e => {
                                                        const value = e.target.value;
                                                        setFormData({...formData, companyName: value});
                                                        triggerLookup('companyName', value);
                                                    }}
                                                    onBlur={() => setTimeout(() => setLookupField(null), 120)}
                                                    className="w-full bg-slate-50 dark:bg-black border border-gray-300 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-slate-400 dark:focus:border-white transition-colors duration-200"
                                                />
                                                {renderCRMSearchSuggestions('companyName')}
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-600 dark:text-gray-600 uppercase tracking-widest">Organisateur</label>
                                                <input 
                                                    type="text"
                                                    value={formData.organizerName}
                                                    onChange={e => setFormData({...formData, organizerName: e.target.value})}
                                                    className="w-full bg-slate-50 dark:bg-black border border-gray-300 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-slate-400 dark:focus:border-white transition-colors duration-200"
                                                />
                                            </div>
                                        </>
                                    )}
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-600 dark:text-gray-600 uppercase tracking-widest">Téléphone</label>
                                        <input 
                                            type="tel"
                                            value={formData.phone}
                                            onChange={e => {
                                                const value = e.target.value;
                                                setFormData({...formData, phone: value});
                                                triggerLookup('phone', value);
                                            }}
                                            onBlur={() => setTimeout(() => setLookupField(null), 120)}
                                            className="w-full bg-slate-50 dark:bg-black border border-gray-300 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-slate-400 dark:focus:border-white transition-colors duration-200"
                                        />
                                        {renderCRMSearchSuggestions('phone')}
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-600 dark:text-gray-600 uppercase tracking-widest">Email</label>
                                        <input 
                                            type="email"
                                            value={formData.email}
                                            onChange={e => {
                                                const value = e.target.value;
                                                setFormData({...formData, email: value});
                                                triggerLookup('email', value);
                                            }}
                                            onBlur={() => setTimeout(() => setLookupField(null), 120)}
                                            className="w-full bg-slate-50 dark:bg-black border border-gray-300 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-slate-400 dark:focus:border-white transition-colors duration-200"
                                        />
                                        {renderCRMSearchSuggestions('email')}
                                    </div>
                                </div>
                            </section>

                            <section className="space-y-2">
                                <h3 className="text-[11px] font-bold text-slate-500 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                    <Clock size={14} /> Logistique
                                </h3>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1 col-span-2">
                                        <label className="text-[10px] font-bold text-slate-600 dark:text-gray-600 uppercase tracking-widest">Date de l'événement</label>
                                        <input 
                                            type="date"
                                            min={minDate}
                                            max={maxDate}
                                            value={formData.date}
                                            onChange={e => setFormData({...formData, date: e.target.value})}
                                            className="w-full bg-slate-50 dark:bg-black border border-gray-300 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-slate-400 dark:focus:border-white transition-colors duration-200"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-600 dark:text-gray-600 uppercase tracking-widest">Heure de début</label>
                                        <input 
                                            type="time" required
                                            value={formData.startTime}
                                            onChange={e => setFormData({...formData, startTime: e.target.value})}
                                            className="w-full bg-slate-50 dark:bg-black border border-gray-300 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-slate-400 dark:focus:border-white transition-colors duration-200"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-600 dark:text-gray-600 uppercase tracking-widest">Heure de fin</label>
                                        <input 
                                            type="time" required
                                            value={formData.endTime}
                                            onChange={e => setFormData({...formData, endTime: e.target.value})}
                                            className="w-full bg-slate-50 dark:bg-black border border-gray-300 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-slate-400 dark:focus:border-white transition-colors duration-200"
                                        />
                                    </div>
                                    <div className="space-y-1 col-span-2">
                                        <label className="text-[10px] font-bold text-slate-600 dark:text-gray-600 uppercase tracking-widest">Nombre de personnes</label>
                                        <input 
                                            type="number"
                                            value={formData.numPeople}
                                            onChange={e => setFormData({...formData, numPeople: e.target.value})}
                                            className="w-full bg-slate-50 dark:bg-black border border-gray-300 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-slate-400 dark:focus:border-white transition-colors duration-200"
                                        />
                                    </div>
                                </div>
                            </section>

                            <section className="space-y-2">
                                <h3 className="text-[11px] font-bold text-slate-500 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                    <MapPin size={14} /> Espaces
                                </h3>
                                {spaces.length === 0 ? (
                                    <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm">
                                        Aucun espace configuré pour ce client. La privatisation peut être enregistrée sans sélection d'espace.
                                    </div>
                                ) : (
                                    <>
                                        <p className="text-[10px] font-bold text-slate-500 dark:text-gray-500 uppercase tracking-widest">
                                            Sélection d'espace obligatoire
                                        </p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    {spaces.map(space => (
                                                <button
                                                    key={space.id}
                                                    type="button"
                                                    onClick={() => setFormData(prev => ({ ...prev, selectedSpaceId: space.id }))}
                                                    className={`px-3 py-1.5 rounded-lg border transition-all text-xs font-bold flex items-center gap-2 ${
                                                        formData.selectedSpaceId === space.id
                                                            ? 'bg-black text-white dark:bg-white dark:text-black border-black dark:border-white'
                                                            : 'bg-slate-50 dark:bg-black border-gray-300 dark:border-white/10 text-slate-500 dark:text-gray-500 hover:border-slate-400 dark:hover:border-white/30'
                                                    }`}
                                                >
                                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: space.color_hex || space.color }} />
                                                    {space.name}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </section>

                            {trackTakenBy && (
                                <section className="space-y-2">
                                    <h3 className="text-[10px] font-bold text-slate-500 dark:text-gray-500 uppercase tracking-widest">Privatisation prise par</h3>
                                    <select
                                        value={takenById}
                                        onChange={(e) => setTakenById(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-black border border-gray-300 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-slate-400 dark:focus:border-white transition-colors duration-200"
                                    >
                                        <option value="">Sélectionner un preneur</option>
                                        {allowedTakenByEmployees.map((emp) => {
                                            const fullName = [emp.first_name, emp.last_name].filter(Boolean).join(' ').trim() || emp.email || emp.id;
                                            return (
                                                <option key={emp.id} value={emp.id}>{fullName}</option>
                                            );
                                        })}
                                    </select>
                                </section>
                            )}
                        </div>


                            <div className="space-y-4 bg-slate-50 dark:bg-white/[0.02] p-4 rounded-2xl border border-gray-200 dark:border-white/5 transition-colors duration-200">
                            <div className="flex items-center justify-between">
                                <h3 className="text-[11px] font-bold text-slate-500 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                    <Users size={14} /> Staffing (Gap Filling)
                                </h3>
                                <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${totalExtras === 0 ? 'bg-green-500/10 text-green-400' : 'bg-orange-500/10 text-orange-400'}`}>
                                    {totalExtras === 0 ? 'Staffing Complet' : `${totalExtras} Extras Nécessaires`}
                                </div>
                            </div>

                            <div className="space-y-3">
                                {staffingRequirements.map((req, idx) => {
                                    const extrasNeeded = Math.max(0, req.needed - req.assignedEmployeeIds.length);

                                    return (
                                        <div key={idx} className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="font-bold text-xs text-slate-900 dark:text-white">{req.staffTypeName}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] text-slate-500 dark:text-gray-500">Besoin:</span>
                                                    <input 
                                                        type="number"
                                                        min="0"
                                                        value={req.needed}
                                                        onChange={e => updateStaffingNeed(req.staffTypeId, parseInt(e.target.value) || 0)}
                                                        className="w-14 bg-slate-50 dark:bg-black border border-gray-300 dark:border-white/10 rounded-lg px-2 py-0.5 text-center text-xs text-slate-900 dark:text-white font-bold transition-colors duration-200"
                                                    />
                                                </div>
                                            </div>

                                            {/* Internal Booking */}
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-bold text-slate-600 dark:text-gray-600 uppercase tracking-widest">Booking Interne</p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {normalizedEmployees
                                                        .filter(emp => {
                                                            const mappedEmployeeIds = allowedEmployeesByCategory[req.staffTypeId] || [];
                                                            const keepAssigned = req.assignedEmployeeIds.includes(emp.id);
                                                            return mappedEmployeeIds.includes(emp.id) || keepAssigned;
                                                        })
                                                        .map(emp => {
                                                            const isAssigned = req.assignedEmployeeIds.includes(emp.id);
                                                            return (
                                                                <button
                                                                    key={emp.id}
                                                                    type="button"
                                                                    onClick={() => toggleAssignment(emp.id, req.staffTypeId)}
                                                                    className={`px-2 py-0.5 rounded-md text-[10px] font-medium border transition-all ${
                                                                        isAssigned 
                                                                                ? 'bg-blue-500/20 border-blue-500/50 text-blue-500 dark:text-blue-400' 
                                                                                : 'bg-slate-50 dark:bg-black border-gray-300 dark:border-white/5 text-slate-500 dark:text-gray-500 hover:border-slate-400 dark:hover:border-white/20'
                                                                    }`}
                                                                >
                                                                    {emp.displayName}
                                                                </button>
                                                            );
                                                        })}
                                                    {normalizedEmployees.filter(emp => {
                                                        const mappedEmployeeIds = allowedEmployeesByCategory[req.staffTypeId] || [];
                                                        const keepAssigned = req.assignedEmployeeIds.includes(emp.id);
                                                        return mappedEmployeeIds.includes(emp.id) || keepAssigned;
                                                    }).length === 0 && (
                                                        <span className="text-xs text-slate-600 dark:text-gray-600 italic">Aucun employé lié à cette catégorie dans les paramètres.</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Extras Display */}
                                            <div className="flex items-center justify-between p-2 bg-slate-100 dark:bg-black/40 rounded-lg border border-gray-200 dark:border-white/5 transition-colors duration-200">
                                                <span className="text-[10px] font-bold text-slate-500 dark:text-gray-500 uppercase tracking-widest">Extras à prévoir</span>
                                                <span className={`text-sm font-bold ${extrasNeeded > 0 ? 'text-orange-400' : 'text-green-400'}`}>
                                                    {extrasNeeded}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        </div>
                    )}

                    {activeTab === 'documents' && (
                        <div className="space-y-6 bg-white dark:bg-[#0A0A0A] transition-colors duration-200">
                            <div className="p-6 rounded-2xl border border-gray-300 dark:border-white/10 bg-slate-50 dark:bg-black/50 space-y-4 transition-colors duration-200">
                                <p className="text-sm text-slate-500 dark:text-gray-400">Ajoutez des pièces jointes dès la création ou pendant la modification.</p>
                                <label className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-black text-white dark:bg-white dark:text-black font-bold cursor-pointer hover:opacity-90 transition-colors duration-200">
                                    <Paperclip size={16} />
                                    <span>Joindre des fichiers</span>
                                    <input type="file" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
                                </label>
                            </div>

                            <div className="space-y-3">
                                {documents.length === 0 && (
                                    <div className="p-6 rounded-2xl border border-dashed border-gray-300 dark:border-white/10 text-sm text-slate-500 dark:text-gray-500 transition-colors duration-200">
                                        Aucun document lié.
                                    </div>
                                )}
                                {documents.map((doc, idx) => (
                                    <div key={`${doc.file_name}-${idx}`} className="p-4 rounded-2xl border border-gray-300 dark:border-white/10 bg-slate-50 dark:bg-black/40 flex items-center justify-between gap-3 transition-colors duration-200">
                                        <div className="min-w-0">
                                            <p className="text-slate-900 dark:text-white font-medium truncate">{doc.file_name}</p>
                                            <p className="text-xs text-slate-500 dark:text-gray-500">
                                                {doc.mime_type || 'Type inconnu'}
                                                {typeof doc.file_size === 'number' ? ` • ${Math.round(doc.file_size / 1024)} Ko` : ''}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => openDocument(doc)}
                                                className="px-3 py-2 rounded-lg border border-gray-300 dark:border-white/10 text-slate-500 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors duration-200"
                                                title="Visualiser"
                                            >
                                                <Eye size={16} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => removeDocument(idx)}
                                                className="px-3 py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10"
                                                title="Supprimer"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'notes' && (
                        <div className="space-y-4">
                            <div className="p-6 rounded-2xl border border-gray-300 dark:border-white/10 bg-slate-50 dark:bg-black/50 transition-colors duration-200">
                                <label className="text-[10px] font-bold text-slate-500 dark:text-gray-500 uppercase tracking-widest">Message / Note opérationnelle</label>
                                <textarea
                                    value={noteText}
                                    onChange={(e) => setNoteText(e.target.value)}
                                    rows={8}
                                    placeholder="Instructions particulières pour l'équipe, contraintes client, briefing..."
                                    className="mt-3 w-full bg-slate-50 dark:bg-black border border-gray-300 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white outline-none focus:border-slate-400 dark:focus:border-white transition-colors duration-200 resize-none"
                                />
                                <p className="mt-3 text-xs text-slate-500 dark:text-gray-500">Si ce champ contient du texte, le calendrier affichera automatiquement un indicateur rouge.</p>
                            </div>
                        </div>
                    )}

                    <div className="pt-10 border-t border-gray-200 dark:border-white/5 flex gap-4 transition-colors duration-200">
                        <button 
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-8 py-4 rounded-2xl font-bold border border-gray-300 dark:border-white/10 text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors duration-200"
                        >
                            Annuler
                        </button>
                        <button 
                            type="submit"
                            disabled={loading}
                            className="flex-[2] bg-white text-black px-8 py-4 rounded-2xl font-bold hover:bg-gray-200 transition-all shadow-xl shadow-white/10 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading ? 'Enregistrement...' : (
                                <>
                                    <CheckCircle2 size={20} />
                                    <span>Enregistrer</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
};
