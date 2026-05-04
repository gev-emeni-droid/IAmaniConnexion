interface Env {
    DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const { results } = await context.env.DB.prepare("SELECT * FROM settings WHERE id = 1").all();
        return new Response(JSON.stringify(results[0] || {}), {
            headers: { "Content-Type": "application/json" }
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 });
    }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const data: any = await context.request.json();

        await context.env.DB.prepare(`
      UPDATE settings SET 
        name = ?, street = ?, zipCode = ?, city = ?, 
        siret = ?, vatNumber = ?, phone = ?, logo = ?, primaryColor = ?,
        rcs = ?, ape = ?, capital = ?, headquarters = ?
      WHERE id = 1
    `).bind(
            data.name, data.street, data.zipCode, data.city,
            data.siret, data.vatNumber, data.phone, data.logo, data.primaryColor,
            data.rcs || '', data.ape || '', data.capital || '', data.headquarters || ''
        ).run();

        return new Response(JSON.stringify({ success: true }), {
            headers: { "Content-Type": "application/json" }
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 });
    }
}
