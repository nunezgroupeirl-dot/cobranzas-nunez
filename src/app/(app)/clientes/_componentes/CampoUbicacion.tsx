"use client";
import { useState } from "react";
import { Boton, Campo } from "@/components/ui";
import { coordenadas, enlaceMapa, miUbicacion, ubicacionValida } from "@/lib/mapa";

interface Props {
  valor: string;
  direccion: string;
  error?: string;
  alCambiar: (v: string) => void;
}

/** Ubicación en Google Maps: el GPS del celular (estando en la casa del cliente) o un enlace pegado. */
export function CampoUbicacion({ valor, direccion, error, alCambiar }: Props) {
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const abrir = enlaceMapa(valor, direccion);

  const usarGps = async () => {
    setBuscando(true);
    setAviso(null);
    try {
      const c = await miUbicacion();
      alCambiar(`${c.lat},${c.lng}`);
    } catch (e) {
      setAviso(e instanceof Error ? e.message : String(e));
    } finally {
      setBuscando(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Campo
        etiqueta="Ubicación en Google Maps"
        value={valor}
        onChange={(e) => alCambiar(e.target.value)}
        placeholder="Pega el enlace de Google Maps o usa tu ubicación"
        error={error ?? (valor && !ubicacionValida(valor) ? "Pega un enlace de Google Maps o coordenadas como -12.0464,-77.0428." : aviso)}
        ayuda={coordenadas(valor) ? "Ubicación exacta guardada." : "Opcional. Si estás en la casa del cliente, toca “Usar mi ubicación”."}
        autoComplete="off"
      />
      <div className="flex flex-wrap gap-2">
        <Boton variante="secundario" tamano="chico" cargando={buscando} onClick={usarGps}>
          📍 Usar mi ubicación
        </Boton>
        {abrir && (
          <a href={abrir} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center rounded-xl px-3 text-sm font-semibold text-marca hover:bg-marca-suave">
            Ver en Google Maps ↗
          </a>
        )}
      </div>
    </div>
  );
}
