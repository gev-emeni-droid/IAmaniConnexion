import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { getRoles, updateEmployeeDetails } from '../services/storage';

interface EditEmployeeModalProps {
  isOpen: boolean;
  employeeId: string;
  initialName: string;
  initialRoleId: string;
  onClose: () => void;
}

const EditEmployeeModal: React.FC<EditEmployeeModalProps> = ({
  isOpen,
  employeeId,
  initialName,
  initialRoleId,
  onClose
}) => {
  const [name, setName] = useState(initialName);
  const [roleId, setRoleId] = useState(initialRoleId);
  const [roles, setRoles] = useState<{ id: string, label: string }[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadRoles();
      setName(initialName);
      setRoleId(initialRoleId);
    }
  }, [isOpen, initialName, initialRoleId]);

  const loadRoles = async () => {
    try {
      const rolesData = await getRoles();
      setRoles(Array.isArray(rolesData) ? rolesData : []);
    } catch (err) {
      console.error('Failed to load roles:', err);
      setRoles([]);
    }
  };

  const handleSave = async () => {
    if (name.trim()) {
      try {
        await updateEmployeeDetails(employeeId, name.trim(), roleId);
        onClose();
      } catch (err) {
        console.error('Failed to update employee:', err);
        alert('Erreur lors de la mise à jour de l\'employé');
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70]">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-5 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-slate-800">Modifier l'employé</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Nom complet</label>
            <input
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Poste</label>
            <select
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              value={roleId}
              onChange={e => setRoleId(e.target.value)}
            >
              {roles.map(r => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2 border border-slate-300 rounded text-slate-700 text-sm hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 flex items-center justify-center gap-2"
          >
            <Save size={16} /> Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditEmployeeModal;