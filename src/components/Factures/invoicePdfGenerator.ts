/**
 * invoicePdfGenerator.ts
 *
 * Génère un PDF de facture côté client en rendant le même template HTML
 * que celui utilisé par CreateInvoice.tsx.
 * Utilisé à la fois pour :
 *   - Le téléchargement depuis l'historique (InvoiceHistory.tsx)
 *   - L'envoi par email (CreateInvoice.tsx via generatePreviewPdfBase64)
 */

import { toPng } from 'html-to-image';
import { resolveLogoUrl } from '../../lib/resolveLogoUrl';

const fmt = (val: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(
        Number.isFinite(val) ? val : 0
    );

const toDisplayDate = (rawDate: string) => {
    if (!rawDate) return '--/--/----';
    // Handles both "YYYY-MM-DD" and ISO strings
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) return rawDate;
    return d.toLocaleDateString('fr-FR');
};

const DEFAULT_ACCENT = '#2f9e9e';

const hexToRgba = (hex: string, alpha: number) => {
    const clean = hex.replace('#', '').padEnd(6, '0').slice(0, 6);
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
};

/** Builds the HTML string of the invoice, matching the CreateInvoice preview exactly. */
export function buildInvoiceHtml(params: {
    invoice: any;
    payload: any;
    snapshot: any;
    accentColor?: string;
}): string {
    const { invoice, payload, snapshot } = params;
    const accent = params.accentColor || snapshot.primary_color || DEFAULT_ACCENT;
    const accentSoft = hexToRgba(accent, 0.10);
    const accentSoftBorder = hexToRgba(accent, 0.25);

    const companyName = snapshot.company_name || 'Nom de l\'établissement';
    const invoiceNumber = invoice.invoice_number || payload.invoiceNumber || 'F-XXXXXX';
    const invoiceDate = toDisplayDate(payload.invoiceDate || invoice.due_date || invoice.created_at || '');
    const logoUrl = snapshot.logo_url ? resolveLogoUrl(snapshot.logo_url) : null;

    const clientName = payload.clientName || invoice.customer_name || '';
    const clientAddress = payload.clientAddress || '';
    const clientPostalCode = payload.clientPostalCode || '';
    const clientCity = payload.clientCity || '';
    const clientCountry = payload.clientCountry || '';
    const coverCount = payload.coverCount || '';

    const lines: any[] = Array.isArray(payload.lines) ? payload.lines : [];
    const tvaRates: number[] = Array.isArray(snapshot.tva_rates) && snapshot.tva_rates.length > 0
        ? snapshot.tva_rates.map(Number)
        : [20];

    // Compute per-line summaries
    const lineSummaries = lines.map((line: any) => {
        const rateDetails = tvaRates.map((rate) => {
            const ttc = Number(line.ttcByRate?.[rate] ?? 0);
            const ht = ttc / (1 + rate / 100);
            const tva = ttc - ht;
            return { rate, ttc, ht, tva };
        });
        return {
            ...line,
            rateDetails,
            totalHt: rateDetails.reduce((s, d) => s + d.ht, 0),
            totalTva: rateDetails.reduce((s, d) => s + d.tva, 0),
            totalTtc: rateDetails.reduce((s, d) => s + d.ttc, 0),
        };
    });

    const totalHt = Number(invoice.total_ht ?? lineSummaries.reduce((s, l) => s + l.totalHt, 0));
    const totalTva = Number(invoice.total_tva ?? lineSummaries.reduce((s, l) => s + l.totalTva, 0));
    const totalTtcBrut = Number(invoice.total_ttc ?? lineSummaries.reduce((s, l) => s + l.totalTtc, 0));
    const alreadyPaid = Number(invoice.already_paid ?? payload.amountAlreadyPaid ?? 0);
    const netToPay = Number(invoice.remaining_due ?? Math.max(0, totalTtcBrut - alreadyPaid));
    const isSettled = totalTtcBrut > 0 && alreadyPaid >= totalTtcBrut;

    const activeTvaRates = tvaRates.filter((rate) =>
        lineSummaries.some((l) => l.rateDetails.some((d: any) => d.rate === rate && d.ht > 0))
    );
    const displayTvaRates = activeTvaRates.length > 0 ? activeTvaRates : tvaRates;
    const hasContent = lineSummaries.some((l) => l.totalTtc > 0);

    const clientHasAddress = clientName || clientAddress || clientCity || clientPostalCode;

    const legalParts1: string[] = [];
    if (snapshot.rcs_ville && snapshot.rcs_numero) legalParts1.push(`RCS ${snapshot.rcs_ville} ${snapshot.rcs_numero}`);
    if (snapshot.siret) legalParts1.push(`• SIRET ${snapshot.siret}`);
    if (snapshot.tva) legalParts1.push(`• TVA ${snapshot.tva}`);
    if (snapshot.ape) legalParts1.push(`• Code APE ${snapshot.ape}`);

    const legalParts2: string[] = [];
    if (snapshot.capital) legalParts2.push(`Capital social : ${snapshot.capital}`);
    if (snapshot.siege_social) legalParts2.push(`• ${snapshot.siege_social}`);
    else if (snapshot.address || snapshot.city) {
        const addr = [snapshot.address, snapshot.postal_code, snapshot.city].filter(Boolean).join(' ');
        if (addr) legalParts2.push(`• ${addr}`);
    }

    const lineRows = hasContent
        ? lineSummaries.map((line) => {
            const baseCols = displayTvaRates.map((rate) => {
                const detail = line.rateDetails.find((d: any) => d.rate === rate);
                const val = detail && detail.ht > 0 ? fmt(detail.ht) : '-';
                return `<td style="padding:16px 0 16px 16px;text-align:right;color:#4a5568;font-size:14px;">${val}</td>`;
            }).join('');
            return `
            <tr>
              <td style="padding:16px 0;">
                <p style="font-weight:700;color:#1e293b;font-size:18px;margin:0 0 2px 0;">${line.label || 'Prestation non renseignée'}</p>
                <p style="font-size:9px;color:#94a3b8;text-transform:uppercase;font-weight:700;letter-spacing:0.06em;margin:0;">
                  ${line.quantity} quantité${line.quantity > 1 ? 's' : ''}${snapshot.enable_cover_count && coverCount ? ` • ${coverCount} couverts` : ''}
                </p>
              </td>
              ${baseCols}
              <td style="padding:16px 0 16px 24px;text-align:right;font-weight:900;color:#0f172a;font-size:18px;">${fmt(line.totalHt)}</td>
            </tr>`;
        }).join('')
        : `<tr><td colspan="${displayTvaRates.length + 2}" style="padding:32px;text-align:center;color:#cbd5e1;font-style:italic;font-size:14px;">Aucune prestation renseignée</td></tr>`;

    const tvaRows = displayTvaRates.map((rate) => {
        const rateTotal = lineSummaries.reduce((sum, line) => {
            const detail = line.rateDetails.find((d: any) => d.rate === rate);
            return sum + (detail?.tva || 0);
        }, 0);
        if (rateTotal <= 0) return '';
        return `
        <div style="display:flex;justify-content:space-between;font-size:10px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;">
          <span>TVA collectée (${rate}%) :</span>
          <span style="color:#475569;">${fmt(rateTotal)}</span>
        </div>`;
    }).join('');

    const headerCols = displayTvaRates.map((rate) =>
        `<th style="padding-bottom:8px;padding-left:16px;font-size:10px;font-weight:900;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em;text-align:right;">Base HT (${rate}%)</th>`
    ).join('');

    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<title>${invoiceNumber}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; background: #fff; color: #1e293b; }
  .invoice-wrap {
    background: white;
    padding: 8mm;
    width: 210mm;
    min-height: 294mm;
    display: flex;
    flex-direction: column;
    position: relative;
  }
</style>
</head>
<body>
<div class="invoice-wrap">

  <!-- HEADER -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;gap:24px;">
    <div style="display:flex;flex-direction:column;min-width:0;">
      ${logoUrl
          ? `<img src="${logoUrl}" alt="Logo" style="max-height:112px;max-width:250px;margin-bottom:8px;object-fit:contain;align-self:flex-start;" />`
          : `<div style="font-size:11px;font-weight:900;letter-spacing:0.2em;color:#94a3b8;margin-bottom:8px;">LOGO</div>`
      }
      <h1 style="font-size:20px;font-weight:700;color:#1e293b;">${companyName}</h1>
      <div style="color:#475569;font-size:11px;margin-top:4px;line-height:1.4;">
        <p>${snapshot.address || '-'}</p>
        <p>${[snapshot.postal_code, snapshot.city].filter(Boolean).join(' ') || '-'}</p>
      </div>
      ${snapshot.phone ? `<p style="margin-top:4px;font-size:11px;color:#475569;font-weight:600;">Tél : ${snapshot.phone}</p>` : ''}
    </div>

    <div style="text-align:right;flex-shrink:0;">
      <h2 style="font-size:32px;font-weight:900;text-transform:uppercase;color:${accent};letter-spacing:-0.035em;margin-bottom:8px;">FACTURE</h2>
      <div style="background:#f8fafc;padding:16px;border-radius:12px;border:1px solid #f1f5f9;display:inline-block;text-align:left;min-width:190px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <div style="margin-bottom:8px;">
          <p style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;margin-bottom:2px;">Numéro de facture</p>
          <p style="font-family:monospace;font-size:15px;font-weight:700;color:#0f172a;">${invoiceNumber}</p>
        </div>
        <div style="display:grid;grid-template-columns:${snapshot.enable_cover_count && coverCount ? '1fr 1fr' : '1fr'};gap:12px;padding-top:8px;border-top:1px solid rgba(226,232,240,0.6);">
          <div>
            <p style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;margin-bottom:2px;">Date</p>
            <p style="font-weight:700;color:#0f172a;font-size:11px;">${invoiceDate}</p>
          </div>
          ${snapshot.enable_cover_count && coverCount ? `
          <div>
            <p style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;margin-bottom:2px;">Couverts</p>
            <p style="font-weight:700;color:#0f172a;font-size:11px;">${coverCount}</p>
          </div>` : ''}
        </div>
      </div>
    </div>
  </div>

  <!-- DESTINATAIRE -->
  ${clientHasAddress ? `
  <div style="margin-bottom:24px;display:flex;justify-content:flex-end;">
    <div style="width:50%;padding:16px;border-radius:12px;border:2px solid #f8fafc;background:white;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
      <h3 style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;color:${accent};opacity:0.7;">Destinataire</h3>
      <p style="font-weight:700;font-size:18px;color:#0f172a;margin-bottom:2px;">${clientName || '-'}</p>
      <div style="color:#475569;font-size:11px;line-height:1.6;">
        <p>${clientAddress || '-'}</p>
        <p>${[clientPostalCode, clientCity, clientCountry].filter(Boolean).join(' ') || '-'}</p>
        ${snapshot.enable_cover_count && coverCount ? `<p style="margin-top:4px;font-weight:600;">Nombre de couverts : ${coverCount}</p>` : ''}
      </div>
    </div>
  </div>` : ''}

  <!-- TABLE -->
  <table style="width:100%;margin-bottom:24px;border-collapse:collapse;">
    <thead>
      <tr style="border-bottom:2px solid #0f172a;text-align:left;">
        <th style="padding-bottom:8px;font-size:10px;font-weight:900;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em;">Désignation de la prestation</th>
        ${headerCols}
        <th style="padding-bottom:8px;padding-left:24px;font-size:10px;font-weight:900;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em;text-align:right;">Total HT</th>
      </tr>
    </thead>
    <tbody style="border-top:1px solid #f1f5f9;">
      ${lineRows}
    </tbody>
  </table>

  <!-- BOTTOM BLOCK -->
  <div style="margin-top:auto;">
    <!-- SUMMARY -->
    <div style="display:flex;justify-content:flex-end;margin-bottom:16px;">
      <div style="width:320px;background:#f8fafc;padding:20px;border-radius:16px;border:1px solid #f1f5f9;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <div style="display:flex;justify-content:space-between;font-size:11px;color:#64748b;">
          <span>Sous-total Hors Taxes :</span>
          <span style="color:#0f172a;">${fmt(totalHt)}</span>
        </div>

        <div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(226,232,240,0.6);">
          ${tvaRows}
        </div>

        <div style="display:flex;justify-content:space-between;font-size:10px;font-weight:900;text-transform:uppercase;color:#475569;margin-top:4px;">
          <span>Total TVA cumulé :</span>
          <span>${fmt(totalTva)}</span>
        </div>

        <div style="display:flex;justify-content:space-between;font-size:10px;font-weight:900;text-transform:uppercase;color:#475569;margin-top:4px;padding-top:4px;border-top:1px solid rgba(226,232,240,0.6);">
          <span>Total TTC :</span>
          <span>${fmt(totalTtcBrut)}</span>
        </div>

        ${alreadyPaid > 0 ? `
        <div style="display:flex;justify-content:space-between;font-size:10px;font-weight:900;text-transform:uppercase;color:#475569;margin-top:4px;">
          <span>Déjà réglé :</span>
          <span>- ${fmt(alreadyPaid)}</span>
        </div>` : ''}

        <div style="padding-top:16px;margin-top:4px;border-top:2px solid ${accent};display:flex;justify-content:space-between;align-items:baseline;">
          <span style="font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;color:${accent};opacity:0.7;">Net à payer TTC</span>
          <span style="font-size:24px;font-weight:900;color:${accent};">${fmt(netToPay)}</span>
        </div>

        ${isSettled ? `
        <div style="border-radius:8px;padding:8px 12px;text-align:center;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin-top:8px;color:${accent};background:${accentSoft};border:1px solid ${accentSoftBorder};">
          Facture acquittée
        </div>` : ''}
      </div>
    </div>

    <!-- LEGAL FOOTER -->
    <div style="margin-top:16px;padding-top:16px;border-top:1px solid #f1f5f9;text-align:center;">
      <div style="opacity:0.8;">
        <p style="font-size:10px;color:#64748b;font-weight:900;text-transform:uppercase;letter-spacing:0.2em;margin-bottom:4px;">${companyName}</p>
        ${legalParts1.length > 0 ? `
        <div style="font-size:8px;color:#94a3b8;line-height:1.6;font-weight:500;text-transform:uppercase;letter-spacing:0.04em;">
          ${legalParts1.join(' ')}
        </div>` : ''}
        ${legalParts2.length > 0 ? `
        <div style="font-size:8px;color:#94a3b8;line-height:1.6;font-weight:500;text-transform:uppercase;letter-spacing:0.04em;">
          ${legalParts2.join(' ')}
        </div>` : ''}
      </div>
    </div>
  </div>

</div>
</body>
</html>`;
}

/**
 * Génère un PDF depuis les données d'une facture, en rendant le même template
 * HTML que l'aperçu de CreateInvoice.tsx.
 */
export async function generateInvoicePdfFromData(params: {
    invoice: any;
    payload: any;
    snapshot: any;
    accentColor?: string;
}): Promise<{ pdf: any; blob: Blob }> {
    const htmlContent = buildInvoiceHtml(params);

    // Crée un iframe caché pour rendre le HTML
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.left = '-10000px';
    iframe.style.top = '0';
    iframe.style.width = '210mm';
    iframe.style.height = '297mm';
    iframe.style.border = 'none';
    iframe.style.zIndex = '-1';
    document.body.appendChild(iframe);

    await new Promise<void>((resolve) => {
        iframe.onload = () => resolve();
        iframe.srcdoc = htmlContent;
        // Fallback timeout
        setTimeout(resolve, 2000);
    });

    // Attendre que les images soient chargées
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (iframeDoc) {
        const imgs = Array.from(iframeDoc.querySelectorAll('img'));
        if (imgs.length > 0) {
            await Promise.all(imgs.map((img) =>
                new Promise<void>((res) => {
                    if (img.complete) { res(); return; }
                    img.onload = () => res();
                    img.onerror = () => res();
                    setTimeout(res, 1500);
                })
            ));
        }
    }

    const targetEl = iframeDoc?.body?.firstElementChild as HTMLElement | null;
    if (!targetEl) {
        document.body.removeChild(iframe);
        throw new Error('Impossible de rendre la facture.');
    }

    try {
        const PIXEL_RATIO = 1.5;
        const imgData = await toPng(targetEl, {
            cacheBust: true,
            pixelRatio: PIXEL_RATIO,
            backgroundColor: '#ffffff',
            width: targetEl.scrollWidth,
            height: targetEl.scrollHeight,
        });

        const { jsPDF } = await import('jspdf');
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageWidth = 210;
        const pageHeight = 297;
        const margin = 0;
        const usableWidth = pageWidth - margin * 2;
        const usableHeight = pageHeight - margin * 2;

        const imageProps = pdf.getImageProperties(imgData);
        const widthRatio = usableWidth / imageProps.width;
        const heightRatio = usableHeight / imageProps.height;
        const scale = Math.min(widthRatio, heightRatio);
        const imageWidth = imageProps.width * scale;
        const imageHeight = imageProps.height * scale;

        pdf.addImage(imgData, 'PNG', margin, margin, imageWidth, imageHeight, undefined, 'SLOW');

        const blob = pdf.output('blob');
        return { pdf, blob };
    } finally {
        document.body.removeChild(iframe);
    }
}
