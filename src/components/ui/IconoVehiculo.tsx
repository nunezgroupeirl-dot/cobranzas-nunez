/**
 * Ícono del vehículo que el cliente tiene en su poder, según el tipo de la moto
 * (Mototaxi, Lineal, Scooter, Trimoto u Otro). Trazos simples para reconocerlo de un vistazo.
 */

// Trazos en una caja de 32 × 24
const TRAZOS: Record<string, string> = {
  // cabina con techo y asiento atrás, rueda delantera
  Mototaxi: "M12 17V6.5a2.5 2.5 0 0 1 2.5-2.5h11A2.5 2.5 0 0 1 28 6.5V17M12 10h16M5 17l3-6h4M8 11V8.5M9.5 17h12",
  // moto lineal: tanque, asiento y manubrio
  Lineal: "M6 17l5-7h7l4 7M11 10 9 6H6.5M18 10l3-4h3M12 10l1.5-2h4.5M9.5 17h7",
  // scooter: plataforma baja para los pies
  Scooter: "M6 17h12a5 5 0 0 1 5-5h-2.5L18 4h-3M10 17c0-3 1.5-5 4-5h4.5M21 12l2.5 5",
  // trimoto de carga: tolva atrás
  Trimoto: "M13 9h15v6H13zM5 17l3-7h5M8 10V7.5M9.5 17h12M13 15v2",
  // otro: vehículo genérico
  Otro: "M5 17V11l3-5h13l4 5h2v6M5 11h22M9.5 17h12",
};

// ruedas de cada tipo: [x, y, radio]
const RUEDAS: Record<string, [number, number, number][]> = {
  Mototaxi: [[5.5, 18, 2.5], [24.5, 18, 2.5]],
  Lineal: [[6, 17, 3.5], [24, 17, 3.5]],
  Scooter: [[6, 17.5, 3], [24, 17.5, 3]],
  Trimoto: [[5.5, 18, 2.5], [24.5, 18, 2.5]],
  Otro: [[8, 18, 2.5], [23, 18, 2.5]],
};

const tipoConocido = (tipo?: string | null) => (tipo && tipo in TRAZOS ? tipo : "Otro");

export function IconoVehiculo({ tipo, className = "h-6 w-8", conTexto = false }: { tipo?: string | null; className?: string; conTexto?: boolean }) {
  const t = tipoConocido(tipo);
  const nombre = tipo || "Vehículo";
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-marca" title={nombre}>
      <svg viewBox="0 0 32 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} role="img" aria-label={nombre}>
        <path d={TRAZOS[t]} />
        {RUEDAS[t].map(([x, y, r]) => (
          <circle key={x} cx={x} cy={y} r={r} />
        ))}
      </svg>
      {conTexto && <span className="text-sm font-semibold text-tinta">{nombre}</span>}
    </span>
  );
}
