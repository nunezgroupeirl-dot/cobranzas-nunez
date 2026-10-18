// Edge Function "usuarios" · Cobranzas Núñez
// Crea usuarios del sistema. Solo la puede usar un administrador activo.
// Necesita la llave service_role, que Supabase inyecta sola en las Edge Functions
// (nunca va en el frontend).
//
// Desplegar (una de dos):
//   · Supabase CLI:  supabase functions deploy usuarios
//   · Panel web:     Edge Functions → Deploy a new function → Via Editor →
//                    nombre "usuarios" → pegar este archivo → Deploy

import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const responder = (cuerpo: Record<string, unknown>, estado = 200) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return responder({ error: "Método no permitido." }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const servicio = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 1. ¿Quién llama? Debe ser administrador activo.
    const comoUsuario = createClient(url, anon, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
      auth: { persistSession: false },
    });
    const { data: esAdmin, error: errAdmin } = await comoUsuario.rpc("es_admin");
    if (errAdmin || esAdmin !== true) return responder({ error: "Solo el administrador puede crear usuarios." }, 403);

    // 2. Validar datos
    const cuerpo = await req.json().catch(() => ({}));
    if (cuerpo.accion !== "crear") return responder({ error: "Acción no válida." }, 400);

    const nombre = String(cuerpo.nombre ?? "").trim();
    const email = String(cuerpo.email ?? "").trim().toLowerCase();
    const clave = String(cuerpo.clave ?? "");
    const rol = cuerpo.rol === "administrador" ? "administrador" : "cobrador";

    if (!nombre) return responder({ error: "Escribe el nombre." }, 400);
    if (!/^\S+@\S+\.\S+$/.test(email)) return responder({ error: "Escribe un correo válido." }, 400);
    if (clave.length < 6) return responder({ error: "La contraseña debe tener al menos 6 caracteres." }, 400);

    // 3. Crear el usuario. El trigger al_crear_usuario crea su perfil activo con este rol.
    const admin = createClient(url, servicio, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await admin.auth.admin.createUser({
      email,
      password: clave,
      email_confirm: true,
      user_metadata: { nombre },
      app_metadata: { rol, creado_por_admin: true },
    });

    if (error) {
      const repetido = /already|registered|exists/i.test(error.message);
      return responder({ error: repetido ? "Ya existe un usuario con ese correo." : error.message }, 400);
    }
    return responder({ ok: true });
  } catch (_e) {
    return responder({ error: "No se pudo crear el usuario. Inténtalo otra vez." }, 500);
  }
});
