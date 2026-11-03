import Link from "next/link";
import { useConEmpresa } from "@/components/layout/empresa";
import { Boton, BotonEnlace, EtiquetaSemaforo, Placa } from "@/components/ui";
import { FALTANTES, type Faltante, type FilaPendiente } from "./faltantes";

interface Props {
  fila: FilaPendiente;
  resaltado: Faltante | "";
  alEditarMoto: () => void;
}

/** Un contrato con lo que le falta, y un botón para ir a completar cada parte. */
export function TarjetaPendiente({ fila: f, resaltado, alEditarMoto }: Props) {
  const conEmpresa = useConEmpresa();
  const falta = (grupo: string) => f.faltan.some((k) => FALTANTES[k].grupo === grupo && k !== "revisar");
  const contratoSinLlenar = f.faltan.includes("contrato_llenado");

  return (
    <li className="rounded-2xl border border-borde bg-superficie p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={conEmpresa(`/clientes/ficha?id=${f.cliente_id}`)} className="text-lg font-bold hover:text-marca hover:underline">
            {f.cliente}
          </Link>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-tenue">
            <Placa placa={f.placa} tamano="chico" />
            <span>{f.empresa}</span>
          </p>
        </div>
        <EtiquetaSemaforo color={f.color} semanas={f.semanas} />
      </div>

      <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Le falta">
        {f.faltan.map((k) => (
          <li
            key={k}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              k === resaltado ? "bg-marca text-white" : k === "revisar" ? "bg-rojo-suave text-rojo" : "bg-amarillo-suave text-amarillo"
            }`}
          >
            {FALTANTES[k].texto}
          </li>
        ))}
      </ul>
      {f.nota && <p className="mt-2 text-sm text-tenue">📝 {f.nota}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        {falta("cliente") && (
          <BotonEnlace href={`/clientes/editar?id=${f.cliente_id}`} variante="secundario" tamano="chico">
            Completar cliente
          </BotonEnlace>
        )}
        {falta("moto") && f.moto && (
          <Boton variante="secundario" tamano="chico" onClick={alEditarMoto}>
            Completar moto
          </Boton>
        )}
        {contratoSinLlenar && (
          <BotonEnlace href={`/contratos/documento?id=${f.contrato_id}`} variante="secundario" tamano="chico">
            Llenar contrato
          </BotonEnlace>
        )}
        {!contratoSinLlenar && f.faltan.includes("contrato_firmado") && (
          <BotonEnlace href={conEmpresa(`/contratos/ver?id=${f.contrato_id}`)} variante="secundario" tamano="chico">
            Subir contrato firmado
          </BotonEnlace>
        )}
      </div>
    </li>
  );
}
