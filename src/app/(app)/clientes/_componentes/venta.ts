import { sumarDias } from "@/components/ui";
import type { Datos } from "@/lib/supabase/datos";
import type { Cliente, Contrato, Frecuencia, Moto } from "@/types/database";

/** Moto y cronograma de un cliente nuevo (todo como texto, tal como se escribe en el formulario). */
export interface Venta {
  tipo: string;
  placa: string;
  tramite: boolean;
  marca: string;
  color: string;
  frecuencia: Frecuencia;
  cuota: string;
  nro_cuotas: string;
  fecha_inicio: string;
  precio: string;
  inicial: string;
  pagadas: string;
}

export const ventaVacia = (hoy: string): Venta => ({
  tipo: "Mototaxi",
  placa: "",
  tramite: false,
  marca: "",
  color: "",
  frecuencia: "semanal",
  cuota: "",
  nro_cuotas: "",
  fecha_inicio: sumarDias(hoy, 7),
  precio: "",
  inicial: "",
  pagadas: "",
});

/** Errores por campo (vacío = todo bien). */
export function validarVenta(v: Venta): Record<string, string> {
  const e: Record<string, string> = {};
  if (!v.tramite && v.placa.trim() && !/^[A-Z0-9]{2,4}-?[A-Z0-9]{2,4}$/i.test(v.placa.trim())) e.placa = "Escribe la placa (ej.: 1234-AB).";
  if (!v.marca.trim()) e.marca = "Escribe la marca.";
  const nro = Number(v.nro_cuotas);
  if (!(Number(v.cuota) > 0)) e.cuota = "Escribe la cuota.";
  if (!Number.isInteger(nro) || nro < 1 || nro > 1000) e.nro_cuotas = "Entre 1 y 1000 cuotas.";
  if (!v.fecha_inicio) e.fecha_inicio = "Elige la fecha de la 1.ª cuota.";
  const pagadas = v.pagadas ? Number(v.pagadas) : 0;
  if (!Number.isInteger(pagadas) || pagadas < 0 || (nro > 0 && pagadas > nro)) e.pagadas = "No puede ser más que el número de cuotas.";
  return e;
}

/** Lo ya guardado en un intento anterior: si algo falla a la mitad, al reintentar no se duplica la moto. */
export interface Hechos {
  moto?: Moto;
  contratoId?: string;
}

/** Registra la moto y crea el cronograma (contrato sin llenar). Devuelve el id del contrato. */
export async function guardarVenta(datos: Datos, cliente: Cliente, v: Venta, hechos: Hechos): Promise<string> {
  const opcional = (x: string) => (x.trim() ? Number(x) : null);
  hechos.moto ??= await datos.guardarMoto({
    cliente_id: cliente.id,
    empresa_id: cliente.empresa_id,
    placa: v.tramite ? null : v.placa,
    placa_tramite: v.tramite,
    tipo: v.tipo,
    marca: v.marca.trim(),
    color: v.color.trim(),
  });
  hechos.contratoId ??= await datos.crearContrato({
    cliente_id: cliente.id,
    moto_id: hechos.moto.id,
    monto_cuota: Number(v.cuota),
    nro_cuotas: Number(v.nro_cuotas),
    fecha_inicio: v.fecha_inicio,
    frecuencia: v.frecuencia,
    precio_total: opcional(v.precio),
    inicial: opcional(v.inicial),
    cuotas_pagadas: v.pagadas ? Number(v.pagadas) : 0,
  });
  return hechos.contratoId;
}

/** Lo que el cliente ya tiene: su moto y su contrato (el activo más reciente). */
export interface VentaActual {
  moto: Moto | null;
  contrato: Contrato | null;
  /** cuántos contratos más tiene (esos se editan desde su contrato) */
  otros: number;
}

/** Busca la moto y el contrato que se muestran al editar un cliente. */
export async function cargarVentaActual(datos: Datos, clienteId: string): Promise<VentaActual> {
  const [contratos, motos] = await Promise.all([datos.contratos(), datos.motos()]);
  const suyos = contratos
    .filter((c) => c.cliente_id === clienteId && c.estado !== "anulado")
    .sort((a, b) => Number(b.estado === "activo") - Number(a.estado === "activo") || b.creado_en.localeCompare(a.creado_en));
  const contrato = suyos[0] ?? null;
  const moto = (contrato ? motos.find((m) => m.id === contrato.moto_id) : motos.find((m) => m.cliente_id === clienteId)) ?? null;
  return { moto, contrato, otros: Math.max(0, suyos.length - 1) };
}

const texto = (n: number | null | undefined) => (n == null ? "" : String(n));

/** El formulario lleno con la moto y el contrato que ya tiene. */
export function ventaDe(hoy: string, { moto, contrato }: VentaActual): Venta {
  const base = ventaVacia(hoy);
  return {
    ...base,
    ...(moto
      ? { tipo: moto.tipo || "Otro", placa: moto.placa ?? "", tramite: !moto.placa && !!moto.placa_tramite, marca: moto.marca, color: moto.color }
      : {}),
    ...(contrato
      ? {
          frecuencia: contrato.frecuencia ?? "semanal",
          cuota: texto(contrato.monto_cuota),
          nro_cuotas: texto(contrato.nro_cuotas),
          fecha_inicio: contrato.fecha_inicio,
          precio: texto(contrato.precio_total),
          inicial: texto(contrato.inicial),
          pagadas: contrato.cuotas_pagadas_inicial ? String(contrato.cuotas_pagadas_inicial) : "",
        }
      : {}),
  };
}

/** Al editar: actualiza la moto y el cronograma solo si cambiaron; si aún no tenía, los crea. */
export async function guardarEdicion(datos: Datos, cliente: Cliente, v: Venta, actual: VentaActual, hechos: Hechos): Promise<void> {
  const { moto, contrato } = actual;
  if (moto && !hechos.moto) {
    const placa = v.tramite ? null : v.placa.trim().toUpperCase() || null;
    const cambio = placa !== moto.placa || v.tramite !== !!moto.placa_tramite || v.tipo !== moto.tipo || v.marca.trim() !== moto.marca || v.color.trim() !== moto.color;
    hechos.moto = cambio
      ? await datos.guardarMoto({ ...moto, placa, placa_tramite: v.tramite, tipo: v.tipo, marca: v.marca.trim(), color: v.color.trim() })
      : moto;
  }
  if (!contrato) {
    await guardarVenta(datos, cliente, v, hechos);
    return;
  }
  const nuevo = {
    monto_cuota: Number(v.cuota),
    nro_cuotas: Number(v.nro_cuotas),
    fecha_inicio: v.fecha_inicio,
    precio_total: v.precio.trim() ? Number(v.precio) : null,
    inicial: v.inicial.trim() ? Number(v.inicial) : null,
    cuotas_pagadas: v.pagadas ? Number(v.pagadas) : 0,
    frecuencia: v.frecuencia,
  };
  const cambio =
    nuevo.monto_cuota !== contrato.monto_cuota ||
    nuevo.nro_cuotas !== contrato.nro_cuotas ||
    nuevo.fecha_inicio !== contrato.fecha_inicio ||
    nuevo.precio_total !== contrato.precio_total ||
    nuevo.inicial !== contrato.inicial ||
    nuevo.cuotas_pagadas !== contrato.cuotas_pagadas_inicial ||
    nuevo.frecuencia !== (contrato.frecuencia ?? "semanal");
  // rehace el cronograma y vuelve a aplicar los pagos ya registrados
  if (cambio) await datos.editarContrato(contrato.id, { ...nuevo, observaciones: contrato.observaciones });
}
