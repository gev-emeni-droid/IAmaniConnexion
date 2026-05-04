import * as pdfjs from 'pdfjs-dist';

// Configuration du worker PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

export interface ImportEmployeeRow {
    last_name: string;
    first_name: string;
    position: string;
    email?: string;
    phone?: string;
}

export const extractRowsFromPdfClient = async (file: File): Promise<ImportEmployeeRow[]> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        fullText += textContent.items.map((item: any) => item.str).join(' ') + '\n';
    }

    const lines = fullText
        .split(/\r?\n/)
        .map((l) => l.replace(/\s+/g, ' ').trim())
        .filter(Boolean);

    const parsedRows: ImportEmployeeRow[] = [];
    for (const line of lines) {
        const lower = line.toLowerCase();
        if (lower.includes('nom') && lower.includes('prénom')) continue;
        if (lower.includes('poste') && lower.includes('téléphone')) continue;

        let cols: string[] = [];
        if (/[;|\t]/.test(line)) {
            cols = line.split(/[;|\t]/).map((c) => c.trim()).filter(Boolean);
        } else if (/\s{2,}/.test(line)) {
            cols = line.split(/\s{2,}/).map((c) => c.trim()).filter(Boolean);
        }

        if (cols.length >= 3) {
            parsedRows.push({
                last_name: String(cols[0] || '').trim(),
                first_name: String(cols[1] || '').trim(),
                position: String(cols[2] || '').trim(),
                phone: String(cols[3] || '').trim()
            });
            continue;
        }

        const simpleMatch = line.match(/^([A-Za-zÀ-ÖØ-öø-ÿ' -]{2,})\s+([A-Za-zÀ-ÖØ-öø-ÿ' -]{2,})\s+-\s+([^\-]{2,})(?:\s+-\s+(\+?[\d .\-]{7,}))?$/);
        if (simpleMatch) {
            parsedRows.push({
                last_name: simpleMatch[1].trim(),
                first_name: simpleMatch[2].trim(),
                position: simpleMatch[3].trim(),
                phone: (simpleMatch[4] || '').trim()
            });
        }
    }

    return parsedRows;
};

export const extractEvenementielRowsFromPdfClient = async (file: File): Promise<any[]> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        fullText += textContent.items.map((item: any) => item.str).join(' ') + '\n';
    }

    const lines = fullText
        .split(/\r?\n/)
        .map((l) => l.replace(/\s+/g, ' ').trim())
        .filter(Boolean);

    const parsedRows: any[] = [];
    for (const line of lines) {
        // Format attendu: Date Client Heures Espace NbPers
        // Exemple: 15/05/2026 Brasserie Polpo 19h-02h Salle 50
        const match = line.match(/(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(\d{1,2}h(?:-\d{1,2}h)?)\s+(.+?)(?:\s+(\d+))?$/);
        if (match) {
            const dateStr = match[1];
            const [day, month, year] = dateStr.split('/');
            parsedRows.push({
                mois_annee: `${month}/${year}`,
                client: match[2].trim(),
                date: dateStr,
                start: match[3].split('-')[0],
                end: match[3].split('-')[1] || '',
                espace: match[4].trim(),
                num_people: match[5] || '',
                staffs: []
            });
        }
    }

    return parsedRows;
};
