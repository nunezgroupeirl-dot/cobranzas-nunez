import { enlaceMapa, enlaceRuta, mapaIncrustado } from "@/lib/mapa";

/** Mapa del cliente con botones para abrir Google Maps y sacar la ruta. */
export function MapaCliente({ ubicacion, direccion, nombre }: { ubicacion?: string | null; direccion?: string | null; nombre: string }) {
  const mapa = mapaIncrustado(ubicacion, direccion);
  const abrir = enlaceMapa(ubicacion, direccion);
  const ruta = enlaceRuta(ubicacion, direccion);
  if (!abrir) return <p className="text-sm text-tenue">Sin dirección ni ubicación. Agrégalas desde “Editar”.</p>;
  return (
    <div className="flex flex-col gap-2">
      {mapa && (
        // Mapa de Google (otro dominio): necesita sus scripts para funcionar; "allow-same-origin" es el de Google, no el de esta app
        // react-doctor-disable-next-line iframe-missing-sandbox
        <iframe
          title={`Mapa de ${nombre}`}
          src={mapa}
          loading="lazy"
          sandbox="allow-scripts allow-same-origin allow-popups"
          referrerPolicy="no-referrer-when-downgrade"
          className="h-56 w-full rounded-xl border border-borde"
        />
      )}
      <div className="flex flex-wrap gap-2">
        <a href={abrir} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center rounded-xl border border-borde px-3 text-sm font-semibold hover:bg-fondo">
          Abrir en Google Maps ↗
        </a>
        {ruta && (
          <a href={ruta} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center rounded-xl bg-marca px-3 text-sm font-semibold text-white hover:bg-marca-oscura">
            Cómo llegar
          </a>
        )}
      </div>
    </div>
  );
}
