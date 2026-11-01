"use client";
import { useState } from "react";
import { useSesion } from "@/components/layout/Sesion";
import { AreaTexto, Aviso, Boton, Campo, Modal, mensajeDeError } from "@/components/ui";
import type { Contrato } from "@/types/database";

interface Props {
  contrato: Contrato;
  abierto: boolean;
  alCerrar: () => void;
  alTerminar: () => void;
}

const texto = (n: number | null) => (n === null ? "" : String(n));
const numero = (s: string) => (s.trim() === "" ? null : Number(s));

/** Corregir un contrato (solo el dueño). El cronograma se rehace y los pagos ya registrados se vuelven a aplicar. */
export function ModalEditarContrato({ contrato, abierto, alCerrar, alTerminar }: Props) {
  const { datos } = useSesion();
  const [f, setF] = useState(() => ({
    cuota: texto(contrato.monto_cuota),
    nro: texto(contrato.nro_cuotas),
    inicio: contrato.fecha_inicio,
    precio: texto(contrato.precio_total),
    inicial: texto(contrato.inicial),
    pagadas: texto(contrato.cuotas_pagadas_inicial),
    obs: contrato.observaciones ?? "",
  }));
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const poner = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  const guardar = async () => {
    setOcupado(true);
    setError(null);
    try {
      await datos.editarContrato(contrato.id, {
        monto_cuota: Number(f.cuota),
        nro_cuotas: Number(f.nro),
        fecha_inicio: f.inicio,
        precio_total: numero(f.precio),
        inicial: numero(f.inicial),
        cuotas_pagadas: Number(f.pagadas || 0),
        observaciones: f.obs.trim() || null,
      });
      alTerminar();
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Modal
      abierto={abierto}
      titulo="Editar contrato"
      alCerrar={alCerrar}
      pie={
        <>
          <Boton variante="secundario" onClick={alCerrar}>
            Cancelar
          </Boton>
          <Boton cargando={ocupado} onClick={guardar}>
            Guardar cambios
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-tenue">El cronograma se vuelve a armar y los pagos ya registrados se aplican de nuevo, desde la cuota más antigua.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Cuota semanal (S/)" type="number" inputMode="decimal" min="0" step="0.5" value={f.cuota} onChange={(e) => poner("cuota", e.target.value)} obligatorio />
          <Campo etiqueta="Número de cuotas" type="number" inputMode="numeric" min="1" max="260" value={f.nro} onChange={(e) => poner("nro", e.target.value)} obligatorio />
          <Campo etiqueta="Fecha de la 1.ª cuota" type="date" value={f.inicio} onChange={(e) => poner("inicio", e.target.value)} obligatorio />
          <Campo etiqueta="Cuotas ya pagadas (cuaderno)" type="number" inputMode="numeric" min="0" value={f.pagadas} onChange={(e) => poner("pagadas", e.target.value)} />
          <Campo etiqueta="Precio de la moto (S/)" type="number" inputMode="decimal" min="0" value={f.precio} onChange={(e) => poner("precio", e.target.value)} />
          <Campo etiqueta="Inicial (S/)" type="number" inputMode="decimal" min="0" value={f.inicial} onChange={(e) => poner("inicial", e.target.value)} />
        </div>
        <AreaTexto etiqueta="Observaciones" value={f.obs} onChange={(e) => poner("obs", e.target.value)} />
        {error && <Aviso tipo="error">{error}</Aviso>}
      </div>
    </Modal>
  );
}
