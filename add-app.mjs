import { readFileSync, writeFileSync } from 'fs';

let content = readFileSync('D:/iamani SaaS/src/App.tsx', 'utf8');

const appComponent = `

const App = () => (
    <Router>
        <AuthProvider>
            <Routes>
                <Route path="/login" element={<LoginView />} />
                <Route path="/*" element={
                    <Layout>
                        <Routes>
                            <Route path="/" element={<DashboardView />} />
                            <Route path="/admin/clients" element={<AdminClientsView />} />
                            <Route path="/admin/clients/:id" element={<AdminClientDetailView />} />
                            <Route path="/admin/support" element={<SupportAdminView />} />
                            <Route path="/evenementiel" element={<EvenementielView />} />
                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                    </Layout>
                } />
            </Routes>
        </AuthProvider>
    </Router>
);

export default App;
`;

content = content + appComponent;
writeFileSync('D:/iamani SaaS/src/App.tsx', content, 'utf8');
console.log('App component and export default added');
