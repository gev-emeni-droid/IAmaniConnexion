import React from 'react';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { Download, History, Mail, Plus, Printer, RotateCcw, Send, Settings, Trash2 } from 'lucide-react';
import { moduleApi } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { BillingSettingsModal } from './BillingSettingsModal';

type BillingSettings = {
    company_name?: string;
    logo_url?: string;
    address?: string;
    postal_code?: string;
    city?: string;
    country?: string;
    siret?: string;
    tva?: string;
    phone?: string;
    capital?: string;
    ape?: string;
    siege_social?: string;
    rcs_ville?: string;
    rcs_numero?: string;
    prestations_catalog?: string;
    tva_rates?: number[];
    enable_cover_count?: boolean;
};

type CatalogItem = {
    id: string;
    label: string;
    unit_price_ttc?: number;
    tax_rate?: number;
};

type InvoiceLine = {
    id: string;
    label: string;
    quantity: number;
    ttcByRate: Record<number, number>;
};

type CRMContactSuggestion = {
    id: string;
    type?: string;
    first_name?: string;
    last_name?: string;
    company_name?: string;
    organizer_name?: string;
    email?: string;
    phone?: string;
    address?: string;
    postal_code?: string;
    city?: string;
    country?: string;
};

interface CreateInvoiceProps {
    onBack?: () => void;
    onShowHistory?: () => void;
    onInvoiceSaved?: () => void;
    initialInvoice?: any;
    autoPrintToken?: number;
}

const DEFAULT_ACCENT_COLOR = '#2f9e9e';

const clampChannel = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

const rgbToHex = (r: number, g: number, b: number) => `#${[r, g, b].map((channel) => clampChannel(channel).toString(16).padStart(2, '0')).join('')}`;

const hexToRgba = (hex: string, alpha: number) => {
    const normalized = hex.replace('#', '').trim();
    const safeHex = normalized.length === 3
        ? normalized.split('').map((char) => char + char).join('')
        : normalized.padEnd(6, '0').slice(0, 6);
    const r = parseInt(safeHex.slice(0, 2), 16);
    const g = parseInt(safeHex.slice(2, 4), 16);
    const b = parseInt(safeHex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const extractLogoAccentColor = async (logoUrl?: string) => {
    if (!logoUrl) return DEFAULT_ACCENT_COLOR;

    return await new Promise<string>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = 64;
                canvas.height = 64;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve(DEFAULT_ACCENT_COLOR);
                    return;
                }

                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

                let weightedR = 0;
                let weightedG = 0;
                let weightedB = 0;
                let totalWeight = 0;

                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    const a = data[i + 3];
                    if (a < 100) continue;

                    const max = Math.max(r, g, b);
                    const min = Math.min(r, g, b);
                    const brightness = (r + g + b) / 3;
                    const saturation = max === 0 ? 0 : (max - min) / max;

                    if (brightness > 245) continue;

                    const weight = Math.max(0.15, saturation * 2.2 + ((255 - brightness) / 255));
                    weightedR += r * weight;
                    weightedG += g * weight;
                    weightedB += b * weight;
                    totalWeight += weight;
                }

                if (totalWeight <= 0) {
                    resolve(DEFAULT_ACCENT_COLOR);
                    return;
                }

                const accent = rgbToHex(weightedR / totalWeight, weightedG / totalWeight, weightedB / totalWeight);
                resolve(accent);
            } catch {
                resolve(DEFAULT_ACCENT_COLOR);
            }
        };
        img.onerror = () => resolve(DEFAULT_ACCENT_COLOR);

        const src = String(logoUrl || '').trim();
        if (!src) {
            resolve(DEFAULT_ACCENT_COLOR);
            return;
        }

        img.src = src.startsWith('data:') ? src : `${src}${src.includes('?') ? '&' : '?'}accent=${Date.now()}`;
    });
};

const toCurrency = (value: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number.isFinite(value) ? value : 0);

const toInputDate = (date = new Date()) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const toDisplayDate = (inputDate: string) => {
    if (!inputDate) return '--/--/----';
    const [y, m, d] = inputDate.split('-');
    return `${d}/${m}/${y}`;
};

const buildInvoiceClientPrefix = (companyName?: string, clientId?: string) => {
    const normalizedName = String(companyName || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase();
    const namePart = normalizedName.slice(0, 4) || 'CLNT';
    const normalizedId = String(clientId || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const idPart = normalizedId.slice(-3);
    return idPart ? `${namePart}-${idPart}` : namePart;
};

const computeDefaultInvoiceNumber = (existing: any[], companyName?: string, clientId?: string) => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const ym = `${y}${m}`;
    const prefix = buildInvoiceClientPrefix(companyName, clientId);
    const regex = new RegExp(`^${prefix}-${ym}-(\\d{4})$`);
    const maxSeq = (Array.isArray(existing) ? existing : [])
        .map((f: any) => String(f?.invoice_number || ''))
        .map((n: string) => {
            const match = n.match(regex);
            return match ? Number(match[1]) : 0;
        })
        .reduce((acc: number, cur: number) => Math.max(acc, cur), 0);
    return `${prefix}-${ym}-${String(maxSeq + 1).padStart(4, '0')}`;
};

const createLineId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
};

const buildEmptyLine = (rates: number[], defaultLabel = ''): InvoiceLine => ({
    id: createLineId(),
    label: defaultLabel,
    quantity: 1,
    ttcByRate: Object.fromEntries(rates.map((rate) => [rate, 0])) as Record<number, number>,
});

const normalizeLineForRates = (line: InvoiceLine, rates: number[]): InvoiceLine => ({
    ...line,
    ttcByRate: Object.fromEntries(rates.map((rate) => [rate, Number(line.ttcByRate?.[rate] ?? 0)])) as Record<number, number>,
});

const getCRMDisplayName = (contact: CRMContactSuggestion) => {
    if (contact.type === 'PRIVÉ') {
        const privateName = [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim();
        return privateName || contact.email || 'Client';
    }
    return contact.company_name || contact.organizer_name || [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim() || 'Client';
};

export const CreateInvoice = ({ onBack, onShowHistory, onInvoiceSaved, initialInvoice, autoPrintToken }: CreateInvoiceProps) => {
    const { user } = useAuth();
    const [settings, setSettings] = React.useState<BillingSettings>({});
    const [catalog, setCatalog] = React.useState<CatalogItem[]>([]);
    const [settingsOpen, setSettingsOpen] = React.useState(false);

    const [invoiceNumber, setInvoiceNumber] = React.useState('');
    const [invoiceDate, setInvoiceDate] = React.useState(toInputDate());

    const [clientName, setClientName] = React.useState('');
    const [clientAddress, setClientAddress] = React.useState('');
    const [clientCity, setClientCity] = React.useState('');
    const [clientPostalCode, setClientPostalCode] = React.useState('');
    const [clientCountry, setClientCountry] = React.useState('France');
    const [coverCount, setCoverCount] = React.useState('');
    const [amountAlreadyPaid, setAmountAlreadyPaid] = React.useState('');
    const [amountMode, setAmountMode] = React.useState<'ttc' | 'ht'>('ttc');
    const [currentInvoiceId, setCurrentInvoiceId] = React.useState('');
    const [savingInvoice, setSavingInvoice] = React.useState(false);
    const [selectedCrmContactId, setSelectedCrmContactId] = React.useState('');
    const [crmSuggestions, setCrmSuggestions] = React.useState<CRMContactSuggestion[]>([]);
    const [showCrmSuggestions, setShowCrmSuggestions] = React.useState(false);
    const [crmSearchLoading, setCrmSearchLoading] = React.useState(false);
    const [recipientEmail, setRecipientEmail] = React.useState('');
    const [emailModalOpen, setEmailModalOpen] = React.useState(false);
    const [sendingEmail, setSendingEmail] = React.useState(false);
    const [pendingEmailInvoiceId, setPendingEmailInvoiceId] = React.useState('');
    const [accentColor, setAccentColor] = React.useState(DEFAULT_ACCENT_COLOR);
    const printAreaRef = React.useRef<HTMLDivElement | null>(null);
    const skipNextCrmSearchRef = React.useRef(false);

    const tvaRates = React.useMemo(
        () => (settings.tva_rates && settings.tva_rates.length > 0 ? settings.tva_rates : [20]),
        [settings.tva_rates]
    );

    const [lines, setLines] = React.useState<InvoiceLine[]>([buildEmptyLine([20])]);

    const loadBillingData = React.useCallback(async () => {
        try {
            const [allFactures, billingSettings] = await Promise.all([
                moduleApi.getFactures(),
                moduleApi.getBillingSettings(),
            ]);
            const s = billingSettings || {};
            setInvoiceNumber(computeDefaultInvoiceNumber(
                Array.isArray(allFactures) ? allFactures : [],
                String(s.company_name || user?.companyName || ''),
                String(user?.clientId || user?.id || '')
            ));
            setSettings(s);

            const parsedCatalog = (() => {
                try {
                    const raw = JSON.parse(s.prestations_catalog || '[]');
                    if (!Array.isArray(raw)) return [];
                    return raw
                        .map((r: any, i: number) => ({
                            id: String(r.id || i + 1),
                            label: String(r.label || '').trim(),
                            unit_price_ttc: Number(r.unit_price_ttc ?? 0),
                            tax_rate: Number(r.tax_rate ?? 0),
                        }))
                        .filter((r: CatalogItem) => r.label.length > 0);
                } catch {
                    return [];
                }
            })();

            setCatalog(parsedCatalog);
            const nextRates = Array.isArray(s.tva_rates) && s.tva_rates.length > 0 ? s.tva_rates : [20];
            setLines((prev) => {
                const normalized = prev.length > 0 ? prev.map((line) => normalizeLineForRates(line, nextRates)) : [buildEmptyLine(nextRates)];
                if (parsedCatalog[0] && normalized[0] && !normalized[0].label.trim()) {
                    normalized[0] = { ...normalized[0], label: parsedCatalog[0].label };
                }
                return normalized;
            });
        } catch (e) {
            console.error(e);
        }
    }, [user?.clientId, user?.companyName, user?.id]);

    React.useEffect(() => {
        loadBillingData();
    }, [loadBillingData]);

    React.useEffect(() => {
        let active = true;
        extractLogoAccentColor(settings.logo_url)
            .then((color) => {
                if (active) setAccentColor(color || DEFAULT_ACCENT_COLOR);
            })
            .catch(() => {
                if (active) setAccentColor(DEFAULT_ACCENT_COLOR);
            });
        return () => {
            active = false;
        };
    }, [settings.logo_url]);

    const accentSoftBg = React.useMemo(() => hexToRgba(accentColor, 0.10), [accentColor]);
    const accentSoftBorder = React.useMemo(() => hexToRgba(accentColor, 0.25), [accentColor]);

    React.useEffect(() => {
        setLines((prev) => {
            if (prev.length === 0) return [buildEmptyLine(tvaRates, catalog[0]?.label || '')];
            return prev.map((line) => normalizeLineForRates(line, tvaRates));
        });
    }, [catalog, tvaRates]);

    const applyCRMContact = React.useCallback((contact: CRMContactSuggestion) => {
        skipNextCrmSearchRef.current = true;
        setSelectedCrmContactId(String(contact.id || ''));
        setClientName(getCRMDisplayName(contact));
        setClientAddress(String(contact.address || ''));
        setClientPostalCode(String(contact.postal_code || ''));
        setClientCity(String(contact.city || ''));
        setClientCountry(String(contact.country || 'France') || 'France');
        setRecipientEmail(String(contact.email || ''));
        setShowCrmSuggestions(false);
        setCrmSuggestions([]);
    }, []);

    React.useEffect(() => {
        const query = clientName.trim();
        if (skipNextCrmSearchRef.current) {
            skipNextCrmSearchRef.current = false;
            return;
        }

        if (query.length < 2) {
            setCrmSuggestions([]);
            return;
        }

        const timer = window.setTimeout(async () => {
            try {
                setCrmSearchLoading(true);
                const data = await moduleApi.searchFactureCRMContacts(query);
                setCrmSuggestions(Array.isArray(data) ? data : []);
            } catch (e) {
                console.error(e);
                setCrmSuggestions([]);
            } finally {
                setCrmSearchLoading(false);
            }
        }, 180);

        return () => window.clearTimeout(timer);
    }, [clientName]);

    const applyConfiguredUnitPrice = (label: string, quantity: number, currentTtcByRate: Record<number, number>) => {
        const selectedItem = catalog.find((item) => item.label === label);
        const unitPriceTtc = Number(selectedItem?.unit_price_ttc ?? 0);
        if (!Number.isFinite(unitPriceTtc) || unitPriceTtc <= 0) {
            return currentTtcByRate;
        }
        const configuredRate = Number(selectedItem?.tax_rate ?? 0);
        const preferredRate = tvaRates.includes(configuredRate)
            ? configuredRate
            : (tvaRates.find((rate) => Number(currentTtcByRate?.[rate] ?? 0) > 0) ?? tvaRates[0]);
        return Object.fromEntries(
            tvaRates.map((rate) => [rate, rate === preferredRate ? unitPriceTtc * quantity : 0])
        ) as Record<number, number>;
    };

    const updateLine = (lineId: string, patch: Partial<InvoiceLine>) => {
        setLines((prev) => prev.map((line) => {
            if (line.id !== lineId) return line;
            const nextLine = { ...line, ...patch };
            const nextLabel = patch.label ?? line.label;
            const nextQuantity = patch.quantity ?? line.quantity;
            return {
                ...nextLine,
                ttcByRate: applyConfiguredUnitPrice(nextLabel, nextQuantity, nextLine.ttcByRate),
            };
        }));
    };

    const updateLineRate = (lineId: string, rate: number, value: string) => {
        const numericValue = Math.max(0, Number(value || 0));
        setLines((prev) => prev.map((line) => line.id === lineId
            ? {
                ...line,
                ttcByRate: {
                    ...line.ttcByRate,
                    [rate]: amountMode === 'ttc' ? numericValue : numericValue * (1 + rate / 100),
                }
            }
            : line));
    };

    const addLine = () => {
        const defaultLabel = catalog[0]?.label || '';
        const newLine = buildEmptyLine(tvaRates, defaultLabel);
        newLine.ttcByRate = applyConfiguredUnitPrice(defaultLabel, newLine.quantity, newLine.ttcByRate);
        setLines((prev) => [...prev, newLine]);
    };

    const removeLine = (lineId: string) => {
        setLines((prev) => {
            const next = prev.filter((line) => line.id !== lineId);
            if (next.length > 0) return next;
            const defaultLabel = catalog[0]?.label || '';
            const fallbackLine = buildEmptyLine(tvaRates, defaultLabel);
            fallbackLine.ttcByRate = applyConfiguredUnitPrice(defaultLabel, fallbackLine.quantity, fallbackLine.ttcByRate);
            return [fallbackLine];
        });
    };

    const lineSummaries = lines.map((line) => {
        const rateDetails = tvaRates.map((rate) => {
            const ttc = Number(line.ttcByRate?.[rate] ?? 0);
            const ht = ttc / (1 + rate / 100);
            const tva = ttc - ht;
            const sourceAmount = amountMode === 'ttc' ? ttc : ht;
            return { rate, ttc, ht, tva, sourceAmount };
        });

        return {
            ...line,
            rateDetails,
            totalHt: rateDetails.reduce((sum, detail) => sum + detail.ht, 0),
            totalTva: rateDetails.reduce((sum, detail) => sum + detail.tva, 0),
            totalTtc: rateDetails.reduce((sum, detail) => sum + detail.ttc, 0),
        };
    });

    const totalHt = lineSummaries.reduce((sum, line) => sum + line.totalHt, 0);
    const totalTva = lineSummaries.reduce((sum, line) => sum + line.totalTva, 0);
    const totalTtcBrut = lineSummaries.reduce((sum, line) => sum + line.totalTtc, 0);
    const alreadyPaidValue = Math.max(0, Number(amountAlreadyPaid || 0));
    const netToPay = Math.max(0, totalTtcBrut - alreadyPaidValue);
    const isSettled = totalTtcBrut > 0 && alreadyPaidValue >= totalTtcBrut;
    const previewHasContent = lineSummaries.some((line) => line.totalTtc > 0);
    const activeTvaRates = tvaRates.filter((rate) => lineSummaries.some((line) => line.rateDetails.some((detail) => detail.rate === rate && detail.ht > 0)));
    const displayTvaRates = activeTvaRates.length > 0 ? activeTvaRates : tvaRates;

    React.useEffect(() => {
        if (!initialInvoice) return;
        try {
            const parsedPayload = typeof initialInvoice.payload_json === 'string'
                ? JSON.parse(initialInvoice.payload_json || '{}')
                : (initialInvoice.payload_json || {});
            const snapshot = (() => {
                try {
                    if (typeof initialInvoice.billing_snapshot === 'string') return JSON.parse(initialInvoice.billing_snapshot || '{}');
                    return initialInvoice.billing_snapshot || parsedPayload.billing_snapshot || {};
                } catch {
                    return parsedPayload.billing_snapshot || {};
                }
            })();
            if (snapshot && Object.keys(snapshot).length > 0) {
                setSettings((prev) => ({ ...prev, ...snapshot }));
            }
            const payloadRates = Array.isArray(snapshot?.tva_rates) && snapshot.tva_rates.length > 0 ? snapshot.tva_rates.map(Number) : tvaRates;
            setCurrentInvoiceId(String(initialInvoice.id || parsedPayload.id || ''));
            setInvoiceNumber(String(parsedPayload.invoiceNumber || initialInvoice.invoice_number || ''));
            setInvoiceDate(String(parsedPayload.invoiceDate || initialInvoice.due_date || toInputDate()));
            setClientName(String(parsedPayload.clientName || initialInvoice.customer_name || ''));
            setSelectedCrmContactId(String(parsedPayload.crmContactId || parsedPayload.crm_contact_id || initialInvoice.crm_contact_id || ''));
            setClientAddress(String(parsedPayload.clientAddress || ''));
            setClientCity(String(parsedPayload.clientCity || ''));
            setClientPostalCode(String(parsedPayload.clientPostalCode || ''));
            setClientCountry(String(parsedPayload.clientCountry || 'France'));
            setRecipientEmail(String(parsedPayload.recipientEmail || ''));
            setCoverCount(String(parsedPayload.coverCount || ''));
            setAmountAlreadyPaid(String(parsedPayload.amountAlreadyPaid ?? initialInvoice.already_paid ?? ''));
            setAmountMode(parsedPayload.amountMode === 'ht' ? 'ht' : 'ttc');
            const restoredLines = Array.isArray(parsedPayload.lines) && parsedPayload.lines.length > 0
                ? parsedPayload.lines.map((line: any) => normalizeLineForRates({
                    id: String(line.id || createLineId()),
                    label: String(line.label || ''),
                    quantity: Math.max(1, Number(line.quantity || 1)),
                    ttcByRate: line.ttcByRate || Object.fromEntries(payloadRates.map((rate: number) => [rate, 0])),
                }, payloadRates))
                : [buildEmptyLine(payloadRates, catalog[0]?.label || '')];
            setLines(restoredLines);
        } catch (e) {
            console.error(e);
        }
    }, [initialInvoice]);

    const openPrintWindow = React.useCallback((targetWindow?: Window | null) => {
        const popup = targetWindow ?? window.open('', '_blank', 'width=900,height=1200');
        if (!popup) {
            alert('Veuillez autoriser la fenêtre d’impression.');
            return;
        }

        const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
            .map((node) => node.outerHTML)
            .join('\n');
        const content = printAreaRef.current?.outerHTML || '';

        popup.document.open();
        popup.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${invoiceNumber || 'Facture'}</title>
${styles}
<style>
body { margin: 0; padding: 0; background: #ffffff; }
.print-hidden { display: none !important; }
.invoice-print-area {
  box-sizing: border-box !important;
  display: flex !important;
  flex-direction: column !important;
  box-shadow: none !important;
  border: none !important;
  max-width: none !important;
  width: 100% !important;
  margin: 0 auto !important;
  position: static !important;
  overflow: visible !important;
  min-height: calc(297mm - 6mm) !important;
  padding: 3mm !important;
}
.invoice-items-table { page-break-inside: auto; }
.invoice-items-table thead { display: table-header-group; }
.invoice-line-row { break-inside: avoid; page-break-inside: avoid; }
.invoice-bottom-block {
  margin-top: auto !important;
}
.invoice-summary-section,
.invoice-legal-footer,
.invoice-keep-together,
.invoice-bottom-block {
  break-inside: avoid-page;
  page-break-inside: avoid;
}
.invoice-summary-section { margin-top: 3mm !important; }
.invoice-legal-footer { margin-top: 3mm !important; padding-top: 2mm !important; }
</style>
</head>
<body>${content}</body>
</html>`);
        popup.document.close();
        popup.focus();
        window.setTimeout(() => popup.print(), 250);
    }, [invoiceNumber]);

    React.useEffect(() => {
        if (!autoPrintToken) return;
        const timer = window.setTimeout(() => openPrintWindow(), 250);
        return () => window.clearTimeout(timer);
    }, [autoPrintToken, openPrintWindow]);

    const buildInvoicePayload = React.useCallback(() => {
        const invoiceId = currentInvoiceId || (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : createLineId());
        return {
            id: invoiceId,
            invoiceNumber,
            invoiceDate,
            clientName,
            clientAddress,
            clientCity,
            clientPostalCode,
            clientCountry,
            crmContactId: selectedCrmContactId || null,
            recipientEmail: recipientEmail.trim(),
            coverCount,
            amountAlreadyPaid: alreadyPaidValue,
            amountMode,
            lines,
            totalHt,
            totalTva,
            totalTtcBrut,
            netToPay,
            status: isSettled ? 'paid' : 'pending',
            billing_snapshot: settings,
        };
    }, [
        alreadyPaidValue,
        amountMode,
        clientAddress,
        clientCity,
        clientCountry,
        clientName,
        clientPostalCode,
        coverCount,
        currentInvoiceId,
        invoiceDate,
        invoiceNumber,
        isSettled,
        lines,
        netToPay,
        recipientEmail,
        selectedCrmContactId,
        settings,
        totalHt,
        totalTtcBrut,
        totalTva,
    ]);

    const saveCurrentInvoice = async (payloadOverride?: ReturnType<typeof buildInvoicePayload>) => {
        setSavingInvoice(true);
        try {
            const payload = payloadOverride || buildInvoicePayload();
            const saved = await moduleApi.createFacture(payload);
            setCurrentInvoiceId(String(saved?.id || payload.id));
            await onInvoiceSaved?.();
            return saved || payload;
        } catch (e: any) {
            alert(e?.message || 'Erreur lors de l’enregistrement de la facture');
            return null;
        } finally {
            setSavingInvoice(false);
        }
    };

    const handlePrintInvoice = async () => {
        const popup = window.open('', '_blank', 'width=900,height=1200');
        if (!popup) {
            alert('Veuillez autoriser la fenêtre d’impression.');
            return;
        }
        const saved = await saveCurrentInvoice();
        if (!saved) {
            popup.close();
            return;
        }
        // Enregistrement action print
        try {
            if (saved.id && user?.clientId) {
                await moduleApi.recordFactureAction(String(saved.id), String(user.clientId), 'print');
            }
        } catch (e) {
            // Optionnel : afficher une erreur ou ignorer
        }
        openPrintWindow(popup);
    };

    const handleOpenSendModal = () => {
        const payload = buildInvoicePayload();
        setPendingEmailInvoiceId(String(payload?.id || currentInvoiceId || ''));
        setEmailModalOpen(true);
    };

    const generatePreviewPdfDocument = async () => {
        if (!printAreaRef.current) {
            throw new Error('Aperçu de facture introuvable.');
        }

        const source = printAreaRef.current;
        const wrapper = document.createElement('div');
        wrapper.style.position = 'fixed';
        wrapper.style.left = '-10000px';
        wrapper.style.top = '0';
        wrapper.style.width = '210mm';
        wrapper.style.background = '#ffffff';
        wrapper.style.padding = '0';
        wrapper.style.margin = '0';
        wrapper.style.zIndex = '-1';

        const clone = source.cloneNode(true) as HTMLDivElement;
        clone.style.width = '210mm';
        clone.style.maxWidth = '210mm';
        clone.style.minHeight = '291mm';
        clone.style.margin = '0';
        clone.style.padding = '3mm';
        clone.style.boxSizing = 'border-box';
        clone.style.border = 'none';
        clone.style.boxShadow = 'none';
        clone.style.borderRadius = '0';
        clone.style.background = '#ffffff';
        clone.style.overflow = 'hidden';

        wrapper.appendChild(clone);
        document.body.appendChild(wrapper);

        try {
            // OPTIMISATION : pixelRatio réduit pour accélérer la génération et éviter de faire ramer le navigateur
            const PIXEL_RATIO = 1.5; // 1.5 = bon compromis qualité/rapidité
            const imgData = await toPng(clone, {
                cacheBust: true,
                pixelRatio: PIXEL_RATIO,
                canvasWidth: clone.scrollWidth * PIXEL_RATIO,
                canvasHeight: clone.scrollHeight * PIXEL_RATIO,
                backgroundColor: '#ffffff',
                skipFonts: false,
                width: clone.scrollWidth,
                height: clone.scrollHeight,
                quality: 1,
            });

            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pageWidth = 210;
            const pageHeight = 297;
            const margin = 3;
            const usableWidth = pageWidth - margin * 2;
            const usableHeight = pageHeight - margin * 2;

            const imageProps = pdf.getImageProperties(imgData);
            const widthRatio = usableWidth / imageProps.width;
            const heightRatio = usableHeight / imageProps.height;
            const scale = Math.min(widthRatio, heightRatio);
            const imageWidth = imageProps.width * scale;
            const imageHeight = imageProps.height * scale;
            const x = margin;
            const y = margin;

            pdf.addImage(imgData, 'PNG', x, y, imageWidth, imageHeight, undefined, 'SLOW');
            return pdf;
        } finally {
            document.body.removeChild(wrapper);
        }
    };

    const generatePreviewPdfBase64 = async () => {
        const pdf = await generatePreviewPdfDocument();
        return arrayBufferToBase64(pdf.output('arraybuffer'));
    };

    const handleDownloadPdf = async () => {
        const saved = await saveCurrentInvoice();
        if (!saved) return;

        // Enregistrement action download
        try {
            if (saved.id && user?.clientId) {
                await moduleApi.recordFactureAction(String(saved.id), String(user.clientId), 'download');
            }
        } catch (e) {
            // Optionnel : afficher une erreur ou ignorer
        }

        try {
            const pdf = await generatePreviewPdfDocument();
            pdf.save(`${invoiceNumber || 'facture'}.pdf`);
        } catch (e: any) {
            alert(e?.message || 'Erreur lors du téléchargement du PDF');
        }
    };

    const handleSendInvoiceEmail = async () => {
        const email = recipientEmail.trim();
        if (!email) {
            alert('Veuillez saisir une adresse email.');
            return;
        }

        const payload = buildInvoicePayload();
        const invoiceId = String(pendingEmailInvoiceId || currentInvoiceId || payload.id || '');
        if (!invoiceId) {
            alert('Impossible de préparer la facture pour l’envoi.');
            return;
        }

        setSendingEmail(true);
        setEmailModalOpen(false);

        try {
            // Générer le PDF côté frontend comme avant
            const pdfBase64 = await generatePreviewPdfBase64();
            const filename = `${payload.invoiceNumber || 'facture'}.pdf`;
            await moduleApi.sendFactureEmail(invoiceId, { to: email, pdfBase64, filename });
            await saveCurrentInvoice(payload);
            // Enregistrement action email dans l'historique
            if (invoiceId && user?.clientId) {
                await moduleApi.recordFactureAction(invoiceId, String(user.clientId), 'email', email);
            }
            // Rafraîchir l'historique si callback fourni
            if (typeof onInvoiceSaved === 'function') onInvoiceSaved();
        } catch (e: any) {
            // Silencieux
        } finally {
            setSendingEmail(false);
        }
    };

    const resetAll = () => {
        setInvoiceDate(toInputDate());
        setClientName('');
        setSelectedCrmContactId('');
        setCrmSuggestions([]);
        setClientAddress('');
        setClientCity('');
        setClientPostalCode('');
        setClientCountry('France');
        setRecipientEmail('');
        setCoverCount('');
        setAmountAlreadyPaid('');
        setCurrentInvoiceId('');
        setPendingEmailInvoiceId('');
        setEmailModalOpen(false);
        setLines([buildEmptyLine(tvaRates, catalog[0]?.label || '')]);
        void loadBillingData();
    };

    const legalMentions = [
        settings.siret ? `SIRET: ${settings.siret}` : null,
        settings.tva ? `TVA: ${settings.tva}` : null,
        settings.rcs_ville && settings.rcs_numero ? `RCS ${settings.rcs_ville} ${settings.rcs_numero}` : null,
        settings.capital ? `Capital social: ${settings.capital}` : null,
        settings.ape ? `APE/NAF: ${settings.ape}` : null,
    ].filter(Boolean).join(' • ');

    return (
        <div className="space-y-6">
            <style>{`
                @media print {
                    body * { visibility: hidden !important; }
                    .invoice-print-area, .invoice-print-area * { visibility: visible !important; }
                    .invoice-print-area {
                        box-sizing: border-box !important;
                        display: flex !important;
                        flex-direction: column !important;
                        position: absolute !important;
                        left: 0 !important;
                        right: 0 !important;
                        top: 0 !important;
                        width: auto !important;
                        max-width: none !important;
                        box-shadow: none !important;
                        border: none !important;
                        border-radius: 0 !important;
                        overflow: visible !important;
                        min-height: calc(297mm - 6mm) !important;
                        padding: 3mm !important;
                        margin: 0 auto !important;
                    }
                    .invoice-items-table { page-break-inside: auto; }
                    .invoice-items-table thead { display: table-header-group; }
                    .invoice-line-row { break-inside: avoid; page-break-inside: avoid; }
                    .invoice-bottom-block {
                        margin-top: auto !important;
                    }
                    .invoice-summary-section,
                    .invoice-legal-footer,
                    .invoice-keep-together,
                    .invoice-bottom-block {
                        break-inside: avoid-page;
                        page-break-inside: avoid;
                    }
                    .invoice-summary-section { margin-top: 3mm !important; }
                    .invoice-legal-footer { margin-top: 3mm !important; padding-top: 2mm !important; }
                    .print-hidden { display: none !important; }
                }
                @page {
                    size: A4 portrait;
                    margin: 3mm;
                }
            `}</style>
            <header className="flex items-center justify-between gap-2 flex-wrap print-hidden">
                <div className="flex items-center gap-2">
                    <button
                        onClick={onShowHistory}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                    >
                        <History size={13} /> Historique
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleOpenSendModal}
                        disabled={savingInvoice || sendingEmail}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-colors disabled:opacity-60"
                    >
                        <Mail size={13} /> {sendingEmail ? 'Envoi...' : 'Envoyer la facture'}
                    </button>
                                {sendingEmail && (
                                    <div style={{position:'fixed',top:0,left:0,width:'100vw',height:'100vh',background:'rgba(255,255,255,0.7)',zIndex:10000,display:'flex',alignItems:'center',justifyContent:'center'}}>
                                        <div style={{background:'#fff',padding:32,borderRadius:12,boxShadow:'0 2px 16px #0002',fontSize:18,fontWeight:600,color:'#222',textAlign:'center'}}>
                                            Envoi en cours...<br/>Veuillez patienter un instant
                                        </div>
                                    </div>
                                )}
                    <button
                        type="button"
                        onClick={handlePrintInvoice}
                        disabled={savingInvoice || sendingEmail}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-colors disabled:opacity-60"
                    >
                        <Printer size={13} /> {savingInvoice ? 'Enregistrement...' : 'Imprimer'}
                    </button>
                    <button
                        type="button"
                        onClick={handleDownloadPdf}
                        disabled={savingInvoice || sendingEmail}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-colors disabled:opacity-60"
                    >
                        <Download size={13} /> {savingInvoice ? 'Préparation...' : 'Télécharger'}
                    </button>
                    <button
                        onClick={() => setSettingsOpen(true)}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                    >
                        <Settings size={13} /> Parametres
                    </button>
                    <button
                        onClick={resetAll}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold text-rose-500 hover:bg-rose-500/10 transition-colors"
                    >
                        <RotateCcw size={13} /> REINITIALISER
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                <div className="space-y-4">
                    <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-4 space-y-3">
                        <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">Informations Facture</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] uppercase tracking-widest font-bold text-[var(--text-muted)]">Numero de facture</label>
                                <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className="h-8 px-3 text-sm bg-[var(--bg-soft)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] outline-none focus:border-[var(--accent)]" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] uppercase tracking-widest font-bold text-[var(--text-muted)]">Date de facture</label>
                                <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="h-8 px-3 text-sm bg-[var(--bg-soft)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] outline-none focus:border-[var(--accent)]" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-4 space-y-3">
                        <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">Client</h3>
                        <div className="flex flex-col gap-1 relative">
                            <label className="text-[10px] uppercase tracking-widest font-bold text-[var(--text-muted)]">Nom de l'entreprise / particulier</label>
                            <input
                                value={clientName}
                                onChange={(e) => {
                                    setClientName(e.target.value);
                                    setSelectedCrmContactId('');
                                    setShowCrmSuggestions(true);
                                }}
                                onFocus={() => setShowCrmSuggestions(true)}
                                onBlur={() => window.setTimeout(() => setShowCrmSuggestions(false), 150)}
                                placeholder="Tapez les premières lettres d’un client CRM"
                                className="h-8 px-3 text-sm bg-[var(--bg-soft)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                            />
                            {selectedCrmContactId && (
                                <span className="text-[10px] font-bold text-emerald-600">Client CRM lié automatiquement</span>
                            )}
                            {recipientEmail && (
                                <span className="text-[10px] font-bold text-sky-600">Email détecté : {recipientEmail}</span>
                            )}
                            {showCrmSuggestions && clientName.trim().length >= 2 && (
                                <div className="absolute top-full left-0 right-0 mt-1 z-20 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-xl overflow-hidden">
                                    {crmSearchLoading ? (
                                        <div className="px-3 py-2 text-xs text-[var(--text-muted)]">Recherche CRM...</div>
                                    ) : crmSuggestions.length === 0 ? (
                                        <div className="px-3 py-2 text-xs text-[var(--text-muted)]">Aucun client CRM correspondant</div>
                                    ) : crmSuggestions.map((contact) => (
                                        <button
                                            key={contact.id}
                                            type="button"
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => applyCRMContact(contact)}
                                            className="w-full text-left px-3 py-2 hover:bg-[var(--bg-soft)] transition-colors border-b border-[var(--border-color)] last:border-b-0"
                                        >
                                            <div className="text-sm font-bold text-[var(--text-primary)]">{getCRMDisplayName(contact)}</div>
                                            <div className="text-[10px] text-[var(--text-muted)]">
                                                {[contact.address, contact.postal_code, contact.city].filter(Boolean).join(', ') || contact.email || 'Client CRM'}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] uppercase tracking-widest font-bold text-[var(--text-muted)]">Adresse complete</label>
                            <textarea value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} rows={3} className="px-3 py-2 text-sm bg-[var(--bg-soft)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] outline-none focus:border-[var(--accent)] resize-none" />
                        </div>
                        <div className={`grid grid-cols-1 ${settings.enable_cover_count ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-3`}>
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] uppercase tracking-widest font-bold text-[var(--text-muted)]">Ville</label>
                                <input value={clientCity} onChange={(e) => setClientCity(e.target.value)} className="h-8 px-3 text-sm bg-[var(--bg-soft)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] outline-none focus:border-[var(--accent)]" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] uppercase tracking-widest font-bold text-[var(--text-muted)]">Code postal</label>
                                <input value={clientPostalCode} onChange={(e) => setClientPostalCode(e.target.value)} className="h-8 px-3 text-sm bg-[var(--bg-soft)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] outline-none focus:border-[var(--accent)]" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] uppercase tracking-widest font-bold text-[var(--text-muted)]">Pays</label>
                                <input value={clientCountry} onChange={(e) => setClientCountry(e.target.value)} className="h-8 px-3 text-sm bg-[var(--bg-soft)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] outline-none focus:border-[var(--accent)]" />
                            </div>
                            {settings.enable_cover_count && (
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] uppercase tracking-widest font-bold text-[var(--text-muted)]">Nombre de couverts</label>
                                    <input type="number" min={0} value={coverCount} onChange={(e) => setCoverCount(e.target.value)} className="h-8 px-3 text-sm bg-[var(--bg-soft)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] outline-none focus:border-[var(--accent)]" />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">Lignes de prestation</h3>
                            <div className="flex items-center gap-2">
                                <div className="inline-flex rounded-lg border border-[var(--border-color)] overflow-hidden">
                                    <button
                                        type="button"
                                        onClick={() => setAmountMode('ttc')}
                                        className={`px-3 h-8 text-xs font-bold transition-colors ${amountMode === 'ttc' ? 'bg-slate-900 text-white dark:bg-white dark:text-black' : 'bg-transparent text-[var(--text-primary)]'}`}
                                    >
                                        TTC
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAmountMode('ht')}
                                        className={`px-3 h-8 text-xs font-bold transition-colors ${amountMode === 'ht' ? 'bg-slate-900 text-white dark:bg-white dark:text-black' : 'bg-transparent text-[var(--text-primary)]'}`}
                                    >
                                        HT
                                    </button>
                                </div>
                                <button
                                type="button"
                                onClick={addLine}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-900 dark:bg-white text-white dark:text-black hover:opacity-80 transition-opacity"
                            >
                                <Plus size={12} /> Ajouter une ligne
                                </button>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {lines.map((line, index) => (
                                <div key={line.id} className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-soft)] p-3 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] uppercase tracking-widest font-bold text-[var(--text-muted)]">Ligne {index + 1}</span>
                                        {lines.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeLine(line.id)}
                                                className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-500 hover:text-rose-600"
                                            >
                                                <Trash2 size={12} /> Supprimer
                                            </button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] uppercase tracking-widest font-bold text-[var(--text-muted)]">Libellé</label>
                                            <select
                                                value={line.label}
                                                onChange={(e) => updateLine(line.id, { label: e.target.value })}
                                                className="h-8 px-3 text-sm bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                                            >
                                                {catalog.length === 0 && <option value="">Aucune prestation configurée</option>}
                                                {catalog.length > 0 && !catalog.some((item) => item.label === line.label) && (
                                                    <option value={line.label}>{line.label || 'Sélectionner une prestation'}</option>
                                                )}
                                                {catalog.map((item) => (
                                                    <option key={item.id} value={item.label}>{item.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] uppercase tracking-widest font-bold text-[var(--text-muted)]">Quantités</label>
                                            <input
                                                type="number"
                                                min={1}
                                                value={line.quantity}
                                                onChange={(e) => updateLine(line.id, { quantity: Math.max(1, Number(e.target.value || 1)) })}
                                                className="h-8 px-3 text-sm bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                                            />
                                        </div>
                                    </div>

                                    <div className={`grid grid-cols-1 ${tvaRates.length > 1 ? 'md:grid-cols-2' : ''} gap-3`}>
                                        {tvaRates.map((rate) => (
                                            <div key={rate} className="flex flex-col gap-1">
                                                <label className="text-[10px] uppercase tracking-widest font-bold text-[var(--text-muted)]">{amountMode === 'ttc' ? `TTC ${rate}%` : `HT ${rate}%`}</label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min={0}
                                                    value={amountMode === 'ttc' ? (line.ttcByRate[rate] ?? 0) : Number(((line.ttcByRate[rate] ?? 0) / (1 + rate / 100)).toFixed(2))}
                                                    onChange={(e) => updateLineRate(line.id, rate, e.target.value)}
                                                    className="h-8 px-3 text-sm bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                                                />
                                            </div>
                                        ))}
                                    </div>

                                    <div className="text-right text-[11px] font-bold text-[var(--text-muted)]">
                                        Total {amountMode === 'ttc' ? 'TTC' : 'HT'} saisi : {toCurrency(lineSummaries[index]?.rateDetails.reduce((sum, detail) => sum + detail.sourceAmount, 0) ?? 0)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-4 space-y-3">
                        <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">Paiement</h3>
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] uppercase tracking-widest font-bold text-[var(--text-muted)]">Montant déjà payé (€)</label>
                            <input
                                type="number"
                                step="0.01"
                                min={0}
                                value={amountAlreadyPaid}
                                onChange={(e) => setAmountAlreadyPaid(e.target.value)}
                                className="h-8 px-3 text-sm bg-[var(--bg-soft)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                                placeholder="Ex: 300"
                            />
                        </div>
                        <p className="text-xs text-[var(--text-muted)]">Acompte ou règlement partiel déjà effectué par le client.</p>
                    </div>
                </div>

                <div
                    ref={printAreaRef}
                    className="invoice-print-area bg-white p-[2mm] w-full max-w-[210mm] mx-auto shadow-xl rounded-lg print:shadow-none print:rounded-none print:p-[2mm] print:m-0 print:w-full flex flex-col min-h-[294mm] overflow-hidden relative border border-slate-100"
                >
                    <div className="invoice-keep-together flex justify-between items-start mb-6 gap-6">
                        <div className="flex flex-col min-w-0">
                            {settings.logo_url ? (
                                <img src={settings.logo_url} alt="Logo" className="max-h-28 max-w-[250px] mb-2 object-contain self-start" />
                            ) : (
                                <div className="text-sm font-black tracking-[0.2em] text-slate-500 mb-2">LOGO</div>
                            )}
                            <h1 className="text-xl font-bold text-slate-800">{settings.company_name || 'Nom de l’établissement'}</h1>
                            <div className="text-slate-600 text-xs mt-1 leading-snug">
                                <p>{settings.address || '-'}</p>
                                <p>{[settings.postal_code, settings.city].filter(Boolean).join(' ') || '-'}</p>
                            </div>
                            {settings.phone && (
                                <p className="mt-1 text-xs text-slate-600 font-medium tracking-tight">Tél : {settings.phone}</p>
                            )}
                        </div>

                        <div className="text-right shrink-0">
                            <h2
                                className="text-[32px] font-black uppercase mb-2 leading-none tracking-[-0.035em] print:text-[32px]"
                                style={{
                                    color: accentColor,
                                    fontFamily: 'Arial Black, Inter, Arial, Helvetica, sans-serif',
                                    fontWeight: 900,
                                }}
                            >
                                FACTURE
                            </h2>
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 inline-block text-left min-w-[190px] shadow-sm">
                                <div className="mb-2">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Numéro de facture</p>
                                    <p className="font-mono text-base font-bold text-slate-900">{invoiceNumber || 'F-XXXXXX'}</p>
                                </div>
                                <div className={`grid ${settings.enable_cover_count ? 'grid-cols-2' : 'grid-cols-1'} gap-3 pt-2 border-t border-slate-200/60`}>
                                    <div>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Date</p>
                                        <p className="font-bold text-slate-900 text-xs">{toDisplayDate(invoiceDate)}</p>
                                    </div>
                                    {settings.enable_cover_count && (
                                        <div>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Couverts</p>
                                            <p className="font-bold text-slate-900 text-xs">{coverCount || '-'}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {(clientName || clientAddress || clientCity || clientPostalCode) && (
                        <div className="invoice-keep-together mb-6 flex justify-end">
                            <div className="w-full md:w-1/2 p-4 rounded-xl border-2 border-slate-50 bg-white shadow-sm">
                                <h3 className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: accentColor, opacity: 0.7 }}>Destinataire</h3>
                                <p className="font-bold text-lg text-slate-900 mb-0.5">{clientName || '-'}</p>
                                <div className="text-slate-600 text-xs whitespace-pre-line leading-relaxed">
                                    <p>{clientAddress || '-'}</p>
                                    <p>{[clientPostalCode, clientCity, clientCountry].filter(Boolean).join(' ') || '-'}</p>
                                    {settings.enable_cover_count && <p className="mt-1 font-semibold">Nombre de couverts : {coverCount || '-'}</p>}
                                </div>
                            </div>
                        </div>
                    )}

                    <table className="invoice-items-table w-full mb-6 border-collapse">
                        <thead>
                            <tr className="border-b border-slate-900 text-left">
                                <th className="pb-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Désignation de la prestation</th>
                                {displayTvaRates.map((rate) => (
                                    <th key={rate} className="pb-2 pl-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Base HT ({rate}%)</th>
                                ))}
                                <th className="pb-2 pl-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total HT</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {previewHasContent ? (
                                lineSummaries.map((line) => (
                                    <tr key={line.id} className="invoice-line-row group">
                                        <td className="py-4 align-top">
                                            <p className="font-bold text-slate-800 text-lg">{line.label || 'Prestation non renseignée'}</p>
                                            <p className="text-[9px] text-slate-400 uppercase font-bold mt-0.5 tracking-wider">
                                                {line.quantity} quantité{line.quantity > 1 ? 's' : ''}{settings.enable_cover_count && coverCount ? ` • ${coverCount} couverts` : ''}
                                            </p>
                                        </td>
                                        {displayTvaRates.map((rate) => {
                                            const detail = line.rateDetails.find((d) => d.rate === rate);
                                            return (
                                                <td key={rate} className="py-4 pl-4 text-right text-slate-700 font-medium text-sm align-top">
                                                    {detail && detail.ht > 0 ? toCurrency(detail.ht) : '-'}
                                                </td>
                                            );
                                        })}
                                        <td className="py-4 pl-6 text-right font-black text-slate-900 text-lg align-top">
                                            {toCurrency(line.totalHt)}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={displayTvaRates.length + 2} className="py-8 text-center text-slate-300 italic text-sm">
                                        Saisissez les montants dans le formulaire pour générer la prestation
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>

                    <div className="invoice-bottom-block mt-auto">
                        <div className="invoice-summary-section flex justify-end mb-4">
                            <div className="w-[320px] bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-3 shadow-sm">
                                <div className="flex justify-between text-xs text-slate-500 font-medium">
                                    <span>Sous-total Hors Taxes :</span>
                                    <span className="text-slate-900">{toCurrency(totalHt)}</span>
                                </div>

                                <div className="space-y-1 pt-2 border-t border-slate-200/60">
                                    {displayTvaRates.map((rate) => {
                                        const rateTotal = lineSummaries.reduce((sum, line) => {
                                            const detail = line.rateDetails.find((d) => d.rate === rate);
                                            return sum + (detail?.tva || 0);
                                        }, 0);
                                        if (rateTotal <= 0) return null;
                                        return (
                                            <div key={rate} className="flex justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                                <span>TVA collectée ({rate}%) :</span>
                                                <span className="text-slate-600">{toCurrency(rateTotal)}</span>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="flex justify-between text-slate-600 text-[10px] font-black uppercase tracking-tight pt-1">
                                    <span>Total des taxes (TVA) :</span>
                                    <span>{toCurrency(totalTva)}</span>
                                </div>

                                <div className="flex justify-between text-slate-600 text-[10px] font-black uppercase tracking-tight pt-1 border-t border-slate-200/60">
                                    <span>Total TTC :</span>
                                    <span>{toCurrency(totalTtcBrut)}</span>
                                </div>

                                {alreadyPaidValue > 0 && (
                                    <div className="flex justify-between text-slate-600 text-[10px] font-black uppercase tracking-tight pt-1">
                                        <span>Déjà réglé :</span>
                                        <span>- {toCurrency(alreadyPaidValue)}</span>
                                    </div>
                                )}

                                <div className="pt-4 border-t-2 flex justify-between items-baseline" style={{ borderColor: accentColor, borderTopStyle: 'solid', borderTopWidth: '2px', opacity: 1 }}>
                                    <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: accentColor, opacity: 0.7 }}>Net à payer TTC</span>
                                    <span className="text-2xl font-black" style={{ color: accentColor }}>{toCurrency(netToPay)}</span>
                                </div>

                                {isSettled && (
                                    <div className="rounded-lg px-3 py-2 text-center text-xs font-bold uppercase tracking-widest" style={{ color: accentColor, backgroundColor: accentSoftBg, border: `1px solid ${accentSoftBorder}` }}>
                                        Facture acquittée
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="invoice-legal-footer pt-4 border-t border-slate-100 text-center">
                            <div className="space-y-1 opacity-80">
                                <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-1">
                                    {settings.company_name || 'Votre établissement'}
                                </p>
                                <div className="text-[8px] text-slate-400 leading-relaxed font-medium flex flex-wrap justify-center gap-x-2 gap-y-0.5 uppercase tracking-wide">
                                    {settings.rcs_ville && settings.rcs_numero && <span>{`RCS ${settings.rcs_ville} ${settings.rcs_numero}`}</span>}
                                    {settings.siret && <span>• SIRET {settings.siret}</span>}
                                    {settings.tva && <span>• TVA {settings.tva}</span>}
                                    {settings.ape && <span>• Code APE {settings.ape}</span>}
                                </div>
                                <div className="text-[8px] text-slate-400 leading-relaxed font-medium flex flex-wrap justify-center gap-x-2 gap-y-0.5 uppercase tracking-wide">
                                    {settings.capital && <span>Capital social : {settings.capital}</span>}
                                    {settings.siege_social && <span>• {settings.siege_social}</span>}
                                    {!settings.siege_social && (settings.address || settings.city) && <span>• {[settings.address, settings.postal_code, settings.city].filter(Boolean).join(' ')}</span>}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <BillingSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} onSaved={loadBillingData} />

            {emailModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-md rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-2xl p-5 space-y-4">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h3 className="text-lg font-black text-[var(--text-primary)]">Envoyer la facture</h3>
                                <p className="text-xs text-[var(--text-muted)] mt-1">La facture est enregistrée dans l’historique puis envoyée en PDF.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setEmailModalOpen(false)}
                                className="text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                            >
                                Fermer
                            </button>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] uppercase tracking-widest font-bold text-[var(--text-muted)]">Adresse email du destinataire</label>
                            <input
                                type="email"
                                value={recipientEmail}
                                onChange={(e) => setRecipientEmail(e.target.value)}
                                placeholder="client@exemple.com"
                                className="h-10 w-full px-3 text-sm bg-[var(--bg-soft)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                            />
                            <p className="text-xs text-[var(--text-muted)]">Si le contact CRM possède un email, il est repris automatiquement.</p>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setEmailModalOpen(false)}
                                className="px-3 py-2 rounded-lg text-xs font-bold bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                            >
                                Annuler
                            </button>
                            <button
                                type="button"
                                onClick={handleSendInvoiceEmail}
                                disabled={sendingEmail}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-white transition-opacity disabled:opacity-60"
                                style={{ backgroundColor: '#0f766e' }}
                            >
                                <Send size={13} /> {sendingEmail ? 'Envoi en cours...' : 'Envoyer'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
