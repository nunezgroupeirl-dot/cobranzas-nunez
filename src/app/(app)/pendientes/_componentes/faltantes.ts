import { alfabetico } from "@/lib/texto";
import type { Cliente, Color, Contrato, Documento, EstadoCliente, Moto } from "@/types/database";

/** Cada dato que puede faltar en un contrato activo, agrupado por dónde se completa (el contrato va en su propia pestaña). */
export const FALTANTES = {
  dni: { texto: "DNI", grupo: "cliente" },
  celular: { texto: "Celular", grupo: "cliente" },
  direccion: { texto: "Dirección", grupo: "cliente" },
  ubicacion: { texto: "Ubicación en el mapa", grupo: "cliente" },
  foto_cliente: { texto: "Foto del cliente", grupo: "cliente" },
  foto_dni: { texto: "Fotos del DNI o Carné (2 caras)", grupo: "cliente" },
  sin_vehiculo: { texto: "Sin vehículo ni cronograma", grupo: "moto" },
  placa: { texto: "Placa", grupo: "moto" },
  tipo: { texto: "Tipo de vehículo", grupo: "moto" },
  ficha: { texto: "Ficha técnica (serie y motor)", grupo: "moto" },
  foto_moto: { texto: "Foto del vehículo", grupo: "moto" },
  sin_contrato: { texto: "Cliente nuevo sin contrato", grupo: "contrato" },
  contrato_llenado: { texto: "Contrato sin llenar", grupo: "contrato" },
  contrato_firmado: { texto: "Contrato firmado sin subir", grupo: "contrato" },
  revisar: { texto: "Revisar en el cuaderno", grupo: "cliente" },
} as const;

export type Faltante = keyof typeof FALTANTES;
export const CLAVES_FALTANTES = Object.keys(FALTANTES) as Faltante[];

export interface FilaPendiente {
  contrato_id: string;
  cliente_id: string;
  empresa_id: string;
  empresa: string;
  cliente: string;
  placa: string | null;
  color: Color;
  semanas: number;
  moto: Moto | null;
  faltan: Faltante[];
  /** Lo que el cuaderno dice que hay que revisar (nombre poco legible, placa de otro cliente, etc.). */
  nota: string | null;
}

// Frases que el cuaderno usa cuando un dato está dudoso
const DUDOSO = /revisar|verificar|confirmar|poco legible|ilegible|borros|incomplet/i;

/** Saca de las observaciones solo las frases que piden revisar algo. */
export function notaRevisar(observaciones: string | null | undefined): string | null {
  if (!observaciones) return null;
  const frases = observaciones
    .split(/(?<=\.)\s+|;\s*|\s·\s/)
    .map((f) => f.trim())
    .filter((f) => DUDOSO.test(f));
  return frases.length ? frases.join(" · ") : null;
}

interface Entrada {
  estados: EstadoCliente[];
  contratos: Contrato[];
  clientes: Cliente[];
  motos: Moto[];
  documentos: Pick<Documento, "cliente_id" | "tipo" | "contrato_id">[];
  /** id → nombre, para los clientes que aún no tienen contrato */
  empresas?: Map<string, string>;
}

/** Lo que le falta al cliente en sí (sus datos y sus fotos). */
function faltaDelCliente(cliente: Cliente | undefined, tiene: Set<string> | undefined): Faltante[] {
  const faltan: Faltante[] = [];
  if (!cliente?.dni) faltan.push("dni");
  if (!cliente?.celular) faltan.push("celular");
  if (!cliente?.direccion) faltan.push("direccion");
  if (!cliente?.ubicacion) faltan.push("ubicacion");
  if (!tiene?.has("cliente")) faltan.push("foto_cliente");
  if (!tiene?.has("dni") || !tiene?.has("dni_reverso")) faltan.push("foto_dni");
  return faltan;
}

/** Lo que le falta a un vehículo (placa, tipo, ficha técnica, foto). */
function faltaDelVehiculo(moto: Moto | null, tiene: Set<string> | undefined): Faltante[] {
  const faltan: Faltante[] = [];
  if (!moto?.placa && !moto?.placa_tramite) faltan.push("placa");
  // el cuaderno no decía qué vehículo es: hasta elegirlo, el ícono sale genérico
  if (!moto?.tipo || moto.tipo === "Otro") faltan.push("tipo");
  if (!moto?.serie || !moto?.motor) faltan.push("ficha");
  if (!tiene?.has("moto")) faltan.push("foto_moto");
  return faltan;
}

/**
 * Una fila por contrato activo con la lista de lo que le falta, más una por cada cliente registrado que aún no tiene contrato
 * (por ejemplo, uno recién guardado a medias). Los que están completos no salen.
 */
export function calcularPendientes({ estados, contratos, clientes, motos, documentos, empresas }: Entrada): FilaPendiente[] {
  const contratoPorId = new Map(contratos.map((c) => [c.id, c]));
  const clientePorId = new Map(clientes.map((c) => [c.id, c]));
  const motoPorId = new Map(motos.map((m) => [m.id, m]));
  const fotos = new Map<string, Set<string>>(); // cliente_id → tipos de foto
  const firmados = new Set<string>(); // contratos con hojas firmadas subidas
  for (const d of documentos) {
    if (d.tipo === "contrato" && d.contrato_id) firmados.add(d.contrato_id);
    else (fotos.get(d.cliente_id) ?? fotos.set(d.cliente_id, new Set()).get(d.cliente_id))?.add(d.tipo);
  }

  const filas: FilaPendiente[] = [];
  for (const e of estados) {
    const contrato = contratoPorId.get(e.contrato_id);
    const cliente = clientePorId.get(e.cliente_id);
    const moto = contrato ? (motoPorId.get(contrato.moto_id) ?? null) : null;
    const tiene = fotos.get(e.cliente_id);
    const nota = notaRevisar(contrato?.observaciones);
    const faltan = [...faltaDelCliente(cliente, tiene), ...faltaDelVehiculo(moto, tiene)];
    if (!contrato?.documento) faltan.push("contrato_llenado");
    if (!firmados.has(e.contrato_id)) faltan.push("contrato_firmado");
    if (nota) faltan.push("revisar");
    if (!faltan.length) continue;
    filas.push({
      contrato_id: e.contrato_id,
      cliente_id: e.cliente_id,
      empresa_id: e.empresa_id,
      empresa: e.empresa,
      cliente: e.cliente,
      placa: moto?.placa ?? e.placa,
      color: e.color,
      semanas: e.semanas_atraso,
      moto,
      faltan,
      nota,
    });
  }
  // Clientes registrados que aún no tienen ningún contrato (ni archivados): también les faltan datos
  const conContrato = new Set(contratos.map((c) => c.cliente_id));
  const vehiculoDe = new Map<string, Moto>();
  for (const m of motos) if (m.cliente_id && !m.archivado && !vehiculoDe.has(m.cliente_id)) vehiculoDe.set(m.cliente_id, m);
  for (const c of clientes) {
    if (c.archivado || conContrato.has(c.id)) continue;
    const tiene = fotos.get(c.id);
    const moto = vehiculoDe.get(c.id) ?? null;
    filas.push({
      contrato_id: "",
      cliente_id: c.id,
      empresa_id: c.empresa_id,
      empresa: empresas?.get(c.empresa_id) ?? "",
      cliente: c.nombres,
      placa: moto?.placa ?? null,
      color: "verde",
      semanas: 0,
      moto,
      // sale también en la pestaña Contratos: le falta el contrato completo
      faltan: [...faltaDelCliente(c, tiene), ...(moto ? faltaDelVehiculo(moto, tiene) : ["sin_vehiculo" as const]), "sin_contrato"],
      nota: null,
    });
  }

  return filas.sort((a, b) => alfabetico(a.cliente, b.cliente));
}

/** Las dos pestañas de "Datos pendientes": el contrato va aparte porque se completa en otro momento (imprimir y firmar). */
export const VISTAS = {
  cliente: { titulo: "Cliente y vehículo", grupos: ["cliente", "moto"] },
  contratos: { titulo: "Contratos", grupos: ["contrato"] },
} as const;
export type Vista = keyof typeof VISTAS;

/** Deja en cada fila solo lo de esa pestaña; las filas que quedan sin nada no salen. */
export function filasDeVista<T extends FilaPendiente>(filas: T[], vista: Vista): T[] {
  const grupos = new Set<string>(VISTAS[vista].grupos);
  return filas
    .flatMap((f) => {
      const faltan = f.faltan.filter((k) => grupos.has(FALTANTES[k].grupo));
      return faltan.length ? [{ ...f, faltan }] : [];
    })
    .sort((a, b) => alfabetico(a.cliente, b.cliente));
}

/** Cuántos contratos tienen pendiente cada dato. */
export function contarPorDato(filas: FilaPendiente[]): Record<Faltante, number> {
  const cuenta = Object.fromEntries(CLAVES_FALTANTES.map((k) => [k, 0])) as Record<Faltante, number>;
  for (const f of filas) for (const k of f.faltan) cuenta[k]++;
  return cuenta;
}
