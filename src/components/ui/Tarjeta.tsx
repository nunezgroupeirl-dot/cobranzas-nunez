import type { ReactNode } from "react";
import { Esqueleto, type VarianteCarga } from "./Esqueleto";

export function Tarjeta({ titulo, accion, children, className = "" }: { titulo?: ReactNode; accion?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-borde bg-superficie p-4 sm:p-5 ${className}`}>
      {(titulo || accion) && (
        <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {titulo && <h2 className="text-lg font-bold">{titulo}</h2>}
          {accion}
        </header>
      )}
      {children}
    </section>
  );
}

/** Mientras carga: un esqueleto con la forma de la pantalla (no un círculo girando). */
export function Cargando({ texto = "Cargando…", variante = "lista" }: { texto?: string; variante?: VarianteCarga }) {
  return <Esqueleto texto={texto} variante={variante} />;
}

export function TituloPagina({ titulo, sub, accion }: { titulo: string; sub?: ReactNode; accion?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[1.75rem] leading-tight font-bold sm:text-[2.125rem]">{titulo}</h1>
        {sub && <div className="mt-1 text-tenue">{sub}</div>}
      </div>
      {accion && <div className="flex flex-wrap gap-2">{accion}</div>}
    </div>
  );
}

export function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-tenue">{etiqueta}</dt>
      <dd className="font-semibold">{children || "—"}</dd>
    </div>
  );
}
