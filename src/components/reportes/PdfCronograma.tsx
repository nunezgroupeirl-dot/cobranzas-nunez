"use client";
import type { Contrato, Cuota } from "@/types/database";
import { NOMBRE_ESTADO_CUOTA, formatoFecha, formatoSoles, hoyLima } from "@/components/ui/formato";
import { clasesBoton } from "@/components/ui/estilos";

interface Props {
  cliente: string;
  dni: string;
  placa: string;
  empresa: string;
  contrato: Pick<Contrato, "monto_cuota" | "nro_cuotas" | "fecha_inicio">;
  cuotas: Pick<Cuota, "numero" | "fecha_vencimiento" | "monto" | "monto_pagado" | "fecha_pago" | "estado">[];
}

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);

const COLOR: Record<Cuota["estado"], string> = {
  pagada_a_tiempo: "#ddf3e5",
  pagada_con_atraso: "#fdf0cf",
  vencida: "#fbe1de",
  pendiente: "#ffffff",
};

function htmlCronograma({ cliente, dni, placa, empresa, contrato, cuotas }: Props): string {
  const pagado = cuotas.reduce((s, c) => s + c.monto_pagado, 0);
  const total = cuotas.reduce((s, c) => s + c.monto, 0);
  const vencido = cuotas.filter((c) => c.estado === "vencida").reduce((s, c) => s + c.monto - c.monto_pagado, 0);
  const filas = cuotas
    .map(
      (c) => `<tr style="background:${COLOR[c.estado]}">
        <td>${c.numero}</td><td>${formatoFecha(c.fecha_vencimiento)}</td><td class="n">${formatoSoles(c.monto)}</td>
        <td class="n">${c.monto_pagado ? formatoSoles(c.monto_pagado) : ""}</td><td>${c.fecha_pago ? formatoFecha(c.fecha_pago) : ""}</td>
        <td>${NOMBRE_ESTADO_CUOTA[c.estado]}</td></tr>`,
    )
    .join("");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Cronograma ${esc(placa)} - ${esc(cliente)}</title>
<style>
@page{size:A4;margin:14mm}
body{font-family:Segoe UI,system-ui,sans-serif;color:#1d2a2f;font-size:11pt;margin:0}
header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1d2a2f;padding-bottom:8px;margin-bottom:12px}
h1{margin:0;font-size:20pt}.t{color:#5d6a6e;font-size:9pt;letter-spacing:.2em;text-transform:uppercase}
.datos{display:grid;grid-template-columns:repeat(4,1fr);gap:6px 14px;margin-bottom:12px}
.datos div span{display:block;color:#5d6a6e;font-size:8.5pt}.datos b{font-size:11pt}
table{width:100%;border-collapse:collapse;font-size:9.5pt}th{background:#1d2a2f;color:#fff;text-align:left;padding:5px}
td{padding:4px 5px;border-bottom:1px solid #ddd8cc}.n{text-align:right;font-variant-numeric:tabular-nums}
thead{display:table-header-group}tr{page-break-inside:avoid}
footer{margin-top:10px;color:#5d6a6e;font-size:8.5pt}
</style></head><body>
<header><div><div class="t">Cobranzas Núñez · ${esc(empresa)}</div><h1>Cronograma de pagos</h1></div>
<div style="text-align:right"><div class="t">Emitido</div><b>${formatoFecha(hoyLima())}</b></div></header>
<section class="datos">
<div><span>Cliente</span><b>${esc(cliente)}</b></div><div><span>DNI</span><b>${esc(dni)}</b></div>
<div><span>Placa</span><b>${esc(placa)}</b></div><div><span>Cuota semanal</span><b>${formatoSoles(contrato.monto_cuota)}</b></div>
<div><span>N.º de cuotas</span><b>${contrato.nro_cuotas}</b></div><div><span>Total del contrato</span><b>${formatoSoles(total)}</b></div>
<div><span>Pagado</span><b>${formatoSoles(pagado)}</b></div><div><span>Deuda vencida</span><b style="color:#c0362c">${formatoSoles(vencido)}</b></div>
</section>
<table><thead><tr><th>N.º</th><th>Vence</th><th class="n">Cuota</th><th class="n">Pagado</th><th>Fecha de pago</th><th>Estado</th></tr></thead>
<tbody>${filas}</tbody></table>
<footer>Verde: pagada a tiempo · Amarillo: pagada con atraso · Rojo: vencida · Blanco: pendiente. Lo registrado hasta las 10:00 p.m. cuenta para ese día.</footer>
<script>window.onload=function(){setTimeout(function(){window.print()},300)}</script>
</body></html>`;
}

/** Botón "PDF del cronograma": abre una vista para imprimir o guardar como PDF (sin librerías). */
export function BotonPdfCronograma(props: Props) {
  const abrir = () => {
    const ventana = window.open("", "_blank");
    if (!ventana) {
      alert("El navegador bloqueó la ventana. Permite las ventanas emergentes para este sitio.");
      return;
    }
    ventana.document.open();
    ventana.document.write(htmlCronograma(props));
    ventana.document.close();
  };
  return (
    <button type="button" onClick={abrir} className={clasesBoton("secundario", "chico")}>
      PDF del cronograma
    </button>
  );
}
