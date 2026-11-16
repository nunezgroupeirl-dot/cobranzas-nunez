import type { CSSProperties } from "react";

/**
 * Esqueletos de carga: la forma de la pantalla en gris suave con un brillo lento,
 * en lugar de un círculo girando. Cada pantalla usa el que se parece a lo que va a mostrar.
 */

export type VarianteCarga = "lista" | "tarjetas" | "ficha" | "formulario" | "panel" | "pantalla" | "cuotas";

/** Un bloque gris con brillo. */
export function Bloque({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return <div className={`esqueleto ${className}`} style={style} aria-hidden />;
}

function Titulo() {
  return (
    <div className="mb-6 flex flex-col gap-3">
      <Bloque className="h-9 w-64 max-w-[70%]" />
      <Bloque className="h-4 w-[28rem] max-w-[90%]" />
    </div>
  );
}

function Filas({ n = 7 }: { n?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-borde bg-superficie">
      <div className="flex gap-6 border-b border-borde bg-fondo/60 px-4 py-3">
        {[28, 16, 20, 14, 12].map((w, i) => (
          <Bloque key={w} className={`h-3 ${i > 2 ? "hidden md:block" : ""}`} style={{ width: `${w * 4}px` }} />
        ))}
      </div>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-borde px-4 py-4 last:border-0">
          <Bloque className="size-9 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Bloque className={`h-4 ${["w-56", "w-44", "w-64", "w-40", "w-52", "w-48", "w-60"][i % 7]} max-w-full`} />
            <Bloque className="h-3 w-28" />
          </div>
          <Bloque className="hidden h-6 w-20 rounded-md md:block" />
          <Bloque className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function Tarjetas({ n = 4 }: { n?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="flex flex-col gap-3 rounded-2xl border border-borde bg-superficie p-4">
          <div className="flex items-center gap-3">
            <Bloque className="h-6 w-9 rounded-md" />
            <Bloque className="h-6 w-24 rounded-md" />
            <Bloque className="h-4 w-40" />
          </div>
          <Bloque className="h-3 w-3/4" />
          <Bloque className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

function Caja({ alto = "h-40", lineas = 3 }: { alto?: string; lineas?: number }) {
  return (
    <div className={`flex flex-col gap-3 rounded-2xl border border-borde bg-superficie p-5 ${alto}`}>
      <Bloque className="h-5 w-40" />
      {Array.from({ length: lineas }, (_, i) => (
        <Bloque key={i} className={`h-3 ${["w-full", "w-5/6", "w-2/3", "w-3/4"][i % 4]}`} />
      ))}
    </div>
  );
}

function Ficha() {
  return (
    <>
      <Titulo />
      <div className="grid gap-4 lg:grid-cols-3">
        <Caja alto="h-48" lineas={4} />
        <Caja alto="h-48" lineas={4} />
        <Caja alto="h-48" lineas={4} />
      </div>
      <div className="mt-4 rounded-2xl border border-borde bg-superficie p-5">
        <Bloque className="mb-4 h-5 w-48" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }, (_, i) => (
            <Bloque key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    </>
  );
}

function Formulario() {
  const campo = (k: number) => (
    <div key={k} className="flex flex-col gap-2">
      <Bloque className="h-3 w-28" />
      <Bloque className="h-12 rounded-xl" />
    </div>
  );
  return (
    <>
      <Titulo />
      {[0, 1].map((t) => (
        <div key={t} className="mb-4 rounded-2xl border border-borde bg-superficie p-5">
          <Bloque className="mb-5 h-5 w-44" />
          <div className="grid gap-4 sm:grid-cols-2">{[0, 1, 2, 3].map(campo)}</div>
        </div>
      ))}
    </>
  );
}

function Panel() {
  return (
    <>
      <Titulo />
      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-3 rounded-2xl border border-borde bg-superficie p-5">
            <Bloque className="h-3 w-24" />
            <Bloque className="h-8 w-32" />
          </div>
        ))}
      </div>
      <div className="flex h-72 items-end gap-3 rounded-2xl border border-borde bg-superficie p-5">
        {[45, 70, 55, 85, 60, 95, 75, 50].map((h) => (
          <Bloque key={h} className="flex-1 rounded-t-lg rounded-b-none" style={{ height: `${h}%` }} />
        ))}
      </div>
    </>
  );
}

/** Toda la página (mientras se verifica la sesión): menú oscuro a la izquierda y contenido. */
function Pantalla() {
  return (
    <div className="flex min-h-dvh bg-fondo">
      <aside className="hidden w-64 shrink-0 flex-col gap-4 bg-tinta p-5 lg:flex" aria-hidden>
        <div className="mb-4 flex items-center gap-3">
          <div className="esqueleto-oscuro size-11 rounded-full" />
          <div className="esqueleto-oscuro h-5 w-32" />
        </div>
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="esqueleto-oscuro size-5 rounded-md" />
            <div className={`esqueleto-oscuro h-4 ${["w-24", "w-32", "w-28", "w-36"][i % 4]}`} />
          </div>
        ))}
      </aside>
      <div className="flex-1 p-4 sm:p-6 lg:p-8">
        <Bloque className="mb-8 h-12 w-full max-w-md rounded-xl" />
        <Titulo />
        <Filas n={6} />
      </div>
    </div>
  );
}

/** Lo que se ve mientras carga una pantalla. */
export function Esqueleto({ variante = "lista", texto = "Cargando…" }: { variante?: VarianteCarga; texto?: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="animate-[aparecer_.25s_ease-out]">
      <span className="sr-only">{texto}</span>
      {variante === "pantalla" && <Pantalla />}
      {variante === "lista" && <Filas />}
      {variante === "tarjetas" && <Tarjetas />}
      {variante === "ficha" && <Ficha />}
      {variante === "formulario" && <Formulario />}
      {variante === "panel" && <Panel />}
      {variante === "cuotas" && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }, (_, i) => (
            <Bloque key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      )}
    </div>
  );
}
