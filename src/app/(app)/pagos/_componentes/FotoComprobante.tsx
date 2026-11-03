import { Boton, Tarjeta, VistaPrevia } from "@/components/ui";
import type { MedioPago } from "@/types/database";

interface Props {
  foto: File | null;
  medio: MedioPago;
  error?: string;
  alCambiar: (foto: File | null) => void;
}

/** Recuadro para elegir la foto. En efectivo abre directo la cámara; en los demás deja elegir cámara o galería. */
function ElegirFoto({ efectivo, error, alCambiar }: { efectivo: boolean; error?: string; alCambiar: (foto: File | null) => void }) {
  return (
    <label
      className={`flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center font-semibold ${error ? "border-rojo text-rojo" : "border-marca text-marca"} hover:bg-marca-suave`}
    >
      <span className="text-4xl" aria-hidden>
        📷
      </span>
      {efectivo ? "Tomar foto del cliente" : "Subir captura o tomar foto"}
      <span className="text-sm font-normal text-tenue">{efectivo ? "Se abre la cámara del celular" : "Captura del Yape / Plin / voucher"}</span>
      {/* efectivo: "capture" abre la cámara (foto del momento del pago). Los demás: sin "capture", porque la captura de Yape llega por WhatsApp */}
      <input
        key={efectivo ? "camara" : "galeria"}
        type="file"
        accept="image/*"
        capture={efectivo ? "environment" : undefined}
        className="sr-only"
        onChange={(e) => alCambiar(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}

/**
 * Evidencia obligatoria del pago.
 * · Yape, Plin, banco o agente: captura o voucher.
 * · Efectivo: una foto del cliente al momento de pagar, tomada con la cámara.
 */
export function FotoComprobante({ foto, medio, error, alCambiar }: Props) {
  const efectivo = medio === "efectivo";
  return (
    <Tarjeta titulo={efectivo ? "Foto del cliente *" : "Foto del comprobante *"}>
      {efectivo && !foto && (
        <p className="mb-3 rounded-xl bg-amarillo-suave px-3 py-2 text-sm font-medium">
          Pago en efectivo: tómale una foto al cliente en el momento en que te entrega el dinero, que se le vea la cara.
        </p>
      )}
      {foto ? (
        <div className="flex flex-wrap items-end gap-4">
          <VistaPrevia archivo={foto} alt={efectivo ? "Foto del cliente" : "Comprobante"} className="max-h-72 rounded-xl border border-borde" />
          <Boton variante="secundario" onClick={() => alCambiar(null)}>
            {efectivo ? "Tomar otra foto" : "Cambiar foto"}
          </Boton>
        </div>
      ) : (
        <ElegirFoto efectivo={efectivo} error={error} alCambiar={alCambiar} />
      )}
      {error && <p className="mt-2 text-sm font-semibold text-rojo">{error}</p>}
    </Tarjeta>
  );
}
