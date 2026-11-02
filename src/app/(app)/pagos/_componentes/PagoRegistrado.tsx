import Link from "next/link";
import { useSesion } from "@/components/layout/Sesion";
import { Boton, Tarjeta, formatoSoles } from "@/components/ui";

interface Props {
  monto: number;
  cuotasCubiertas: number[];
  cliente: string;
  clienteId: string;
  alOtroPago: () => void;
  alOtroCliente: () => void;
}

/** Confirmación después de registrar un pago. */
export function PagoRegistrado({ monto, cuotasCubiertas, cliente, clienteId, alOtroPago, alOtroCliente }: Props) {
  const { esAdmin } = useSesion();
  const detalle =
    cuotasCubiertas.length > 0
      ? `Cubre ${cuotasCubiertas.length === 1 ? "la cuota" : "las cuotas"} N.º ${cuotasCubiertas.join(", ")}.`
      : "Quedó a cuenta de la cuota pendiente más antigua.";
  return (
    <div className="mx-auto max-w-xl">
      <Tarjeta>
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <span className="grid size-16 place-items-center rounded-full bg-verde text-3xl text-white">✓</span>
          <h1 className="text-2xl font-extrabold">Pago registrado</h1>
          <p className="text-lg">
            {formatoSoles(monto)} de <b>{cliente}</b>
          </p>
          <p className="text-tenue">{detalle}</p>
          <div className="mt-2 flex w-full flex-col gap-2 sm:flex-row">
            <Boton variante="secundario" tamano="grande" ancho onClick={alOtroPago}>
              Otro pago de este cliente
            </Boton>
            <Boton tamano="grande" ancho onClick={alOtroCliente}>
              Pago de otro cliente
            </Boton>
          </div>
          {esAdmin && (
            <Link href={`/clientes/ficha?id=${clienteId}`} className="font-semibold text-marca">
              Ver ficha del cliente
            </Link>
          )}
        </div>
      </Tarjeta>
    </div>
  );
}
