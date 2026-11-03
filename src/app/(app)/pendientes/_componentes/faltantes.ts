import type { Cliente, Color, Contrato, Documento, EstadoCliente, Moto } from "@/types/database";

/** Cada dato que puede faltar en un contrato activo, agrupado por dónde se completa. */
export const FALTANTES = {
  dni: { texto: "DNI", grupo: "cliente" },
  celular: { texto: "Celular", grupo: "cliente" },
  direccion: { texto: "Dirección", grupo: "cliente" },
  ubicacion: { texto: "Ubicación en el mapa", grupo: "cliente" },
  foto_cliente: { texto: "Foto del cliente", grupo: "cliente" },
  foto_dni: { texto: "Foto del DNI", grupo: "cliente" },
  placa: { texto: "Placa", grupo: "moto" },
  ficha: { texto: "Ficha técnica (serie y motor)", grupo: "moto" },
  foto_moto: { texto: "Foto de la moto", grupo: "moto" },
  contrato_llenado: { texto: "Contrato sin llenar", grupo: "contrato" },
  contrato_firmado: { texto: "Contrato firmado sin subir", grupo: "contrato" },
  revisar: { texto: "Revisar en el cuaderno", grupo: "contrato" },
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
}

/** Una fila por contrato activo con la lista de lo que le falta. Los que están completos no salen. */
export function calcularPendientes({ estados, contratos, clientes, motos, documentos }: Entrada): FilaPendiente[] {
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
    const faltan: Faltante[] = [];
    if (!cliente?.dni) faltan.push("dni");
    if (!cliente?.celular) faltan.push("celular");
    if (!cliente?.direccion) faltan.push("direccion");
    if (!cliente?.ubicacion) faltan.push("ubicacion");
    if (!tiene?.has("cliente")) faltan.push("foto_cliente");
    if (!tiene?.has("dni")) faltan.push("foto_dni");
    if (!moto?.placa) faltan.push("placa");
    if (!moto?.serie || !moto?.motor) faltan.push("ficha");
    if (!tiene?.has("moto")) faltan.push("foto_moto");
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
  // Primero a quien le falta más
  return filas.sort((a, b) => b.faltan.length - a.faltan.length || a.cliente.localeCompare(b.cliente));
}

/** Cuántos contratos tienen pendiente cada dato. */
export function contarPorDato(filas: FilaPendiente[]): Record<Faltante, number> {
  const cuenta = Object.fromEntries(CLAVES_FALTANTES.map((k) => [k, 0])) as Record<Faltante, number>;
  for (const f of filas) for (const k of f.faltan) cuenta[k]++;
  return cuenta;
}
