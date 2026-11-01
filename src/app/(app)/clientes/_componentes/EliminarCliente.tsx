"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSesion } from "@/components/layout/Sesion";
import { useConEmpresa } from "@/components/layout/empresa";
import { Boton, ModalEliminar } from "@/components/ui";
import type { Cliente } from "@/types/database";

/** Botón y confirmación para borrar un cliente con todo lo suyo. Solo lo ve el dueño. */
export function EliminarCliente({ cliente, contratos, pagos }: { cliente: Cliente; contratos: number; pagos: number }) {
  const { datos, esAdmin } = useSesion();
  const router = useRouter();
  const conEmpresa = useConEmpresa();
  const [abierto, setAbierto] = useState(false);
  if (!esAdmin) return null;
  return (
    <>
      <Boton variante="borrar" onClick={() => setAbierto(true)}>
        Eliminar
      </Boton>
      <ModalEliminar
        abierto={abierto}
        titulo="Eliminar cliente"
        confirmarCon={cliente.dni}
        alCerrar={() => setAbierto(false)}
        alEliminar={async () => {
          await datos.eliminarCliente(cliente.id);
          router.replace(conEmpresa("/clientes"));
        }}
      >
        <p>
          Se borra a <b>{cliente.nombres}</b> con sus fotos, sus {contratos} contrato(s) y sus {pagos} pago(s). Sus motos sin otros contratos también se borran.
        </p>
      </ModalEliminar>
    </>
  );
}
