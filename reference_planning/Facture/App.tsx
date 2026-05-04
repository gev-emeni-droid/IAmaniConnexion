
import React, { useState, useEffect } from 'react';
import { Settings, FileText, Printer, RefreshCcw, History, Moon, Sun } from 'lucide-react';
import { RestaurantSettings, InvoiceData } from './types';
import { STORAGE_KEYS, PREDEFINED_DESCRIPTIONS } from './constants';
import { generateInvoiceNumber, getCurrentDate, generatePDF } from './utils';
import emailjs from '@emailjs/browser';
import { api } from './api';
import SettingsModal from './components/SettingsModal';
import InvoiceForm from './components/InvoiceForm';
import InvoicePreview from './components/InvoicePreview';
import EmailModal from './components/EmailModal';
import HistoryModal from './components/HistoryModal';
import HistoryPage from './components/HistoryPage';

const App: React.FC = () => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [settings, setSettings] = useState<RestaurantSettings>({
    name: '',
    street: '',
    zipCode: '',
    city: '',
    siret: '',
    vatNumber: '',
    phone: '',
    logo: null,
    primaryColor: '#4f46e5'
  });

  const [invoiceData, setInvoiceData] = useState<InvoiceData>({
    invoiceNumber: '',
    date: getCurrentDate(),
    covers: 1,
    client: {
      companyName: '',
      address: ''
    },
    description: PREDEFINED_DESCRIPTIONS[0],
    amountHT10: 0,
    amountHT20: 0
  });


  const [prestations, setPrestations] = useState<string[]>(PREDEFINED_DESCRIPTIONS);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved === 'true';
  });

  // Load settings, data and prestations on mount
  useEffect(() => {
    const fetchData = async () => {
      // 1. Settings
      const savedSettings = await api.settings.get();
      if (savedSettings) {
        setSettings(savedSettings);
      } else {
        setIsSettingsOpen(true); // Open settings if first time
      }

      // 2. Prestations
      try {
        const prests = await api.prestations.list();
        if (prests && prests.length > 0) {
          setPrestations(prests.map(p => p.label));
        } else {
          // Fallback if empty DB, or maybe should init DB?
          // DB already has defaults inserted via SQL
        }
      } catch (e) {
        console.error("Failed to load prestations", e);
      }

      // 3. Invoice Data
      const savedInvoice = await api.invoice.get();
      if (savedInvoice) {
        setInvoiceData(savedInvoice);
      } else {
        // Initialize if empty
        setInvoiceData(prev => ({
          ...prev,
          invoiceNumber: generateInvoiceNumber()
        }));
      }
    };
    fetchData();
  }, []);

  // Persist dark mode preference
  useEffect(() => {
    localStorage.setItem('darkMode', isDarkMode.toString());
  }, [isDarkMode]);

  // Auto-save invoice data
  useEffect(() => {
    const timer = setTimeout(() => {
      api.invoice.save(invoiceData);
    }, 1000); // Debounce 1s
    return () => clearTimeout(timer);
  }, [invoiceData]);

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isHistoryView, setIsHistoryView] = useState(false);

  const saveToHistory = async () => {
    const totalHT = invoiceData.amountHT10 + invoiceData.amountHT20;
    const totalTVA = (invoiceData.amountHT10 * 0.1) + (invoiceData.amountHT20 * 0.2);
    const totalTTC = totalHT + totalTVA;

    await api.history.add({
      invoiceNumber: invoiceData.invoiceNumber,
      clientName: invoiceData.client.companyName,
      totalTTC: totalTTC,
      date: invoiceData.date,
      fullData: {
        settings: settings,
        invoiceData: invoiceData
      }
    });
  };

  const handlePrint = async () => {
    await saveToHistory();
    const originalTitle = document.title;
    document.title = " ";
    window.print();
    document.title = originalTitle;
  };

  const handleSendEmail = async (email: string) => {
    try {
      await saveToHistory();
      // 1. Générer le PDF
      const pdfBlob = await generatePDF('invoice-preview');

      // 2. Préparer le fichier pour EmailJS
      // Note: Pour envoyer un fichier avec EmailJS en version gratuite, c'est complexe directement.
      // Une astuce courante est de convertir en Base64, mais EmailJS a des limites de taille (50kb).
      // Avec un compte payant ou une config spécifique c'est mieux, mais essayons une approche hybride.
      // SI le user n'a pas configuré EmailJS, on alerte.

      const SERVICE_ID = 'YOUR_SERVICE_ID'; // À REMPLACER
      const TEMPLATE_ID = 'YOUR_TEMPLATE_ID'; // À REMPLACER
      const PUBLIC_KEY = 'YOUR_PUBLIC_KEY'; // À REMPLACER

      if (SERVICE_ID === 'YOUR_SERVICE_ID') {
        alert("Attention : Vous devez configurer vos identifiants EmailJS dans le fichier App.tsx pour que l'envoi fonctionne réellement.\n\nLe PDF a été généré avec succès en interne !");
        // En attendant, on télécharge le PDF pour prouver que ça marche
        const url = window.URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Facture-${invoiceData.invoiceNumber}.pdf`;
        link.click();
        return;
      }

      // Convertir Blob en Base64 pour l'envoi (si le template l'accepte)
      const reader = new FileReader();
      reader.readAsDataURL(pdfBlob);
      reader.onloadend = async () => {
        const base64data = reader.result;

        try {
          await emailjs.send(
            SERVICE_ID,
            TEMPLATE_ID,
            {
              to_email: email,
              client_name: settings.name,
              invoice_number: invoiceData.invoiceNumber,
              message_html: "Veuillez trouver la facture ci-jointe.",
              content: base64data // Il faut configurer le template pour accepter une pièce jointe 'content'
            },
            PUBLIC_KEY
          );
          alert('Email envoyé avec succès !');
        } catch (error) {
          console.error('Erreur envoi:', error);
          alert('Erreur lors de l\'envoi de l\'email verifiez la console.');
        }
      };

    } catch (error) {
      console.error('Erreur génération PDF:', error);
      alert('Erreur lors de la génération du PDF.');
    }
  };

  const handleReset = () => {
    if (confirm('Voulez-vous réinitialiser le formulaire pour un nouveau client ?\n(Conserve les produits et montants, efface uniquement le client)')) {
      setInvoiceData(prev => ({
        ...prev,
        invoiceNumber: generateInvoiceNumber(),
        date: getCurrentDate(),
        client: { companyName: '', address: '' },
        // On conserve la description, les montants et les couverts
      }));
    }
  };

  return (
    <div
      className={`min-h-screen pb-20 transition-colors duration-300 ${isDarkMode ? 'bg-slate-900' : 'bg-slate-50'}`}
      style={{
        '--primary': settings.primaryColor || '#4f46e5',
        // approximate lighter shades for generic usage if needed, though we use opacity mostly
      } as React.CSSProperties}
    >
      {/* Header / Navbar */}
      <header className={`border-b sticky top-0 z-40 no-print shadow-sm transition-colors duration-300 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--primary)' }}>
              <FileText className="w-6 h-6 text-white" />
            </div>
            <h1 className={`text-xl font-bold tracking-tight hidden sm:block ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
              {settings.name || "L'IAmani"}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`flex items-center gap-2 px-4 py-2 font-semibold rounded-lg transition-all ${isDarkMode
                ? 'text-slate-300 hover:bg-slate-700'
                : 'text-slate-600 hover:bg-slate-100'
                }`}
              title={isDarkMode ? "Mode clair" : "Mode sombre"}
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              <span className="hidden sm:inline">{isDarkMode ? "Clair" : "Sombre"}</span>
            </button>

            <button
              onClick={() => setIsHistoryView(true)}
              className={`flex items-center gap-2 px-4 py-2 font-semibold rounded-lg transition-all ${isDarkMode
                ? 'text-slate-300 hover:bg-slate-700'
                : 'text-slate-600 hover:bg-slate-100'
                }`}
              title="Historique des factures"
            >
              <History className="w-5 h-5" />
              <span className="hidden sm:inline">Historique</span>
            </button>

            <button
              onClick={() => setIsSettingsOpen(true)}
              className={`flex items-center gap-2 px-4 py-2 font-semibold rounded-lg transition-all ${isDarkMode
                ? 'text-slate-300 hover:bg-slate-700'
                : 'text-slate-600 hover:bg-slate-100'
                }`}
            >
              <Settings className="w-5 h-5" />
              <span className="hidden sm:inline">Paramètres</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-95"
              style={{ backgroundColor: 'var(--primary)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)' }} // Shadow is tricky with var, simplified
            >
              <Printer className="w-5 h-5" />
              <span>Imprimer PDF</span>
            </button>
          </div>
        </div>
      </header>

      {isHistoryView ? (
        <HistoryPage onBack={() => setIsHistoryView(false)} isDarkMode={isDarkMode} />
      ) : (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
            {/* Editor Left Column */}
            <div className="xl:col-span-5 no-print">
              <InvoiceForm
                data={invoiceData}
                onChange={setInvoiceData}
                prestations={prestations}
              />


            </div>

            {/* Preview Right Column */}
            <div className="xl:col-span-7 flex flex-col items-center">
              <div className="no-print mb-4 w-full flex justify-between items-center px-2">
                <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">Aperçu</span>
                <span></span>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-rose-500 hover:bg-rose-50 rounded-lg transition-all ml-auto"
                  title="Réinitialiser le formulaire"
                >
                  <RefreshCcw className="w-3 h-3" />
                  <span>Réinitialiser</span>
                </button>
              </div>
              <InvoicePreview
                settings={settings}
                data={invoiceData}
              />
            </div>
          </div>
        </main>
      )}

      {/* Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => {
          setIsSettingsOpen(false);
          // Refresh prestations in case they were changed
          api.prestations.list().then(prests => {
            if (prests.length > 0) setPrestations(prests.map(p => p.label));
          });
        }}
        onSave={setSettings}
        initialSettings={settings}
      />

      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
      />

      <EmailModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        onSubmit={handleSendEmail}
      />

      {/* Simple Footer for web view */}
      <footer className="no-print text-center py-8 text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]">
        L'IAmani &copy; {new Date().getFullYear()} — Solution Express
      </footer>
    </div>
  );
};

export default App;