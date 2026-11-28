import type { Color, Frecuencia } from "@/types/database";
import { textoSemaforo } from "./formato";

const ESTILO: Record<Color, string> = {
  verde: "bg-verde-suave text-verde",
  amarillo: "bg-amarillo-suave text-amarillo",
  rojo: "bg-rojo-suave text-rojo",
};
const PUNTO: Record<Color, string> = { verde: "bg-verde", amarillo: "bg-amarillo", rojo: "bg-rojo" };

/**
 * Etiqueta del semáforo. El color ya viene calculado por la vista; aquí solo se muestra.
 * `semanas` son las cuotas vencidas; con `frecuencia` se dicen en días, semanas, quincenas o meses.
 */
export function EtiquetaSemaforo({
  color,
  semanas = 0,
  frecuencia,
  grande = false,
}: {
  color: Color;
  semanas?: number;
  frecuencia?: Frecuencia | null;
  grande?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap ${ESTILO[color]} ${
        grande ? "px-4 py-1.5 text-base" : "px-2.5 py-0.5 text-sm"
      }`}
    >
      <span className={`size-2.5 rounded-full ${PUNTO[color]}`} aria-hidden />
      {textoSemaforo(color, semanas, frecuencia)}
    </span>
  );
}
