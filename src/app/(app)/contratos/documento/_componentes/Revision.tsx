"use client";
import { etiquetaCampo, fechaFin, problemaCampo, type CamposContrato } from "@/components/reportes/ContratoImpreso";
import { Tarjeta, formatoFecha } from "@/components/ui";
import { PASOS } from "./pasos";

const mostrar = (f: CamposContrato, k: keyof CamposContrato) => {
  const x = String(f[k] ?? "").trim();
  if (k === "inicio" || k === "fecha_firma") return formatoFecha(x);
  if (k === "doc_tipo") return x === "CE" ? "Carné de Extranjería" : "DNI";
  if (k === "renta" || k === "inicial") return `S/ ${Number(x).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return x;
};

/** Paso 5: todo lo que saldrá en el contrato, para revisarlo antes de imprimir. */
export function Revision({ valores: f, alEditar }: { valores: CamposContrato; alEditar: (paso: number) => void }) {
  return (
    <Tarjeta titulo="5. Revisa y descarga">
      <p className="mb-4 text-sm text-tenue">
        Así saldrá el contrato. Si algo está mal, toca <b>Corregir</b>. En el papel solo quedarán en blanco <b>las firmas y las huellas</b>.
      </p>
      <div className="flex flex-col gap-4">
        {PASOS.map((p, i) => (
          <section key={p.titulo} className="rounded-xl border border-borde p-3">
            <header className="mb-2 flex items-center justify-between gap-2">
              <h3 className="font-bold">{p.titulo}</h3>
              <button type="button" onClick={() => alEditar(i)} className="min-h-10 rounded-lg px-3 text-sm font-semibold text-marca hover:bg-marca-suave">
                Corregir
              </button>
            </header>
            <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
              {p.campos.map((c) => {
                const problema = problemaCampo(f, c.clave);
                return (
                  <div key={c.clave} className={c.ancho ? "sm:col-span-2" : ""}>
                    <dt className="text-tenue">{etiquetaCampo(c.clave)}</dt>
                    <dd className={problema ? "font-semibold text-rojo" : "font-semibold"}>{problema ?? mostrar(f, c.clave)}</dd>
                  </div>
                );
              })}
              {i === 3 && fechaFin(f) && (
                <div>
                  <dt className="text-tenue">Termina el</dt>
                  <dd className="font-semibold">{formatoFecha(fechaFin(f))}</dd>
                </div>
              )}
            </dl>
          </section>
        ))}
      </div>
    </Tarjeta>
  );
}
