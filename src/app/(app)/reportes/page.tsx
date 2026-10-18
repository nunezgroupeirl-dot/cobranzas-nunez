"use client";
import { useState } from "react";
import { SoloAdmin, useSesion } from "@/components/layout/Sesion";
import { filtrarPorEmpresa, useEmpresa } from "@/components/layout/empresa";
import { Aviso, Boton, Campo, NOMBRE_MEDIO, Tarjeta, TituloPagina, formatoFecha, formatoFechaHora, hoyLima, mensajeDeError, sumarDias } from "@/components/ui";
import { descargarExcel } from "@/lib/exportar";

function Reportes() {
  const { datos, empresas } = useSesion();
  const empresa = useEmpresa();
  const [desde, setDesde] = useState(() => sumarDias(hoyLima(), -30));
  const [hasta, setHasta] = useState(hoyLima);
  const [ocupado, setOcupado] = useState<"" | "clientes" | "pagos">("");
  const [aviso, setAviso] = useState<{ tipo: "exito" | "error"; texto: string } | null>(null);
  const sufijo = empresa ? `_${(empresas.find((e) => e.id === empresa)?.nombre ?? "empresa").replace(/\s+/g, "-")}` : "";

  const excelClientes = async () => {
    setOcupado("clientes");
    try {
      const [estados, clientes] = await Promise.all([datos.estadoClientes(), datos.clientes()]);
      const filas = filtrarPorEmpresa(estados, empresa).map((e) => {
        const c = clientes.find((x) => x.id === e.cliente_id);
        return [e.cliente, e.dni, e.celular, c?.direccion, e.placa, e.empresa, e.cuota, e.semanas_atraso, e.color, e.deuda, formatoFecha(e.ultimo_pago), formatoFecha(e.proxima_cuota)];
      });
      descargarExcel(`clientes${sufijo}_${hoyLima()}`, [
        {
          nombre: "Clientes",
          columnas: ["Cliente", "DNI", "Celular", "Dirección", "Placa", "Empresa", "Cuota", "Semanas de atraso", "Color", "Deuda vencida", "Último pago", "Próxima cuota"],
          filas,
        },
      ]);
      setAviso({ tipo: "exito", texto: `Excel con ${filas.length} clientes descargado.` });
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
      const [pagos, contratos, clientes, motos, cuentas] = await Promise.all([datos.pagos({ desde, hasta }), datos.contratos(), datos.clientes(), datos.motos(), datos.cuentas()]);
      const filas = pagos
        .map((p) => ({ p, con: contratos.find((c) => c.id === p.contrato_id) }))
        .filter(({ con }) => !empresa || con?.empresa_id === empresa)
        .map(({ p, con }) => [
          formatoFecha(p.fecha_pago),
          clientes.find((c) => c.id === con?.cliente_id)?.nombres,
          clientes.find((c) => c.id === con?.cliente_id)?.dni,
          motos.find((m) => m.id === con?.moto_id)?.placa,
          empresas.find((e) => e.id === con?.empresa_id)?.nombre,
          p.monto,
          NOMBRE_MEDIO[p.medio],
          cuentas.find((c) => c.id === p.cuenta_id)?.nombre,
          p.nro_operacion,
          p.registrado_por_nombre,
          formatoFechaHora(p.creado_en),
          p.anulado ? "ANULADO" : "Válido",
          p.motivo_anulacion,
        ]);
      descargarExcel(`pagos${sufijo}_${desde}_a_${hasta}`, [
        {
          nombre: "Pagos",
          columnas: ["Fecha de pago", "Cliente", "DNI", "Placa", "Empresa", "Monto", "Medio", "Cuenta destino", "N.º operación", "Registró", "Registrado el", "Estado", "Motivo de anulación"],
          filas,
        },
      ]);
      setAviso({ tipo: "exito", texto: `Excel con ${filas.length} pagos descargado.` });
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
