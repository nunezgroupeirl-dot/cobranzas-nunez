/**
 * MODO DATOS DE PRUEBA: guarda todo en el navegador (localStorage + IndexedDB para fotos)
 * y aplica las mismas reglas que la base de datos (supabase/esquema.sql).
 * Usuarios de prueba:
 *   admin@prueba.pe / admin123        (administrador)
 *   cobrador@prueba.pe / cobrador123  (cobrador)
 */
import type {
  Bucket,
  Cliente,
  Contrato,
  Cuenta,
  Cuota,
  Documento,
  Empresa,
  EstadoCliente,
  FilaImportacion,
  MedioPago,
  Moto,
  Pago,
  Perfil,
  ResumenEmpresa,
  CobranzaSemana,
} from "@/types/database";
import { ErrorDatos, type Datos } from "./datos";
import {
  aCentimos,
  aplicarPagos,
  deCentimos,
  fechaOperativaLima,
  generarCuotas,
  inicioSemana,
  resumenCuotas,
  sumarDias,
  validarPago,
} from "./reglas";
import { claveEmpresa, nombreReservado } from "@/lib/texto";
import { mesAnterior, siguienteMes } from "@/lib/letras";

const CLAVE_ESTADO = "cn_simulado_v3";
const CLAVE_SESION = "cn_simulado_sesion";

/** Las 4 empresas de Andrés (iguales a supabase/esquema.sql). */
const EMPRESAS: [nombre: string, ruc: string][] = [
  ["Inversiones Anne E.I.R.L.", "20615867161"],
  ["Inversiones Comerciales Yarhua E.I.R.L.", "20613322079"],
  ["Nuñez Group E.I.R.L.", "20612130036"],
  ["Grupo Comercial Romi S.A.C.", "20614675838"],
];

type CuotaBase = Omit<Cuota, "estado" | "monto_pagado" | "fecha_pago">;
type PerfilConClave = Perfil & { clave: string };

interface Estado {
  empresas: Empresa[];
  cuentas: Cuenta[];
  perfiles: PerfilConClave[];
  clientes: Cliente[];
  documentos: Documento[];
  motos: Moto[];
  contratos: Contrato[];
  cuotas: CuotaBase[];
  pagos: Pago[];
  reportes?: string[]; // meses con reporte descargado
}

const nuevoId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

/* ---------------- datos semilla ---------------- */

function semilla(): Estado {
  const hoy = fechaOperativaLima();
  const ahora = new Date().toISOString();
  // mismos nombres que los datos iniciales de supabase/esquema.sql
  const empresas: Empresa[] = EMPRESAS.map(([nombre, ruc], i) => ({ id: `emp-${i + 1}`, nombre, ruc }));
  const medios: MedioPago[] = ["yape", "plin", "banco"];
  const cuentas: Cuenta[] = empresas.flatMap((e, i) =>
    medios.map((m, j) => ({
      id: `cta-${i + 1}-${j + 1}`,
      empresa_id: e.id,
      nombre: `${m === "banco" ? "BCP" : m === "yape" ? "Yape" : "Plin"} · ${e.nombre}`,
      medio: m,
      activa: true,
    })),
  );
  const perfiles: PerfilConClave[] = [
    { id: "usr-admin", nombre: "Andrés (prueba)", email: "admin@prueba.pe", rol: "administrador", activo: true, clave: "admin123" },
    { id: "usr-cobrador", nombre: "Adrián (prueba)", email: "cobrador@prueba.pe", rol: "cobrador", puesto: "oficina", activo: true, clave: "cobrador123" },
    { id: "usr-ruta", nombre: "Luis (prueba)", email: "ruta@prueba.pe", rol: "cobrador", puesto: "ruta", activo: true, clave: "ruta123" },
  ];

  const personas: [string, string, string, string, number, number, number][] = [
    // nombre, dni, celular, placa, semanas desde inicio, semanas de atraso, cuota
    ["Rosa Quispe Huamán", "45879632", "987654321", "1234-AB", 12, 0, 120],
    ["Luis Mamani Condori", "70123456", "912345678", "5678-CD", 20, 0, 150],
    ["Carmen Flores Rojas", "41236587", "998877665", "9012-EF", 8, 1, 100],
    ["Jorge Torres Salazar", "46598712", "955443322", "3456-GH", 15, 2, 130],
    ["Ana Ccori Vilca", "72589634", "966112233", "7890-IJ", 30, 0, 110],
    ["Pedro Huaman Pari", "43215698", "944556677", "2468-KL", 18, 3, 140],
    ["María Gutierrez Ríos", "48521479", "933221100", "1357-MN", 25, 5, 125],
    ["Víctor Ramos Ticona", "71452369", "922334455", "8642-OP", 6, 0, 160],
    ["Elena Choque Apaza", "47896321", "911223344", "9753-QR", 22, 7, 115],
    ["Raúl Paredes León", "42587413", "900112233", "1593-ST", 10, 1, 135],
    ["Silvia Nina Ccama", "73698521", "988776655", "7531-UV", 4, 0, 145],
    ["Hugo Vargas Inga", "45632178", "977665544", "4826-WX", 16, 4, 120],
  ];
  const tipos = ["Lineal", "Scooter", "Trimoto"];
  const marcas = ["Honda", "Bajaj", "Yamaha", "TVS"];
  const colores = ["Rojo", "Negro", "Azul", "Blanco"];

  const clientes: Cliente[] = [];
  const motos: Moto[] = [];
  const contratos: Contrato[] = [];
  const cuotas: CuotaBase[] = [];
  const pagos: Pago[] = [];

  personas.forEach(([nombre, dni, cel, placa, semanas, atraso, monto], i) => {
    const empresa = empresas[i % 4];
    const cliente: Cliente = {
      id: `cli-${i + 1}`,
      empresa_id: empresa.id,
      nombres: nombre,
      dni,
      celular: cel,
      direccion: `Jr. Prueba ${100 + i}, Lima`,
      referencia: "Datos de prueba",
      creado_en: ahora,
    };
    const moto: Moto = {
      id: `mot-${i + 1}`,
      cliente_id: cliente.id,
      empresa_id: empresa.id,
      placa,
      tipo: tipos[i % 3],
      marca: marcas[i % 4],
      color: colores[i % 4],
    };
    const inicio = sumarDias(hoy, -semanas * 7);
    const contrato: Contrato = {
      id: `con-${i + 1}`,
      cliente_id: cliente.id,
      moto_id: moto.id,
      empresa_id: empresa.id,
      monto_cuota: monto,
      nro_cuotas: 52,
      fecha_inicio: inicio,
      precio_total: null,
      inicial: null,
      cuotas_pagadas_inicial: 0,
      observaciones: null,
      estado: "activo",
      cerrado_motivo: null,
      creado_en: ahora,
    };
    const cs = generarCuotas(contrato).map((c) => ({ ...c, id: `${contrato.id}-c${c.numero}` }));
    const vencidasHastaHoy = cs.filter((c) => c.fecha_vencimiento < hoy).length;
    // los que están al día: la mitad ya pagó también la cuota que vence hoy (para que el panel muestre "cobrado hoy")
    const pagadas = Math.max(0, vencidasHastaHoy - atraso) + (atraso === 0 && i % 2 === 0 ? 1 : 0);
    for (let k = 0; k < pagadas; k++) {
      const venc = cs[k].fecha_vencimiento;
      const tarde = (i + k) % 5 === 0; // algunos pagan 2 días tarde
      const fecha = tarde ? sumarDias(venc, 2) : venc;
      const medio: MedioPago = (["yape", "plin", "banco", "efectivo"] as const)[(i + k) % 4];
      pagos.push({
        id: `pag-${i + 1}-${k + 1}`,
        contrato_id: contrato.id,
        monto,
        fecha_pago: fecha > hoy ? hoy : fecha,
        medio,
        cuenta_id: medio === "efectivo" ? null : cuentas.find((c) => c.empresa_id === empresa.id && c.medio === medio)?.id ?? null,
        nro_operacion: medio === "efectivo" ? null : String(10_000_000 + i * 1000 + k),
        foto_ruta: "",
        foto_hash: `semilla-${i}-${k}`,
        registrado_por: "usr-cobrador",
        registrado_por_nombre: "Adrián (prueba)",
        creado_en: `${fecha}T15:00:00.000Z`,
        anulado: false,
        motivo_anulacion: null,
      });
    }
    clientes.push(cliente);
    motos.push(moto);
    contratos.push(contrato);
    cuotas.push(...cs);
  });

  return { empresas, cuentas, perfiles, clientes, documentos: [], motos, contratos, cuotas, pagos };
}

/* ---------------- almacenamiento ---------------- */

function leer(): Estado {
  if (typeof window === "undefined") return semilla();
  try {
    const crudo = window.localStorage.getItem(CLAVE_ESTADO);
    if (crudo) return JSON.parse(crudo) as Estado;
  } catch {
    /* sin almacenamiento: seguimos con la semilla */
  }
  const s = semilla();
  guardar(s);
  return s;
}

function guardar(s: Estado) {
  try {
    window.localStorage.setItem(CLAVE_ESTADO, JSON.stringify(s));
  } catch {
    /* almacenamiento lleno o bloqueado */
  }
}

const pausa = () => new Promise((r) => setTimeout(r, 120));

/* IndexedDB para las fotos (localStorage no alcanza) */
function abrirDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("cn_archivos", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("archivos");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idb<T>(modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("archivos", modo);
    const req = fn(tx.objectStore("archivos"));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}
const urlsCreadas = new Map<string, string>();

/* ---------------- cálculos tipo "vista" ---------------- */

/** Borra un archivo de prueba y libera su URL en memoria. */
async function borrarArchivoLocal(bucket: Bucket, ruta: string) {
  const k = `${bucket}/${ruta}`;
  await idb("readwrite", (st) => st.delete(k));
  const u = urlsCreadas.get(k);
  if (u) URL.revokeObjectURL(u);
  urlsCreadas.delete(k);
}

function cuotasDe(s: Estado, contratoId: string, hoy: string): Cuota[] {
  const contrato = s.contratos.find((c) => c.id === contratoId);
  return aplicarPagos(
    s.cuotas.filter((c) => c.contrato_id === contratoId),
    s.pagos.filter((p) => p.contrato_id === contratoId),
    hoy,
    contrato?.cuotas_pagadas_inicial ?? 0,
  );
}

/** Como recalcular_contrato: un contrato pagado por completo pasa a "terminado". */
function actualizarEstadoContrato(s: Estado, contratoId: string) {
  const contrato = s.contratos.find((c) => c.id === contratoId);
  if (!contrato || contrato.estado === "anulado") return;
  const cs = cuotasDe(s, contratoId, fechaOperativaLima());
  contrato.estado = cs.length > 0 && cs.every((c) => c.estado.startsWith("pagada")) ? "terminado" : "activo";
}

function estadoClientes(s: Estado): EstadoCliente[] {
  const hoy = fechaOperativaLima();
  return s.contratos
    .filter((c) => c.estado === "activo")
    .map((con) => {
      const cli = s.clientes.find((c) => c.id === con.cliente_id);
      const moto = s.motos.find((m) => m.id === con.moto_id);
      const emp = s.empresas.find((e) => e.id === con.empresa_id);
      const r = resumenCuotas(cuotasDe(s, con.id, hoy));
      const ultimo = s.pagos
        .filter((p) => p.contrato_id === con.id && !p.anulado)
        .map((p) => p.fecha_pago)
        .sort()
        .pop();
      return {
        contrato_id: con.id,
        cliente_id: con.cliente_id,
        cliente: cli?.nombres ?? "—",
        dni: cli?.dni ?? "",
        placa: moto?.placa ?? "",
        celular: cli?.celular ?? null,
        empresa_id: con.empresa_id,
        empresa: emp?.nombre ?? "",
        cuota: con.monto_cuota,
        semanas_atraso: r.semanas_atraso,
        deuda: r.deuda,
        color: r.color,
        ultimo_pago: ultimo ?? null,
        proxima_cuota: r.proxima_cuota,
        direccion: cli?.direccion ?? null,
        ubicacion: cli?.ubicacion ?? null,
      };
    });
}

/* ---------------- implementación ---------------- */

export function crearDatosSimulados(): Datos {
  const sesionActual = (s: Estado): Perfil | null => {
    if (typeof window === "undefined") return null;
    const id = window.localStorage.getItem(CLAVE_SESION);
    const p = s.perfiles.find((x) => x.id === id && x.activo);
    if (!p) return null;
    const { clave: _clave, ...perfil } = p;
    void _clave;
    return perfil;
  };
  const exigirSesion = (s: Estado) => {
    const p = sesionActual(s);
    if (!p) throw new ErrorDatos("SIN_SESION", "Tu sesión terminó. Vuelve a ingresar.");
    return p;
  };
  const exigirAdmin = (s: Estado) => {
    const p = exigirSesion(s);
    if (p.rol !== "administrador") throw new ErrorDatos("SIN_PERMISO", "Solo el administrador puede hacer esto.");
    return p;
  };

  return {
    modoPrueba: true,

    async sesion() {
      return sesionActual(leer());
    },
    async ingresar(email, clave) {
      await pausa();
      const s = leer();
      const p = s.perfiles.find((x) => x.email.toLowerCase() === email.trim().toLowerCase() && x.clave === clave);
      if (!p) throw new ErrorDatos("CREDENCIALES", "Correo o contraseña incorrectos.");
      if (!p.activo) throw new ErrorDatos("INACTIVO", "Este usuario está desactivado.");
      window.localStorage.setItem(CLAVE_SESION, p.id);
      const { clave: _c, ...perfil } = p;
      void _c;
      return perfil;
    },
    async salir() {
      window.localStorage.removeItem(CLAVE_SESION);
    },

    async empresas() {
      return leer().empresas;
    },
    async cuentas() {
      return leer().cuentas.filter((c) => c.activa);
    },
    async todasLasCuentas() {
      return leer().cuentas;
    },
    async guardarEmpresa(e) {
      const s = leer();
      exigirAdmin(s);
      const nombre = e.nombre.trim();
      if (!nombre) throw new ErrorDatos("DATOS", "Escribe el nombre de la empresa.");
      if (e.ruc && !/^\d{11}$/.test(e.ruc)) throw new ErrorDatos("DATOS", "El RUC debe tener 11 números.");
      if (s.empresas.some((x) => x.nombre.toLowerCase() === nombre.toLowerCase() && x.id !== e.id))
        throw new ErrorDatos("REPETIDO", "Ya existe una empresa con ese nombre.");
      const limpio = (t?: string | null) => t?.trim() || null;
      const datos = { nombre, ruc: limpio(e.ruc), representante: limpio(e.representante), representante_dni: limpio(e.representante_dni), domicilio: limpio(e.domicilio) };
      if (!e.id) {
        s.empresas.push({ id: nuevoId(), ...datos });
        guardar(s);
        return;
      }
      const emp = s.empresas.find((x) => x.id === e.id);
      if (!emp) throw new ErrorDatos("NO_EXISTE", "La empresa no existe.");
      Object.assign(emp, datos);
      guardar(s);
    },
    async eliminarEmpresa(id) {
      await pausa();
      const s = leer();
      exigirAdmin(s);
      const usada = [s.clientes, s.motos, s.cuentas, s.contratos].some((lista) => lista.some((x) => x.empresa_id === id));
      if (usada)
        throw new ErrorDatos("EN_USO", "La empresa todavía tiene clientes, motos, cuentas o contratos. Elimínalos o muévelos a otra empresa primero.");
      s.empresas = s.empresas.filter((x) => x.id !== id);
      guardar(s);
    },
    async eliminarCuenta(id) {
      await pausa();
      const s = leer();
      exigirAdmin(s);
      if (s.pagos.some((p) => p.cuenta_id === id))
        throw new ErrorDatos("EN_USO", "Esta cuenta ya tiene pagos registrados. Desactívala en vez de eliminarla, así se conserva el historial.");
      s.cuentas = s.cuentas.filter((x) => x.id !== id);
      guardar(s);
    },
    async guardarCuenta(c) {
      const s = leer();
      exigirAdmin(s);
      if (!c.nombre.trim()) throw new ErrorDatos("DATOS", "Escribe el nombre de la cuenta.");
      if (c.id) {
        const i = s.cuentas.findIndex((x) => x.id === c.id);
        if (i < 0) throw new ErrorDatos("NO_EXISTE", "La cuenta no existe.");
        s.cuentas[i] = { ...s.cuentas[i], ...c, id: c.id, nombre: c.nombre.trim() };
      } else {
        s.cuentas.push({ ...c, id: nuevoId(), nombre: c.nombre.trim() });
      }
      guardar(s);
    },

    async estadoClientes() {
      await pausa();
      return estadoClientes(leer());
    },
    async morosos() {
      await pausa();
      return estadoClientes(leer())
        .filter((e) => e.semanas_atraso > 0)
        .sort((a, b) => b.semanas_atraso - a.semanas_atraso || b.deuda - a.deuda);
    },
    async resumenEmpresas() {
      await pausa();
      const s = leer();
      exigirAdmin(s);
      const hoy = fechaOperativaLima();
      const lunes = inicioSemana(hoy);
      const domingo = sumarDias(lunes, 6);
      const estados = estadoClientes(s);
      return s.empresas.map<ResumenEmpresa>((e) => {
        const contratos = s.contratos.filter((c) => c.empresa_id === e.id && c.estado === "activo");
        const ids = new Set(contratos.map((c) => c.id));
        const pagos = s.pagos.filter((p) => ids.has(p.contrato_id) && !p.anulado);
        const suma = (ps: Pago[]) => deCentimos(ps.reduce((t, p) => t + aCentimos(p.monto), 0));
        const esperado = s.cuotas
          .filter((c) => ids.has(c.contrato_id) && c.fecha_vencimiento >= lunes && c.fecha_vencimiento <= domingo)
          .reduce((t, c) => t + aCentimos(c.monto), 0);
        const est = estados.filter((x) => x.empresa_id === e.id);
        return {
          empresa_id: e.id,
          empresa: e.nombre,
          cobrado_hoy: suma(pagos.filter((p) => p.fecha_pago === hoy)),
          cobrado_semana: suma(pagos.filter((p) => p.fecha_pago >= lunes && p.fecha_pago <= hoy)),
          esperado_semana: deCentimos(esperado),
          clientes_verde: est.filter((x) => x.color === "verde").length,
          clientes_amarillo: est.filter((x) => x.color === "amarillo").length,
          clientes_rojo: est.filter((x) => x.color === "rojo").length,
          deuda: deCentimos(est.reduce((t, x) => t + aCentimos(x.deuda), 0)),
        };
      });
    },
    async usoFotos() {
      // Modo prueba: estimación con el tamaño promedio de una foto comprimida (~120 KB)
      const s = leer();
      exigirAdmin(s);
      const archivos = s.documentos.length + s.pagos.length;
      return { bytes: archivos * 120 * 1024, archivos };
    },
    async reportePendiente() {
      const s = leer();
      const mes = mesAnterior(fechaOperativaLima());
      const hubo = s.pagos.some((p) => p.fecha_pago >= mes && p.fecha_pago < siguienteMes(mes));
      return hubo && !(s.reportes ?? []).includes(mes) ? mes : null;
    },
    async marcarReporteDescargado(mes) {
      const s = leer();
      exigirAdmin(s);
      s.reportes = [...new Set([...(s.reportes ?? []), mes])];
      guardar(s);
    },
    async guardarDocumentoContrato(id, documento) {
      await pausa();
      const s = leer();
      exigirAdmin(s);
      const c = s.contratos.find((x) => x.id === id);
      if (!c) throw new ErrorDatos("NO_EXISTE", "El contrato no existe.");
      c.documento = documento;
      guardar(s);
    },
    async cobranzaSemanal(semanas = 8) {
      await pausa();
      const s = leer();
      exigirAdmin(s);
      const hoy = fechaOperativaLima();
      const lunes = inicioSemana(hoy);
      const n = Math.min(Math.max(semanas, 1), 26);
      const desde = sumarDias(lunes, -7 * (n - 1));
      const empresaDe = new Map(s.contratos.filter((c) => c.estado !== "anulado").map((c) => [c.id, c.empresa_id]));
      const vigentes = new Set(s.contratos.filter((c) => c.estado === "activo" || c.estado === "terminado").map((c) => c.id));
      const clave = (semana: string, empresa: string) => `${semana}|${empresa}`;
      const cobrado = new Map<string, number>();
      const esperado = new Map<string, number>();
      for (const p of s.pagos) {
        const emp = empresaDe.get(p.contrato_id);
        if (p.anulado || !emp || p.fecha_pago < desde || p.fecha_pago > hoy) continue;
        const k = clave(inicioSemana(p.fecha_pago), emp);
        cobrado.set(k, (cobrado.get(k) ?? 0) + aCentimos(p.monto));
      }
      for (const c of s.cuotas) {
        const emp = empresaDe.get(c.contrato_id);
        if (!emp || !vigentes.has(c.contrato_id) || c.fecha_vencimiento < desde || c.fecha_vencimiento > sumarDias(lunes, 6)) continue;
        const k = clave(inicioSemana(c.fecha_vencimiento), emp);
        esperado.set(k, (esperado.get(k) ?? 0) + aCentimos(c.monto));
      }
      const filas: CobranzaSemana[] = [];
      for (let i = 0; i < n; i++) {
        const semana = sumarDias(desde, 7 * i);
        for (const e of s.empresas) {
          const k = clave(semana, e.id);
          filas.push({ semana, empresa_id: e.id, cobrado: deCentimos(cobrado.get(k) ?? 0), esperado: deCentimos(esperado.get(k) ?? 0) });
        }
      }
      return filas;
    },

    async clientes() {
      return leer().clientes;
    },
    async cliente(id) {
      return leer().clientes.find((c) => c.id === id) ?? null;
    },
    async guardarCliente(c) {
      await pausa();
      const s = leer();
      exigirAdmin(s);
      if (c.dni && !/^\d{8,12}$/.test(c.dni)) throw new ErrorDatos("DNI_INVALIDO", "El DNI debe tener 8 números (Carné de Extranjería: 9 a 12).");
      if (c.dni && s.clientes.some((x) => x.dni === c.dni && x.id !== c.id)) throw new ErrorDatos("DNI_REPETIDO", "Ya existe un cliente con ese DNI.");
      if (c.id) {
        const i = s.clientes.findIndex((x) => x.id === c.id);
        if (i < 0) throw new ErrorDatos("NO_EXISTE", "El cliente no existe.");
        s.clientes[i] = { ...s.clientes[i], ...c, id: c.id };
        guardar(s);
        return s.clientes[i];
      }
      const nuevo: Cliente = { ...c, id: nuevoId(), creado_en: new Date().toISOString() };
      s.clientes.push(nuevo);
      guardar(s);
      return nuevo;
    },
    async documentos(clienteId) {
      return leer().documentos.filter((d) => d.cliente_id === clienteId);
    },
    async resumenDocumentos() {
      return leer().documentos.map(({ cliente_id, tipo, contrato_id }) => ({ cliente_id, tipo, contrato_id }));
    },
    async agregarDocumento(d) {
      const s = leer();
      exigirAdmin(s);
      const nuevo: Documento = { ...d, id: nuevoId(), creado_en: new Date().toISOString() };
      s.documentos.push(nuevo);
      guardar(s);
      return nuevo;
    },
    async borrarDocumento(id) {
      const s = leer();
      const doc = s.documentos.find((d) => d.id === id);
      s.documentos = s.documentos.filter((d) => d.id !== id);
      guardar(s);
      // igual que en Supabase: borrar el registro también borra el archivo
      if (doc) await borrarArchivoLocal("documentos", doc.ruta);
    },

    async motos() {
      return leer().motos;
    },
    async guardarMoto(m) {
      await pausa();
      const s = leer();
      exigirAdmin(s);
      const placa = m.placa?.trim().toUpperCase() || null;
      if (placa && s.motos.some((x) => x.placa === placa && x.id !== m.id)) throw new ErrorDatos("PLACA_REPETIDA", "Ya existe una moto con esa placa.");
      if (m.id) {
        const i = s.motos.findIndex((x) => x.id === m.id);
        s.motos[i] = { ...s.motos[i], ...m, placa, id: m.id };
        guardar(s);
        return s.motos[i];
      }
      const nueva: Moto = { ...m, placa, id: nuevoId() };
      s.motos.push(nueva);
      guardar(s);
      return nueva;
    },    async eliminarMoto(id) {
      await pausa();
      const s = leer();
      exigirAdmin(s);
      if (s.contratos.some((c) => c.moto_id === id)) throw new ErrorDatos("EN_USO", "Esta moto tiene contratos. Elimina o cierra su contrato primero.");
      s.motos = s.motos.filter((m) => m.id !== id);
      guardar(s);
    },
    async eliminarCliente(id) {
      await pausa();
      const s = leer();
      exigirAdmin(s);
      if (!s.clientes.some((c) => c.id === id)) throw new ErrorDatos("NO_EXISTE", "El cliente no existe.");
      const contratos = new Set(s.contratos.filter((c) => c.cliente_id === id).map((c) => c.id));
      const fotos = [
        ...s.pagos.filter((p) => contratos.has(p.contrato_id)).map((p) => ["evidencias", p.foto_ruta] as const),
        ...s.documentos.filter((d) => d.cliente_id === id).map((d) => ["documentos", d.ruta] as const),
      ];
      s.pagos = s.pagos.filter((p) => !contratos.has(p.contrato_id));
      s.cuotas = s.cuotas.filter((q) => !contratos.has(q.contrato_id));
      s.contratos = s.contratos.filter((c) => !contratos.has(c.id));
      s.motos = s.motos.filter((m) => !(m.cliente_id === id && !s.contratos.some((c) => c.moto_id === m.id)));
      for (const m of s.motos) if (m.cliente_id === id) m.cliente_id = null;
      s.documentos = s.documentos.filter((d) => d.cliente_id !== id);
      s.clientes = s.clientes.filter((c) => c.id !== id);
      guardar(s);
      await Promise.all(fotos.map(([bucket, ruta]) => borrarArchivoLocal(bucket, ruta)));
    },
    async eliminarContrato(id) {
      await pausa();
      const s = leer();
      exigirAdmin(s);
      if (!s.contratos.some((c) => c.id === id)) throw new ErrorDatos("NO_EXISTE", "El contrato no existe.");
      const fotos = s.pagos.filter((p) => p.contrato_id === id).map((p) => p.foto_ruta);
      const escaneos = s.documentos.filter((d) => d.contrato_id === id).map((d) => d.ruta);
      s.documentos = s.documentos.filter((d) => d.contrato_id !== id);
      s.pagos = s.pagos.filter((p) => p.contrato_id !== id);
      s.cuotas = s.cuotas.filter((q) => q.contrato_id !== id);
      s.contratos = s.contratos.filter((c) => c.id !== id);
      guardar(s);
      await Promise.all([...fotos.map((ruta) => borrarArchivoLocal("evidencias", ruta)), ...escaneos.map((ruta) => borrarArchivoLocal("documentos", ruta))]);
    },
    async editarContrato(id, c) {
      await pausa();
      const s = leer();
      exigirAdmin(s);
      const con = s.contratos.find((x) => x.id === id);
      if (!con) throw new ErrorDatos("NO_EXISTE", "El contrato no existe.");
      if (con.estado === "anulado") throw new ErrorDatos("CERRADO", "El contrato está cerrado: no se puede editar.");
      if (!(c.monto_cuota > 0)) throw new ErrorDatos("DATOS", "La cuota semanal debe ser mayor a 0.");
      if (!(c.nro_cuotas >= 1 && c.nro_cuotas <= 260)) throw new ErrorDatos("DATOS", "El número de cuotas debe estar entre 1 y 260.");
      if (c.cuotas_pagadas < 0 || c.cuotas_pagadas > c.nro_cuotas)
        throw new ErrorDatos("DATOS", "Las cuotas ya pagadas no pueden ser más que el número de cuotas.");
      Object.assign(con, {
        monto_cuota: c.monto_cuota,
        nro_cuotas: c.nro_cuotas,
        fecha_inicio: c.fecha_inicio,
        precio_total: c.precio_total,
        inicial: c.inicial,
        cuotas_pagadas_inicial: c.cuotas_pagadas,
        observaciones: c.observaciones?.trim() || null,
      });
      // Igual que en la base: cronograma nuevo; los pagos se reaplican al calcular las cuotas
      s.cuotas = s.cuotas.filter((q) => q.contrato_id !== id);
      s.cuotas.push(...generarCuotas(con).map((q) => ({ ...q, id: `${id}-c${q.numero}` })));
      actualizarEstadoContrato(s, id);
      guardar(s);
    },

    async contratos() {
      return leer().contratos;
    },
    async contrato(id) {
      return leer().contratos.find((c) => c.id === id) ?? null;
    },
    async crearContrato(args) {
      await pausa();
      const s = leer();
      exigirAdmin(s);
      const moto = s.motos.find((m) => m.id === args.moto_id);
      if (!moto) throw new ErrorDatos("MOTO", "Elige una moto.");
      if (s.contratos.some((c) => c.moto_id === moto.id && c.estado === "activo" && c.cliente_id !== args.cliente_id))
        throw new ErrorDatos("MOTO_OCUPADA", "Esa moto ya tiene un contrato activo de otro cliente.");
      if (!(args.monto_cuota > 0) || !(args.nro_cuotas > 0)) throw new ErrorDatos("DATOS", "Revisa la cuota y el número de cuotas.");
      const contrato: Contrato = {
        id: nuevoId(),
        cliente_id: args.cliente_id,
        moto_id: args.moto_id,
        empresa_id: moto.empresa_id,
        monto_cuota: args.monto_cuota,
        nro_cuotas: args.nro_cuotas,
        fecha_inicio: args.fecha_inicio,
        frecuencia: args.frecuencia ?? "semanal",
        precio_total: args.precio_total ?? null,
        inicial: args.inicial ?? null,
        cuotas_pagadas_inicial: 0,
        observaciones: null,
        estado: "activo",
        cerrado_motivo: null,
        creado_en: new Date().toISOString(),
      };
      s.contratos.push(contrato);
      s.cuotas.push(...generarCuotas(contrato).map((c) => ({ ...c, id: `${contrato.id}-c${c.numero}` })));
      if (!moto.cliente_id) moto.cliente_id = args.cliente_id;
      guardar(s);
      return contrato.id;
    },
    async cuotas(contratoId) {
      return cuotasDe(leer(), contratoId, fechaOperativaLima());
    },
    async cerrarContrato(contratoId, motivo) {
      await pausa();
      const s = leer();
      exigirAdmin(s);
      if (!motivo.trim()) throw new ErrorDatos("MOTIVO", "Escribe el motivo del cierre.");
      const c = s.contratos.find((x) => x.id === contratoId);
      if (!c) throw new ErrorDatos("NO_EXISTE", "El contrato no existe.");
      if (c.estado !== "activo") throw new ErrorDatos("ESTADO", "Solo se puede cerrar un contrato activo.");
      c.estado = "anulado";
      c.cerrado_motivo = motivo.trim();
      const moto = s.motos.find((m) => m.id === c.moto_id);
      if (moto) moto.cliente_id = null;
      guardar(s);
    },
    async importarCliente(f: FilaImportacion) {
      const s = leer();
      exigirAdmin(s);
      const empresa = s.empresas.find((e) => claveEmpresa(e.nombre) === claveEmpresa(f.empresa));
      if (!empresa) throw new ErrorDatos("DATOS", `La empresa "${f.empresa}" no existe en el sistema. Revisa el nombre en Configuración.`);
      const dni = f.dni.replace(/\D/g, "") || null;
      const placa = f.placa.trim().toUpperCase() || null;
      if (dni && !/^\d{8,12}$/.test(dni)) throw new ErrorDatos("DATOS", "DNI o Carné de Extranjería inválido.");
      if (!f.nombres.trim()) throw new ErrorDatos("DATOS", "Falta el nombre.");
      if (!f.cuota || f.cuota <= 0) throw new ErrorDatos("DATOS", "Falta la cuota.");
      if (!f.nro_cuotas) throw new ErrorDatos("DATOS", "Falta el número de cuotas.");
      if (!f.fecha_inicio) throw new ErrorDatos("DATOS", "Falta la fecha de la 1.ª cuota.");
      const pagadas = f.cuotas_pagadas ?? 0;
      if (pagadas < 0 || pagadas > f.nro_cuotas) throw new ErrorDatos("DATOS", "Las cuotas ya pagadas no pueden ser más que el número de cuotas.");
      const celular = /^9\d{8}$/.test(f.celular) ? f.celular : null;

      // por DNI; sin DNI, por nombre (el mismo cliente con 2 motos va en 2 filas)
      let cliente = dni ? s.clientes.find((c) => c.dni === dni) : s.clientes.find((c) => !c.dni && c.nombres.toLowerCase() === f.nombres.trim().toLowerCase());
      if (!cliente) {
        cliente = { id: nuevoId(), empresa_id: empresa.id, nombres: f.nombres.trim(), dni, celular, direccion: f.direccion || null, referencia: f.referencia || null, creado_en: new Date().toISOString() };
        s.clientes.push(cliente);
      }
      if (s.contratos.some((c) => c.cliente_id === cliente?.id && c.estado === "activo" && c.fecha_inicio === f.fecha_inicio && c.monto_cuota === f.cuota && c.nro_cuotas === f.nro_cuotas))
        throw new ErrorDatos("DATOS", "Esta fila ya se importó (el cliente ya tiene ese mismo contrato).");
      let moto = placa ? s.motos.find((m) => m.placa === placa) : undefined;
      if (moto && s.contratos.some((c) => c.moto_id === moto?.id && c.estado === "activo" && c.cliente_id !== cliente?.id))
        throw new ErrorDatos("DATOS", `La placa ${placa} ya tiene un contrato activo (¿fila importada dos veces?).`);
      if (!moto) {
        moto = { id: nuevoId(), cliente_id: cliente.id, empresa_id: empresa.id, placa, tipo: f.tipo || "Otro", marca: f.marca, color: f.color };
        s.motos.push(moto);
      } else moto.cliente_id = cliente.id;

      const contrato: Contrato = {
        id: nuevoId(),
        cliente_id: cliente.id,
        moto_id: moto.id,
        empresa_id: moto.empresa_id,
        monto_cuota: f.cuota,
        nro_cuotas: f.nro_cuotas,
        fecha_inicio: f.fecha_inicio,
        frecuencia: (["mensual", "quincenal"] as const).find((x) => x === f.frecuencia.toLowerCase()) ?? "semanal",
        precio_total: f.precio ?? null,
        inicial: f.inicial ?? null,
        cuotas_pagadas_inicial: pagadas,
        observaciones: ["Importado de cuaderno", f.frecuencia.toLowerCase() === "diario" ? "Pagaba diario" : "", f.observaciones].filter(Boolean).join(" · "),
        estado: "activo",
        cerrado_motivo: null,
        creado_en: new Date().toISOString(),
      };
      s.contratos.push(contrato);
      s.cuotas.push(...generarCuotas(contrato).map((c) => ({ ...c, id: `${contrato.id}-c${c.numero}` })));
      actualizarEstadoContrato(s, contrato.id);
      guardar(s);
      return contrato.id;
    },

    async pagos(filtro) {
      await pausa();
      const s = leer();
      return s.pagos
        .filter((p) => (filtro?.incluir_anulados ?? true) || !p.anulado)
        .filter((p) => !filtro?.contrato_id || p.contrato_id === filtro.contrato_id)
        .filter((p) => !filtro?.desde || p.fecha_pago >= filtro.desde)
        .filter((p) => !filtro?.hasta || p.fecha_pago <= filtro.hasta)
        .sort((a, b) => b.fecha_pago.localeCompare(a.fecha_pago) || b.creado_en.localeCompare(a.creado_en));
    },
    async registrarPago(args) {
      await pausa();
      const s = leer();
      const quien = exigirSesion(s);
      const hoy = fechaOperativaLima();
      const antes = cuotasDe(s, args.contrato_id, hoy);
      const saldo = resumenCuotas(antes).saldo;
      const error = validarPago(args, s.pagos, saldo);
      if (error) throw new ErrorDatos(error);
      const pago: Pago = {
        id: nuevoId(),
        contrato_id: args.contrato_id,
        monto: args.monto,
        fecha_pago: args.fecha_pago,
        medio: args.medio,
        cuenta_id: args.cuenta_id,
        nro_operacion: args.medio === "efectivo" ? null : args.nro_operacion?.trim() || null,
        foto_ruta: args.foto_ruta,
        foto_hash: args.foto_hash,
        registrado_por: quien.id,
        registrado_por_nombre: quien.nombre,
        creado_en: new Date().toISOString(),
        anulado: false,
        motivo_anulacion: null,
      };
      s.pagos.push(pago);
      actualizarEstadoContrato(s, args.contrato_id);
      guardar(s);
      const despues = cuotasDe(s, args.contrato_id, hoy);
      const cubiertas = despues
        .filter((c, i) => c.estado.startsWith("pagada") && !antes[i].estado.startsWith("pagada"))
        .map((c) => c.numero);
      return { pago_id: pago.id, cuotas_cubiertas: cubiertas };
    },
    async anularPago(pagoId, motivo) {
      await pausa();
      const s = leer();
      exigirAdmin(s);
      if (!motivo.trim()) throw new ErrorDatos("MOTIVO", "Escribe el motivo.");
      const p = s.pagos.find((x) => x.id === pagoId);
      if (!p) throw new ErrorDatos("NO_EXISTE", "El pago no existe.");
      if (p.anulado) throw new ErrorDatos("YA_ANULADO", "Este pago ya estaba anulado.");
      p.anulado = true;
      p.motivo_anulacion = motivo.trim();
      actualizarEstadoContrato(s, p.contrato_id);
      guardar(s);
    },

    async consultaPublica(dni) {
      await pausa();
      const s = leer();
      const cli = s.clientes.find((c) => c.dni === dni.trim());
      if (!cli) return null;
      const activos = s.contratos
        .filter((c) => c.cliente_id === cli.id && c.estado === "activo")
        .sort((a, b) => a.creado_en.localeCompare(b.creado_en));
      if (!activos.length) return null;
      const hoy = fechaOperativaLima();
      return {
        nombre: nombreReservado(cli.nombres),
        contratos: activos.map((con) => {
          const cs = cuotasDe(s, con.id, hoy);
          const r = resumenCuotas(cs);
          const total = cs.reduce((t, c) => t + c.monto, 0);
          const pagado = cs.reduce((t, c) => t + c.monto_pagado, 0);
          const proxima = cs.find((c) => c.estado === "pendiente");
          const pagos = s.pagos
            .filter((p) => p.contrato_id === con.id && !p.anulado)
            .sort((a, b) => b.fecha_pago.localeCompare(a.fecha_pago) || b.creado_en.localeCompare(a.creado_en))
            .slice(0, 12);
          let despues = 0; // lo pagado después de cada pago
          return {
            placa: s.motos.find((m) => m.id === con.moto_id)?.placa ?? null,
            cuota: con.monto_cuota,
            frecuencia: con.frecuencia ?? "semanal",
            total,
            pagado,
            saldo: total - pagado,
            deuda: r.deuda,
            semanas_atraso: r.semanas_atraso,
            proxima_fecha: proxima?.fecha_vencimiento ?? null,
            proxima_monto: proxima ? proxima.monto - proxima.monto_pagado : null,
            pagos: pagos.map((p) => {
              const saldo = total - pagado + despues;
              despues += p.monto;
              return { fecha: p.fecha_pago, monto: p.monto, saldo };
            }),
          };
        }),
      };
    },

    async usuarios() {
      const s = leer();
      exigirAdmin(s);
      return s.perfiles.map(({ clave: _c, ...p }) => {
        void _c;
        return p;
      });
    },
    async crearUsuario(u) {
      await pausa();
      const s = leer();
      exigirAdmin(s);
      if (s.perfiles.some((p) => p.email.toLowerCase() === u.email.toLowerCase()))
        throw new ErrorDatos("EMAIL_REPETIDO", "Ya existe un usuario con ese correo.");
      if (u.clave.length < 6) throw new ErrorDatos("CLAVE", "La contraseña debe tener al menos 6 caracteres.");
      // Igual que en la base: solo el dueño es administrador; todo usuario nuevo es cobrador.
      if (u.rol === "administrador") throw new ErrorDatos("UN_SOLO_DUENO", "Solo el dueño puede ser administrador.");
      s.perfiles.push({ id: nuevoId(), nombre: u.nombre, email: u.email.trim(), rol: "cobrador", puesto: u.puesto, activo: true, clave: u.clave });
      guardar(s);
    },
    async editarUsuario(id, cambios) {
      await pausa();
      const s = leer();
      exigirAdmin(s);
      const p = s.perfiles.find((x) => x.id === id);
      if (!p) throw new ErrorDatos("NO_EXISTE", "El usuario no existe.");
      if (p.rol === "administrador") throw new ErrorDatos("SIN_PERMISO", "La contraseña del dueño se cambia desde su propia sesión.");
      if (cambios.nombre !== undefined && !cambios.nombre.trim()) throw new ErrorDatos("DATOS", "Escribe el nombre.");
      if (cambios.clave !== undefined && cambios.clave.length < 6) throw new ErrorDatos("CLAVE", "La contraseña debe tener al menos 6 caracteres.");
      if (cambios.nombre !== undefined) p.nombre = cambios.nombre.trim();
      if (cambios.clave !== undefined) p.clave = cambios.clave;
      if (cambios.puesto !== undefined) p.puesto = cambios.puesto;
      guardar(s);
    },
    async cambiarMiClave(clave) {
      await pausa();
      const s = leer();
      const yo = exigirSesion(s);
      if (clave.length < 6) throw new ErrorDatos("CLAVE", "La contraseña debe tener al menos 6 caracteres.");
      const p = s.perfiles.find((x) => x.id === yo.id);
      if (p) p.clave = clave;
      guardar(s);
    },
    async actualizarUsuario(id, cambios) {
      await pausa();
      const s = leer();
      const yo = exigirAdmin(s);
      if (id === yo.id) throw new ErrorDatos("PROPIO", "La cuenta del dueño no se puede desactivar ni cambiar de rol.");
      if (cambios.rol === "administrador") throw new ErrorDatos("UN_SOLO_DUENO", "Solo el dueño puede ser administrador.");
      const p = s.perfiles.find((x) => x.id === id);
      if (!p) throw new ErrorDatos("NO_EXISTE", "El usuario no existe.");
      Object.assign(p, cambios);
      guardar(s);
    },

    async subirArchivo(bucket, ruta, archivo) {
      await idb("readwrite", (st) => st.put(archivo, `${bucket}/${ruta}`));
    },
    async borrarArchivo(bucket: Bucket, ruta: string) {
      await borrarArchivoLocal(bucket, ruta);
    },
    async urlArchivo(bucket, ruta) {
      if (!ruta) return null;
      const k = `${bucket}/${ruta}`;
      const previa = urlsCreadas.get(k);
      if (previa) return previa;
      const blob = await idb<Blob | undefined>("readonly", (st) => st.get(k));
      if (!blob) return null;
      // Solo modo prueba: se guarda en caché y se libera en borrarArchivo / reiniciarDatosDePrueba.
      // react-doctor-disable-next-line no-create-object-url-without-revoke
      const url = URL.createObjectURL(blob);
      urlsCreadas.set(k, url);
      return url;
    },
  };
}

/** Borra los datos de prueba del navegador (botón en la pantalla de usuarios). */
export function reiniciarDatosDePrueba() {
  window.localStorage.removeItem(CLAVE_ESTADO);
  for (const u of urlsCreadas.values()) URL.revokeObjectURL(u);
  urlsCreadas.clear();
}
