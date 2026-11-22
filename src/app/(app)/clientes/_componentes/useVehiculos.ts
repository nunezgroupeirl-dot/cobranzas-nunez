"use client";
import { useRef, useState } from "react";
import { hoyLima } from "@/components/ui";
import type { Datos } from "@/lib/supabase/datos";
import type { Cliente } from "@/types/database";
import { guardarEdicion, guardarExtras, guardarVenta, validarVenta, ventaDe, ventaVacia, type Hechos, type Venta, type VentaActual } from "./venta";

/** Un vehículo del formulario: uno que el cliente ya tiene (actual) o uno nuevo. */
export interface ItemVehiculo {
  clave: string;
  v: Venta;
  actual: VentaActual | null;
  /** un vehículo nuevo se puede dejar sin registrar (casilla apagada) */
  activo: boolean;
  errores: Record<string, string>;
}

let siguiente = 0;
const claveNueva = () => `nuevo-${++siguiente}`;

/**
 * Los vehículos del cliente en el formulario (puede tener varios), cada uno con su cronograma.
 * Al crear empieza con uno; al editar, con los que ya tiene. "Registrar otro vehículo" agrega más.
 */
export function useVehiculos(nuevo: boolean, actuales: VentaActual[] = []) {
  const [items, setItems] = useState<ItemVehiculo[]>(() =>
    actuales.length
      ? actuales.map((a, i) => ({ clave: `actual-${i}`, v: ventaDe(hoyLima(), a), actual: a, activo: true, errores: {} }))
      : [{ clave: claveNueva(), v: ventaVacia(hoyLima()), actual: null, activo: nuevo, errores: {} }],
  );
  // lo ya guardado de cada vehículo: si algo falla a la mitad, al reintentar no se duplica
  const hechos = useRef<Record<string, Hechos>>({});

  const cambiar = (clave: string, cambio: Partial<Venta>) =>
    setItems((xs) =>
      xs.map((x) =>
        x.clave === clave ? { ...x, v: { ...x.v, ...cambio }, errores: Object.fromEntries(Object.entries(x.errores).filter(([k]) => !(k in cambio))) } : x,
      ),
    );
  const activar = (clave: string, activo: boolean) => setItems((xs) => xs.map((x) => (x.clave === clave ? { ...x, activo } : x)));
  const agregar = () => setItems((xs) => [...xs, { clave: claveNueva(), v: ventaVacia(hoyLima()), actual: null, activo: true, errores: {} }]);
  const quitar = (clave: string) => setItems((xs) => xs.filter((x) => x.clave !== clave || x.actual));

  /** Revisa los vehículos activos; marca los errores de cada uno. */
  /** `conFoto`: si el comprobante (de cuotas ya pagadas) tiene su foto. */
  const validar = (conFoto: (id: string) => boolean = () => false, fotoRepetida: (id: string) => number | null = () => null) => {
    const revisados = items.map((x) => ({ ...x, errores: x.activo ? validarVenta(x.v, x.actual?.contrato?.cuotas_pagadas_inicial ?? 0, conFoto, fotoRepetida) : {} }));
    setItems(revisados);
    return revisados.every((x) => Object.keys(x.errores).length === 0);
  };

  /** Guarda cada vehículo (edita los que tenía, crea los nuevos). Devuelve el primer contrato nuevo, si hubo. */
  const guardarTodos = async (datos: Datos, cliente: Cliente): Promise<string | undefined> => {
    let primerNuevo: string | undefined;
    for (const x of items.filter((y) => y.activo)) {
      hechos.current[x.clave] ??= {};
      const h = hechos.current[x.clave];
      // uno por uno: cada vehículo depende de que el anterior no haya fallado (y la placa no se repita)
      // react-doctor-disable-next-line async-await-in-loop
      if (x.actual) await guardarEdicion(datos, cliente, x.v, x.actual, h);
      else {
        // react-doctor-disable-next-line async-await-in-loop
        const id = await guardarVenta(datos, cliente, x.v, h);
        primerNuevo ??= id;
      }
      // contrato con varios vehículos: los demás, ligados a ese contrato
      const contratoId = h.contratoId ?? x.actual?.contrato?.id;
      if (contratoId && (x.v.varios || x.actual?.extras?.length))
        // react-doctor-disable-next-line async-await-in-loop
        await guardarExtras(datos, cliente, x.v, contratoId, x.v.empresa_id || cliente.empresa_id, x.actual?.extras ?? [], h);
    }
    return primerNuevo;
  };

  /** Vuelve a poner los vehículos de un borrador (sin errores marcados). */
  const restaurar = (guardados: Omit<ItemVehiculo, "errores">[]) => {
    if (!guardados.length) return;
    // cada uno conserva su clave (sus fotos del borrador van con ella); las nuevas claves siguen después
    for (const x of guardados) siguiente = Math.max(siguiente, Number(/^nuevo-(\d+)$/.exec(x.clave)?.[1] ?? 0));
    setItems(guardados.map((x) => ({ ...x, v: { ...ventaVacia(hoyLima()), ...x.v }, errores: {} })));
  };

  /** El contrato (cronograma) ya guardado de un item del formulario. */
  const contratoDe = (clave: string): string | undefined =>
    hechos.current[clave]?.contratoId ?? items.find((x) => x.clave === clave)?.actual?.contrato?.id ?? undefined;

  /** El vehículo ya guardado de un item del formulario (para ligarle sus fotos). */
  const motoDe = (clave: string): string | undefined =>
    hechos.current[clave]?.moto?.id ?? items.find((x) => x.clave === clave)?.actual?.moto?.id ?? undefined;

  /** Al cambiar la empresa del cliente, los vehículos que estaban en su empresa anterior (o sin elegir) la siguen. */
  const seguirEmpresa = (antes: string, despues: string) =>
    setItems((xs) => xs.map((x) => (!x.v.empresa_id || x.v.empresa_id === antes ? { ...x, v: { ...x.v, empresa_id: despues } } : x)));

  return { items, cambiar, activar, agregar, quitar, validar, guardarTodos, restaurar, motoDe, contratoDe, seguirEmpresa, alguno: items.some((x) => x.activo) };
}
