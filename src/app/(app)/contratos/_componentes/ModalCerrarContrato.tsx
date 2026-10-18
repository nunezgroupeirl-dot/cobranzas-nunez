"use client";
import { useState } from "react";
import { useSesion } from "@/components/layout/Sesion";
import { AreaTexto, Aviso, Boton, Modal, mensajeDeError } from "@/components/ui";

interface Props {
  contratoId: string;
  placa?: string;
  abierto: boolean;
  alCerrar: () => void;
  alTerminar: () => void;
}

/** Cierre de contrato (solo administrador): la moto queda libre y deja de contar como deuda. */
export function ModalCerrarContrato({ contratoId, placa, abierto, alCerrar, alTerminar }: Props) {
  const { datos } = useSesion();
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const cerrar = async () => {
    if (!motivo.trim()) {
      setError("Escribe el motivo (por ejemplo: moto recuperada).");
      return;
    }
    setOcupado(true);
    setError(null);
    try {
      await datos.cerrarContrato(contratoId, motivo.trim());
      setMotivo("");
      alTerminar();
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Modal
      abierto={abierto}
      titulo="Cerrar contrato"
      alCerrar={alCerrar}
      pie={
        <>
          <Boton variante="secundario" onClick={alCerrar}>
            Cancelar
          </Boton>
          <Boton variante="peligro" cargando={ocupado} onClick={cerrar}>
            Sí, cerrar
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p>
          El contrato deja de contar como deuda y sale de ¿Quién no paga?. La moto <b>{placa}</b> queda libre para un contrato nuevo. Los pagos registrados se
          conservan.
        </p>
        <AreaTexto etiqueta="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: moto recuperada por falta de pago" obligatorio />
        {error && <Aviso tipo="error">{error}</Aviso>}
      </div>
    </Modal>
  );
}
