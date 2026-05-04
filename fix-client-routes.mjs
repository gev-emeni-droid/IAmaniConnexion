import { readFileSync, writeFileSync } from 'fs';

const path = 'D:/iamani SaaS/src/App.tsx';
let content = readFileSync(path, 'utf8');

const importAnchor = "import { AdminEvenementielConfig } from './components/Admin/AdminEvenementielConfig';\nimport { PostesEmployesModule } from './components/Employes/PostesEmployesModule';";
const importReplacement = "import { AdminEvenementielConfig } from './components/Admin/AdminEvenementielConfig';\nimport { PlanningModule } from './components/Planning/PlanningModule';\nimport { PostesEmployesModule } from './components/Employes/PostesEmployesModule';";

if (!content.includes("import { PlanningModule } from './components/Planning/PlanningModule';")) {
  content = content.replace(importAnchor, importReplacement);
}

const routeAnchor = `                            <Route path="/" element={<DashboardView />} />
                            <Route path="/admin/clients" element={<AdminClientsView />} />`;
const routeReplacement = `                            <Route path="/" element={<DashboardView />} />
                            <Route path="/planning" element={<PlanningModule />} />
                            <Route path="/crm" element={<CRMModule />} />
                            <Route path="/factures" element={<FacturesModule />} />
                            <Route path="/employes" element={<PostesEmployesModule />} />
                            <Route path="/admin/clients" element={<AdminClientsView />} />`;

content = content.replace(routeAnchor, routeReplacement);
writeFileSync(path, content, 'utf8');
console.log('App routes updated');
