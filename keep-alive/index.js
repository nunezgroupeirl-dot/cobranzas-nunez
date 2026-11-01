// Keep-alive · Cobranzas Núñez
// Worker de Cloudflare que corre solo (Cron Trigger) para que Supabase no pause
// el proyecto en el plan gratis por "poca actividad" (7 días sin consultas).
// Hace una consulta real y liviana: la consulta pública por DNI con un DNI que no
// existe. No lee datos de nadie ni abre nada nuevo: esa función ya es pública.
//
// Con Supabase Pro no hace falta (los proyectos pagados nunca se pausan),
// pero tampoco molesta: 4 consultas al día.
//
// Variables (Cloudflare → el Worker → Settings → Variables and Secrets):
//   SUPABASE_URL       https://xxxx.supabase.co           (texto)
//   SUPABASE_ANON_KEY  la llave anon / publishable        (secreto)

async function despertar(env) {
  const respuesta = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/consulta_publica`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_dni: "00000000" }),
  });
  if (!respuesta.ok) {
    // Así el error aparece en Cloudflare → el Worker → Logs
    throw new Error(`Supabase respondió ${respuesta.status}: ${await respuesta.text()}`);
  }
  return respuesta.status;
}

export default {
  // Lo ejecuta Cloudflare según el horario de Triggers → Cron Triggers
  async scheduled(_evento, env, ctx) {
    ctx.waitUntil(despertar(env));
  },

  // Abrir la dirección del Worker en el navegador sirve para probarlo a mano
  async fetch(_peticion, env) {
    try {
      const estado = await despertar(env);
      return new Response(`Supabase activo (respuesta ${estado}).`, { status: 200 });
    } catch (e) {
      return new Response(`Error: ${e.message}`, { status: 502 });
    }
  },
};
