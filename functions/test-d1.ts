export const onRequest = async (context) => {
  return new Response(
    JSON.stringify({
      env: Object.keys(context.env),
      hasDB: !!context.env.DB
    }),
    { headers: { "content-type": "application/json" } }
  );
};
