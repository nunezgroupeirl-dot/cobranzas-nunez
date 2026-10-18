"use client";
import { useEffect, useState } from "react";
import { useSesion } from "@/components/layout/Sesion";
import { Modal } from "@/components/ui";
import type { Bucket } from "@/types/database";

/** Miniatura de una foto guardada en un bucket; al tocarla se amplía. */
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

  if (!cargada) return <div className={`${className} animate-pulse rounded-xl bg-fondo`} />;
  if (!url)
    return (
      <div className={`${className} grid place-items-center rounded-xl border border-dashed border-borde bg-fondo p-1 text-center text-xs text-tenue`}>
        Sin foto
      </div>
    );
  return (
    <>
      <button type="button" onClick={() => setAbierta(true)} className={`${className} overflow-hidden rounded-xl border border-borde`} aria-label={`Ampliar ${titulo}`}>
        <img src={url} alt={titulo} className="size-full object-cover" />
      </button>
      <Modal abierto={abierta} titulo={titulo} alCerrar={() => setAbierta(false)} ancho="grande">
        <img src={url} alt={titulo} className="mx-auto max-h-[75dvh] w-auto rounded-xl" />
      </Modal>
    </>
  );
}
