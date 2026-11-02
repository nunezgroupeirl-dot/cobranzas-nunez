/** Nombre del sistema: la marca vive en la tipografía, sin logotipo. */
export const NOMBRE_NEGOCIO = "Inversiones Núñez & Asociados";

export function Marca({ claro = false, grande = false, chico = false }: { claro?: boolean; grande?: boolean; chico?: boolean }) {
  return (
    <span className="flex flex-col leading-none" aria-label={NOMBRE_NEGOCIO}>
      <span
        className={`font-semibold tracking-[0.18em] uppercase ${grande ? "text-sm md:text-base" : chico ? "text-[0.55rem]" : "text-[0.65rem]"} ${claro ? "text-white/60" : "text-tenue"}`}
        aria-hidden
      >
        Inversiones
      </span>
      <span
        className={`font-display font-bold whitespace-nowrap ${grande ? "mt-1 text-4xl md:text-6xl" : chico ? "mt-0.5 text-[1.1rem]" : "mt-0.5 text-[1.45rem]"} ${claro ? "text-white" : "text-tinta"}`}
        aria-hidden
      >
        Núñez <span className={claro ? "text-white/70" : "text-marca"}>&amp;</span> Asociados
      </span>
    </span>
  );
}
