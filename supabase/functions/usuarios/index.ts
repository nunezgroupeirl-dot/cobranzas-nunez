// Edge Function "usuarios" · Cobranzas Núñez
// Crea cobradores y les cambia el nombre o la contraseña. Solo la puede usar el dueño.
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
    if (errAdmin || esAdmin !== true) return responder({ error: "Solo el dueño puede administrar usuarios." }, 403);

    const cuerpo = await req.json().catch(() => ({}));
    const admin = createClient(url, servicio, { auth: { persistSession: false, autoRefreshToken: false } });

    // Editar a un trabajador: nombre y/o contraseña. La cuenta del dueño no se toca desde aquí.
    if (cuerpo.accion === "editar") {
      const id = String(cuerpo.id ?? "");
      const { data: perfil } = await admin.from("perfiles").select("id, rol").eq("id", id).maybeSingle();
      if (!perfil) return responder({ error: "El usuario no existe." }, 404);
      if (perfil.rol === "administrador") return responder({ error: "La contraseña del dueño se cambia desde su propia sesión." }, 403);
      const nombre = cuerpo.nombre === undefined ? null : String(cuerpo.nombre).trim();
      const clave = cuerpo.clave === undefined ? null : String(cuerpo.clave);
      if (nombre !== null && !nombre) return responder({ error: "Escribe el nombre." }, 400);
      if (clave !== null && clave.length < 6) return responder({ error: "La contraseña debe tener al menos 6 caracteres." }, 400);
      if (nombre === null && clave === null) return responder({ error: "No hay cambios." }, 400);
      const { error: errAuth } = await admin.auth.admin.updateUserById(id, {
        ...(clave !== null ? { password: clave } : {}),
        ...(nombre !== null ? { user_metadata: { nombre } } : {}),
      });
      if (errAuth) return responder({ error: errAuth.message }, 400);
      if (nombre !== null) {
        const { error: errPerfil } = await admin.from("perfiles").update({ nombre }).eq("id", id);
        if (errPerfil) return responder({ error: errPerfil.message }, 400);
      }
      return responder({ ok: true });
    }

    // 2. Crear: validar datos
    if (cuerpo.accion !== "crear") return responder({ error: "Acción no válida." }, 400);

    const nombre = String(cuerpo.nombre ?? "").trim();
    const email = String(cuerpo.email ?? "").trim().toLowerCase();
    const clave = String(cuerpo.clave ?? "");
    // Solo existe un administrador: el dueño. Todo usuario nuevo es cobrador.
    if (cuerpo.rol === "administrador") return responder({ error: "Solo el dueño puede ser administrador." }, 400);
    const rol = "cobrador";

    if (!nombre) return responder({ error: "Escribe el nombre." }, 400);
    if (!/^\S+@\S+\.\S+$/.test(email)) return responder({ error: "Escribe un correo válido." }, 400);
    if (clave.length < 6) return responder({ error: "La contraseña debe tener al menos 6 caracteres." }, 400);

    // 3. Crear el usuario. El trigger al_crear_usuario crea su perfil activo con este rol.
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
    return responder({ error: "No se pudo completar la acción. Inténtalo otra vez." }, 500);
  }
});
