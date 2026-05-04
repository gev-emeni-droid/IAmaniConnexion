
import { STORAGE_KEYS } from './constants';

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
};

export const generateInvoiceNumber = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  const currentCounter = localStorage.getItem(STORAGE_KEYS.INVOICE_COUNTER) || '0';
  const nextCounter = parseInt(currentCounter) + 1;
  localStorage.setItem(STORAGE_KEYS.INVOICE_COUNTER, nextCounter.toString());

  return `F-${year}${month}-${String(nextCounter).padStart(4, '0')}`;
};

export const getCurrentDate = () => {
  return new Date().toLocaleDateString('fr-FR');
};

import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export const generatePDF = async (containerId: string): Promise<Blob> => {
  // New Logic: The container holds multiple .invoice-page elements
  // We capture each one individually to ensure perfect pagination.
  const container = document.getElementById(containerId);
  if (!container) throw new Error('Container not found');

  // Find all pages within the container
  const pages = container.getElementsByClassName('invoice-page');
  if (pages.length === 0) throw new Error('No invoice pages found');

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  for (let i = 0; i < pages.length; i++) {
    const pageElement = pages[i] as HTMLElement;

    // Use html2canvas on the specific page element
    const canvas = await html2canvas(pageElement, {
      scale: 3, // High quality
      logging: false,
      useCORS: true,
      backgroundColor: '#ffffff', // Ensure white background
      onclone: (clonedDoc) => {
        // Fix style issues in clone if needed, but the element should already be 210mm x 297mm
        const clonedPage = clonedDoc.getElementsByClassName('invoice-page')[i] as HTMLElement;
        if (clonedPage) {
          clonedPage.style.margin = '0';
          clonedPage.style.boxShadow = 'none';
        }
      }
    });

    const imgData = canvas.toDataURL('image/png', 1.0);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    if (i > 0) {
      pdf.addPage();
    }

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, '', 'FAST');
  }

  return pdf.output('blob');
};
