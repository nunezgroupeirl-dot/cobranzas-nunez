import { sumarDias } from "@/components/ui";
import type { Datos } from "@/lib/supabase/datos";
import type { Cliente, Frecuencia, Moto } from "@/types/database";

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
  if (!Number.isInteger(nro) || nro < 1 || nro > 260) e.nro_cuotas = "Entre 1 y 260 cuotas.";
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
