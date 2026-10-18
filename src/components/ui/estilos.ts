/** Clases de los botones (las usan Boton, BotonEnlace y el botón del PDF del cronograma). */
export type Variante = "primario" | "secundario" | "peligro" | "fantasma";
export type Tamano = "normal" | "grande" | "chico";

const VARIANTES: Record<Variante, string> = {
  primario: "bg-marca text-white hover:bg-marca-oscura shadow-sm",
  secundario: "bg-superficie text-tinta border border-borde hover:bg-fondo",
  peligro: "bg-rojo text-white hover:brightness-95",
  fantasma: "text-marca hover:bg-marca-suave",
};
const TAMANOS: Record<Tamano, string> = {
  chico: "min-h-10 px-3 text-sm",
  normal: "min-h-12 px-5 text-base",
  grande: "min-h-14 px-6 text-lg",
};

export function clasesBoton(variante: Variante = "primario", tamano: Tamano = "normal", ancho = false) {
  return [
    "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition select-none",
    "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-marca",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    VARIANTES[variante],
    TAMANOS[tamano],
    ancho ? "w-full" : "",
  ].join(" ");
}
