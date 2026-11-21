"use client";
import { useEffect, useRef } from "react";
import { Boton, NOMBRE_DOCUMENTO, VistaPrevia } from "@/components/ui";
import { esPdf } from "@/lib/pdf";
import { tipoDeClave } from "./secciones";

export type EstadoFoto = "espera" | "subiendo" | "listo" | "error";
export interface FotoEnCola {
  clave: string;
  archivo: File;
  estado: EstadoFoto;
}

/** 0 datos del cliente · 1 vehículos y cronograma · 2 fotos · 3 comprobantes de cuotas pagadas · 4 listo (abre el contrato o la ficha) */
export type PasoGuardado = 0 | 1 | 2 | 3 | 4;

export interface Progreso {
  nombre: string;
  editando: boolean;
  conVehiculo: boolean;
  destino: "contrato" | "ficha";
  paso: PasoGuardado;
  fotos: FotoEnCola[];
  /** comprobantes de cuotas ya pagadas que se registran como pagos anteriores */
  comprobantes: { total: number; listos: number };
  /** si algo falló: el mensaje y en qué paso */
  error: string | null;
}

interface Props {
  progreso: Progreso;
  alReintentar: () => void;
  alCerrar: () => void;
}

/**
 * Ventana que acompaña el guardado de un cliente: cada paso con su check, las fotos subiendo una por una
 * con su contador y, si algo falla (p. ej. la señal), cuál fue y el botón para reintentar sin perder nada.
 */
export function ProgresoGuardado({ progreso: p, alReintentar, alCerrar }: Props) {
  const caja = useRef<HTMLDivElement>(null);
  useEffect(() => caja.current?.focus(), []);

  const listas = p.fotos.filter((f) => f.estado === "listo").length;
  const fallidas = p.fotos.filter((f) => f.estado === "error").length;
  const terminado = p.paso === 4 && !p.error;
  const pasos: { paso: PasoGuardado; texto: string; ver: boolean }[] = [
    { paso: 0, texto: "Datos del cliente", ver: true },
    { paso: 1, texto: "Vehículo y cronograma", ver: p.conVehiculo },
    { paso: 2, texto: "Fotos y documentos", ver: p.fotos.length > 0 },
    { paso: 3, texto: "Comprobantes de cuotas pagadas", ver: p.comprobantes.total > 0 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 motion-safe:animate-[aparecer_150ms_ease-out]">
      <div
        ref={caja}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="progreso-titulo"
        className="w-full max-w-md rounded-3xl bg-superficie p-6 shadow-xl outline-none"
      >
        {terminado ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center" role="status">
            <span className="flex size-16 items-center justify-center rounded-full bg-verde-suave text-verde motion-safe:animate-[aparecer_250ms_ease-out]">
              <Check className="size-9" />
            </span>
            <p id="progreso-titulo" className="text-xl font-bold">
              {p.editando ? "Cambios guardados" : "Cliente guardado"}
            </p>
            <p className="text-tenue">{p.destino === "contrato" ? "Abriendo el contrato…" : "Abriendo la ficha…"}</p>
          </div>
        ) : (
          <>
            <p id="progreso-titulo" className="text-xl font-bold">
              {p.error ? "No se pudo terminar de guardar" : `Guardando a ${p.nombre}`}
            </p>
            <p className="mt-1 text-sm text-tenue">
              {p.error ? "Lo que ya se guardó no se pierde. Revisa tu internet y reintenta." : "No cierres esta pantalla. Tarda unos segundos."}
            </p>

            <ol className="mt-5 flex flex-col gap-4" aria-live="polite">
              {pasos
                .filter((x) => x.ver)
                .map((x) => {
                  const hecho = p.paso > x.paso;
                  const actual = p.paso === x.paso;
                  const fallo = actual && !!p.error;
                  return (
                    <li key={x.paso} className="flex items-start gap-3">
                      <Indicador hecho={hecho} actual={actual && !fallo} fallo={fallo} />
                      <div className="min-w-0 flex-1 pt-0.5">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className={`font-semibold ${!hecho && !actual ? "text-tenue" : ""}`}>{x.texto}</span>
                          {x.paso === 2 && p.fotos.length > 0 && (
                            <span className="num text-sm text-tenue">
                              {listas} de {p.fotos.length}
                            </span>
                          )}
                          {x.paso === 3 && (
                            <span className="num text-sm text-tenue">
                              {p.comprobantes.listos} de {p.comprobantes.total}
                            </span>
                          )}
                        </div>
                        {x.paso === 2 && p.fotos.length > 0 && (actual || hecho) && (
                          <>
                            <div className="mt-2 h-2 overflow-hidden rounded-full bg-borde/60" aria-hidden>
                              <div
                                className={`h-full rounded-full transition-[width] duration-300 ${fallidas ? "bg-rojo" : "bg-marca"}`}
                                style={{ width: `${Math.round((listas / p.fotos.length) * 100)}%` }}
                              />
                            </div>
                            <ul className="mt-3 flex flex-wrap gap-1.5">
                              {p.fotos.map((f) => (
                                <MiniFoto key={f.clave} foto={f} />
                              ))}
                            </ul>
                          </>
                        )}
                        {fallo && <p className="mt-1 text-sm font-semibold text-rojo">{p.error}</p>}
                      </div>
                    </li>
                  );
                })}
              <li className="flex items-center gap-3">
                <Indicador hecho={false} actual={false} fallo={false} numero={pasos.filter((x) => x.ver).length + 1} />
                <span className="font-semibold text-tenue">{p.destino === "contrato" ? "Abrir el contrato" : "Abrir la ficha"}</span>
              </li>
            </ol>

            {p.error && (
              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <Boton variante="secundario" onClick={alCerrar}>
                  Volver al formulario
                </Boton>
                <Boton onClick={alReintentar}>Reintentar</Boton>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Indicador({ hecho, actual, fallo, numero }: { hecho: boolean; actual: boolean; fallo: boolean; numero?: number }) {
  if (hecho)
    return (
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-verde-suave text-verde">
        <Check className="size-4" />
      </span>
    );
  if (fallo)
    return (
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-rojo-suave font-bold text-rojo" aria-label="Falló">
        !
      </span>
    );
  if (actual)
    return (
      <span className="flex size-7 shrink-0 items-center justify-center" aria-label="En curso">
        <span className="size-6 animate-spin rounded-full border-[3px] border-marca border-r-transparent motion-reduce:animate-none" />
      </span>
    );
  return <span className="flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-borde text-sm text-tenue">{numero ?? ""}</span>;
}

function MiniFoto({ foto }: { foto: FotoEnCola }) {
  const nombre = NOMBRE_DOCUMENTO[tipoDeClave(foto.clave)];
  const marco =
    foto.estado === "listo" ? "border-verde" : foto.estado === "error" ? "border-rojo" : foto.estado === "subiendo" ? "border-marca" : "border-borde opacity-60";
  return (
    <li className={`relative size-10 overflow-hidden rounded-lg border-2 ${marco}`} title={nombre}>
      {esPdf(foto.archivo) ? (
        <span className="flex size-full items-center justify-center bg-marca-suave text-[10px] font-bold text-marca">PDF</span>
      ) : (
        <VistaPrevia archivo={foto.archivo} alt={nombre} className="size-full object-cover" />
      )}
      {foto.estado !== "espera" && (
        <span
          className={`absolute inset-0 flex items-center justify-center ${foto.estado === "listo" ? "bg-verde/55 text-white" : foto.estado === "error" ? "bg-rojo/65 font-bold text-white" : "bg-black/35"}`}
        >
          {foto.estado === "listo" ? (
            <Check className="size-5" />
          ) : foto.estado === "error" ? (
            "!"
          ) : (
            <span className="size-4 animate-spin rounded-full border-2 border-white border-r-transparent motion-reduce:animate-none" />
          )}
        </span>
      )}
      <span className="sr-only">
        {nombre}: {foto.estado === "listo" ? "subida" : foto.estado === "error" ? "falló" : foto.estado === "subiendo" ? "subiendo" : "en espera"}
      </span>
    </li>
  );
}

function Check({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}
