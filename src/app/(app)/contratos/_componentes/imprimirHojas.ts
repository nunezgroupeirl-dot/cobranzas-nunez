import type { Datos } from "@/lib/supabase/datos";

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);

/**
 * Imprime (o guarda como PDF) las hojas escaneadas del contrato firmado, una por página A4.
 * La ventana se abre al instante (si no, el navegador la bloquea) y se llena cuando llegan los enlaces de las fotos.
 */
export async function imprimirHojas(datos: Datos, rutas: string[], titulo: string): Promise<void> {
  const ventana = window.open("", "_blank");
  if (!ventana) throw new Error("El navegador bloqueó la ventana. Permite las ventanas emergentes para este sitio.");
  ventana.document.write(`<!doctype html><title>${esc(titulo)}</title><p style="font-family:sans-serif;padding:24px">Preparando las hojas…</p>`);
  try {
    const urls = await Promise.all(rutas.map((r) => datos.urlArchivo("documentos", r)));
    const hojas = urls.map((u, i) => (u ? `<section><img src="${esc(u)}" alt="Página ${i + 1}"></section>` : `<section><p>No se pudo cargar la página ${i + 1}.</p></section>`)).join("");
    ventana.document.open();
    ventana.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(titulo)}</title>
<style>@page{size:A4;margin:8mm}body{margin:0;font-family:sans-serif}section{height:calc(297mm - 16mm);display:flex;align-items:center;justify-content:center;page-break-after:always;break-after:page}section:last-child{page-break-after:auto;break-after:auto}img{max-width:100%;max-height:100%;object-fit:contain}</style>
</head><body>${hojas}<script>
var imgs=[].slice.call(document.images);Promise.all(imgs.map(function(i){return i.complete?0:new Promise(function(r){i.onload=i.onerror=r})})).then(function(){setTimeout(function(){window.print()},200)});
</script></body></html>`);
    ventana.document.close();
  } catch (e) {
    ventana.close();
    throw e;
  }
}
