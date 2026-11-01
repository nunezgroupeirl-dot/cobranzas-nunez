import type { ReactNode } from "react";

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

export function Cargando({ texto = "Cargando…" }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-tenue" role="status">
      <span className="size-5 animate-spin rounded-full border-2 border-marca border-r-transparent" aria-hidden />
      {texto}
    </div>
  );
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
