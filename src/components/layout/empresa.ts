"use client";
import { useSearchParams } from "next/navigation";

/**
 * Filtro de empresa guardado en la URL como ?empresa=<id>.
 * Sin parámetro = Todas. Petit usa el mismo hook en sus pantallas.
 */
export function useEmpresa(): string | null {
  return useSearchParams().get("empresa");
}

/** Arma un enlace conservando el ?empresa= actual */
export function useConEmpresa() {
  const empresa = useEmpresa();
  return (href: string) => {
    if (!empresa) return href;
    return `${href}${href.includes("?") ? "&" : "?"}empresa=${encodeURIComponent(empresa)}`;
  };
}

/** Filtra una lista por la empresa elegida en la URL */
export function filtrarPorEmpresa<T extends { empresa_id: string }>(filas: T[], empresa: string | null): T[] {
  return empresa ? filas.filter((f) => f.empresa_id === empresa) : filas;
}
