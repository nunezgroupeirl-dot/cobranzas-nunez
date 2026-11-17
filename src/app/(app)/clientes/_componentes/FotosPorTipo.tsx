"use client";
import { NOMBRE_DOCUMENTO, VistaPrevia } from "@/components/ui";
import { MiniaturaPdf } from "@/components/ui/Pdf";
import { esPdf } from "@/lib/pdf";
import type { Documento, TipoDocumento } from "@/types/database";
import { Foto } from "./Foto";
import { GRUPOS_FOTOS, type TipoFoto } from "./secciones";


interface Props {
  existentes: Documento[];
  pendientes: Partial<Record<TipoDocumento, File>>;
  alElegir: (tipo: TipoDocumento, archivo: File) => void;
  alQuitarPendiente: (tipo: TipoDocumento) => void;
  alQuitarExistente: (d: Documento) => void;
}

/** Las fotos por partes (Cliente, Vehículo, Casa, Otros), con espacios chicos: cada una se toma y se reemplaza por separado. */
export function FotosPorTipo(props: Props) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {GRUPOS_FOTOS.map((g) => (
        <section key={g.titulo} className="flex flex-col gap-2 rounded-xl border border-borde p-3" data-grupo={g.titulo}>
          <div>
            <h3 className="leading-tight font-semibold">{g.titulo}</h3>
            <p className="text-xs text-tenue">{g.ayuda}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {g.espacios.map((e) => (
              <Espacio key={e.tipo} tipo={e.tipo} etiqueta={e.etiqueta} {...props} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

const MINIATURA = "size-24 sm:size-28";

function Espacio({ tipo, etiqueta, existentes, pendientes, alElegir, alQuitarPendiente, alQuitarExistente }: Props & { tipo: TipoFoto; etiqueta: string }) {
  const guardadas = existentes.filter((d) => d.tipo === tipo);
  const nueva = pendientes[tipo];
  const tiene = guardadas.length > 0 || !!nueva;
  return (
    <div className="flex w-24 flex-col gap-1 sm:w-28" data-espacio={tipo}>
      <p className="truncate text-xs font-semibold text-marca" title={etiqueta}>
        {etiqueta}
      </p>
      {guardadas.map((d) => (
        <div key={d.id} className="flex flex-col gap-1">
          <Foto bucket="documentos" ruta={d.ruta} titulo={NOMBRE_DOCUMENTO[d.tipo]} className={MINIATURA} />
          <button type="button" onClick={() => alQuitarExistente(d)} className="self-start text-xs font-semibold text-rojo">
            Quitar
          </button>
        </div>
      ))}
      {nueva && (
        <div className="flex flex-col gap-1">
          {esPdf(nueva) ? (
            <MiniaturaPdf fuente={nueva} className={`${MINIATURA} rounded-xl border-2 border-marca`} />
          ) : (
            <VistaPrevia archivo={nueva} alt={NOMBRE_DOCUMENTO[tipo]} className={`${MINIATURA} rounded-xl border-2 border-marca object-cover`} />
          )}
          <span className="flex flex-col text-xs">
            <span className="font-semibold text-marca">Se sube al guardar</span>
            <button type="button" onClick={() => alQuitarPendiente(tipo)} className="self-start font-semibold text-rojo">
              Quitar
            </button>
          </span>
        </div>
      )}
      {!tiene && (
        <label className={`flex ${MINIATURA} cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-marca/60 text-center font-semibold text-marca hover:bg-marca-suave`}>
          <span className="text-2xl leading-none" aria-hidden>
            +
          </span>
          <span className="text-xs">Foto o PDF</span>
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
