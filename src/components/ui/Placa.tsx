type Tamano = "chico" | "normal" | "grande";

const TAMANOS: Record<Tamano, string> = {
  chico: "text-sm px-1.5 pt-[3px] pb-px",
  normal: "text-base px-2 pt-1 pb-0.5",
  grande: "text-2xl px-3 pt-1.5 pb-1",
};

/**
 * Placa de la moto con forma de placa: así la reconocen los cobradores de un vistazo.
 * Fondo blanco, borde oscuro y franja superior; letra semi condensada.
 */
export function Placa({ placa, tamano = "normal" }: { placa?: string | null; tamano?: Tamano }) {
  if (!placa) return <span className="text-tenue">—</span>;
  return (
    <span
      className={`num inline-block rounded-[4px] border-[1.5px] border-tinta bg-white font-display leading-none font-bold tracking-[0.06em] whitespace-nowrap text-tinta uppercase shadow-[inset_0_3px_0_var(--color-marca)] ${TAMANOS[tamano]}`}
      aria-label={`Placa ${placa}`}
    >
      {placa}
    </span>
  );
}
