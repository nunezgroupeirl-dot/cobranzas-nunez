"use client";
import { useState } from "react";
import { useSesion } from "@/components/layout/Sesion";
import { Aviso, Boton, Campo, DETALLE_PUESTO, Modal, NOMBRE_PUESTO, OpcionesBoton, mensajeDeError } from "@/components/ui";
import type { Perfil, Puesto } from "@/types/database";

interface Props {
  /** El trabajador a editar, o "yo" para la contraseña del propio dueño. */
  usuario: Perfil | "yo";
  alCerrar: () => void;
  alGuardar: (texto: string) => void;
}

/** Cambiar el nombre o la contraseña de un trabajador, o la contraseña propia del dueño. */
export function ModalEditarUsuario({ usuario, alCerrar, alGuardar }: Props) {
  const { datos } = useSesion();
  const propio = usuario === "yo";
  const [nombre, setNombre] = useState(propio ? "" : usuario.nombre);
  const [clave, setClave] = useState("");
  const [puesto, setPuesto] = useState<Puesto | "">(propio ? "" : (usuario.puesto ?? ""));
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const guardar = async () => {
    setError(null);
    if (clave && clave.length < 6) return setError("La contraseña debe tener al menos 6 caracteres.");
    if (propio && !clave) return setError("Escribe la nueva contraseña.");
    if (!propio && !nombre.trim()) return setError("Escribe el nombre.");
    setOcupado(true);
    try {
      if (propio) {
        await datos.cambiarMiClave(clave);
        alGuardar("Tu contraseña se cambió. Úsala la próxima vez que ingreses.");
      } else {
        const cambioNombre = nombre.trim() !== usuario.nombre;
        const cambioPuesto = puesto !== "" && puesto !== (usuario.puesto ?? "");
        if (!cambioNombre && !clave && !cambioPuesto) return alCerrar();
        await datos.editarUsuario(usuario.id, {
          ...(cambioNombre ? { nombre: nombre.trim() } : {}),
          ...(clave ? { clave } : {}),
          ...(cambioPuesto && puesto ? { puesto } : {}),
        });
        alGuardar(clave ? `Listo. Dale a ${nombre.trim()} su nueva contraseña en persona.` : "Cambios guardados.");
      }
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Modal
      abierto
      titulo={propio ? "Cambiar mi contraseña" : `Editar a ${usuario.nombre}`}
      alCerrar={alCerrar}
      pie={
        <>
          <Boton variante="secundario" onClick={alCerrar}>
            Cancelar
          </Boton>
          <Boton cargando={ocupado} onClick={guardar}>
            Guardar
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {!propio && (
          <>
            <OpcionesBoton
              etiqueta="Puesto"
              valor={puesto}
              alCambiar={(v) => setPuesto(v as Puesto)}
              opciones={(["oficina", "ruta"] as const).map((p) => ({ valor: p, texto: NOMBRE_PUESTO[p] }))}
            />
            {puesto && <p className="-mt-2 text-sm text-tenue">{DETALLE_PUESTO[puesto]}</p>}
            <Campo etiqueta="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} obligatorio ayuda="Es el nombre que aparece en el sistema y en los pagos que registra." />
            <Campo etiqueta="Correo para ingresar" value={usuario.email} disabled ayuda="El correo no se cambia. Si hace falta otro, crea un usuario nuevo." />
          </>
        )}
        <Campo
          etiqueta={propio ? "Nueva contraseña" : "Nueva contraseña (opcional)"}
          type="text"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          autoComplete="new-password"
          ayuda={propio ? "Mínimo 6 caracteres." : "Déjala vacía si no quieres cambiarla. Mínimo 6 caracteres."}
        />
        {error && <Aviso tipo="error">{error}</Aviso>}
      </div>
    </Modal>
  );
}
