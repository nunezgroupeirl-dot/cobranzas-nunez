"use client";
import { useState } from "react";
import { useSesion } from "@/components/layout/Sesion";
import { AreaTexto, Aviso, Boton, Modal, mensajeDeError } from "@/components/ui";

interface Props {
  tipo: "cliente" | "moto";
  id: string;
  nombre: string;
  alCerrar: () => void;
  alTerminar: () => void;
}

/** Archivar un cliente o un vehículo que ya no está en la empresa (se puede restaurar desde "Archivados"). */
export function ModalArchivar({ tipo, id, nombre, alCerrar, alTerminar }: Props) {
  const { datos } = useSesion();
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const que = tipo === "cliente" ? "cliente" : "vehículo";

  const archivar = async () => {
    setOcupado(true);
    setError(null);
    try {
      await datos.archivar(tipo, id, true, motivo);
      alTerminar();
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Modal
      abierto
      titulo={`Archivar ${que}`}
      alCerrar={alCerrar}
      pie={
        <>
          <Boton variante="secundario" onClick={alCerrar}>
            Cancelar
          </Boton>
          <Boton cargando={ocupado} onClick={archivar}>
            Archivar
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p>
          <b>{nombre}</b> deja de salir en las listas del día a día, pero no se borra nada: sigue en <b>Archivados</b> y en el <b>Histórico</b>, con sus contratos,
          pagos y fotos. Se puede restaurar cuando quieras.
        </p>
        {tipo === "cliente" && <p className="text-sm text-tenue">Sus vehículos sin contrato activo también se archivan.</p>}
        {error && <Aviso tipo="error">{error}</Aviso>}
        <AreaTexto etiqueta="Motivo (opcional)" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={tipo === "cliente" ? "Ej.: terminó de pagar y ya no trabaja con nosotros" : "Ej.: vendido, recuperado y entregado a otra empresa"} />
      </div>
    </Modal>
  );
}
