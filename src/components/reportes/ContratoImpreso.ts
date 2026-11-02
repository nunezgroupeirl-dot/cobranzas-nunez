import { fechaEnLetras, solesEnLetras } from "@/lib/letras";
import type { Cliente, Empresa, Moto } from "@/types/database";

export interface DatosContrato {
  empresa: Empresa;
  cliente: Cliente;
  moto: Moto;
  renta: number;
  frecuencia: "DIARIA" | "SEMANAL";
  cuenta: string; // "BCP (1944202917005)"
  plazoMeses: number;
  inicio: string; // YYYY-MM-DD
  fin: string;
  inicial: number | null;
  ciudad: string;
  fechaFirma: string;
}

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
/** Dato o raya para llenar a mano si falta. */
const v = (t: string | number | null | undefined, ancho = 160) =>
  t === null || t === undefined || String(t).trim() === "" ? `<span class="raya" style="width:${ancho}px"></span>` : esc(String(t));
const monto = (n: number) => n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Documento de identidad con su nombre: "DNI de N.º 48140469" o "Carné de Extranjería N.º 002149083". */
const documento = (n: string) => (n.length === 8 ? `DNI de N.º ${esc(n)}` : `Carné de Extranjería N.º ${esc(n)}`);
const documentoCorto = (n: string) => (n.length === 8 ? `DNI: ${esc(n)}` : `Carné de Extranjería N.º ${esc(n)}`);

/** Lo que falta para que el contrato salga completo (se imprime con rayas para llenar a mano). */
export function datosFaltantes(d: Pick<DatosContrato, "empresa" | "cliente" | "moto" | "cuenta" | "inicial">): string[] {
  const falta: string[] = [];
  if (!d.empresa.ruc) falta.push("RUC de la empresa");
  if (!d.empresa.representante) falta.push("representante de la empresa");
  if (!d.empresa.representante_dni) falta.push("DNI del representante");
  if (!d.empresa.domicilio) falta.push("domicilio de la empresa");
  if (!d.cliente.direccion) falta.push("dirección del cliente");
  const ficha: [keyof Moto, string][] = [
    ["modelo", "modelo"], ["anio", "año"], ["clase", "clase"], ["combustible", "combustible"],
    ["serie", "n.º de serie"], ["motor", "n.º de motor"], ["carroceria", "carrocería"],
  ];
  const sinFicha = ficha.filter(([k]) => d.moto[k] === null || d.moto[k] === undefined || d.moto[k] === "").map(([, t]) => t);
  if (sinFicha.length) falta.push(`de la moto: ${sinFicha.join(", ")}`);
  if (!d.cuenta.trim()) falta.push("cuenta de depósito");
  if (d.inicial === null) falta.push("monto de la inicial");
  return falta;
}

export function htmlContrato(d: DatosContrato): string {
  const { empresa: e, cliente: c, moto: m } = d;
  const esMototaxi = /mototaxi|trimoto/i.test(m.tipo);
  const vehiculo = esMototaxi ? "MOTOTAXI" : "MOTOCICLETA";
  const inicial = d.inicial === null ? v(null, 90) : `${monto(d.inicial)}`;
  const inicialLetras = d.inicial === null ? v(null, 220) : solesEnLetras(d.inicial);

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Contrato ${esc(m.placa)} - ${esc(c.nombres)}</title>
<style>
@page{size:A4;margin:20mm 20mm 18mm}
body{font-family:Arial,Helvetica,sans-serif;color:#000;font-size:11pt;line-height:1.55;margin:0}
h1{text-align:center;font-size:14pt;margin:0 0 16px}
p{margin:0 0 11px;text-align:justify}
b{font-weight:700}
.raya{display:inline-block;border-bottom:1px solid #000;height:1em;vertical-align:baseline}
.ficha{display:grid;grid-template-columns:1fr 1fr;gap:4px 30px;margin:4px 0 12px 30px}
.firmas{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:70px;page-break-inside:avoid}
.firma{display:flex;gap:10px;align-items:flex-start}
.firma .linea{flex:1;border-top:1px solid #000;padding-top:4px;font-size:10pt;line-height:1.4}
.huella{width:68px;height:88px;border:1px solid #888;border-radius:6px;flex:none;display:flex;align-items:flex-end;justify-content:center;font-size:7pt;color:#777;padding-bottom:3px;box-sizing:border-box}
.pie{margin-top:28px;font-size:8pt;color:#555;border-top:1px solid #ccc;padding-top:4px}
.ok{display:none}
@media screen{body{max-width:180mm;margin:20px auto;padding:0 10mm}.ok{display:block;background:#fff5d6;border:1px solid #e6c65c;padding:8px 12px;border-radius:8px;font-size:10pt;margin-bottom:16px}}
</style></head><body>
<div class="ok">Vista para imprimir. En la ventana de impresión elige la impresora o <b>Guardar como PDF</b>.</div>
<h1>Contrato de Alquiler Venta de ${esMototaxi ? "Mototaxi" : "Motocicleta"}</h1>

<p>Conste por el presente documento el contrato de <b>ALQUILER VENTA</b> del vehículo de placa de rodaje N.º <b>${esc(m.placa)}</b> que celebran de una parte la empresa <b>${esc(e.nombre.toUpperCase())}</b>, con número de RUC ${v(e.ruc, 110)}, representada por el Sr. ${v(e.representante, 220)} con DNI de N.º ${v(e.representante_dni, 90)} con domicilio en ${v(e.domicilio, 300)}, a quien en adelante se le llamará <b>EL ARRENDADOR</b>; y de la otra parte el Sr. <b>${esc(c.nombres)}</b> con ${documento(c.dni)} con domicilio en ${v(c.direccion, 300)}, que para los efectos del presente contrato se le denominará <b>EL ARRENDATARIO</b>, sujeto a los términos y condiciones siguientes:</p>

<p><b>PRIMERO.</b> <b>EL ARRENDADOR</b> da en alquiler venta a <b>EL ARRENDATARIO</b> el vehículo <b>${vehiculo} ${esc(m.marca.toUpperCase())}</b> de placa de rodaje N.º <b>${esc(m.placa)}</b> y que presenta las siguientes características:</p>
<div class="ficha">
<div>Clase: ${v(m.clase, 100)}</div><div>Combustible: ${v(m.combustible, 140)}</div>
<div>Marca: ${v(m.marca.toUpperCase(), 100)}</div><div>Color: ${v(m.color.toUpperCase(), 120)}</div>
<div>Modelo: ${v(m.modelo, 140)}</div><div>N.º de serie: ${v(m.serie, 170)}</div>
<div>Año de modelo: ${v(m.anio, 70)}</div><div>N.º motor: ${v(m.motor, 170)}</div>
<div></div><div>Carrocería: ${v(m.carroceria, 150)}</div>
</div>

<p><b>SEGUNDO.</b> <b>EL ARRENDATARIO</b> destinará el vehículo materia del presente contrato única y exclusivamente al <b>SERVICIO DE ${esMototaxi ? "MOTOTAXI" : "TRANSPORTE"}</b>, quedando prohibido variar su finalidad.</p>

<p><b>TERCERO.</b> <b>EL ARRENDATARIO</b> está prohibido de traspasar o subarrendar el vehículo materia del presente contrato, total o parcialmente, a favor de terceros, reservándose <b>EL ARRENDADOR</b> el derecho de resolver el presente contrato.</p>

<p><b>CUARTO.</b> El plazo de duración del presente contrato es de <b>${d.plazoMeses} meses</b> previo acuerdo de ambas partes. La validez del presente contrato empieza el <b>${fechaEnLetras(d.inicio)}</b> y termina el <b>${fechaEnLetras(d.fin)}</b>. Al no cumplir los términos y condiciones del presente contrato, <b>EL ARRENDATARIO</b> queda obligado a devolver el vehículo en las mismas condiciones en que lo recibió, sin necesidad de notificación, requerimiento o aviso previo de <b>EL ARRENDADOR</b>. De incumplir con las cláusulas precedentes, se resolverá el contrato de pleno derecho, amparado en el artículo 1429 del Código Civil.</p>

<p><b>QUINTO.</b> <b>EL ARRENDADOR</b> tiene el derecho a modificar el contrato, si se afectan las cláusulas pactadas en el contrato.</p>

<p><b>SEXTO.</b> La renta pactada de común acuerdo por el <b>ALQUILER VENTA</b> del vehículo es de <b>${monto(d.renta)} soles</b> (${solesEnLetras(d.renta)}), que se depositará en forma <b>${d.frecuencia}</b> en la cuenta <b>${v(d.cuenta, 220)}</b>, teniendo la obligación de mandar el váucher del depósito. Al no mandar el váucher de depósito, se tomará en cuenta que no realizó el depósito a <b>EL ARRENDADOR</b>, que tendrá el derecho de quitar el vehículo por <b>INCUMPLIMIENTO DEL ARRENDATARIO</b>.</p>

<p><b>SÉPTIMO.</b> <b>EL ARRENDATARIO</b> declara que recibe el vehículo en perfecto estado de conservación y funcionamiento, con sus llaves, tarjeta de propiedad y SOAT (vigente), dejando constancia de que el vencimiento del SOAT será única y exclusivamente responsabilidad de <b>EL ARRENDATARIO</b>. <b>EL ARRENDATARIO</b> tiene la obligación de tramitar un nuevo SOAT ante el seguro correspondiente.</p>

<p><b>OCTAVO.</b> Es obligación <b>DIARIA</b> de <b>EL ARRENDATARIO</b> la limpieza interior y exterior del vehículo, así como la revisión de freno, batería, embrague, aceite, etc., para el funcionamiento diario adecuado, haciéndolo presente a <b>EL ARRENDADOR</b>.</p>

<p><b>NOVENO.</b> Cualquier desperfecto o rotura que suceda en el vehículo durante la vigencia de este contrato deberá ser reparado o repuesto por <b>EL ARRENDATARIO</b>.</p>

<p><b>DÉCIMO.</b> Las infracciones de tránsito, temas ilegales, accidentes y choques que cometiera <b>EL ARRENDATARIO</b> y que correspondan al vehículo serán de responsabilidad de <b>EL ARRENDATARIO</b>, y deberá comunicarlo a <b>EL ARRENDADOR</b>.</p>

<p><b>DÉCIMO PRIMERO.</b> <b>EL ARRENDATARIO</b> dejará la suma de <b>${inicial} soles</b> (${inicialLetras}) como inicial para responder por la integridad del vehículo.</p>

<p><b>DÉCIMO SEGUNDO.</b> <b>EL ARRENDADOR</b> tendrá el derecho de quitar el vehículo por el incumplimiento de alguna de las cláusulas anteriores por parte de <b>EL ARRENDATARIO</b>, exonerándose así del derecho de devolución de los <b>${inicial} soles</b> de inicial.</p>

<p style="margin-top:22px">En señal de conformidad, las partes firman el presente contrato en ${esc(d.ciudad)}, el ${fechaEnLetras(d.fechaFirma)}.</p>

<div class="firmas">
<div class="firma"><div class="linea"><b>${esc(e.nombre.toUpperCase())}</b><br>RUC: ${v(e.ruc, 100)}<br>Gerente: ${v(e.representante, 150)}<br>DNI: ${v(e.representante_dni, 90)}<br><b>EL ARRENDADOR</b></div><div class="huella">Huella</div></div>
<div class="firma"><div class="linea"><b>${esc(c.nombres)}</b><br>${documentoCorto(c.dni)}<br><b>EL ARRENDATARIO</b></div><div class="huella">Huella</div></div>
</div>
<div class="pie">Placa ${esc(m.placa)} · ${esc(c.nombres)} · ${documentoCorto(c.dni)} — Una vez firmado, escanéalo y súbelo en la pantalla del contrato.</div>
<script>window.onload=function(){setTimeout(function(){window.print()},400)}</script>
</body></html>`;
}

/** Abre el contrato en una ventana nueva lista para imprimir o guardar como PDF. */
export function abrirContrato(d: DatosContrato): boolean {
  const ventana = window.open("", "_blank");
  if (!ventana) return false;
  ventana.document.open();
  ventana.document.write(htmlContrato(d));
  ventana.document.close();
  return true;
}
