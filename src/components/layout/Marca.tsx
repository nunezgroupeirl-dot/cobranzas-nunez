/** Nombre del sistema: la marca vive en la tipografía, sin logotipo. */
export function Marca({ claro = false, grande = false }: { claro?: boolean; grande?: boolean }) {
  return (
    <span className="flex items-baseline gap-2">
      <span className={`font-display leading-none font-bold ${grande ? "text-5xl md:text-7xl" : "text-[1.75rem]"} ${claro ? "text-white" : "text-tinta"}`}>Núñez</span>
      <span className={`${grande ? "text-lg md:text-xl" : "text-sm"} ${claro ? "text-white/55" : "hidden text-tenue sm:inline"}`}>cobranzas</span>
    </span>
  );
}
