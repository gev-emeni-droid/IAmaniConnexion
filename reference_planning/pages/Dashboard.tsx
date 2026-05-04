import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, LogOut, Calendar, Archive, Trash, Edit, ExternalLink, X, Info, FileText } from 'lucide-react';
import { getPlannings, createPlanning, deletePlanning, initMockData } from '../services/storage';
import { Planning } from '../types';
import { format, startOfWeek, parseISO, endOfWeek, isMonday } from 'date-fns';
import { fr } from 'date-fns/locale';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [plannings, setPlannings] = useState<Planning[]>([]);
  const [search, setSearch] = useState('');
  const [filterService, setFilterService] = useState<'Tout' | 'Salle' | 'Cuisine'>('Tout');
  const [sortAsc, setSortAsc] = useState(false);

  // New Planning Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newPlanningDate, setNewPlanningDate] = useState('');
  const [newPlanningService, setNewPlanningService] = useState<'Salle' | 'Cuisine'>('Salle');

  useEffect(() => {
    const loadData = async () => {
      try {
        await initMockData();
        const data = await getPlannings();
        setPlannings(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to load data:', err);
        setPlannings([]);
      }
    };
    loadData();
  }, []);

  const openCreateModal = () => {
    // Default to next Monday
    const start = new Date();
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1) + 7; // Next monday
    start.setDate(diff);

    setNewPlanningDate(format(start, 'yyyy-MM-dd'));
    setNewPlanningService('Salle');
    setIsCreateModalOpen(true);
  };

  const handleConfirmCreate = async () => {
    if (!newPlanningDate) return;
    try {
      const start = new Date(newPlanningDate);
      const newP = await createPlanning(start, newPlanningService);
      if (newP && newP.id) {
        const data = await getPlannings();
        setPlannings(Array.isArray(data) ? data : []);
        setIsCreateModalOpen(false);
        navigate(`/planning/${newP.id}`);
      } else {
        console.error('Planning creation failed: no ID returned');
        alert('Erreur lors de la création du planning');
      }
    } catch (err) {
      console.error('Failed to create planning:', err);
      alert('Erreur: ' + (err instanceof Error ? err.message : 'Erreur inconnue'));
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Supprimer ce planning ?')) {
      try {
        await deletePlanning(id);
        const data = await getPlannings();
        setPlannings(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to delete planning:', err);
      }
    }
  };

  const handleArchive = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // In real app, toggle status
    const updated = plannings.map(p => p.id === id ? { ...p, status: 'archived' as const } : p);
    alert("L'archivage est automatique selon la date, mais fonctionnel ici pour la démo.");
  };

  const filtered = plannings
    .filter(p => {
      const matchSearch = p.weekStart.includes(search) || p.service.toLowerCase().includes(search.toLowerCase());
      const matchFilter = filterService === 'Tout' || p.service === filterService;
      return matchSearch && matchFilter;
    })
    .sort((a, b) => {
      const d1 = new Date(a.weekStart).getTime();
      const d2 = new Date(b.weekStart).getTime();
      return sortAsc ? d1 - d2 : d2 - d1;
    });

  const activePlannings = filtered.filter(p => p.status === 'active');
  const archivedPlannings = filtered.filter(p => p.status === 'archived');

  // Compute displayed range for modal feedback
  let displayStart: Date | null = null;
  let displayEnd: Date | null = null;
  if (newPlanningDate) {
    displayStart = startOfWeek(new Date(newPlanningDate), { weekStartsOn: 1 });
    displayEnd = endOfWeek(new Date(newPlanningDate), { weekStartsOn: 1 });
  }

  const handleLogout = () => {
    // Redirection vers la page de connexion
    window.location.href = 'https://polpo.connexion.l-iamani.com/';
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-brand text-white p-2 rounded-lg">
              <Calendar size={24} />
            </div>
            <h1 className="text-xl font-bold text-brand tracking-tight">Planning Polpo</h1>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/facture')}
              className="bg-white border border-brand text-brand hover:bg-brand/10 px-4 py-2 rounded-lg font-medium shadow-sm transition-all flex items-center gap-2"
            >
              <FileText size={18} /> Factures
            </button>
            <button
              onClick={openCreateModal}
              className="bg-brand hover:opacity-90 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-all flex items-center gap-2"
            >
              <Plus size={18} /> Nouveau Planning
            </button>
            <button
              onClick={handleLogout}
              className="text-slate-500 hover:text-slate-800 flex items-center gap-2 text-sm font-medium"
            >
              <LogOut size={18} /> <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        </div>
      </header >

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Controls */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-8 flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Rechercher une date, un service..."
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="flex bg-slate-100 p-1 rounded-lg">
              {['Tout', 'Salle', 'Cuisine'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilterService(f as any)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${filterService === f ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {f}
                </button>
              ))}
            </div>
            <button
              onClick={() => setSortAsc(!sortAsc)}
              className="ml-auto md:ml-2 px-3 py-2 border rounded-lg hover:bg-slate-50 text-slate-600 text-sm"
            >
              {sortAsc ? 'Plus ancien' : 'Plus récent'}
            </button>
          </div>
        </div>

        {/* Active Plannings */}
        <div className="mb-10">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <div className="w-2 h-6 bg-green-500 rounded-full"></div>
            Plannings Actifs
          </h2>
          {activePlannings.length === 0 ? (
            <div className="text-center py-12 bg-slate-100/50 rounded-xl border border-dashed border-slate-300">
              <p className="text-slate-500">Aucun planning actif.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activePlannings.map(p => (
                <PlanningCard key={p.id} planning={p} onClick={() => navigate(`/planning/${p.id}`)} onDelete={handleDelete} onArchive={handleArchive} />
              ))}
            </div>
          )}
        </div>

        {/* Archives */}
        <div>
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <div className="w-2 h-6 bg-slate-400 rounded-full"></div>
            Archives
          </h2>
          {archivedPlannings.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-400 text-sm">Aucune archive.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-75">
              {archivedPlannings.map(p => (
                <PlanningCard key={p.id} planning={p} onClick={() => navigate(`/planning/${p.id}`)} onDelete={handleDelete} isArchived />
              ))}
            </div>
          )}
        </div>

      </main>

      {/* CREATE MODAL */}
      {
        isCreateModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-800">Nouveau Planning</h2>
                <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Service</label>
                  <select
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                    value={newPlanningService}
                    onChange={(e) => setNewPlanningService(e.target.value as 'Salle' | 'Cuisine')}
                  >
                    <option value="Salle">Salle</option>
                    <option value="Cuisine">Cuisine</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Début de semaine (toujours un lundi)</label>
                  <p className="text-xs text-slate-500 mb-2">Choisissez le lundi de la semaine que vous voulez planifier.</p>
                  <input
                    type="date"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={newPlanningDate}
                    onChange={(e) => setNewPlanningDate(e.target.value)}
                  />
                </div>

                {/* Computed Date Feedback */}
                {displayStart && displayEnd && (
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex items-start gap-3">
                    <Info className="text-blue-600 shrink-0 mt-0.5" size={18} />
                    <div className="text-sm text-blue-800">
                      Le planning sera créé pour la semaine du <br />
                      <span className="font-bold">Lundi {format(displayStart, 'dd/MM/yyyy')}</span> au <span className="font-bold">Dimanche {format(displayEnd, 'dd/MM/yyyy')}</span>.
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setIsCreateModalOpen(false)}
                    className="flex-1 bg-white border border-slate-300 text-slate-700 font-medium py-2.5 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleConfirmCreate}
                    disabled={!newPlanningDate}
                    className="flex-1 bg-brand text-white font-medium py-2.5 rounded-lg hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Créer le planning
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }


    </div>
  );
};

const PlanningCard: React.FC<{
  planning: Planning,
  onClick: () => void,
  onDelete: (id: string, e: React.MouseEvent) => void,
  onArchive?: (id: string, e: React.MouseEvent) => void,
  isArchived?: boolean
}> = ({ planning, onClick, onDelete, onArchive, isArchived }) => {
  const start = parseISO(planning.weekStart);
  const end = parseISO(planning.weekEnd);

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer group relative overflow-hidden"
    >
      <div className={`h-1.5 w-full ${planning.service === 'Cuisine' ? 'bg-orange-500' : 'bg-blue-500'}`}></div>
      <div className="p-5">
        <div className="flex justify-between items-start mb-2">
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${planning.service === 'Cuisine' ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
            {planning.service}
          </span>
          {!isArchived ? (
            <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded font-bold">EN COURS</span>
          ) : (
            <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5 rounded font-bold">ARCHIVÉ</span>
          )}
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-1">
          Semaine du {format(start, 'dd MMM', { locale: fr })}
        </h3>
        <p className="text-sm text-slate-500 mb-6">
          au {format(end, 'dd MMM yyyy', { locale: fr })}
        </p>

        <div className="flex items-center justify-between mt-auto">
          <button className="text-sm font-medium text-blue-600 flex items-center gap-1 group-hover:underline">
            Ouvrir <ExternalLink size={14} />
          </button>

          <div className="flex gap-2">
            {!isArchived && onArchive && (
              <button onClick={(e) => onArchive(planning.id, e)} className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-colors" title="Archiver">
                <Archive size={16} />
              </button>
            )}
            <button onClick={(e) => onDelete(planning.id, e)} className="p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 rounded-full transition-colors" title="Supprimer">
              <Trash size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;