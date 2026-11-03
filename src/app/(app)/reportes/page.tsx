"use client";
import { useMemo, useState } from "react";
import { SoloAdmin, useSesion } from "@/components/layout/Sesion";
import { useEmpresa } from "@/components/layout/empresa";
import { Aviso, Boton, Campo, Selector, Tarjeta, TituloPagina, hoyLima, mensajeDeError, sumarDias } from "@/components/ui";
import { descargarExcel } from "@/lib/exportar";
import { mesAnterior, nombreMes, sumarMeses } from "@/lib/letras";
import { descargarReporteMensual, hojaClientes, hojaPagos } from "@/lib/reportes";

function Reportes() {
  const { datos, empresas } = useSesion();
  const empresa = useEmpresa();
  const [desde, setDesde] = useState(() => sumarDias(hoyLima(), -30));
  const [hasta, setHasta] = useState(hoyLima);
  const [ocupado, setOcupado] = useState<"" | "clientes" | "pagos" | "mes">("");
  const [mes, setMes] = useState(() => mesAnterior(hoyLima()));
  const meses = useMemo(() => Array.from({ length: 12 }, (_, i) => sumarMeses(mesAnterior(hoyLima()), -i)), []);
  const [aviso, setAviso] = useState<{ tipo: "exito" | "error"; texto: string } | null>(null);
  const sufijo = empresa ? `_${(empresas.find((e) => e.id === empresa)?.nombre ?? "empresa").replace(/\s+/g, "-")}` : "";

  const excelClientes = async () => {
    setOcupado("clientes");
    try {
      const hoja = await hojaClientes(datos, empresa);
      descargarExcel(`clientes${sufijo}_${hoyLima()}`, [hoja]);
      setAviso({ tipo: "exito", texto: `Excel con ${hoja.filas.length} clientes descargado.` });
    } catch (e) {
      setAviso({ tipo: "error", texto: mensajeDeError(e) });
    } finally {
      setOcupado("");
    }
  };

  const excelPagos = async () => {
    if (desde > hasta) {
      setAviso({ tipo: "error", texto: "La fecha “desde” no puede ser mayor que “hasta”." });
      return;
    }
    setOcupado("pagos");
    try {
      const hoja = await hojaPagos(datos, empresas, desde, hasta, empresa);
      descargarExcel(`pagos${sufijo}_${desde}_a_${hasta}`, [hoja]);
      setAviso({ tipo: "exito", texto: `Excel con ${hoja.filas.length} pagos descargado.` });
    } catch (e) {
      setAviso({ tipo: "error", texto: mensajeDeError(e) });
    } finally {
      setOcupado("");
    }
  };

  const excelMes = async () => {
    setOcupado("mes");
    try {
      const n = await descargarReporteMensual(datos, empresas, mes);
      setAviso({ tipo: "exito", texto: `Reporte de ${nombreMes(mes)} descargado (${n} pagos).` });
    } catch (e) {
      setAviso({ tipo: "error", texto: mensajeDeError(e) });
    } finally {
      setOcupado("");
    }
  };

  return (
    <>
      <TituloPagina titulo="Reportes" sub={empresa ? "Solo la empresa elegida arriba." : "Todas las empresas (cambia el filtro arriba)."} />
      {aviso && (
        <div className="mb-4">
          <Aviso tipo={aviso.tipo} alCerrar={() => setAviso(null)}>
            {aviso.texto}
          </Aviso>
        </div>
      )}
      <Tarjeta className="mb-4" titulo="Reporte mensual">
        <p className="mb-4 text-tenue">
          Un Excel con el resumen por empresa, todos los pagos del mes y el estado de los clientes. Descárgalo cada mes y guárdalo: es tu respaldo. Las 4 empresas juntas.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <Selector
            etiqueta="Mes"
            opciones={meses.map((m) => ({ valor: m, texto: nombreMes(m) }))}
            value={mes}
            onChange={(e) => setMes(e.target.value)}
          />
          <Boton tamano="grande" onClick={excelMes} cargando={ocupado === "mes"}>
            Descargar reporte mensual
          </Boton>
        </div>
      </Tarjeta>
      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta titulo="Clientes">
          <p className="mb-4 text-tenue">Todos los contratos activos con su color, deuda y fechas.</p>
          <Boton tamano="grande" onClick={excelClientes} cargando={ocupado === "clientes"}>
            Descargar Excel de clientes
          </Boton>
        </Tarjeta>
        <Tarjeta titulo="Pagos por fechas">
          <div className="mb-4 grid grid-cols-2 gap-3">
            <Campo etiqueta="Desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            <Campo etiqueta="Hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
          <Boton tamano="grande" onClick={excelPagos} cargando={ocupado === "pagos"}>
            Descargar Excel de pagos
          </Boton>
        </Tarjeta>
      </div>
    </>
  );
}

export default function PaginaReportes() {
  return (
    <SoloAdmin>
      <Reportes />
    </SoloAdmin>
  );
}
