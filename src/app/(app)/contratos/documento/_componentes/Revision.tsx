"use client";
import type { ReactNode } from "react";
import { Tarjeta, formatoFecha } from "@/components/ui";
import type { Paso } from "./pasos";

/** Cómo se lee un dato en la revisión (fechas y montos en formato del Perú). */
function textoDato(k: string, x: string): string {
  if (!x.trim()) return "—";
  if (k === "inicio" || k === "fecha_firma") return formatoFecha(x);
  if (k === "doc_tipo") return x === "CE" ? "Carné de Extranjería" : "DNI";
  if (k === "renta" || k === "inicial" || k === "precio") return `S/ ${Number(x).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return x;
}

interface Props<K extends string> {
  pasos: Paso<K>[];
  valores: Record<K, string>;
  etiqueta: (k: K) => string;
  problema: (k: K) => string | null;
  alEditar: (paso: number) => void;
  /** datos calculados que se muestran al final de cada paso (ej.: "Termina el") */
  extra?: (paso: number) => ReactNode;
  titulo?: string;
}

/** Último paso: todo lo que saldrá en el contrato, para revisarlo antes de imprimir. */
export function Revision<K extends string>({ pasos, valores, etiqueta, problema, alEditar, extra, titulo = "Revisa y descarga" }: Props<K>) {
  return (
    <Tarjeta titulo={`${pasos.length + 1}. ${titulo}`}>
      <p className="mb-4 text-sm text-tenue">
        Así saldrá el contrato. Si algo está mal, toca <b>Corregir</b>. En el papel solo quedarán en blanco <b>las firmas y las huellas</b>.
      </p>
      <div className="flex flex-col gap-4">
        {pasos.map((p, i) => (
          <section key={p.titulo} className="rounded-xl border border-borde p-3">
            <header className="mb-2 flex items-center justify-between gap-2">
              <h3 className="font-bold">{p.titulo}</h3>
              <button type="button" onClick={() => alEditar(i)} className="min-h-10 rounded-lg px-3 text-sm font-semibold text-marca hover:bg-marca-suave">
                Corregir
              </button>
            </header>
            <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
              {p.campos.map((c) => {
                const mal = problema(c.clave);
                return (
                  <div key={c.clave} className={c.ancho ? "sm:col-span-2" : ""}>
                    <dt className="text-tenue">{etiqueta(c.clave)}</dt>
                    <dd className={mal ? "font-semibold text-rojo" : "font-semibold"}>{mal ?? textoDato(c.clave, String(valores[c.clave] ?? ""))}</dd>
                  </div>
                );
              })}
              {extra?.(i)}
            </dl>
          </section>
        ))}
      </div>
    </Tarjeta>
  );
}
