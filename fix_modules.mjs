import { readFileSync, writeFileSync } from 'fs';

const file = 'src/App.tsx';
let content = readFileSync(file, 'utf8');

// Le bloc à remplacer : la liste hardcodée de 5 modules
// On cherche la signature unique : value: 'employes', label: 'RH'
// et on remplace tout le tableau + map par ALL_MODULES.map

const oldPattern = `{[
                                            { value: 'planning', label: 'Planning' },
                                            { value: 'evenementiel', label: 'Événementiel' },
                                            { value: 'crm', label: 'CRM' },
                                            { value: 'facture', label: 'Factures' },
                                            { value: 'employes', label: 'RH' }
                                        ].map((m) => {
                                            const checked = newCollab.modules_access.includes(m.value);
                                            return (
                                                <label key={m.value} className={\`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-all \${checked ? 'border-slate-300 dark:border-white/30 bg-slate-100 dark:bg-white/5 text-slate-900 dark:text-white' : 'border-gray-300 dark:border-white/10 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'}\`}>
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={() => toggleCollaboratorModule(m.value)}
                                                        className="accent-white"
                                                    />
                                                    <span className="text-sm font-medium">{m.label}</span>
                                                </label>
                                            );
                                        })}`;

const newBlock = `{ALL_MODULES.map((m) => {
                                            const checked = newCollab.modules_access.includes(m.name);
                                            return (
                                                <label key={m.name} className={\`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-all \${checked ? 'border-slate-300 dark:border-white/30 bg-slate-100 dark:bg-white/5 text-slate-900 dark:text-white' : 'border-gray-300 dark:border-white/10 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'}\`}>
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={() => toggleCollaboratorModule(m.name)}
                                                        className="accent-white"
                                                    />
                                                    <span className="text-sm font-medium">{m.label}</span>
                                                </label>
                                            );
                                        })}`;

// Normalize line endings before replace
const normalizedContent = content.replace(/\r\n/g, '\n');
const normalizedOld = oldPattern.replace(/\r\n/g, '\n');

if (normalizedContent.includes(normalizedOld)) {
    const updated = normalizedContent.replace(normalizedOld, newBlock);
    writeFileSync(file, updated, 'utf8');
    console.log('✅ Remplacement réussi ! ALL_MODULES utilisé dans le formulaire collaborateur.');
} else {
    // Essayons une recherche partielle pour diagnostiquer
    const idx = normalizedContent.indexOf("{ value: 'employes', label: 'RH' }");
    if (idx >= 0) {
        console.log('Trouvé "employes" à', idx);
        console.log('Contexte:', normalizedContent.substring(idx - 500, idx + 100));
    } else {
        console.log('❌ Pattern non trouvé. Cherche "planning"...');
        const idx2 = normalizedContent.indexOf("value: 'planning'");
        console.log('planning à:', idx2);
        if (idx2 >= 0) console.log('Contexte:', normalizedContent.substring(idx2 - 10, idx2 + 200));
    }
}
