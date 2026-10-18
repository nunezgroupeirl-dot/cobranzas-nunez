"use client";
import { useCallback, useEffect, useState } from "react";
import { mensajeDeError } from "./formato";

/** Carga datos al montar (y cuando cambian las dependencias). */
export function useCarga<T>(cargar: () => Promise<T>, deps: unknown[] = []) {
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    cargar()
      .then((d) => {
        if (vivo) {
          setDatos(d);
          setError(null);
        }
      })
      .catch((e: unknown) => vivo && setError(mensajeDeError(e)))
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, ...deps]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);
  return { datos, error, cargando, recargar };
}
