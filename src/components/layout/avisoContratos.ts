"use client";
import { useEffect, useRef, useState } from "react";
import { useSesion } from "./Sesion";

// No se consulta en cada clic: como mucho una vez cada 20 s, salvo al entrar a "Datos pendientes"
// o a la ficha de un cliente o contrato (ahí se llega justo después de guardar uno nuevo)
const ESPERA_MS = 20_000;
const AL_INSTANTE = ["/pendientes", "/clientes/ficha", "/contratos/ver"];

/**
 * Cuántos contratos activos faltan llenar o subir firmados, más los clientes que aún no tienen contrato: es el número rojo del menú,
 * así el dueño lo ve desde cualquier pantalla. Solo para el dueño.
 */
export function useContratosPorFirmar(ruta: string): number {
  const { datos, esAdmin } = useSesion();
  const [cuantos, setCuantos] = useState(0);
  const ultima = useRef(0);

  useEffect(() => {
    if (!esAdmin) return;
    const ahora = Date.now();
    if (ahora - ultima.current < ESPERA_MS && !AL_INSTANTE.some((r) => ruta.startsWith(r))) return;
    ultima.current = ahora;
    // sin cancelar al cambiar de pantalla: la respuesta sirve igual (el menú no se desmonta)
    datos
      .contratosPorFirmar()
      .then(setCuantos)
      .catch(() => undefined); // si falla, el aviso se queda como estaba
  }, [datos, esAdmin, ruta]);

  return esAdmin ? cuantos : 0;
}

/**
 * Cuántos vehículos hay que inmovilizar (4 semanas de deuda o más): número rojo junto a "¿Quién no paga?"
 * y aviso arriba de cada pantalla. Solo para administradores.
 */
export function usePorInmovilizar(ruta: string): number {
  const { datos, esAdmin } = useSesion();
  const [cuantos, setCuantos] = useState(0);
  const ultima = useRef(0);

  useEffect(() => {
    if (!esAdmin) return;
    const ahora = Date.now();
    if (ahora - ultima.current < ESPERA_MS && !ruta.startsWith("/morosos") && !ruta.startsWith("/pagos")) return;
    ultima.current = ahora;
    datos
      .porInmovilizar()
      .then(setCuantos)
      .catch(() => undefined);
  }, [datos, esAdmin, ruta]);

  return esAdmin ? cuantos : 0;
}
