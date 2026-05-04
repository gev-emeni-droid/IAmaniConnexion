
interface Env {
    DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const { results } = await context.env.DB.prepare("SELECT * FROM current_invoice WHERE id = 1").all();
        const row: any = results[0];

        if (!row) return new Response(JSON.stringify({}), { headers: { "Content-Type": "application/json" } });

        // Transform flat DB structure back to nested InvoiceData object
        const invoiceData = {
            invoiceNumber: row.invoiceNumber,
            date: row.date,
            covers: row.covers,
            client: {
                companyName: row.client_companyName,
                address: row.client_address
            },
            description: row.description,
            amountHT10: row.amountHT10,
            amountHT20: row.amountHT20
        };

        return new Response(JSON.stringify(invoiceData), {
            headers: { "Content-Type": "application/json" }
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const data: any = await context.request.json();

        await context.env.DB.prepare(`
      UPDATE current_invoice SET 
        invoiceNumber = ?, date = ?, covers = ?, 
        client_companyName = ?, client_address = ?, 
        description = ?, amountHT10 = ?, amountHT20 = ?
      WHERE id = 1
    `).bind(
            data.invoiceNumber, data.date, data.covers,
            data.client.companyName, data.client.address,
            data.description, data.amountHT10, data.amountHT20
        ).run();

        return new Response(JSON.stringify({ success: true }), {
            headers: { "Content-Type": "application/json" }
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
