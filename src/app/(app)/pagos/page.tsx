"use client";
import { useMemo, useState } from "react";
import { SoloAdmin, useSesion } from "@/components/layout/Sesion";
import { useEmpresa } from "@/components/layout/empresa";
import { Aviso, Campo, Cargando, TituloPagina, formatoSoles, hoyLima, sumarDias, useCarga } from "@/components/ui";
import { HistorialPagos } from "./_componentes/HistorialPagos";

function Historial() {
  const { datos } = useSesion();
  const empresa = useEmpresa();
  const [desde, setDesde] = useState(() => sumarDias(hoyLima(), -6));
  const [hasta, setHasta] = useState(hoyLima);
  const [verAnulados, setVerAnulados] = useState(true);

  const { datos: info, cargando, error, recargar } = useCarga(async () => {
    const [pagos, contratos, clientes, motos, cuentas] = await Promise.all([
      datos.pagos({ desde, hasta }),
      datos.contratos(),
      datos.clientes(),
      datos.motos(),
      datos.cuentas(),
    ]);
    return { pagos, contratos, clientes, motos, cuentas };
  }, [datos, desde, hasta]);

  const { lista, etiquetas, total } = useMemo(() => {
    const etiquetas = new Map<string, string>();
    const empresaDe = new Map<string, string>();
    info?.contratos.forEach((c) => {
      const cli = info.clientes.find((x) => x.id === c.cliente_id)?.nombres ?? "—";
      const placa = info.motos.find((m) => m.id === c.moto_id)?.placa ?? "";
      etiquetas.set(c.id, `${cli} · ${placa}`);
      empresaDe.set(c.id, c.empresa_id);
    });
    const lista = (info?.pagos ?? []).filter((p) => (verAnulados || !p.anulado) && (!empresa || empresaDe.get(p.contrato_id) === empresa));
    const total = lista.filter((p) => !p.anulado).reduce((s, p) => s + p.monto, 0);
    return { lista, etiquetas, total };
  }, [info, empresa, verAnulados]);

  return (
    <>
      <TituloPagina
        titulo="Historial de pagos"
        sub={info ? `Todo lo cobrado entre las fechas elegidas: ${lista.filter((p) => !p.anulado).length} pagos válidos · ${formatoSoles(total)}` : undefined}
      />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Campo etiqueta="Desde" type="date" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} />
        <Campo etiqueta="Hasta" type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} />
        <label className="flex min-h-12 items-center gap-2 font-semibold">
          <input type="checkbox" checked={verAnulados} onChange={(e) => setVerAnulados(e.target.checked)} className="size-5 accent-marca" />
          Mostrar anulados
        </label>
      </div>
      {error && <Aviso tipo="error">{error}</Aviso>}
      {cargando && !info ? <Cargando /> : <HistorialPagos pagos={lista} cuentas={info?.cuentas ?? []} etiquetas={etiquetas} alCambiar={recargar} />}
    </>
  );
}

export default function PaginaPagos() {
  return (
    <SoloAdmin>
      <Historial />
    </SoloAdmin>
  );
}
