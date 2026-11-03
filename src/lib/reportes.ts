/** Hojas de Excel de los reportes (pantalla Reportes y reporte mensual). */
import { NOMBRE_MEDIO, formatoFecha, formatoFechaHora } from "@/components/ui/formato";
import { descargarExcel, type Hoja } from "@/lib/exportar";
import { nombreMes, siguienteMes } from "@/lib/letras";
import type { Datos } from "@/lib/supabase/datos";
import { sumarDias } from "@/lib/supabase/reglas";
import type { Empresa } from "@/types/database";

const deEmpresa = <T extends { empresa_id: string }>(filas: T[], empresa: string | null) => (empresa ? filas.filter((f) => f.empresa_id === empresa) : filas);

/** Contratos activos con su color, deuda y fechas. */
export async function hojaClientes(datos: Datos, empresa: string | null): Promise<Hoja> {
  const [estados, clientes] = await Promise.all([datos.estadoClientes(), datos.clientes()]);
  const porId = new Map(clientes.map((c) => [c.id, c]));
  const filas = deEmpresa(estados, empresa).map((e) => [
    e.cliente,
    e.dni,
    e.celular,
    porId.get(e.cliente_id)?.direccion,
    e.placa,
    e.empresa,
    e.cuota,
    e.semanas_atraso,
    e.color,
    e.deuda,
    formatoFecha(e.ultimo_pago),
    formatoFecha(e.proxima_cuota),
  ]);
  return {
    nombre: "Clientes",
    columnas: ["Cliente", "DNI / C.E.", "Celular", "Dirección", "Placa", "Empresa", "Cuota", "Semanas de atraso", "Color", "Deuda vencida", "Último pago", "Próxima cuota"],
    filas,
  };
}

/** Pagos registrados entre dos fechas (incluye anulados, marcados). */
export async function hojaPagos(datos: Datos, empresas: Empresa[], desde: string, hasta: string, empresa: string | null): Promise<Hoja> {
  const [pagos, contratos, clientes, motos, cuentas] = await Promise.all([datos.pagos({ desde, hasta }), datos.contratos(), datos.clientes(), datos.motos(), datos.todasLasCuentas()]);
  const contrato = new Map(contratos.map((c) => [c.id, c]));
  const cliente = new Map(clientes.map((c) => [c.id, c]));
  const placa = new Map(motos.map((m) => [m.id, m.placa]));
  const cuenta = new Map(cuentas.map((c) => [c.id, c.nombre]));
  const nombreEmpresa = new Map(empresas.map((e) => [e.id, e.nombre]));
  const filas = pagos
    .map((p) => ({ p, con: contrato.get(p.contrato_id) }))
    .filter(({ con }) => !empresa || con?.empresa_id === empresa)
    .map(({ p, con }) => {
      const cli = con ? cliente.get(con.cliente_id) : undefined;
      return [
        formatoFecha(p.fecha_pago),
        cli?.nombres,
        cli?.dni,
        con ? placa.get(con.moto_id) : undefined,
        con ? nombreEmpresa.get(con.empresa_id) : undefined,
        p.monto,
        NOMBRE_MEDIO[p.medio],
        p.cuenta_id ? cuenta.get(p.cuenta_id) : undefined,
        p.nro_operacion,
        p.registrado_por_nombre,
        formatoFechaHora(p.creado_en),
        p.anulado ? "ANULADO" : "Válido",
        p.motivo_anulacion,
      ];
    });
  return {
    nombre: "Pagos",
    columnas: ["Fecha de pago", "Cliente", "DNI / C.E.", "Placa", "Empresa", "Monto", "Medio", "Cuenta destino", "N.º operación", "Registró", "Registrado el", "Estado", "Motivo de anulación"],
    filas,
  };
}

/** Totales por empresa del mes: cobrado, pagos, y la deuda y semáforo de hoy. */
function hojaResumen(pagos: Hoja, clientes: Hoja, empresas: Empresa[]): Hoja {
  const filas = empresas.map((e) => {
    const suyos = pagos.filas.filter((f) => f[4] === e.nombre && f[11] === "Válido");
    const activos = clientes.filas.filter((f) => f[5] === e.nombre);
    const color = (c: string) => activos.filter((f) => f[8] === c).length;
    return [
      e.nombre,
      suyos.reduce((t, f) => t + Number(f[5] ?? 0), 0),
      suyos.length,
      activos.length,
      color("verde"),
      color("amarillo"),
      color("rojo"),
      activos.reduce((t, f) => t + Number(f[9] ?? 0), 0),
    ];
  });
  const suma = (i: number) => filas.reduce((t, f) => t + Number(f[i]), 0);
  filas.push(["TOTAL", suma(1), suma(2), suma(3), suma(4), suma(5), suma(6), suma(7)]);
  return {
    nombre: "Resumen",
    columnas: ["Empresa", "Cobrado en el mes S/", "N.º de pagos", "Contratos activos hoy", "Verde", "Amarillo", "Rojo", "Deuda vencida hoy S/"],
    filas,
    anchos: [38, 20, 14, 22, 10, 10, 10, 20],
  };
}

/** Reporte de un mes (todas las empresas): resumen, pagos del mes y clientes al día de hoy. Lo marca como descargado. */
export async function descargarReporteMensual(datos: Datos, empresas: Empresa[], mes: string): Promise<number> {
  const hasta = sumarDias(siguienteMes(mes), -1);
  const [pagos, clientes] = await Promise.all([hojaPagos(datos, empresas, mes, hasta, null), hojaClientes(datos, null)]);
  pagos.nombre = `Pagos ${nombreMes(mes)}`.slice(0, 31);
  descargarExcel(`reporte_${mes.slice(0, 7)}_Nunez_y_Asociados`, [hojaResumen(pagos, clientes, empresas), pagos, clientes]);
  await datos.marcarReporteDescargado(mes);
  return pagos.filas.length;
}
