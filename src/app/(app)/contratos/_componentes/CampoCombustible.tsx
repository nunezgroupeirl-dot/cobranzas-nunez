"use client";
import { useState } from "react";
import { Campo, OpcionesBoton } from "@/components/ui";

/** Los combustibles de siempre (como salen en la tarjeta de propiedad). */
export const COMBUSTIBLES = ["GASOLINA", "DIESEL", "BI-COMBUSTIBLE GLP", "BI-COMBUSTIBLE GNV"];
const OTRO = "__otro";

/**
 * Combustible: se elige de los de siempre; "Otro" abre una casilla para escribirlo.
 * Lo que ya estaba escrito y no es de la lista se muestra como "Otro" con su texto.
 */
export function CampoCombustible({
  valor,
  alCambiar,
  etiqueta = "Combustible",
  obligatorio = false,
  error,
}: {
  valor: string;
  alCambiar: (v: string) => void;
  etiqueta?: string;
  obligatorio?: boolean;
  error?: string;
}) {
  const enLista = COMBUSTIBLES.includes(valor.trim().toUpperCase());
  const [otro, setOtro] = useState(!!valor.trim() && !enLista);
  const elegido = otro ? OTRO : enLista ? valor.trim().toUpperCase() : "";
  return (
    <div className="flex flex-col gap-2 sm:col-span-2">
      <OpcionesBoton
        etiqueta={etiqueta}
        opciones={[...COMBUSTIBLES.map((c) => ({ valor: c, texto: c.replace("BI-COMBUSTIBLE", "Bi-combustible").replace("GASOLINA", "Gasolina").replace("DIESEL", "Diésel") })), { valor: OTRO, texto: "Otro" }]}
        valor={elegido}
        alCambiar={(v) => {
          if (v === OTRO) {
            setOtro(true);
            if (enLista) alCambiar("");
          } else {
            setOtro(false);
            alCambiar(v);
          }
        }}
        obligatorio={obligatorio}
        error={otro ? undefined : error}
      />
      {otro && (
        <Campo
          etiqueta="¿Cuál combustible?"
          value={valor}
          onChange={(e) => alCambiar(e.target.value.toUpperCase())}
          placeholder="Ej.: GLP, GNV, ELÉCTRICO"
          maxLength={60}
          obligatorio={obligatorio}
          error={error}
        />
      )}
    </div>
  );
}
