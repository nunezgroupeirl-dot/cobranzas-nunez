"use client";
import { NOMBRE_DOCUMENTO, VistaPrevia } from "@/components/ui";
import { MiniaturaPdf } from "@/components/ui/Pdf";
import { esPdf } from "@/lib/pdf";
import type { Documento, TipoDocumento } from "@/types/database";
import { Foto } from "./Foto";
import { GRUPOS_FOTOS, tipoDeClave, type GrupoFotos, type TipoFoto } from "./secciones";

interface Props {
  existentes: Documento[];
  /** Clave: el tipo, o "tipo:n" en los espacios que aceptan varias (ver tipoDeClave). */
  pendientes: Record<string, File>;
  alElegir: (clave: string, archivo: File) => void;
  alQuitarPendiente: (clave: string) => void;
  alQuitarExistente: (d: Documento) => void;
  /** por defecto, las del cliente (Cliente, Casa, Otros); en cada vehículo, las de ese vehículo */
  grupos?: GrupoFotos[];
}

/** Las fotos por partes (Cliente, Vehículo, Casa, Otros), con espacios chicos: cada una se toma y se reemplaza por separado. */
export function FotosPorTipo({ grupos = GRUPOS_FOTOS, ...props }: Props) {
  return (
    <div className={`grid gap-3 ${grupos.length > 1 ? "lg:grid-cols-2" : ""}`}>
      {grupos.map((g) => (
        <section key={g.titulo} className="flex flex-col gap-2 rounded-xl border border-borde p-3" data-grupo={g.titulo}>
          <div>
            <h3 className="leading-tight font-semibold">{g.titulo}</h3>
            <p className="text-xs text-tenue">{g.ayuda}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {g.espacios.map((e) => (
              e.varios ? <EspacioVarios key={e.tipo} tipo={e.tipo} etiqueta={e.etiqueta} {...props} /> : <Espacio key={e.tipo} tipo={e.tipo} etiqueta={e.etiqueta} {...props} />
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
        <Guardada key={d.id} d={d} alQuitar={alQuitarExistente} />
      ))}
      {nueva && <Pendiente archivo={nueva} tipo={tipo} alQuitar={() => alQuitarPendiente(tipo)} />}
      {!tiene && <Agregar tipo={tipo} texto="Foto o PDF" alElegir={(a) => alElegir(tipo, a)} />}
    </div>
  );
}

/** Espacio que acepta varios archivos (Otros): cada uno al costado del anterior y al final "+ Agregar otro". */
function EspacioVarios({ tipo, etiqueta, existentes, pendientes, alElegir, alQuitarPendiente, alQuitarExistente }: Props & { tipo: TipoFoto; etiqueta: string }) {
  const guardadas = existentes.filter((d) => d.tipo === tipo);
  const nuevas = Object.entries(pendientes).filter(([clave]) => tipoDeClave(clave) === tipo);
  const tiene = guardadas.length + nuevas.length > 0;
  return (
    <div className="flex flex-col gap-1" data-espacio={tipo}>
      <p className="truncate text-xs font-semibold text-marca">{etiqueta}</p>
      <div className="flex flex-wrap gap-3">
        {guardadas.map((d) => (
          <div key={d.id} className="w-24 sm:w-28">
            <Guardada d={d} alQuitar={alQuitarExistente} />
          </div>
        ))}
        {nuevas.map(([clave, archivo]) => (
          <div key={clave} className="w-24 sm:w-28">
            <Pendiente archivo={archivo} tipo={tipo} alQuitar={() => alQuitarPendiente(clave)} />
          </div>
        ))}
        <div className="w-24 sm:w-28">
          <Agregar tipo={tipo} texto={tiene ? "Agregar otro" : "Foto o PDF"} alElegir={(a) => alElegir(`${tipo}:${Date.now()}`, a)} />
        </div>
      </div>
    </div>
  );
}

function Guardada({ d, alQuitar }: { d: Documento; alQuitar: (d: Documento) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <Foto bucket="documentos" ruta={d.ruta} titulo={NOMBRE_DOCUMENTO[d.tipo]} className={MINIATURA} />
      <button type="button" onClick={() => alQuitar(d)} className="self-start text-xs font-semibold text-rojo">
        Quitar
      </button>
    </div>
  );
}

function Pendiente({ archivo, tipo, alQuitar }: { archivo: File; tipo: TipoDocumento; alQuitar: () => void }) {
  return (
    <div className="flex flex-col gap-1">
      {esPdf(archivo) ? (
        <MiniaturaPdf fuente={archivo} className={`${MINIATURA} rounded-xl border-2 border-marca`} />
      ) : (
        <VistaPrevia archivo={archivo} alt={NOMBRE_DOCUMENTO[tipo]} className={`${MINIATURA} rounded-xl border-2 border-marca object-cover`} />
      )}
      <span className="flex flex-col text-xs">
        <span className="font-semibold text-marca">Se sube al guardar</span>
        <button type="button" onClick={alQuitar} className="self-start font-semibold text-rojo">
          Quitar
        </button>
      </span>
    </div>
  );
}

function Agregar({ tipo, texto, alElegir }: { tipo: TipoDocumento; texto: string; alElegir: (a: File) => void }) {
  return (
    <label className={`flex ${MINIATURA} cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-marca/60 text-center font-semibold text-marca hover:bg-marca-suave`}>
      <span className="text-2xl leading-none" aria-hidden>
        +
      </span>
      <span className="text-xs">{texto}</span>
      <input
        type="file"
        accept="image/*,application/pdf"
        className="sr-only"
        aria-label={`${texto}: ${NOMBRE_DOCUMENTO[tipo]}`}
        onChange={(ev) => {
          const a = ev.target.files?.[0];
          if (a) alElegir(a);
          ev.target.value = "";
        }}
      />
    </label>
  );
}
