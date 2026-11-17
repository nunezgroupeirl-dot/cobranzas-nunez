"use client";
import { useRef, useState } from "react";
import { hoyLima } from "@/components/ui";
import type { Datos } from "@/lib/supabase/datos";
import type { Cliente } from "@/types/database";
import { guardarEdicion, guardarVenta, validarVenta, ventaDe, ventaVacia, type Hechos, type Venta, type VentaActual } from "./venta";

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
  const validar = () => {
    const revisados = items.map((x) => ({ ...x, errores: x.activo ? validarVenta(x.v) : {} }));
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
    }
    return primerNuevo;
  };

  /** Vuelve a poner los vehículos de un borrador (sin errores marcados). */
  const restaurar = (guardados: Omit<ItemVehiculo, "errores">[]) => {
    if (!guardados.length) return;
    // los nuevos reciben clave nueva: así "Registrar otro vehículo" no repite una
    setItems(guardados.map((x) => ({ ...x, clave: x.actual ? x.clave : claveNueva(), v: { ...ventaVacia(hoyLima()), ...x.v }, errores: {} })));
  };

  return { items, cambiar, activar, agregar, quitar, validar, guardarTodos, restaurar, alguno: items.some((x) => x.activo) };
}
