"use client";
import { useMemo, useState } from "react";
import { filtrarPorEmpresa, useEmpresa } from "@/components/layout/empresa";
import { EtiquetaSemaforo, TituloPagina, Placa, textoDocumento } from "@/components/ui";
import type { EstadoCliente } from "@/types/database";
import { claveBusqueda, coincide, normalizar } from "../../clientes/_componentes/buscar";

/** Paso 1 de Registrar pago: buscar al cliente por nombre, DNI o placa. */
export function BuscarContrato({
  estados,
  vehiculos,
  alElegir,
}: {
  estados: EstadoCliente[];
  /** con varios vehículos: "Vehículo 1, 2…" y su tipo/marca, para no confundirlos */
  vehiculos?: Map<string, { numero: number; total: number; descripcion: string }>;
  alElegir: (contratoId: string) => void;
}) {
  const empresa = useEmpresa();
  const [busca, setBusca] = useState("");

  // Texto de búsqueda de cada cliente, normalizado una sola vez (no en cada tecla)
  const indice = useMemo(
    () => filtrarPorEmpresa(estados, empresa).map((e) => ({ estado: e, clave: claveBusqueda(e.cliente, e.dni, e.placa) })),
    [estados, empresa],
  );
  const coincidencias = useMemo(() => {
    const q = normalizar(busca);
    if (!q) return [];
    const encontrados: EstadoCliente[] = [];
    for (const { estado, clave } of indice) {
      if (coincide(clave, q)) encontrados.push(estado);
      if (encontrados.length === 8) break;
    }
    return encontrados;
  }, [busca, indice]);

  return (
    <>
      <TituloPagina titulo="Registrar pago" sub="Busca al cliente por nombre, DNI o placa." />
      <input
        type="search"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Nombre, DNI o placa"
        aria-label="Buscar cliente"
        className="mb-3 min-h-14 w-full rounded-2xl border border-borde bg-superficie px-5 text-lg focus:border-marca focus:ring-3 focus:ring-marca/20 focus:outline-none"
      />
      <ul className="flex flex-col gap-2">
        {coincidencias.map((e) => (
          <li key={e.contrato_id}>
            <button
              type="button"
              onClick={() => alElegir(e.contrato_id)}
              className="flex min-h-16 w-full items-center justify-between gap-3 rounded-2xl border border-borde bg-superficie px-4 text-left hover:border-marca"
            >
              <span>
                <span className="block font-bold">{e.cliente}</span>
                <span className="text-sm text-tenue">
                  {(vehiculos?.get(e.contrato_id)?.total ?? 1) > 1 && (
                    <b className="text-marca">
                      Vehículo {vehiculos?.get(e.contrato_id)?.numero}
                      {vehiculos?.get(e.contrato_id)?.descripcion ? ` (${vehiculos.get(e.contrato_id)?.descripcion})` : ""} ·{" "}
                    </b>
                  )}
                  <Placa placa={e.placa} tamano="chico" /> · {textoDocumento(e.dni, e.tipo_doc)}
                </span>
              </span>
              <EtiquetaSemaforo color={e.color} semanas={e.semanas_atraso} />
            </button>
          </li>
        ))}
        {busca && coincidencias.length === 0 && <p className="p-4 text-center text-tenue">No se encontró ningún cliente con contrato activo.</p>}
      </ul>
    </>
  );
}
