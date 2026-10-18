import { Aviso, Dato, EtiquetaSemaforo, NOMBRE_ESTADO_CONTRATO, Tarjeta, formatoFecha, formatoSoles } from "@/components/ui";
import type { Contrato, Cuota, EstadoCliente, Moto } from "@/types/database";

interface Props {
  contrato: Contrato;
  cuotas: Pick<Cuota, "monto" | "monto_pagado" | "fecha_vencimiento">[];
  estado: EstadoCliente | null;
  moto: Moto | null;
}

/** Cifras del contrato: estado, cuota, deuda, pagado y total. */
export function ResumenContrato({ contrato, cuotas, estado, moto }: Props) {
  let pagado = 0;
  let total = 0;
  for (const c of cuotas) {
    pagado += c.monto_pagado;
    total += c.monto;
  }
  return (
    <Tarjeta>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Dato etiqueta="Estado">
          {estado ? <EtiquetaSemaforo color={estado.color} semanas={estado.semanas_atraso} /> : <span>{NOMBRE_ESTADO_CONTRATO[contrato.estado]}</span>}
        </Dato>
        <Dato etiqueta="Cuota">{formatoSoles(contrato.monto_cuota)}</Dato>
        <Dato etiqueta="Deuda vencida">{formatoSoles(estado?.deuda ?? 0)}</Dato>
        <Dato etiqueta="Pagado">{formatoSoles(pagado)}</Dato>
        <Dato etiqueta="Total contrato">{formatoSoles(total)}</Dato>
        <Dato etiqueta="Moto">{moto ? `${moto.marca} ${moto.tipo} ${moto.color}` : "—"}</Dato>
      </dl>
      <p className="mt-3 text-sm text-tenue">
        Primera cuota {formatoFecha(contrato.fecha_inicio)} · última {formatoFecha(cuotas.at(-1)?.fecha_vencimiento)}
        {contrato.precio_total != null && <> · Precio {formatoSoles(contrato.precio_total)}</>}
        {contrato.inicial != null && <> · Inicial {formatoSoles(contrato.inicial)}</>}
        {contrato.cuotas_pagadas_inicial > 0 && <> · {contrato.cuotas_pagadas_inicial} cuotas pagadas antes del sistema</>}
      </p>
      {contrato.observaciones && <p className="mt-1 text-sm text-tenue">{contrato.observaciones}</p>}
      {contrato.estado === "terminado" && (
        <div className="mt-3">
          <Aviso tipo="exito">Contrato terminado: todas las cuotas están pagadas.</Aviso>
        </div>
      )}
      {contrato.estado === "anulado" && (
        <div className="mt-3">
          <Aviso tipo="alerta">Contrato cerrado{contrato.cerrado_motivo ? `: ${contrato.cerrado_motivo}` : "."} Ya no cuenta como deuda ni aparece en morosos.</Aviso>
        </div>
      )}
    </Tarjeta>
  );
}
