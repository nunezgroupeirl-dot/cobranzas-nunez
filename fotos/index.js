// Fotos · Cobranzas Núñez
// Worker de Cloudflare que guarda las fotos en R2 (10 GB gratis) en vez de Supabase Storage.
// Aplica los MISMOS permisos que tenían los buckets de Supabase:
//   · ver: cualquier usuario activo · subir comprobantes: dueño y cobradores · subir fotos del cliente: solo el dueño
//   · borrar foto de pago: quien la subió o el dueño, y solo si ya no está ligada a un pago
//   · borrar foto de cliente: el dueño, o quien la subió
// Quién es el usuario lo decide Supabase: se valida su sesión en cada petición.
//
// Configuración (Cloudflare → el Worker → Settings):
//   Bindings → R2 bucket:   FOTOS  → bucket "cobranzas-nunez-fotos"
//   Variables:              SUPABASE_URL (texto), SUPABASE_ANON_KEY (texto)
//   Secret:                 FIRMA_SECRETA (texto largo al azar; firma los enlaces de 1 hora)

const BUCKETS = new Set(["evidencias", "documentos"]);
// empresa_id/cliente_id/tipo-fecha-azar.jpg  (lo arma src/lib/fotos.ts)
const RUTA_VALIDA = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[a-z]{2,12}-\d{10,15}-[a-z0-9]{1,10}\.jpg$/;
const TAMANO_MAXIMO = 2 * 1024 * 1024; // las fotos llegan comprimidas (~120 KB)
const VIGENCIA_ENLACE = 3600; // segundos

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Max-Age": "86400",
};

const responder = (cuerpo, estado = 200) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" } });
const fallo = (estado, mensaje) => responder({ error: mensaje }, estado);

/* ---------------- sesión y permisos (los decide Supabase) ---------------- */

function tokenDe(peticion) {
  const h = peticion.headers.get("Authorization") || "";
  return h.startsWith("Bearer ") ? h.slice(7) : "";
}

async function supabase(env, token, camino, opciones = {}) {
  return fetch(`${env.SUPABASE_URL}${camino}`, {
    ...opciones,
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(opciones.headers || {}) },
  });
}

/** Devuelve { id, staff, admin } del usuario de la sesión, o null si la sesión no es válida. */
async function usuario(env, token) {
  if (!token) return null;
  // Las tres consultas son independientes: van a la vez (una sola espera)
  const rol = async (fn) => {
    const x = await supabase(env, token, `/rest/v1/rpc/${fn}`, { method: "POST", body: "{}" });
    return x.ok && (await x.json()) === true;
  };
  const [r, staff, admin] = await Promise.all([supabase(env, token, "/auth/v1/user"), rol("es_staff"), rol("es_admin")]);
  if (!r.ok) return null;
  const { id } = await r.json();
  return { id, staff, admin };
}

/** ¿La foto ya está ligada a un pago registrado? */
async function ligadaAPago(env, token, ruta) {
  const r = await supabase(env, token, `/rest/v1/pagos?select=id&foto_ruta=eq.${encodeURIComponent(ruta)}&limit=1`);
  if (!r.ok) return true; // ante la duda, no se borra
  return (await r.json()).length > 0;
}

/* ---------------- enlaces firmados (para <img src>) ---------------- */

async function firma(env, texto) {
  const clave = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.FIRMA_SECRETA), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", clave, new TextEncoder().encode(texto));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Comparación en tiempo constante (no revela cuántos caracteres coinciden). */
function iguales(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/* ---------------- rutas ---------------- */

function partes(url) {
  // /archivo/<bucket>/<empresa>/<cliente>/<archivo>.jpg
  const m = url.pathname.match(/^\/archivo\/([a-z]+)\/(.+)$/);
  if (!m) return null;
  const bucket = m[1];
  const ruta = decodeURIComponent(m[2]);
  if (!BUCKETS.has(bucket) || !RUTA_VALIDA.test(ruta)) return null;
  return { bucket, ruta, clave: `${bucket}/${ruta}` };
}

export default {
  async fetch(peticion, env) {
    if (peticion.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    if (!env.FOTOS || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.FIRMA_SECRETA) {
      return fallo(500, "Falta configurar el Worker de fotos (bucket R2, SUPABASE_URL, SUPABASE_ANON_KEY o FIRMA_SECRETA).");
    }
    const url = new URL(peticion.url);

    if (url.pathname === "/" && peticion.method === "GET") return new Response("Fotos de Cobranzas Núñez: activo.", { headers: CORS });

    // Pedir un enlace temporal para mostrar una foto
    if (url.pathname === "/firmar" && peticion.method === "POST") {
      const yo = await usuario(env, tokenDe(peticion));
      if (!yo) return fallo(401, "Tu sesión expiró. Vuelve a ingresar.");
      if (!yo.staff) return fallo(403, "No tienes permiso para ver fotos.");
      const { bucket, ruta } = await peticion.json().catch(() => ({}));
      const p = partes(new URL(`/archivo/${bucket}/${ruta}`, url));
      if (!p) return fallo(400, "Foto no válida.");
      const exp = Math.floor(Date.now() / 1000) + VIGENCIA_ENLACE;
      const sig = await firma(env, `${p.clave}:${exp}`);
      return responder({ url: `${url.origin}/archivo/${p.bucket}/${p.ruta}?exp=${exp}&sig=${sig}`, vence: exp });
    }

    const p = partes(url);
    if (!p) return fallo(404, "No encontrado.");

    // Ver una foto con enlace firmado
    if (peticion.method === "GET") {
      const exp = Number(url.searchParams.get("exp"));
      const sig = url.searchParams.get("sig") || "";
      if (!exp || exp < Date.now() / 1000) return fallo(403, "El enlace de la foto venció. Recarga la página.");
      if (!iguales(sig, await firma(env, `${p.clave}:${exp}`))) return fallo(403, "Enlace no válido.");
      const obj = await env.FOTOS.get(p.clave);
      if (!obj) return fallo(404, "La foto no existe.");
      return new Response(obj.body, {
        headers: { ...CORS, "Content-Type": "image/jpeg", "Cache-Control": `private, max-age=${Math.max(0, exp - Math.floor(Date.now() / 1000))}` },
      });
    }

    const yo = await usuario(env, tokenDe(peticion));
    if (!yo) return fallo(401, "Tu sesión expiró. Vuelve a ingresar.");
    if (!yo.staff) return fallo(403, "No tienes permiso para manejar fotos.");

    // Subir: comprobantes de pago (dueño y cobradores); fotos y documentos del cliente (solo el dueño)
    if (peticion.method === "PUT") {
      if (p.bucket === "documentos" && !yo.admin) return fallo(403, "Solo el dueño puede subir fotos y documentos del cliente.");
      if ((peticion.headers.get("Content-Type") || "") !== "image/jpeg") return fallo(415, "La foto debe ser JPG.");
      const largo = Number(peticion.headers.get("Content-Length") || 0);
      if (largo > TAMANO_MAXIMO) return fallo(413, "La foto es demasiado grande.");
      if (await env.FOTOS.head(p.clave)) return fallo(409, "Esa foto ya existe.");
      const cuerpo = await peticion.arrayBuffer();
      if (cuerpo.byteLength === 0 || cuerpo.byteLength > TAMANO_MAXIMO) return fallo(413, "La foto está vacía o es demasiado grande.");
      await env.FOTOS.put(p.clave, cuerpo, {
        httpMetadata: { contentType: "image/jpeg" },
        customMetadata: { subido_por: yo.id },
      });
      return responder({ ok: true }, 201);
    }

    // Borrar
    if (peticion.method === "DELETE") {
      const obj = await env.FOTOS.head(p.clave);
      if (!obj) return new Response(null, { status: 204, headers: CORS });
      const esSuya = obj.customMetadata?.subido_por === yo.id;
      if (p.bucket === "evidencias") {
        if (!esSuya && !yo.admin) return fallo(403, "Solo quien subió la foto o el dueño pueden descartarla.");
        if (await ligadaAPago(env, tokenDe(peticion), p.ruta)) return fallo(403, "La foto ya es evidencia de un pago y no se puede borrar.");
      } else if (!yo.admin && !esSuya) {
        return fallo(403, "Solo el dueño o quien subió la foto puede borrarla.");
      }
      await env.FOTOS.delete(p.clave);
      return new Response(null, { status: 204, headers: CORS });
    }

    return fallo(405, "Método no permitido.");
  },
};
