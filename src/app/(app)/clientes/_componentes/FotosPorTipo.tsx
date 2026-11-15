"use client";
import { NOMBRE_DOCUMENTO, VistaPrevia } from "@/components/ui";
import { MiniaturaPdf } from "@/components/ui/Pdf";
import { esPdf } from "@/lib/pdf";
import type { Documento, TipoDocumento } from "@/types/database";
import { Foto } from "./Foto";
import { SECCIONES, type TipoFoto } from "./secciones";


interface Props {
  existentes: Documento[];
  pendientes: Partial<Record<TipoDocumento, File>>;
  alElegir: (tipo: TipoDocumento, archivo: File) => void;
  alQuitarPendiente: (tipo: TipoDocumento) => void;
  alQuitarExistente: (d: Documento) => void;
}

/** Un espacio por cada foto: cada una se toma y se reemplaza por separado. Acepta fotos o PDF. */
export function FotosPorTipo(props: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {SECCIONES.map((s) => (
        <section
          key={s.titulo}
          className={`flex flex-col gap-2 rounded-xl border border-borde p-3 ${s.espacios.length > 1 ? "col-span-2" : ""}`}
          data-tipo={s.espacios[0].tipo}
        >
          <div>
            <h3 className="font-semibold leading-tight">{s.titulo}</h3>
            <p className="text-xs text-tenue">{s.ayuda}</p>
          </div>
          <div className={s.espacios.length > 1 ? "grid grid-cols-2 gap-3" : "contents"}>
            {s.espacios.map((e) => (
              <Espacio key={e.tipo} tipo={e.tipo} etiqueta={e.etiqueta} {...props} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Espacio({ tipo, etiqueta, existentes, pendientes, alElegir, alQuitarPendiente, alQuitarExistente }: Props & { tipo: TipoFoto; etiqueta?: string }) {
  const guardadas = existentes.filter((d) => d.tipo === tipo);
  const nueva = pendientes[tipo];
  const tiene = guardadas.length > 0 || !!nueva;
  return (
    <div className="flex flex-col gap-2" data-espacio={tipo}>
      {etiqueta && <p className="text-sm font-semibold text-marca">{etiqueta}</p>}
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
          {esPdf(nueva) ? (
            <MiniaturaPdf fuente={nueva} className="aspect-[4/3] w-full rounded-xl border-2 border-marca" />
          ) : (
            <VistaPrevia archivo={nueva} alt={NOMBRE_DOCUMENTO[tipo]} className="aspect-[4/3] w-full rounded-xl border-2 border-marca object-cover" />
          )}
          <span className="flex justify-between gap-2 text-xs">
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
          <span className="text-sm">Foto o PDF</span>
          <input
            type="file"
            accept="image/*,application/pdf"
            className="sr-only"
            aria-label={`Foto o PDF: ${NOMBRE_DOCUMENTO[tipo]}`}
            onChange={(ev) => {
              const a = ev.target.files?.[0];
              if (a) alElegir(tipo, a);
              ev.target.value = "";
            }}
          />
        </label>
      )}
    </div>
  );
}
