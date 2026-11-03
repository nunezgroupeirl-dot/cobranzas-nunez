/** Nombre del sistema con el logo del grupo (león dorado). */
export const NOMBRE_NEGOCIO = "Inversiones Núñez & Asociados";

export function Marca({ claro = false, grande = false, chico = false }: { claro?: boolean; grande?: boolean; chico?: boolean }) {
  const lado = grande ? "size-20 md:size-24" : chico ? "size-9" : "size-11";
  return (
    <span className={`flex items-center ${grande ? "gap-4" : "gap-2.5"}`}>
      <img src="/marca/logo-256.webp" alt={chico ? NOMBRE_NEGOCIO : ""} width={96} height={96} className={`${lado} shrink-0 rounded-full`} />
      {/* en celulares angostos solo el logo, para que entren el buscador y el filtro */}
      <span className={`flex-col leading-none ${chico ? "hidden min-[400px]:flex" : "flex"}`} aria-label={NOMBRE_NEGOCIO}>
        <span
          className={`font-semibold tracking-[0.18em] uppercase ${grande ? "text-sm md:text-base" : chico ? "text-[0.55rem]" : "text-[0.62rem]"} ${claro ? "text-oro" : "text-tenue"}`}
          aria-hidden
        >
          Inversiones
        </span>
        <span
          className={`font-display font-bold whitespace-nowrap ${grande ? "mt-1 text-4xl md:text-6xl" : chico ? "mt-0.5 text-[1.05rem]" : "mt-0.5 text-[1.3rem]"} ${claro ? "text-white" : "text-tinta"}`}
          aria-hidden
        >
          Núñez <span className={claro ? "text-oro" : "text-marca"}>&amp;</span> Asociados
        </span>
      </span>
    </span>
  );
}
