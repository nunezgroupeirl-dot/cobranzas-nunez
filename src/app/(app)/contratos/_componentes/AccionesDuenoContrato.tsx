"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSesion } from "@/components/layout/Sesion";
import { Boton, ModalEliminar } from "@/components/ui";
import type { Contrato } from "@/types/database";
import { ModalEditarContrato } from "./ModalEditarContrato";

interface Props {
  contrato: Contrato;
  placa?: string;
  clienteId?: string;
  alCambiar: () => void;
}

/** Editar y eliminar contrato. Solo lo ve el dueño. */
export function AccionesDuenoContrato({ contrato, placa, clienteId, alCambiar }: Props) {
  const { datos, esAdmin } = useSesion();
  const router = useRouter();
  const [modal, setModal] = useState<"editar" | "eliminar" | null>(null);
  if (!esAdmin) return null;
  return (
    <>
      {contrato.estado !== "anulado" && (
        <Boton variante="secundario" tamano="grande" onClick={() => setModal("editar")}>
          Editar
        </Boton>
      )}
      <Boton variante="borrar" tamano="grande" onClick={() => setModal("eliminar")}>
        Eliminar
      </Boton>
      {modal === "editar" && (
        <ModalEditarContrato
          contrato={contrato}
          abierto
          alCerrar={() => setModal(null)}
          alTerminar={() => {
            setModal(null);
            alCambiar();
          }}
        />
      )}
      <ModalEliminar
        abierto={modal === "eliminar"}
        titulo="Eliminar contrato"
        confirmarCon={placa}
        alCerrar={() => setModal(null)}
        alEliminar={async () => {
          await datos.eliminarContrato(contrato.id);
          router.replace(clienteId ? `/clientes/ficha?id=${clienteId}` : "/contratos");
        }}
      >
        <p>
          Se borra el contrato de la moto <b>{placa}</b>, su cronograma y <b>todos sus pagos con sus fotos</b>. El cliente y la moto se conservan.
        </p>
        <p className="text-sm text-tenue">Si solo quieres que deje de contar como deuda (moto recuperada), usa “Cerrar contrato”.</p>
      </ModalEliminar>
    </>
  );
}
