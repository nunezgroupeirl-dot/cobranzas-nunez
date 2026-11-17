"use client";
import { useEffect, useState } from "react";
import { useSesion } from "@/components/layout/Sesion";
import { Boton, Modal, clasesBoton } from "@/components/ui";
import { HojasPdf, MiniaturaPdf } from "@/components/ui/Pdf";
import { esPdf } from "@/lib/pdf";
import type { Bucket } from "@/types/database";

/** Miniatura de una foto (o PDF) guardada en un bucket; al tocarla se amplía. */
export function Foto({ bucket, ruta, titulo, className = "size-24" }: { bucket: Bucket; ruta: string; titulo: string; className?: string }) {
  const { datos } = useSesion();
  const [url, setUrl] = useState<string | null>(null);
  const [cargada, setCargada] = useState(false);
  const [abierta, setAbierta] = useState(false);

  useEffect(() => {
    let vivo = true;
    datos
      .urlArchivo(bucket, ruta)
      .then((u) => vivo && setUrl(u))
      .catch(() => vivo && setUrl(null))
      .finally(() => vivo && setCargada(true));
    return () => {
      vivo = false;
    };
  }, [datos, bucket, ruta]);

  if (!cargada) return <div className={`esqueleto ${className} rounded-xl`} aria-hidden />;
  if (!url)
    return (
      <div className={`${className} grid place-items-center rounded-xl border border-dashed border-borde bg-fondo p-1 text-center text-xs text-tenue`}>
        Sin foto
      </div>
    );
  const pdf = esPdf(ruta);
  return (
    <>
      <button type="button" onClick={() => setAbierta(true)} className={`${className} overflow-hidden rounded-xl border border-borde`} aria-label={`Ampliar ${titulo}`}>
        {pdf ? <MiniaturaPdf fuente={url} className="size-full" /> : <img src={url} alt={titulo} loading="lazy" className="size-full object-cover" />}
      </button>
      <Modal abierto={abierta} titulo={titulo} alCerrar={() => setAbierta(false)} ancho="grande">
        <div className="flex flex-col gap-3">
          <AccionesArchivo url={url} nombre={nombreArchivo(titulo, ruta)} pdf={pdf} />
          {pdf ? abierta && <HojasPdf fuente={url} /> : <img src={url} alt={titulo} className="mx-auto max-h-[70dvh] w-auto rounded-xl" />}
        </div>
      </Modal>
    </>
  );
}

/** "DNI o Carné de Extranjería (frente) · Ana Ccori" + ".pdf" → "dni-o-carne-de-extranjeria-frente-ana-ccori.pdf" */
function nombreArchivo(titulo: string, ruta: string) {
  const ext = ruta.split(".").pop() ?? "jpg";
  const base = titulo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base || "documento"}.${ext}`;
}

/** Abrir en otra pestaña y descargar (para editarlo o mandarlo). */
function AccionesArchivo({ url, nombre, pdf }: { url: string; nombre: string; pdf: boolean }) {
  const [bajando, setBajando] = useState(false);
  const [error, setError] = useState(false);
  const descargar = async () => {
    setBajando(true);
    setError(false);
    try {
      // se baja como archivo (no solo se abre): el enlace firmado es de otro dominio y "download" no basta
      const r = await fetch(url);
      if (!r.ok) throw new Error(String(r.status));
      const blob = await r.blob();
      const local = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = local;
      a.download = nombre;
      a.click();
      setTimeout(() => URL.revokeObjectURL(local), 1000);
    } catch {
      setError(true);
    } finally {
      setBajando(false);
    }
  };
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {error && <span className="text-sm font-semibold text-rojo">No se pudo descargar. Prueba con “Abrir”.</span>}
      <a href={url} target="_blank" rel="noopener noreferrer" className={clasesBoton("secundario", "chico")}>
        {pdf ? "Abrir PDF" : "Abrir en otra pestaña"}
      </a>
      <Boton variante="secundario" tamano="chico" cargando={bajando} onClick={descargar}>
        Descargar
      </Boton>
    </div>
  );
}
