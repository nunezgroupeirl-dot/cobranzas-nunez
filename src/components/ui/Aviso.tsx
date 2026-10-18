import type { ReactNode } from "react";

type Tipo = "exito" | "error" | "info" | "alerta";

const ESTILO: Record<Tipo, string> = {
  exito: "border-verde/40 bg-verde-suave text-verde",
  error: "border-rojo/40 bg-rojo-suave text-rojo",
  info: "border-marca/30 bg-marca-suave text-marca-oscura",
  alerta: "border-amarillo/40 bg-amarillo-suave text-amarillo",
};
const ICONO: Record<Tipo, string> = { exito: "✓", error: "!", info: "i", alerta: "!" };

export function Aviso({ tipo = "info", children, alCerrar }: { tipo?: Tipo; children: ReactNode; alCerrar?: () => void }) {
  return (
    <div role={tipo === "error" ? "alert" : "status"} className={`flex items-start gap-3 rounded-2xl border px-4 py-3 font-medium ${ESTILO[tipo]}`}>
      <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-current/15 text-sm font-bold">{ICONO[tipo]}</span>
      <div className="flex-1 text-tinta">{children}</div>
      {alCerrar && (
        <button onClick={alCerrar} className="text-xl leading-none text-tenue" aria-label="Cerrar aviso">
          ×
        </button>
      )}
    </div>
  );
}
