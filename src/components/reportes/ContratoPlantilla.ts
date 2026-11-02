/**
 * Plantilla EN BLANCO del contrato de alquiler venta: el mismo texto del contrato,
 * con rayas para llenarlo a mano. Se imprime, se llena, se firma, se escanea y se sube.
 */

/** Raya para escribir a mano. */
const r = (ancho: number) => `<span class="raya" style="width:${ancho}px"></span>`;
/** Casilla para marcar. */
const casilla = (texto: string) => `<span class="op"><span class="casilla"></span> ${texto}</span>`;

export function htmlPlantillaContrato(): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Contrato de Alquiler Venta - plantilla en blanco</title>
<style>
@page{size:A4;margin:14mm 16mm 12mm}
body{font-family:Arial,Helvetica,sans-serif;color:#000;font-size:10.5pt;line-height:1.8;margin:0}
h1{text-align:center;font-size:14pt;margin:0 0 6px;line-height:1.3}
.codigo{text-align:right;font-size:9pt;margin-bottom:8px}
p{margin:0 0 6px;text-align:justify}
p.llenar{text-align:left}
.op{white-space:nowrap}
b{font-weight:700}
.raya{display:inline-block;border-bottom:1px solid #000;height:1.1em;vertical-align:baseline}
.casilla{display:inline-block;width:11px;height:11px;border:1.2px solid #000;vertical-align:-1px;margin-left:4px}
.ficha{display:grid;grid-template-columns:1fr 1fr;gap:0 26px;margin:0 0 8px 24px}
.firmas{display:grid;grid-template-columns:1fr 1fr;gap:36px;margin-top:52px;page-break-inside:avoid}
.firma{display:flex;gap:10px;align-items:flex-start}
.firma .linea{flex:1;border-top:1px solid #000;padding-top:4px;font-size:9.5pt;line-height:1.9}
.huella{width:68px;height:88px;border:1px solid #888;border-radius:6px;flex:none;display:flex;align-items:flex-end;justify-content:center;font-size:7pt;color:#777;padding-bottom:3px;box-sizing:border-box}
.pie{margin-top:22px;font-size:8pt;color:#555;border-top:1px solid #ccc;padding-top:4px;line-height:1.4}
.ok{display:none}
@media screen{body{max-width:180mm;margin:20px auto;padding:0 10mm}.ok{display:block;background:#fff5d6;border:1px solid #e6c65c;padding:8px 12px;border-radius:8px;font-size:10pt;margin-bottom:16px;line-height:1.4}}
</style></head><body>
<div class="ok">Plantilla en blanco. En la ventana de impresión elige la impresora o <b>Guardar como PDF</b>.</div>
<h1>Contrato de Alquiler Venta de Mototaxi</h1>
<div class="codigo">Placa N.º ${r(110)}</div>

<p class="llenar">Conste por el presente documento el contrato de <b>ALQUILER VENTA</b> del vehículo de placa de rodaje N.º ${r(100)} que celebran de una parte la empresa ${r(300)}, con número de RUC ${r(130)}, representada por el Sr. ${r(270)} con DNI de N.º ${r(110)}, con domicilio en ${r(560)} ${r(300)}, a quien en adelante se le llamará <b>EL ARRENDADOR</b>; y de la otra parte el Sr. ${r(330)} con ${casilla("DNI")} ${casilla("Carné de Extranjería")} N.º ${r(130)}, con domicilio en ${r(520)} ${r(340)}, que para los efectos del presente contrato se le denominará <b>EL ARRENDATARIO</b>, sujeto a los términos y condiciones siguientes:</p>

<p class="llenar"><b>PRIMERO.</b> <b>EL ARRENDADOR</b> da en alquiler venta a <b>EL ARRENDATARIO</b> el vehículo ${casilla("MOTOTAXI")} ${casilla("MOTOCICLETA")} de placa de rodaje N.º ${r(100)}, que presenta las siguientes características:</p>
<div class="ficha">
<div>Clase: ${r(150)}</div><div>Combustible: ${r(170)}</div>
<div>Marca: ${r(150)}</div><div>Color: ${r(200)}</div>
<div>Modelo: ${r(145)}</div><div>N.º de serie: ${r(170)}</div>
<div>Año de modelo: ${r(100)}</div><div>N.º motor: ${r(185)}</div>
<div></div><div>Carrocería: ${r(180)}</div>
</div>

<p><b>SEGUNDO.</b> <b>EL ARRENDATARIO</b> destinará el vehículo materia del presente contrato única y exclusivamente al <b>SERVICIO DE MOTOTAXI</b>, quedando prohibido variar su finalidad.</p>

<p><b>TERCERO.</b> <b>EL ARRENDATARIO</b> está prohibido de traspasar o subarrendar el vehículo materia del presente contrato, total o parcialmente, a favor de terceros, reservándose <b>EL ARRENDADOR</b> el derecho de resolver el presente contrato.</p>

<p class="llenar"><b>CUARTO.</b> El plazo de duración del presente contrato es de ${r(50)} meses previo acuerdo de ambas partes. La validez del presente contrato empieza el ${r(40)} de ${r(110)} del ${r(60)} y termina el ${r(40)} de ${r(110)} del ${r(60)}. Al no cumplir los términos y condiciones del presente contrato, <b>EL ARRENDATARIO</b> queda obligado a devolver el vehículo en las mismas condiciones en que lo recibió, sin necesidad de notificación, requerimiento o aviso previo de <b>EL ARRENDADOR</b>. De incumplir con las cláusulas precedentes, se resolverá el contrato de pleno derecho, amparado en el artículo 1429 del Código Civil.</p>

<p><b>QUINTO.</b> <b>EL ARRENDADOR</b> tiene el derecho a modificar el contrato, si se afectan las cláusulas pactadas en el contrato.</p>

<p class="llenar"><b>SEXTO.</b> La renta pactada de común acuerdo por el <b>ALQUILER VENTA</b> del vehículo es de S/ ${r(90)} (${r(330)} soles), que se depositará en forma ${casilla("DIARIA")} ${casilla("SEMANAL")} en la cuenta ${r(140)} N.º ${r(200)}, teniendo la obligación de mandar el váucher del depósito. Al no mandar el váucher de depósito, se tomará en cuenta que no realizó el depósito a <b>EL ARRENDADOR</b>, que tendrá el derecho de quitar el vehículo por <b>INCUMPLIMIENTO DEL ARRENDATARIO</b>.</p>

<p><b>SÉPTIMO.</b> <b>EL ARRENDATARIO</b> declara que recibe el vehículo en perfecto estado de conservación y funcionamiento, con sus llaves, tarjeta de propiedad y SOAT (vigente), dejando constancia de que el vencimiento del SOAT será única y exclusivamente responsabilidad de <b>EL ARRENDATARIO</b>. <b>EL ARRENDATARIO</b> tiene la obligación de tramitar un nuevo SOAT ante el seguro correspondiente.</p>

<p><b>OCTAVO.</b> Es obligación <b>DIARIA</b> de <b>EL ARRENDATARIO</b> la limpieza interior y exterior del vehículo, así como la revisión de freno, batería, embrague, aceite, etc., para el funcionamiento diario adecuado, haciéndolo presente a <b>EL ARRENDADOR</b>.</p>

<p><b>NOVENO.</b> Cualquier desperfecto o rotura que suceda en el vehículo durante la vigencia de este contrato deberá ser reparado o repuesto por <b>EL ARRENDATARIO</b>.</p>

<p><b>DÉCIMO.</b> Las infracciones de tránsito, temas ilegales, accidentes y choques que cometiera <b>EL ARRENDATARIO</b> y que correspondan al vehículo serán de responsabilidad de <b>EL ARRENDATARIO</b>, y deberá comunicarlo a <b>EL ARRENDADOR</b>.</p>

<p class="llenar"><b>DÉCIMO PRIMERO.</b> <b>EL ARRENDATARIO</b> dejará la suma de S/ ${r(90)} (${r(330)} soles) como inicial para responder por la integridad del vehículo.</p>

<p><b>DÉCIMO SEGUNDO.</b> <b>EL ARRENDADOR</b> tendrá el derecho de quitar el vehículo por el incumplimiento de alguna de las cláusulas anteriores por parte de <b>EL ARRENDATARIO</b>, exonerándose así del derecho de devolución de la inicial.</p>

<p class="llenar" style="margin-top:12px">En señal de conformidad, las partes firman el presente contrato en ${r(120)}, el ${r(40)} de ${r(110)} del ${r(60)}.</p>

<div class="firmas">
<div class="firma"><div class="linea">Empresa: ${r(165)}<br>RUC: ${r(185)}<br>Gerente: ${r(170)}<br>DNI: ${r(175)}<br><b>EL ARRENDADOR</b></div><div class="huella">Huella</div></div>
<div class="firma"><div class="linea">Nombre: ${r(170)}<br>${casilla("DNI")} ${casilla("C.E.")} N.º ${r(105)}<br><b>EL ARRENDATARIO</b></div><div class="huella">Huella</div></div>
</div>
<div class="pie">Cobranzas Núñez — Una vez lleno y firmado, escanea o fotografía cada hoja y súbela en la app: Motos y contratos → el contrato → “Contrato firmado”.</div>
<script>window.onload=function(){setTimeout(function(){window.print()},400)}</script>
</body></html>`;
}

/** Abre la plantilla en blanco lista para imprimir o guardar como PDF. */
export function abrirPlantillaContrato(): boolean {
  const ventana = window.open("", "_blank");
  if (!ventana) return false;
  ventana.document.open();
  ventana.document.write(htmlPlantillaContrato());
  ventana.document.close();
  return true;
}
