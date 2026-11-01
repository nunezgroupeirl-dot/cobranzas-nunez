"use client";
import { NOMBRE_DOCUMENTO, VistaPrevia } from "@/components/ui";
import type { Documento, TipoDocumento } from "@/types/database";
import { Foto } from "./Foto";

const TIPOS_FOTO = Object.keys(NOMBRE_DOCUMENTO) as TipoDocumento[];

const AYUDA: Record<TipoDocumento, string> = {
  cliente: "Rostro, de frente",
  dni: "Que se lea el número",
  moto: "Con la placa visible",
  fachada: "Frente de la casa",
  recibo: "Luz o agua, con la dirección",
  otro: "Cualquier otro documento",
};

interface Props {
  existentes: Documento[];
  pendientes: Partial<Record<TipoDocumento, File>>;
  alElegir: (tipo: TipoDocumento, archivo: File) => void;
  alQuitarPendiente: (tipo: TipoDocumento) => void;
  alQuitarExistente: (d: Documento) => void;
}

/** Un espacio por cada tipo de foto: cada una se toma y se reemplaza por separado. */
export function FotosPorTipo({ existentes, pendientes, alElegir, alQuitarPendiente, alQuitarExistente }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {TIPOS_FOTO.map((tipo) => {
        const guardadas = existentes.filter((d) => d.tipo === tipo);
        const nueva = pendientes[tipo];
        const tiene = guardadas.length > 0 || !!nueva;
        return (
          <section key={tipo} className="flex flex-col gap-2 rounded-xl border border-borde p-3" data-tipo={tipo}>
            <div>
              <h3 className="font-semibold leading-tight">{NOMBRE_DOCUMENTO[tipo]}</h3>
              <p className="text-xs text-tenue">{AYUDA[tipo]}</p>
            </div>
            {guardadas.map((d) => (
              <div key={d.id} className="flex flex-col gap-1">
                <Foto bucket="documentos" ruta={d.ruta} titulo={NOMBRE_DOCUMENTO[d.tipo]} className="aspect-[4/3] w-full" />
                <button type="button" onClick={() => alQuitarExistente(d)} className="self-start text-xs font-semibold text-rojo">
                  Quitar
                </button>
              </div>
            ))}
            {nueva && (
              <div className="flex flex-col gap-1">
                <VistaPrevia archivo={nueva} alt={NOMBRE_DOCUMENTO[tipo]} className="aspect-[4/3] w-full rounded-xl border-2 border-marca object-cover" />
                <span className="flex justify-between text-xs">
                  <span className="font-semibold text-marca">Se sube al guardar</span>
                  <button type="button" onClick={() => alQuitarPendiente(tipo)} className="font-semibold text-rojo">
                    Quitar
                  </button>
                </span>
              </div>
            )}
            {!tiene && (
              <label className="flex aspect-[4/3] w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-marca/60 text-center font-semibold text-marca hover:bg-marca-suave">
                <span className="text-2xl leading-none" aria-hidden>
                  +
                </span>
                <span className="text-sm">Tomar o elegir</span>
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  aria-label={`Foto: ${NOMBRE_DOCUMENTO[tipo]}`}
                  onChange={(e) => {
                    const a = e.target.files?.[0];
                    if (a) alElegir(tipo, a);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
          </section>
        );
      })}
    </div>
  );
}
