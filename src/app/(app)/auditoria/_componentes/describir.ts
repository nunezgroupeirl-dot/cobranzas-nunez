import { NOMBRE_DOCUMENTO, NOMBRE_MEDIO, formatoSoles } from "@/components/ui/formato";
import type { Auditoria, MedioPago, TipoDocumento } from "@/types/database";

/** Para nombrar lo que se tocó: cliente y placa de cada contrato, nombre de cada cliente, placa de cada vehículo. */
export interface Contexto {
  contrato: Map<string, { cliente: string; placa: string }>;
  cliente: Map<string, string>;
  placa: Map<string, string>;
}

type Fila = Record<string, unknown>;

const CAMPOS: Record<string, string> = {
  nombres: "nombre",
  dni: "DNI",
  celular: "celular",
  direccion: "dirección",
  referencia: "referencia",
  recomendado_por: "recomendado por",
  ubicacion: "ubicación",
  empresa_id: "empresa",
  placa: "placa",
  placa_tramite: "placa en trámite",
  tipo: "tipo",
  marca: "marca",
  color: "color",
  modelo: "modelo",
  anio: "año",
  serie: "serie",
  motor: "motor",
  monto_cuota: "cuota",
  nro_cuotas: "n.º de cuotas",
  fecha_inicio: "fecha de inicio",
  frecuencia: "frecuencia",
  precio_total: "precio",
  inicial: "inicial",
  cuotas_pagadas_inicial: "cuotas ya pagadas",
  observaciones: "observaciones",
  documento: "contrato llenado",
  archivado: "archivado",
  rol: "rol",
  puesto: "puesto",
  activo: "activo",
  nombre: "nombre",
  ruc: "RUC",
  representante: "representante",
};

const texto = (v: unknown) => (v == null ? "" : String(v));
const soles = (v: unknown) => formatoSoles(Number(v ?? 0));

/** Qué campos cambiaron en una edición (en palabras). */
function cambios(d: Fila | null): string {
  const antes = (d?.antes ?? {}) as Fila;
  const despues = (d?.despues ?? {}) as Fila;
  const lista = Object.keys(CAMPOS).filter((k) => k in despues && JSON.stringify(antes[k]) !== JSON.stringify(despues[k]));
  return lista.length ? lista.map((k) => CAMPOS[k]).join(", ") : "";
}

/** Una línea en palabras: "Registró un pago de S/ 120.00 (Yape) · Juan Pérez · 1234-AB". */
export function describir(a: Auditoria, ctx: Contexto): { texto: string; foto?: string } {
  const d = a.detalle as Fila | null;
  const fila = (a.accion === "update" ? (d?.despues as Fila) : d) ?? {};
  const deContrato = (id: unknown) => {
    const c = ctx.contrato.get(texto(id));
    return c ? ` · ${c.cliente}${c.placa ? ` · ${c.placa}` : ""}` : "";
  };
  const queCambio = cambios(d);

  switch (a.tabla) {
    case "pagos": {
      const base = `${soles(fila.monto)} (${NOMBRE_MEDIO[fila.medio as MedioPago] ?? texto(fila.medio)})${deContrato(fila.contrato_id)}`;
      if (a.accion === "insert")
        return {
          texto: `${Array.isArray(fila.cuotas_anteriores) ? "Subió el comprobante de cuotas del cuaderno" : "Registró un pago"} de ${base}`,
          foto: texto(fila.foto_ruta) || undefined,
        };
      if (a.accion === "update" && fila.anulado && !(d?.antes as Fila)?.anulado)
        return { texto: `Anuló el pago de ${base}${fila.motivo_anulacion ? ` — motivo: ${texto(fila.motivo_anulacion)}` : ""}`, foto: texto(fila.foto_ruta) || undefined };
      return { texto: `${a.accion === "delete" ? "Eliminó" : "Cambió"} el pago de ${base}` };
    }
    case "clientes": {
      const n = texto(fila.nombres) || ctx.cliente.get(texto(a.registro_id)) || "un cliente";
      if (a.accion === "insert") return { texto: `Registró al cliente ${n}` };
      if (a.accion === "delete") return { texto: `Eliminó al cliente ${n}` };
      return { texto: `Editó al cliente ${n}${queCambio ? ` (${queCambio})` : ""}` };
    }
    case "motos": {
      const p = texto(fila.placa) || (fila.placa_tramite ? "placa en trámite" : "sin placa");
      const v = `el vehículo ${texto(fila.tipo)} ${p}`.replace(/\s+/g, " ");
      if (a.accion === "insert") return { texto: `Registró ${v}` };
      if (a.accion === "delete") return { texto: `Eliminó ${v}` };
      return { texto: `Editó ${v}${queCambio ? ` (${queCambio})` : ""}` };
    }
    case "contratos": {
      const de = deContrato(a.registro_id) || deContrato(fila.id);
      if (a.accion === "insert") return { texto: `Creó un contrato de ${texto(fila.nro_cuotas)} cuotas de ${soles(fila.monto_cuota)}${de}` };
      if (a.accion === "delete") return { texto: `Eliminó un contrato${de}` };
      const antes = (d?.antes ?? {}) as Fila;
      if (fila.estado !== antes.estado) {
        if (fila.estado === "anulado") return { texto: `Cerró el contrato${de}${fila.cerrado_motivo ? ` — motivo: ${texto(fila.cerrado_motivo)}` : ""}` };
        if (fila.estado === "terminado") return { texto: `El contrato quedó pagado por completo${de}` };
        return { texto: `El contrato volvió a estar activo${de}` };
      }
      return { texto: `Editó el contrato${de}${queCambio ? ` (${queCambio})` : ""}` };
    }
    case "documentos": {
      const tipo = NOMBRE_DOCUMENTO[fila.tipo as TipoDocumento] ?? texto(fila.tipo);
      const quien = ctx.cliente.get(texto(fila.cliente_id));
      const de = quien ? ` de ${quien}` : "";
      return { texto: `${a.accion === "delete" ? "Quitó" : "Subió"} ${fila.tipo === "contrato" ? "una hoja del contrato firmado" : `la foto "${tipo}"`}${de}` };
    }
    case "perfiles": {
      const n = texto(fila.nombre) || "un usuario";
      if (a.accion === "insert") return { texto: `Creó el usuario ${n}` };
      return { texto: `Cambió al usuario ${n}${queCambio ? ` (${queCambio})` : ""}` };
    }
    case "empresas":
      return { texto: `${a.accion === "insert" ? "Agregó" : a.accion === "delete" ? "Eliminó" : "Editó"} la empresa ${texto(fila.nombre)}${queCambio ? ` (${queCambio})` : ""}` };
    case "cuentas":
      return { texto: `${a.accion === "insert" ? "Agregó" : a.accion === "delete" ? "Eliminó" : "Editó"} la cuenta ${texto(fila.nombre)}` };
    default:
      return { texto: `${a.accion} en ${a.tabla}` };
  }
}
