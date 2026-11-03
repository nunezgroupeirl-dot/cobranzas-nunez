"use client";
import { useEffect, useState } from "react";
import { Boton, mensajeDeError } from "@/components/ui";
import { nombreMes } from "@/lib/letras";
import { descargarReporteMensual } from "@/lib/reportes";
import { useSesion } from "./Sesion";

/**
 * Aviso para el dueño desde el día 1 de cada mes: descargar el reporte del mes anterior.
 * No tiene botón de cerrar: se quita solo cuando el reporte se descarga (queda anotado en la base de datos,
 * así no vuelve a salir en ningún equipo).
 */
export function RecordatorioReporte() {
  const { datos, empresas, esAdmin } = useSesion();
  const [mes, setMes] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!esAdmin) return;
    let vivo = true;
    datos
      .reportePendiente()
      .then((m) => vivo && setMes(m))
      .catch(() => vivo && setMes(null)); // si falla la consulta, no se bloquea el trabajo
    return () => {
      vivo = false;
    };
  }, [datos, esAdmin]);

  if (!mes) return null;

  const descargar = async () => {
    setOcupado(true);
    setError(null);
    try {
      await descargarReporteMensual(datos, empresas, mes);
      setMes(null);
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div role="status" className="no-imprimir mb-4 flex flex-col gap-3 rounded-2xl border-2 border-amarillo bg-amarillo-suave p-4 sm:flex-row sm:items-center">
      <span className="text-2xl" aria-hidden>
        📋
      </span>
      <div className="flex-1">
        <p className="font-bold">Descarga el reporte de {nombreMes(mes)}</p>
        <p className="text-sm">Es tu respaldo del mes: resumen por empresa, todos los pagos y el estado de los clientes. Este aviso se quita cuando lo descargues.</p>
        {error && <p className="mt-1 text-sm font-semibold text-rojo">{error}</p>}
      </div>
      <Boton onClick={descargar} cargando={ocupado}>
        Descargar reporte
      </Boton>
    </div>
  );
}
