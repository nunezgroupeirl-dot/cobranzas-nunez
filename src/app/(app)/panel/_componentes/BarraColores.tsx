import Link from "next/link";

const TRAMOS = [
  { clave: "verde", clase: "bg-verde", texto: "Al día" },
  { clave: "amarillo", clase: "bg-amarillo", texto: "1 a 3 semanas" },
  { clave: "rojo", clase: "bg-rojo", texto: "4 o más semanas" },
] as const;

/**
 * Reparto del semáforo. Con `enlace`, cada tramo lleva a la lista de clientes
 * filtrada por ese color (y por la empresa, si se indica).
 */
export function BarraColores({ v, a, r, enlace, empresa, alto = "h-9" }: { v: number; a: number; r: number; enlace?: boolean; empresa?: string | null; alto?: string }) {
  const cuenta = { verde: v, amarillo: a, rojo: r };
  const total = v + a + r || 1;
  return (
    <div className={`flex w-full overflow-hidden rounded-lg bg-fondo ${alto}`}>
      {TRAMOS.map((t) => {
        const n = cuenta[t.clave];
        if (n === 0) return null;
        const estilo = { width: `${(n / total) * 100}%` };
        const clase = `${t.clase} num flex min-w-7 items-center justify-center text-sm font-bold text-white`;
        if (!enlace) {
          return (
            <span key={t.clave} className={clase} style={estilo} title={`${t.texto}: ${n}`}>
              {n}
            </span>
          );
        }
        const href = `/clientes?color=${t.clave}${empresa ? `&empresa=${empresa}` : ""}`;
        return (
          <Link key={t.clave} href={href} className={`${clase} hover:brightness-110`} style={estilo} aria-label={`${t.texto}: ${n} clientes. Ver lista`}>
            {n}
          </Link>
        );
      })}
    </div>
  );
}
