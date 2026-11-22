/** Contrato con varios vehículos: las placas de los demás, al lado de la principal ("+ 7781-SB · EN TRÁMITE"). */
export function OtrasPlacas({ placas, className = "" }: { placas?: string | null; className?: string }) {
  if (!placas?.trim()) return null;
  return (
    <span className={`text-xs font-semibold whitespace-nowrap text-marca ${className}`} title="Otros vehículos del mismo contrato">
      + {placas}
    </span>
  );
}
