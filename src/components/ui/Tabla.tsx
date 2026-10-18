import type { KeyboardEvent, ReactNode } from "react";

export interface Columna<T> {
  clave: string;
  titulo: string;
  celda: (fila: T) => ReactNode;
  /** alinear a la derecha (montos) */
  numero?: boolean;
  /** no mostrar en la tarjeta de celular */
  ocultarEnMovil?: boolean;
}

interface Props<T> {
  columnas: Columna<T>[];
  filas: T[];
  claveFila: (fila: T) => string;
  alTocar?: (fila: T) => void;
  vacio?: string;
  /** contenido principal de la tarjeta en celular (si no, se usa la primera columna) */
  tituloMovil?: (fila: T) => ReactNode;
  acento?: (fila: T) => string | undefined;
}

/** Tabla en tablet/escritorio; tarjetas apiladas en celular. */
export function Tabla<T>({ columnas, filas, claveFila, alTocar, vacio = "No hay datos.", tituloMovil, acento }: Props<T>) {
  if (filas.length === 0) {
    return <p className="rounded-2xl border border-dashed border-borde bg-superficie p-8 text-center text-tenue">{vacio}</p>;
  }
  const [primera, ...resto] = columnas;
  // fila tocable también con teclado (Tab + Enter o Espacio)
  const activable = (f: T) =>
    alTocar
      ? {
          tabIndex: 0,
          onClick: () => alTocar(f),
          onKeyDown: (e: KeyboardEvent) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            e.preventDefault();
            alTocar(f);
          },
        }
      : {};
  return (
    <>
      <div className="hidden overflow-x-auto rounded-2xl border border-borde bg-superficie md:block">
        <table className="w-full text-left">
          <thead className="bg-fondo text-sm text-tenue">
            <tr>
              {columnas.map((c) => (
                <th key={c.clave} className={`px-4 py-3 font-semibold ${c.numero ? "text-right" : ""}`}>
                  {c.titulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr
                key={claveFila(f)}
                {...activable(f)}
                className={`border-t border-borde ${alTocar ? "cursor-pointer hover:bg-marca-suave/50 focus-visible:bg-marca-suave/50 focus-visible:outline-none" : ""}`}
                style={acento?.(f) ? { boxShadow: `inset 4px 0 0 ${acento(f)}` } : undefined}
              >
                {columnas.map((c) => (
                  <td key={c.clave} className={`px-4 py-3 align-middle ${c.numero ? "num text-right" : ""}`}>
                    {c.celda(f)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-2 md:hidden">
        {filas.map((f) => (
          <li
            key={claveFila(f)}
            {...activable(f)}
            role={alTocar ? "button" : undefined}
            className={`rounded-2xl border border-borde bg-superficie p-4 ${alTocar ? "cursor-pointer active:bg-marca-suave/50 focus-visible:ring-3 focus-visible:ring-marca/30 focus-visible:outline-none" : ""}`}
            style={acento?.(f) ? { boxShadow: `inset 5px 0 0 ${acento(f)}` } : undefined}
          >
            <div className="font-semibold">{tituloMovil ? tituloMovil(f) : primera.celda(f)}</div>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              {(tituloMovil ? columnas : resto)
                .filter((c) => !c.ocultarEnMovil)
                .map((c) => (
                  <div key={c.clave} className="contents">
                    <dt className="text-tenue">{c.titulo}</dt>
                    <dd className={`text-right ${c.numero ? "num" : ""}`}>{c.celda(f)}</dd>
                  </div>
                ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
