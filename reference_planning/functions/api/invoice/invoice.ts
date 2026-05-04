
interface Env {
    FACTURE_DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const { results } = await context.env.FACTURE_DB.prepare("SELECT * FROM current_invoice WHERE id = 1").all();
        const row: any = results[0];

        if (!row) return new Response(JSON.stringify({}), { headers: { "Content-Type": "application/json" } });

        // If full_data exists (new format), use it as the source of truth
        if (row.full_data) {
            try {
                const parsed = JSON.parse(row.full_data);
                return new Response(JSON.stringify(parsed), {
                    headers: { "Content-Type": "application/json" }
                });
            } catch (e) {
                console.error("Failed to parse full_data", e);
                // Fallback to legacy
            }
        }

        // Fallback: Transform legacy flat DB structure back to nested InvoiceData object
        const invoiceData = {
            invoiceNumber: row.invoiceNumber,
            date: row.date,
            covers: row.covers,
            client: {
                companyName: row.client_companyName,
                address: row.client_address,
                zipCode: row.client_zipCode,
                city: row.client_city,
                country: row.client_country
            },
            // Map legacy description/amounts to single item array for compatibility
            items: [
                {
                    id: 'legacy-1',
                    description: row.description || '',
                    amountHT10: row.amountHT10 || 0,
                    amountHT20: row.amountHT20 || 0
                }
            ],
            deposit: 0
        };

        return new Response(JSON.stringify(invoiceData), {
            headers: { "Content-Type": "application/json" }
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 });
    }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const data: any = await context.request.json();
        const fullDataJson = JSON.stringify(data);

        // Update full_data. We also update legacy searchable fields for convenience if needed, 
        // but primarily we rely on full_data now.
        // We maintain invoiceNumber and date as separate columns for potential lightweight queries.
        await context.env.FACTURE_DB.prepare(`
      UPDATE current_invoice SET 
        invoiceNumber = ?, 
        date = ?, 
        full_data = ?
      WHERE id = 1
    `).bind(
            data.invoiceNumber,
            data.date,
            fullDataJson
        ).run();

        return new Response(JSON.stringify({ success: true }), {
            headers: { "Content-Type": "application/json" }
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 });
    }
}
