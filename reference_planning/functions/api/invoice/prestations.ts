interface Env {
    FACTURE_DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const { results } = await context.env.FACTURE_DB.prepare(
            "SELECT * FROM prestations ORDER BY id ASC"
        ).all();
        return new Response(JSON.stringify(results), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 });
    }
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const { label } = await context.request.json() as { label: string };

        if (!label) {
            return new Response(JSON.stringify({ error: "Label is required" }), { status: 400 });
        }

        const info = await context.env.FACTURE_DB.prepare(
            "INSERT INTO prestations (label) VALUES (?)"
        )
            .bind(label)
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
            "DELETE FROM prestations WHERE id = ?"
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

export const onRequestPut: PagesFunction<Env> = async (context) => {
    try {
        const { id, label } = await context.request.json() as { id: number, label: string };

        if (!id || !label) {
            return new Response(JSON.stringify({ error: "ID and Label are required" }), { status: 400 });
        }

        await context.env.FACTURE_DB.prepare(
            "UPDATE prestations SET label = ? WHERE id = ?"
        )
            .bind(label, id)
            .run();

        return new Response(JSON.stringify({ success: true }), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 });
    }
};
