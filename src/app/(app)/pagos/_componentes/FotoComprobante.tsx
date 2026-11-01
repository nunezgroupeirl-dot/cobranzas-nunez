import { Boton, Tarjeta, VistaPrevia } from "@/components/ui";
import type { MedioPago } from "@/types/database";

interface Props {
  foto: File | null;
  medio: MedioPago;
  error?: string;
  alCambiar: (foto: File | null) => void;
}

/** Foto obligatoria del comprobante (captura de Yape/Plin, voucher o foto del efectivo). */
export function FotoComprobante({ foto, medio, error, alCambiar }: Props) {
  return (
    <Tarjeta titulo="Foto del comprobante *">
      {foto ? (
        <div className="flex flex-wrap items-end gap-4">
          <VistaPrevia archivo={foto} alt="Comprobante" className="max-h-72 rounded-xl border border-borde" />
          <Boton variante="secundario" onClick={() => alCambiar(null)}>
            Cambiar foto
          </Boton>
        </div>
      ) : (
        <label
          className={`flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center font-semibold ${error ? "border-rojo text-rojo" : "border-marca text-marca"} hover:bg-marca-suave`}
        >
          <span className="text-4xl" aria-hidden>
            📷
          </span>
          Subir captura o tomar foto
          <span className="text-sm font-normal text-tenue">{medio === "efectivo" ? "Foto del recibo o del dinero entregado" : "Captura del Yape / Plin / voucher"}</span>
          {/* Sin "capture": así el celular deja elegir cámara O galería (la captura de Yape llega por WhatsApp) */}
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => alCambiar(e.target.files?.[0] ?? null)} />
        </label>
      )}
      {error && <p className="mt-2 text-sm font-semibold text-rojo">{error}</p>}
    </Tarjeta>
  );
}
