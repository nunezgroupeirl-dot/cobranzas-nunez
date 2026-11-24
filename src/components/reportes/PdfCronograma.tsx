"use client";
import type { Contrato, Cuota, TipoDoc } from "@/types/database";
import { useSesion } from "@/components/layout/Sesion";
import { NOMBRE_ESTADO_CUOTA, diaSemana, formatoFecha, formatoSoles, hoyLima, nombreCuota, nombreDocumento } from "@/components/ui/formato";
import { clasesBoton } from "@/components/ui/estilos";

interface Props {
  cliente: string;
  dni: string | null;
  tipoDoc?: TipoDoc | null;
  placa: string | null;
  empresa: string;
  /** préstamo de dinero: no hay vehículo, el PDF dice "Tipo: Préstamo de dinero" en vez de la placa */
  prestamo?: boolean;
  contrato: Pick<Contrato, "monto_cuota" | "nro_cuotas" | "fecha_inicio" | "frecuencia"> & { empresa_id?: string };
  cuotas: Pick<Cuota, "numero" | "fecha_vencimiento" | "monto" | "monto_pagado" | "fecha_pago" | "estado">[];
}

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);

const COLOR: Record<Cuota["estado"], string> = {
  pagada_a_tiempo: "#ddf3e5",
  pagada_con_atraso: "#fdecd3",
  vencida: "#fbe1de",
  pendiente: "#ffffff",
};

/** Datos de la cabecera: la empresa del contrato (nombre y RUC) con el logo del negocio. */
interface Cabecera {
  logo: string;
  ruc: string | null;
}

export function htmlCronograma({ cliente, dni, tipoDoc, placa, empresa, prestamo, contrato, cuotas }: Props, { logo, ruc }: Cabecera): string {
  const pagado = cuotas.reduce((s, c) => s + c.monto_pagado, 0);
  const total = cuotas.reduce((s, c) => s + c.monto, 0);
  const vencido = cuotas.filter((c) => c.estado === "vencida").reduce((s, c) => s + c.monto - c.monto_pagado, 0);
  const filas = cuotas
    .map(
      (c) => `<tr style="background:${COLOR[c.estado]}">
        <td>${c.numero}</td><td><b style="text-transform:capitalize">${diaSemana(c.fecha_vencimiento)}</b> ${formatoFecha(c.fecha_vencimiento)}</td><td class="n">${formatoSoles(c.monto)}</td>
        <td class="n">${c.monto_pagado ? formatoSoles(c.monto_pagado) : ""}</td><td>${c.fecha_pago ? formatoFecha(c.fecha_pago) : ""}</td>
        <td>${NOMBRE_ESTADO_CUOTA[c.estado]}</td></tr>`,
    )
    .join("");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Cronograma ${esc(prestamo ? "préstamo" : (placa ?? "sin placa"))} - ${esc(cliente)}</title>
<style>
@page{size:A4;margin:14mm}
body{font-family:Segoe UI,system-ui,sans-serif;color:#1d2a2f;font-size:11pt;margin:0}
header{display:flex;justify-content:space-between;align-items:center;gap:16px;border-bottom:3px solid #b8932f;padding-bottom:10px;margin-bottom:12px}
.marca{display:flex;align-items:center;gap:12px}.marca img{width:64px;height:64px;border-radius:50%;object-fit:cover}
.empresa{font-size:14pt;font-weight:700;text-transform:uppercase;line-height:1.15}
*{-webkit-print-color-adjust:exact;print-color-adjust:exact}
h1{margin:0;font-size:20pt}.t{color:#5d6a6e;font-size:9pt;letter-spacing:.2em;text-transform:uppercase}
.datos{display:grid;grid-template-columns:repeat(4,1fr);gap:6px 14px;margin-bottom:12px}
.datos div span{display:block;color:#5d6a6e;font-size:8.5pt}.datos b{font-size:11pt}
table{width:100%;border-collapse:collapse;font-size:9.5pt}th{background:#1d2a2f;color:#fff;text-align:left;padding:5px}
td{padding:4px 5px;border-bottom:1px solid #ddd8cc}.n{text-align:right;font-variant-numeric:tabular-nums}
thead{display:table-header-group}tr{page-break-inside:avoid}
footer{margin-top:10px;color:#5d6a6e;font-size:8.5pt}
</style></head><body>
<header><div class="marca"><img src="${esc(logo)}" alt=""><div>
<div class="empresa">${esc(empresa || "Inversiones Nuñez & Asociados")}</div>
${ruc ? `<div class="t" style="letter-spacing:.05em">RUC ${esc(ruc)}</div>` : ""}
<div class="t">Inversiones Nuñez &amp; Asociados</div></div></div>
<div style="text-align:right"><h1>Cronograma de pagos</h1><div class="t">Emitido el ${formatoFecha(hoyLima())}</div></div></header>
<section class="datos">
<div><span>Cliente</span><b>${esc(cliente)}</b></div><div><span>${nombreDocumento(dni, tipoDoc)}</span><b>${esc(dni ?? "Falta")}</b></div>
<div><span>${prestamo ? "Tipo" : "Placa"}</span><b>${esc(prestamo ? "Préstamo de dinero" : (placa ?? "Sin placa"))}</b></div><div><span>${nombreCuota(contrato.frecuencia)}</span><b>${formatoSoles(contrato.monto_cuota)}</b></div>
<div><span>N.º de cuotas</span><b>${contrato.nro_cuotas}</b></div><div><span>Total del contrato</span><b>${formatoSoles(total)}</b></div>
<div><span>Pagado</span><b>${formatoSoles(pagado)}</b></div><div><span>Deuda vencida</span><b style="color:#c0362c">${formatoSoles(vencido)}</b></div>
</section>
<table><thead><tr><th>N.º</th><th>Vence</th><th class="n">Cuota</th><th class="n">Pagado</th><th>Fecha de pago</th><th>Estado</th></tr></thead>
<tbody>${filas}</tbody></table>
<footer>Verde: pagada a tiempo · Amarillo: pagada con atraso · Rojo: vencida · Blanco: pendiente. El día cambia a medianoche.</footer>
<script>window.onload=function(){setTimeout(function(){window.print()},300)}</script>
</body></html>`;
}

/** Botón "PDF del cronograma": abre una vista para imprimir o guardar como PDF (sin librerías). */
export function BotonPdfCronograma(props: Props) {
  const { empresas } = useSesion();
  const datosEmpresa = empresas.find((e) => e.id === props.contrato.empresa_id) ?? empresas.find((e) => e.nombre === props.empresa);
  const abrir = () => {
    const ventana = window.open("", "_blank");
    if (!ventana) {
      alert("El navegador bloqueó la ventana. Permite las ventanas emergentes para este sitio.");
      return;
    }
    ventana.document.open();
    // dirección completa: la ventana nueva no sabe de qué sitio viene
    ventana.document.write(htmlCronograma(props, { logo: `${window.location.origin}/marca/logo-256.webp`, ruc: datosEmpresa?.ruc ?? null }));
    ventana.document.close();
  };
  return (
    <button type="button" onClick={abrir} className={clasesBoton("secundario", "chico")}>
      PDF del cronograma
    </button>
  );
}
