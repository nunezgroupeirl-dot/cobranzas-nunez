"use client";
import { Campo } from "@/components/ui";

import { CAMPOS_FICHA, type FichaTecnica } from "./fichaTecnica";

const ETIQUETAS: Record<keyof FichaTecnica, { texto: string; ejemplo: string }> = {
  modelo: { texto: "Modelo", ejemplo: "TVS KING LS+ DP IT" },
  anio: { texto: "Año de modelo", ejemplo: "2027" },
  clase: { texto: "Clase", ejemplo: "L5" },
  combustible: { texto: "Combustible", ejemplo: "BI-COMBUSTIBLE GLP" },
  serie: { texto: "N.º de serie", ejemplo: "MD6M14LA3V4AA1841" },
  motor: { texto: "N.º de motor", ejemplo: "AK4AV41A6496" },
  carroceria: { texto: "Carrocería", ejemplo: "TRIMOTO PASAJEROS" },
};

/** Datos de la tarjeta de propiedad que salen en el contrato impreso. Todos opcionales. */
export function CamposFichaTecnica({ valores, alCambiar }: { valores: FichaTecnica; alCambiar: (k: keyof FichaTecnica, v: string) => void }) {
  const completos = CAMPOS_FICHA.filter((k) => valores[k].trim()).length;
  return (
    <details className="rounded-xl border border-borde p-3" open={completos > 0}>
      <summary className="cursor-pointer font-semibold">
        Datos para el contrato <span className="font-normal text-tenue">(tarjeta de propiedad · {completos} de {CAMPOS_FICHA.length})</span>
      </summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {CAMPOS_FICHA.map((k) => (
          <Campo
            key={k}
            etiqueta={ETIQUETAS[k].texto}
            placeholder={ETIQUETAS[k].ejemplo}
            value={valores[k]}
            inputMode={k === "anio" ? "numeric" : undefined}
            maxLength={k === "anio" ? 4 : 60}
            onChange={(e) => alCambiar(k, k === "anio" ? e.target.value.replace(/\D/g, "") : e.target.value.toUpperCase())}
          />
        ))}
      </div>
    </details>
  );
}
