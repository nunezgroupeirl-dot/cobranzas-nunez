import { Marca } from "@/components/layout/Marca";

const PUNTOS = [
  { icono: "M3 6h18v12H3zM3 10h18M7 15h3", titulo: "Pagos con su comprobante", texto: "Yape, Plin, banco o efectivo, cada uno con su foto." },
  { icono: "M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5", titulo: "¿Quién no paga?, con mapa", texto: "El semáforo de atrasos y cómo llegar a cada cliente." },
  { icono: "M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M9 14l2 2 4-4", titulo: "Contratos listos para firmar", texto: "Se llenan en la página y salen en PDF con su cronograma." },
];

const EMPRESAS = ["Inversiones Anne", "Grupo Comercial Romi", "Inversiones Comerciales Yarhua", "Nuñez Group"];

/** Columna oscura del ingreso: la marca, lo que hace el sistema y las 4 empresas. */
export function PanelMarca() {
  return (
    <section className="relative isolate flex flex-col overflow-hidden bg-tinta px-6 py-8 text-white md:px-12 md:py-12">
      {/* fondo: brillo dorado, líneas finas y el león de marca de agua */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_20%_15%,rgba(212,175,55,0.18),transparent_55%),radial-gradient(ellipse_at_90%_100%,rgba(138,101,20,0.25),transparent_50%)]" />
      <div aria-hidden className="absolute inset-0 -z-10 opacity-[0.05] bg-[repeating-linear-gradient(135deg,#d4af37_0_1px,transparent_1px_22px)]" />
      <img aria-hidden src="/marca/logo-512.webp" alt="" width={512} height={512} className="absolute -right-28 -bottom-40 -z-10 hidden size-[30rem] rounded-full opacity-[0.07] md:block" />

      <h1>
        <span className="hidden xl:block">
          <Marca claro grande />
        </span>
        <span className="xl:hidden">
          <Marca claro />
        </span>
      </h1>

      <div className="mt-8 md:my-auto md:py-10">
        <p className="font-display text-3xl leading-tight font-bold md:text-5xl">
          Cobranzas claras,
          <br />
          <span className="text-oro">clientes al día.</span>
        </p>
        <p className="mt-4 max-w-md text-white/70 md:text-lg">Clientes, contratos y pagos de motos y mototaxis de las cuatro empresas, en un solo lugar.</p>

        <ul className="mt-8 hidden max-w-md flex-col gap-4 md:flex">
          {PUNTOS.map((p) => (
            <li key={p.titulo} className="flex items-start gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-oro/40 bg-oro/10 text-oro">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden>
                  <path d={p.icono} />
                </svg>
              </span>
              <span>
                <span className="block font-semibold">{p.titulo}</span>
                <span className="block text-sm text-white/60">{p.texto}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <footer className="mt-8 hidden md:block">
        <p className="mb-2 text-xs font-semibold tracking-[0.2em] text-white/50 uppercase">Una plataforma para</p>
        <ul className="flex flex-wrap gap-2">
          {EMPRESAS.map((e) => (
            <li key={e} className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-sm text-white/80">
              {e}
            </li>
          ))}
        </ul>
      </footer>
    </section>
  );
}
