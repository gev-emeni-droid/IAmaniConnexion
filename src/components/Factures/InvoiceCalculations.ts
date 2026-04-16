export const resolveClientTvaRate = (defaultRate?: string, customRate?: number | null) => {
    if (defaultRate === 'custom') {
        const parsed = Number(customRate ?? 0);
        return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    }
    const parsed = Number(defaultRate ?? 20);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 20;
};

export const computeInvoiceTotals = (amountHt: number, clientTvaRate: number) => {
    const safeHt = Number.isFinite(amountHt) ? amountHt : 0;
    const safeRate = Number.isFinite(clientTvaRate) ? clientTvaRate : 0;
    const totalTva = safeHt * (safeRate / 100);
    const totalTtc = safeHt + totalTva;
    return {
        subtotalHt: safeHt,
        totalTva,
        totalTtc,
    };
};
