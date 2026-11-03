/**
 * Acceso a Supabase. Usa las tablas, vistas y funciones de supabase/esquema.sql.
 *
 * - La seguridad real está en la base de datos (RLS + funciones): el frontend solo
 *   usa la llave pública (anon) y la sesión del usuario.
 * - Supabase devuelve como máximo 1000 filas por consulta: `todas()` pagina para
 *   que las listas grandes (clientes, pagos de un mes) lleguen completas.
 */
import type { PostgrestError } from "@supabase/supabase-js";
import type {
  Cliente,
  ConsultaPublica,
  Contrato,
  Cuenta,
  Cuota,
  Documento,
  Empresa,
  EstadoCliente,
  Moto,
  Pago,
  Perfil,
  RegistrarPagoResultado,
  ResumenEmpresa,
  CobranzaSemana,
  Bucket,
} from "@/types/database";
import { supabaseNavegador } from "./cliente";
import { crearAlmacen } from "./almacen";
import { ErrorDatos, type Datos } from "./datos";
import { fechaOperativaLima } from "./reglas";
import { mesAnterior, siguienteMes } from "@/lib/letras";

/** Códigos que lanza la base de datos y que la pantalla traduce (ver MENSAJE_ERROR) */
const CODIGOS = ["OPERACION_REPETIDA", "IMAGEN_REPETIDA", "MONTO_INVALIDO", "SIN_FOTO", "SIN_PERMISO"];
const TAMANO_PAGINA = 1000;
const COLUMNAS_MOTO = "id, cliente_id, empresa_id, placa, tipo, marca, color, modelo, anio, clase, combustible, serie, motor, carroceria";

type ErrorSupabase = Pick<PostgrestError, "message" | "code"> | { message: string; code?: string };

function lanzar(error: ErrorSupabase | null | undefined): void {
  if (!error) return;
  const mensaje = error.message ?? "";
  const codigo = CODIGOS.find((c) => mensaje.includes(c));
  if (codigo) throw new ErrorDatos(codigo, mensaje);
  if (error.code === "23505") throw new ErrorDatos("REPETIDO", traducirUnico(mensaje));
  if (error.code === "42501" || /permission denied|row-level security/i.test(mensaje))
    throw new ErrorDatos("SIN_PERMISO", "No tienes permiso para hacer esto.");
  if (/JWT|session/i.test(mensaje)) throw new ErrorDatos("SIN_SESION", "Tu sesión terminó. Vuelve a ingresar.");
  if (/Failed to fetch|NetworkError|network/i.test(mensaje))
    throw new ErrorDatos("SIN_CONEXION", "No hay conexión a internet. Revisa la señal e inténtalo otra vez.");
  // Los mensajes que escribe la base de datos ya están en español
  throw new ErrorDatos(error.code ?? "ERROR", mensaje || "Algo salió mal. Inténtalo otra vez.");
}

function traducirUnico(mensaje: string): string {
  if (mensaje.includes("clientes_dni")) return "Ya existe un cliente con ese DNI.";
  if (mensaje.includes("motos_placa")) return "Ya existe una moto con esa placa.";
  if (mensaje.includes("empresas_nombre")) return "Ya existe una empresa con ese nombre.";
  return "Ese dato ya está registrado.";
}

function fila<T>(r: { data: unknown; error: ErrorSupabase | null }): T | null {
  lanzar(r.error);
  return (r.data ?? null) as T | null;
}

/** Trae todas las filas de una consulta, de 1000 en 1000. */
async function todas<T>(
  consulta: (desde: number, hasta: number) => PromiseLike<{ data: unknown; error: ErrorSupabase | null }>,
): Promise<T[]> {
  const resultado: T[] = [];
  for (let desde = 0; ; desde += TAMANO_PAGINA) {
    const r = await consulta(desde, desde + TAMANO_PAGINA - 1);
    lanzar(r.error);
    const lote = (r.data ?? []) as T[];
    resultado.push(...lote);
    if (lote.length < TAMANO_PAGINA) return resultado;
  }
}

/** Postgres devuelve numeric como texto en algunos casos: lo pasamos a número. */
const num = (v: unknown): number => (typeof v === "number" ? v : Number(v ?? 0));
const numONull = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

const normalizarEstado = (e: EstadoCliente): EstadoCliente => ({ ...e, cuota: num(e.cuota), deuda: num(e.deuda), semanas_atraso: num(e.semanas_atraso) });
const normalizarContrato = (c: Contrato): Contrato => ({ ...c, monto_cuota: num(c.monto_cuota), precio_total: numONull(c.precio_total), inicial: numONull(c.inicial) });
const normalizarCuota = (c: Cuota): Cuota => ({ ...c, monto: num(c.monto), monto_pagado: num(c.monto_pagado) });

type PagoConPerfil = Omit<Pago, "registrado_por_nombre"> & { perfil: { nombre: string } | null };

export function crearDatosReales(): Datos {
  const sb = supabaseNavegador();
  const almacen = crearAlmacen(sb); // fotos: Worker con R2 o Supabase Storage
  /** Llama a la Edge Function "usuarios"; su mensaje de error en español viene en el cuerpo de la respuesta. */
  const funcionUsuarios = async (cuerpo: Record<string, unknown>, porDefecto: string) => {
    const { data, error } = await sb.functions.invoke("usuarios", { body: cuerpo });
    if (error) {
      let mensaje = porDefecto;
      const contexto = (error as { context?: Response }).context;
      if (contexto && typeof contexto.json === "function") {
        const respuesta = await contexto.json().catch(() => null);
        if (respuesta?.error) mensaje = String(respuesta.error);
      } else if (/Failed to send|fetch/i.test(error.message)) {
        mensaje = "No se pudo conectar con la función de usuarios. ¿Está desplegada en Supabase?";
      }
      throw new ErrorDatos("USUARIO", mensaje);
    }
    if (data?.error) throw new ErrorDatos("USUARIO", String(data.error));
  };

  /** Borra una fila; si otra tabla la usa (llave foránea), explica qué hacer. */
  const borrarFila = async (tabla: string, id: string, enUso: string) => {
    const r = await sb.from(tabla).delete().eq("id", id).select("id");
    if (r.error?.code === "23503") throw new ErrorDatos("EN_USO", enUso);
    lanzar(r.error);
    if (!r.data?.length) throw new ErrorDatos("SIN_PERMISO", "No tienes permiso para eliminar esto.");
  };
  /** Después de borrar los registros, se borran sus fotos (si alguna falla, no detiene nada). */
  const borrarFotos = (bucket: Bucket, rutas: string[]) => Promise.all(rutas.map((ruta) => almacen.borrar(bucket, ruta).catch(() => undefined)));

  const perfilDe = async (userId: string): Promise<Perfil | null> =>
    fila<Perfil>(await sb.from("perfiles").select("*").eq("id", userId).maybeSingle());

  return {
    modoPrueba: false,

    /* ---------------- sesión ---------------- */
    async sesion() {
      const { data } = await sb.auth.getSession();
      const usuario = data.session?.user;
      if (!usuario) return null;
      const p = await perfilDe(usuario.id).catch(() => null);
      return p && p.activo ? p : null;
    },
    async ingresar(email, clave) {
      const { data, error } = await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: clave });
      if (error || !data.user) {
        if (error && /fetch|network/i.test(error.message)) throw new ErrorDatos("SIN_CONEXION", "No hay conexión a internet.");
        throw new ErrorDatos("CREDENCIALES", "Correo o contraseña incorrectos.");
      }
      const p = await perfilDe(data.user.id);
      if (!p || !p.activo) {
        await sb.auth.signOut();
        throw new ErrorDatos("INACTIVO", "Este usuario está desactivado. Pide acceso al administrador.");
      }
      return p;
    },
    async salir() {
      await sb.auth.signOut();
    },

    /* ---------------- empresas y cuentas ---------------- */
    async empresas() {
      return todas<Empresa>((a, b) => sb.from("empresas").select("id, nombre, ruc, representante, representante_dni, domicilio").order("nombre").range(a, b));
    },
    async cuentas() {
      return todas<Cuenta>((a, b) => sb.from("cuentas").select("id, empresa_id, nombre, medio, activa").eq("activa", true).order("nombre").range(a, b));
    },
    async todasLasCuentas() {
      return todas<Cuenta>((a, b) => sb.from("cuentas").select("id, empresa_id, nombre, medio, activa").order("nombre").range(a, b));
    },
    async guardarEmpresa(e) {
      const limpio = (t?: string | null) => t?.trim() || null;
      const datos = {
        nombre: e.nombre.trim(),
        ruc: limpio(e.ruc),
        representante: limpio(e.representante),
        representante_dni: limpio(e.representante_dni),
        domicilio: limpio(e.domicilio),
      };
      lanzar((e.id ? await sb.from("empresas").update(datos).eq("id", e.id) : await sb.from("empresas").insert(datos)).error);
    },
    async eliminarEmpresa(id) {
      await borrarFila("empresas", id, "La empresa todavía tiene clientes, motos, cuentas o contratos. Elimínalos o muévelos a otra empresa primero.");
    },
    async eliminarCuenta(id) {
      await borrarFila("cuentas", id, "Esta cuenta ya tiene pagos registrados. Desactívala en vez de eliminarla, así se conserva el historial.");
    },
    async guardarCuenta(c) {
      const { id, ...resto } = c;
      const datos = { ...resto, nombre: resto.nombre.trim() };
      lanzar((id ? await sb.from("cuentas").update(datos).eq("id", id) : await sb.from("cuentas").insert(datos)).error);
    },

    /* ---------------- vistas ---------------- */
    async estadoClientes() {
      const filas = await todas<EstadoCliente>((a, b) => sb.from("v_estado_cliente").select("*").order("cliente").range(a, b));
      return filas.map(normalizarEstado);
    },
    async morosos() {
      const filas = await todas<EstadoCliente>((a, b) =>
        sb.from("v_morosos").select("*").order("semanas_atraso", { ascending: false }).order("deuda", { ascending: false }).range(a, b),
      );
      return filas.map(normalizarEstado);
    },
    async resumenEmpresas() {
      const filas = await todas<ResumenEmpresa>((a, b) => sb.from("v_resumen_empresa").select("*").range(a, b));
      return filas.map((r) => ({
        ...r,
        cobrado_hoy: num(r.cobrado_hoy),
        cobrado_semana: num(r.cobrado_semana),
        esperado_semana: num(r.esperado_semana),
        deuda: num(r.deuda),
      }));
    },
    async usoFotos() {
      const r = await sb.rpc("uso_fotos");
      lanzar(r.error);
      const f = ((r.data ?? []) as { bytes: number; archivos: number }[])[0];
      return { bytes: num(f?.bytes), archivos: num(f?.archivos) };
    },
    async reportePendiente() {
      const mes = mesAnterior(fechaOperativaLima());
      const [pagos, hecho] = await Promise.all([
        sb.from("pagos").select("id").gte("fecha_pago", mes).lt("fecha_pago", siguienteMes(mes)).limit(1),
        sb.from("reportes_mensuales").select("mes").eq("mes", mes).maybeSingle(),
      ]);
      lanzar(pagos.error);
      lanzar(hecho.error);
      return (pagos.data ?? []).length > 0 && !hecho.data ? mes : null;
    },
    async marcarReporteDescargado(mes) {
      const r = await sb.from("reportes_mensuales").upsert({ mes }, { onConflict: "mes", ignoreDuplicates: true });
      lanzar(r.error);
    },
    async guardarDocumentoContrato(id, documento) {
      lanzar((await sb.rpc("guardar_documento_contrato", { p_contrato_id: id, p_documento: documento })).error);
    },
    async cobranzaSemanal(semanas = 8) {
      const r = await sb.rpc("cobranza_semanal", { p_semanas: semanas });
      lanzar(r.error);
      return ((r.data ?? []) as CobranzaSemana[]).map((f) => ({ ...f, cobrado: num(f.cobrado), esperado: num(f.esperado) }));
    },

    /* ---------------- clientes ---------------- */
    async clientes() {
      return todas<Cliente>((a, b) => sb.from("clientes").select("*").order("nombres").range(a, b));
    },
    async cliente(id) {
      return fila<Cliente>(await sb.from("clientes").select("*").eq("id", id).maybeSingle());
    },
    async guardarCliente(c) {
      const { id, ...resto } = c;
      const datos = { ...resto, nombres: resto.nombres.trim() };
      const r = id
        ? await sb.from("clientes").update(datos).eq("id", id).select().single()
        : await sb.from("clientes").insert(datos).select().single();
      return fila<Cliente>(r) as Cliente;
    },
    async documentos(clienteId) {
      return todas<Documento>((a, b) => sb.from("documentos").select("id, cliente_id, tipo, ruta, contrato_id, creado_en").eq("cliente_id", clienteId).order("creado_en").range(a, b));
    },
    async resumenDocumentos() {
      return todas<Pick<Documento, "cliente_id" | "tipo" | "contrato_id">>((a, b) => sb.from("documentos").select("cliente_id, tipo, contrato_id").order("id").range(a, b));
    },
    async agregarDocumento(d) {
      return fila<Documento>(await sb.from("documentos").insert(d).select("id, cliente_id, tipo, ruta, contrato_id, creado_en").single()) as Documento;
    },
    async borrarDocumento(id) {
      const doc = fila<Pick<Documento, "ruta">>(await sb.from("documentos").select("ruta").eq("id", id).maybeSingle());
      const r = await sb.from("documentos").delete().eq("id", id).select("id");
      lanzar(r.error);
      if (!r.data?.length) throw new ErrorDatos("SIN_PERMISO", "Solo el administrador o quien subió la foto puede borrarla.");
      if (doc?.ruta) await almacen.borrar("documentos", doc.ruta);
    },

    /* ---------------- motos y contratos ---------------- */
    async motos() {
      return todas<Moto>((a, b) => sb.from("motos").select(COLUMNAS_MOTO).order("placa").range(a, b));
    },
    async guardarMoto(m) {
      const { id, ...resto } = m;
      const datos = { ...resto, placa: resto.placa?.trim().toUpperCase() || null };
      const r = id
        ? await sb.from("motos").update(datos).eq("id", id).select(COLUMNAS_MOTO).single()
        : await sb.from("motos").insert(datos).select(COLUMNAS_MOTO).single();
      return fila<Moto>(r) as Moto;
    },    async eliminarMoto(id) {
      await borrarFila("motos", id, "Esta moto tiene contratos. Elimina o cierra su contrato primero.");
    },
    async eliminarCliente(id) {
      const r = await sb.rpc("eliminar_cliente", { p_cliente_id: id });
      lanzar(r.error);
      const fotos = (r.data ?? {}) as { evidencias?: string[]; documentos?: string[] };
      await Promise.all([borrarFotos("evidencias", fotos.evidencias ?? []), borrarFotos("documentos", fotos.documentos ?? [])]);
    },
    async eliminarContrato(id) {
      // las páginas escaneadas del contrato se borran con el contrato: antes se anotan sus archivos
      const escaneos = await sb.from("documentos").select("ruta").eq("contrato_id", id);
      // react-doctor-disable-next-line server-sequential-independent-await
      const r = await sb.rpc("eliminar_contrato", { p_contrato_id: id });
      lanzar(r.error);
      await Promise.all([
        borrarFotos("evidencias", (r.data ?? []) as string[]),
        borrarFotos("documentos", (escaneos.data ?? []).map((d) => d.ruta as string)),
      ]);
    },
    async editarContrato(id, c) {
      lanzar(
        (
          await sb.rpc("editar_contrato", {
            p_contrato_id: id,
            p_monto_cuota: c.monto_cuota,
            p_nro_cuotas: c.nro_cuotas,
            p_fecha_inicio: c.fecha_inicio,
            p_precio_total: c.precio_total,
            p_inicial: c.inicial,
            p_cuotas_pagadas: c.cuotas_pagadas,
            p_observaciones: c.observaciones,
          })
        ).error,
      );
    },

    async contratos() {
      const filas = await todas<Contrato>((a, b) => sb.from("contratos").select("*").order("creado_en", { ascending: false }).range(a, b));
      return filas.map(normalizarContrato);
    },
    async contrato(id) {
      const c = fila<Contrato>(await sb.from("contratos").select("*").eq("id", id).maybeSingle());
      return c ? normalizarContrato(c) : null;
    },
    async crearContrato(args) {
      const r = await sb.rpc("crear_contrato", {
        p_cliente_id: args.cliente_id,
        p_moto_id: args.moto_id,
        p_monto_cuota: args.monto_cuota,
        p_nro_cuotas: args.nro_cuotas,
        p_fecha_inicio: args.fecha_inicio,
        p_precio_total: args.precio_total ?? null,
        p_inicial: args.inicial ?? null,
        // semanal es el valor por defecto en la base: solo se manda cuando es otra
        ...(args.frecuencia && args.frecuencia !== "semanal" ? { p_frecuencia: args.frecuencia } : {}),
      });
      lanzar(r.error);
      return String(r.data);
    },
    async cuotas(contratoId) {
      const filas = await todas<Cuota>((a, b) => sb.from("cuotas").select("*").eq("contrato_id", contratoId).order("numero").range(a, b));
      return filas.map(normalizarCuota);
    },
    async cerrarContrato(contratoId, motivo) {
      lanzar((await sb.rpc("cerrar_contrato", { p_contrato_id: contratoId, p_motivo: motivo })).error);
    },
    async importarCliente(f) {
      const r = await sb.rpc("importar_cliente", {
        p_fila: {
          empresa: f.empresa,
          nombres: f.nombres,
          dni: f.dni,
          celular: f.celular,
          direccion: f.direccion,
          referencia: f.referencia,
          tipo: f.tipo,
          placa: f.placa,
          marca: f.marca,
          color: f.color,
          cuota: f.cuota,
          nro_cuotas: f.nro_cuotas,
          fecha_inicio: f.fecha_inicio,
          frecuencia: f.frecuencia,
          cuotas_pagadas: f.cuotas_pagadas,
          ultimo_pago: f.ultimo_pago,
          observaciones: f.observaciones,
          precio: f.precio ?? null,
          inicial: f.inicial ?? null,
        },
      });
      lanzar(r.error);
      return String(r.data);
    },

    /* ---------------- pagos ---------------- */
    async pagos(filtro) {
      const filas = await todas<PagoConPerfil>((a, b) => {
        let q = sb
          .from("pagos")
          .select("id, contrato_id, monto, fecha_pago, medio, cuenta_id, nro_operacion, foto_ruta, foto_hash, registrado_por, creado_en, anulado, motivo_anulacion, perfil:perfiles!pagos_registrado_por_fkey(nombre)")
          .order("fecha_pago", { ascending: false })
          .order("creado_en", { ascending: false });
        if (filtro?.contrato_id) q = q.eq("contrato_id", filtro.contrato_id);
        if (filtro?.desde) q = q.gte("fecha_pago", filtro.desde);
        if (filtro?.hasta) q = q.lte("fecha_pago", filtro.hasta);
        if (filtro?.incluir_anulados === false) q = q.eq("anulado", false);
        return q.range(a, b);
      });
      return filas.map(({ perfil, ...p }) => ({ ...p, monto: num(p.monto), registrado_por_nombre: perfil?.nombre ?? "" }));
    },
    async registrarPago(args) {
      const r = await sb.rpc("registrar_pago", {
        p_contrato_id: args.contrato_id,
        p_monto: args.monto,
        p_fecha_pago: args.fecha_pago,
        p_medio: args.medio,
        p_cuenta_id: args.cuenta_id,
        p_nro_operacion: args.nro_operacion,
        p_foto_ruta: args.foto_ruta,
        p_foto_hash: args.foto_hash,
      });
      lanzar(r.error);
      const d = (Array.isArray(r.data) ? r.data[0] : r.data) as RegistrarPagoResultado;
      return { pago_id: d.pago_id, cuotas_cubiertas: d.cuotas_cubiertas ?? [] };
    },
    async anularPago(pagoId, motivo) {
      lanzar((await sb.rpc("anular_pago", { p_pago_id: pagoId, p_motivo: motivo })).error);
    },

    /* ---------------- consulta pública ---------------- */
    async consultaPublica(dni) {
      const r = await sb.rpc("consulta_publica", { p_dni: dni.trim() });
      lanzar(r.error);
      const d = r.data as ConsultaPublica | null;
      if (!d?.contratos?.length) return null;
      return {
        nombre: d.nombre,
        contratos: d.contratos.map((k) => ({
          ...k,
          cuota: num(k.cuota),
          deuda: num(k.deuda),
          semanas_atraso: num(k.semanas_atraso),
          cuotas: k.cuotas.map((c) => ({ ...c, monto: num(c.monto), monto_pagado: num(c.monto_pagado) })),
        })),
      };
    },

    /* ---------------- usuarios ---------------- */
    async usuarios() {
      return todas<Perfil>((a, b) => sb.from("perfiles").select("*").order("nombre").range(a, b));
    },
    async crearUsuario(u) {
      await funcionUsuarios({ accion: "crear", ...u }, "No se pudo crear el usuario.");
    },
    async editarUsuario(id, cambios) {
      await funcionUsuarios({ accion: "editar", id, ...cambios }, "No se pudo guardar el cambio.");
    },
    async cambiarMiClave(clave) {
      if (clave.length < 6) throw new ErrorDatos("CLAVE", "La contraseña debe tener al menos 6 caracteres.");
      const { error } = await sb.auth.updateUser({ password: clave });
      if (error) throw new ErrorDatos("CLAVE", /different|same/i.test(error.message) ? "La nueva contraseña debe ser distinta de la actual." : error.message);
    },
    async actualizarUsuario(id, cambios) {
      lanzar((await sb.rpc("actualizar_usuario", { p_id: id, p_rol: cambios.rol ?? null, p_activo: cambios.activo ?? null })).error);
    },

    /* ---------------- archivos ---------------- */
    async subirArchivo(bucket, ruta, archivo) {
      await almacen.subir(bucket, ruta, archivo);
    },
    async borrarArchivo(bucket, ruta) {
      await almacen.borrar(bucket, ruta);
    },
    async urlArchivo(bucket, ruta) {
      if (!ruta) return null;
      return almacen.url(bucket, ruta);
    },
  };
}
