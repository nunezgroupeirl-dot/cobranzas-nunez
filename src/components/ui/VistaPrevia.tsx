"use client";
import { useEffect, useState } from "react";

/**
 * Vista previa de una foto elegida en el dispositivo (todavía sin subir).
 * Crea su URL temporal y la libera al cambiar de foto o al desaparecer, para no llenar la memoria
 * de la tablet cuando se registran muchos pagos seguidos.
 */
export function VistaPrevia({ archivo, alt = "", className = "" }: { archivo: Blob; alt?: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(archivo);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [archivo]);
  return url ? <img src={url} alt={alt} className={className} /> : <div className={`animate-pulse bg-fondo ${className}`} aria-hidden />;
}
