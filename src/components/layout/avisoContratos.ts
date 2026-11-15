"use client";
import { useEffect, useRef, useState } from "react";
import { useSesion } from "./Sesion";

// No se consulta en cada clic: como mucho una vez cada 20 s (salvo al entrar a "Datos pendientes")
const ESPERA_MS = 20_000;

/**
 * Cuántos contratos activos faltan llenar o subir firmados: es el número rojo del menú,
 * así el dueño lo ve desde cualquier pantalla. Solo para el dueño.
 */
export function useContratosPorFirmar(ruta: string): number {
  const { datos, esAdmin } = useSesion();
  const [cuantos, setCuantos] = useState(0);
  const ultima = useRef(0);

  useEffect(() => {
    if (!esAdmin) return;
    const ahora = Date.now();
    if (ahora - ultima.current < ESPERA_MS && !ruta.startsWith("/pendientes")) return;
    ultima.current = ahora;
    // sin cancelar al cambiar de pantalla: la respuesta sirve igual (el menú no se desmonta)
    datos
      .contratosPorFirmar()
      .then(setCuantos)
      .catch(() => undefined); // si falla, el aviso se queda como estaba
  }, [datos, esAdmin, ruta]);

  return esAdmin ? cuantos : 0;
}
