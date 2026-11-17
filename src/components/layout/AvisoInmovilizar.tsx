"use client";
import Link from "next/link";
import { useState } from "react";

/**
 * Aviso para los administradores: hay vehículos con 4 semanas de deuda o más que se deben inmovilizar.
 * Se puede cerrar, pero vuelve a salir al recargar mientras sigan con esa deuda.
 */
export function AvisoInmovilizar({ cuantos, enlace, enLista }: { cuantos: number; enlace: string; enLista: boolean }) {
  const [cerrado, setCerrado] = useState(false);
  if (!cuantos || cerrado || enLista) return null;
  return (
    <div role="alert" className="no-imprimir mb-4 flex flex-col gap-3 rounded-2xl border-2 border-rojo bg-rojo-suave p-4 sm:flex-row sm:items-center">
      <span className="text-2xl" aria-hidden>
        🚫
      </span>
      <div className="flex-1">
        <p className="font-bold text-rojo">
          {cuantos === 1 ? "1 vehículo para inmovilizar" : `${cuantos} vehículos para inmovilizar`}
        </p>
        <p className="text-sm">Tienen 4 semanas de deuda o más. Revisa la lista y coordina la inmovilización.</p>
      </div>
      <div className="flex gap-2">
        <Link href={enlace} className="inline-flex min-h-12 items-center rounded-xl bg-rojo px-4 font-bold text-white">
          Ver la lista
        </Link>
        <button type="button" onClick={() => setCerrado(true)} className="min-h-12 rounded-xl px-3 font-semibold text-rojo hover:bg-white/60">
          Cerrar
        </button>
      </div>
    </div>
  );
}
