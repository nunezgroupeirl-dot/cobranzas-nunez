import { EtiquetaSemaforo, Tarjeta, formatoFecha, formatoSoles } from "@/components/ui";
import type { EstadoCliente } from "@/types/database";

/** Tarjeta lateral con el cliente elegido y su situación. */
export function ResumenCliente({ estado, alCambiar }: { estado: EstadoCliente; alCambiar: () => void }) {
  return (
    <Tarjeta>
      <p className="text-sm text-tenue">Cliente</p>
      <p className="text-xl font-extrabold">{estado.cliente}</p>
      <p className="text-tenue">
        <span className="font-mono font-semibold whitespace-nowrap text-tinta">{estado.placa}</span> · {estado.empresa}
      </p>
      <div className="my-3">
        <EtiquetaSemaforo color={estado.color} semanas={estado.semanas_atraso} grande />
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt className="text-tenue">Deuda vencida</dt>
        <dd className="num text-right font-bold">{formatoSoles(estado.deuda)}</dd>
        <dt className="text-tenue">Cuota</dt>
        <dd className="num text-right font-bold">{formatoSoles(estado.cuota)}</dd>
        <dt className="text-tenue">Próxima</dt>
        <dd className="text-right">{formatoFecha(estado.proxima_cuota)}</dd>
      </dl>
      <button type="button" onClick={alCambiar} className="mt-3 text-sm font-semibold text-marca">
        Cambiar cliente
      </button>
    </Tarjeta>
  );
}
