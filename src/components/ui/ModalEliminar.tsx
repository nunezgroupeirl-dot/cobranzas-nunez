"use client";
import { useState, type ReactNode } from "react";
import { Aviso } from "./Aviso";
import { Boton } from "./Boton";
import { Campo } from "./Campo";
import { Modal } from "./Modal";
import { mensajeDeError } from "./formato";

interface Props {
  abierto: boolean;
  titulo: string;
  children: ReactNode;
  /** Si se indica, hay que escribirlo para habilitar el botón (p. ej. el DNI o la placa). */
  confirmarCon?: string;
  alCerrar: () => void;
  alEliminar: () => Promise<void>;
}

/** Confirmación de borrado definitivo (solo el dueño). */
export function ModalEliminar({ abierto, titulo, children, confirmarCon, alCerrar, alEliminar }: Props) {
  const [escrito, setEscrito] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const listo = !confirmarCon || escrito.trim().toUpperCase() === confirmarCon.trim().toUpperCase();

  const cerrar = () => {
    setEscrito("");
    setError(null);
    alCerrar();
  };
  const eliminar = async () => {
    setOcupado(true);
    setError(null);
    try {
      await alEliminar();
      setEscrito("");
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Modal
      abierto={abierto}
      titulo={titulo}
      alCerrar={cerrar}
      pie={
        <>
          <Boton variante="secundario" onClick={cerrar}>
            Cancelar
          </Boton>
          <Boton variante="peligro" cargando={ocupado} disabled={!listo} onClick={eliminar}>
            Sí, eliminar
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {children}
        <p className="font-semibold text-rojo">Esto no se puede deshacer.</p>
        {confirmarCon && (
          <Campo etiqueta={`Para confirmar, escribe ${confirmarCon}`} value={escrito} onChange={(e) => setEscrito(e.target.value)} autoComplete="off" />
        )}
        {error && <Aviso tipo="error">{error}</Aviso>}
      </div>
    </Modal>
  );
}
