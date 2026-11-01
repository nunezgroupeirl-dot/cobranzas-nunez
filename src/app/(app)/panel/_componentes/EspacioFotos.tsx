/** Plan gratis de Supabase Storage. */
const LIMITE_BYTES = 1024 ** 3;
const AVISO = 0.8;

const gb = (bytes: number) => (bytes / 1024 ** 3).toLocaleString("es-PE", { maximumFractionDigits: 2, minimumFractionDigits: 2 });

/**
 * Medidor del espacio de fotos. Si se llena, ya no se pueden subir fotos y por lo tanto
 * tampoco registrar pagos: avisa desde el 80 % para pasar las fotos a Cloudflare R2.
 */
export function EspacioFotos({ bytes, archivos }: { bytes: number; archivos: number }) {
  const uso = Math.min(1, bytes / LIMITE_BYTES);
  const alerta = uso >= AVISO;
  return (
    <section className={`mt-4 rounded-2xl border p-4 sm:p-5 ${alerta ? "border-rojo bg-rojo-suave" : "border-borde bg-superficie"}`} aria-label="Espacio para fotos">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold">Espacio para fotos</p>
        <p className="num text-sm text-tenue">
          <b className={alerta ? "text-rojo" : "text-tinta"}>{gb(bytes)} GB</b> de 1 GB · {archivos.toLocaleString("es-PE")} fotos
        </p>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-fondo">
        <div className={`h-full rounded-full ${alerta ? "bg-rojo" : "bg-marca"}`} style={{ width: `${Math.max(uso * 100, 1)}%` }} />
      </div>
      {alerta && (
        <p className="mt-2 text-sm font-semibold text-rojo">
          Queda poco espacio. Cuando se llene no se podrán registrar pagos con foto: hay que activar el almacenamiento de fotos en Cloudflare R2.
        </p>
      )}
    </section>
  );
}
