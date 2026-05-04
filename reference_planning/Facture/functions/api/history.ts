interface Env {
    DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const { results } = await context.env.DB.prepare(
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

        // Check for duplicates
        const existing = await context.env.DB.prepare(
            "SELECT id FROM invoices_history WHERE clientName = ? AND totalTTC = ? AND date = ?"
        )
            .bind(data.clientName, data.totalTTC, data.date)
            .first();

        if (existing) {
            return new Response(JSON.stringify({ success: true, duplicate: true, id: existing.id }), {
                headers: { "Content-Type": "application/json" },
            });
        }

        const fullDataJson = data.fullData ? JSON.stringify(data.fullData) : null;

        const info = await context.env.DB.prepare(
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

        await context.env.DB.prepare(
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
