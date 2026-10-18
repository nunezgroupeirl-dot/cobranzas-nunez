"use client";
import { useState } from "react";
import { SoloAdmin, useSesion } from "@/components/layout/Sesion";
import { Aviso, Boton, Campo, Cargando, Modal, OpcionesBoton, Tabla, TituloPagina, mensajeDeError, useCarga, type Columna } from "@/components/ui";
import type { Perfil, Rol } from "@/types/database";

function Usuarios() {
  const { datos, perfil: yo } = useSesion();
  const { datos: usuarios, cargando, error, recargar } = useCarga(() => datos.usuarios(), [datos]);
  const [abierto, setAbierto] = useState(false);
  const [f, setF] = useState({ nombre: "", email: "", clave: "", rol: "cobrador" as Rol });
  const [errForm, setErrForm] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "exito" | "error"; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const crear = async () => {
    if (!f.nombre.trim() || !/^\S+@\S+\.\S+$/.test(f.email) || f.clave.length < 6) {
      setErrForm("Completa nombre, un correo válido y una contraseña de al menos 6 caracteres.");
      return;
    }
    setOcupado("crear");
    setErrForm(null);
    try {
      await datos.crearUsuario({ ...f, nombre: f.nombre.trim(), email: f.email.trim() });
      setAbierto(false);
      setAviso({ tipo: "exito", texto: `Usuario ${f.email} creado. Dale su contraseña en persona.` });
      setF({ nombre: "", email: "", clave: "", rol: "cobrador" });
      recargar();
    } catch (e) {
      setErrForm(mensajeDeError(e));
    } finally {
      setOcupado(null);
    }
  };

  const cambiar = async (u: Perfil, cambios: Partial<Pick<Perfil, "rol" | "activo">>, texto: string) => {
    if (!confirm(texto)) return;
    setOcupado(u.id);
    try {
      await datos.actualizarUsuario(u.id, cambios);
      setAviso({ tipo: "exito", texto: "Cambio guardado." });
      recargar();
    } catch (e) {
      setAviso({ tipo: "error", texto: mensajeDeError(e) });
    } finally {
      setOcupado(null);
    }
  };

  const columnas: Columna<Perfil>[] = [
    { clave: "nombre", titulo: "Nombre", celda: (u) => <span className="font-semibold">{u.nombre}{u.id === yo.id ? " (tú)" : ""}</span> },
    { clave: "email", titulo: "Correo", celda: (u) => u.email },
    { clave: "rol", titulo: "Rol", celda: (u) => <span className="capitalize">{u.rol}</span> },
    {
      clave: "estado",
      titulo: "Estado",
      celda: (u) => <span className={`font-semibold ${u.activo ? "text-verde" : "text-rojo"}`}>{u.activo ? "Activo" : "Desactivado"}</span>,
    },
    {
      clave: "acciones",
      titulo: "",
      celda: (u) =>
        u.id === yo.id ? null : (
          <div className="flex flex-wrap justify-end gap-1">
            <Boton
              variante="secundario"
              tamano="chico"
              cargando={ocupado === u.id}
              onClick={() => {
                const rol: Rol = u.rol === "administrador" ? "cobrador" : "administrador";
                cambiar(u, { rol }, `¿Cambiar a ${u.nombre} a ${rol}?`);
              }}
            >
              Hacer {u.rol === "administrador" ? "cobrador" : "admin"}
            </Boton>
            <Boton
              variante={u.activo ? "fantasma" : "secundario"}
              tamano="chico"
              className={u.activo ? "text-rojo" : ""}
              onClick={() => cambiar(u, { activo: !u.activo }, u.activo ? `¿Desactivar a ${u.nombre}? Ya no podrá ingresar.` : `¿Reactivar a ${u.nombre}?`)}
            >
              {u.activo ? "Desactivar" : "Activar"}
            </Boton>
          </div>
        ),
    },
  ];

  return (
    <>
      <TituloPagina titulo="Usuarios" accion={<Boton tamano="grande" onClick={() => setAbierto(true)}>+ Nuevo usuario</Boton>} />
      {aviso && (
        <div className="mb-3">
          <Aviso tipo={aviso.tipo} alCerrar={() => setAviso(null)}>
            {aviso.texto}
          </Aviso>
        </div>
      )}
      {error && <Aviso tipo="error">{error}</Aviso>}
      {cargando && !usuarios ? <Cargando /> : <Tabla columnas={columnas} filas={usuarios ?? []} claveFila={(u) => u.id} />}

      {datos.modoPrueba && (
        <div className="mt-8 rounded-2xl border border-dashed border-amarillo p-4">
          <p className="font-semibold">Modo prueba</p>
          <p className="text-sm text-tenue">Borra todo lo que registraste en este navegador y vuelve a los datos de ejemplo.</p>
          <Boton
            variante="secundario"
            tamano="chico"
            className="mt-2"
            onClick={async () => {
              if (!confirm("¿Borrar los datos de prueba de este navegador?")) return;
              const { reiniciarDatosDePrueba } = await import("@/lib/supabase/simulado");
              reiniciarDatosDePrueba();
              window.location.reload();
            }}
          >
            Reiniciar datos de prueba
          </Boton>
        </div>
      )}

      <Modal
        abierto={abierto}
        titulo="Nuevo usuario"
        alCerrar={() => setAbierto(false)}
        pie={
          <>
            <Boton variante="secundario" onClick={() => setAbierto(false)}>
              Cancelar
            </Boton>
            <Boton onClick={crear} cargando={ocupado === "crear"}>
              Crear usuario
            </Boton>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {errForm && <Aviso tipo="error">{errForm}</Aviso>}
          <Campo etiqueta="Nombre" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} obligatorio />
          <Campo etiqueta="Correo" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} obligatorio autoComplete="off" />
          <Campo etiqueta="Contraseña inicial" type="text" value={f.clave} onChange={(e) => setF({ ...f, clave: e.target.value })} obligatorio ayuda="Mínimo 6 caracteres." autoComplete="new-password" />
          <OpcionesBoton
            etiqueta="Rol"
            opciones={[
              { valor: "cobrador", texto: "Cobrador" },
              { valor: "administrador", texto: "Administrador" },
            ]}
            valor={f.rol}
            alCambiar={(v) => setF({ ...f, rol: v as Rol })}
          />
          <p className="text-sm text-tenue">El cobrador ve clientes, cronogramas y morosos y registra pagos. No ve el panel de dinero, no anula ni borra.</p>
        </div>
      </Modal>
    </>
  );
}

export default function PaginaUsuarios() {
  return (
    <SoloAdmin>
      <Usuarios />
    </SoloAdmin>
  );
}
