interface Env {
    FACTURE_DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const { results } = await context.env.FACTURE_DB.prepare(
            "SELECT * FROM invoices_history ORDER BY createdAt DESC LIMIT 50"
        ).all();

        // Parse full_data JSON
        const parsedResults = results.map((item: any) => ({
            ...item,
            fullData: item.full_data ? JSON.parse(item.full_data) : null
        }));

        return new Response(JSON.stringify(parsedResults), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 });
    }
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const defaultData = {
            invoiceNumber: '',
            clientName: '',
            totalTTC: 0,
            date: '',
            fullData: null
        };

        const input = await context.request.json() as typeof defaultData;
        const data = { ...defaultData, ...input };

        // Check for duplicates by invoiceNumber
        const existing = await context.env.FACTURE_DB.prepare(
            "SELECT id FROM invoices_history WHERE invoiceNumber = ?"
        )
            .bind(data.invoiceNumber)
            .first();

        if (existing) {
            // Update existing record
            const fullDataJson = data.fullData ? JSON.stringify(data.fullData) : null;
            await context.env.FACTURE_DB.prepare(
                "UPDATE invoices_history SET clientName = ?, totalTTC = ?, date = ?, full_data = ? WHERE id = ?"
            )
                .bind(data.clientName, data.totalTTC, data.date, fullDataJson, existing.id)
                .run();

            return new Response(JSON.stringify({ success: true, updated: true, id: existing.id }), {
                headers: { "Content-Type": "application/json" },
            });
        }

        const fullDataJson = data.fullData ? JSON.stringify(data.fullData) : null;

        const info = await context.env.FACTURE_DB.prepare(
            "INSERT INTO invoices_history (invoiceNumber, clientName, totalTTC, date, full_data) VALUES (?, ?, ?, ?, ?)"
        )
            .bind(data.invoiceNumber, data.clientName, data.totalTTC, data.date, fullDataJson)
            .run();

        return new Response(JSON.stringify({ success: true, id: info.meta.last_row_id }), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 });
    }
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
    try {
        const url = new URL(context.request.url);
        const id = url.searchParams.get('id');

        if (!id) {
            return new Response(JSON.stringify({ error: 'Missing id parameter' }), { status: 400 });
        }

        await context.env.FACTURE_DB.prepare(
            "DELETE FROM invoices_history WHERE id = ?"
        )
            .bind(id)
            .run();

        return new Response(JSON.stringify({ success: true }), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 });
    }
};
