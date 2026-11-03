"use client";
import { useState } from "react";
import { SoloAdmin, useSesion } from "@/components/layout/Sesion";
import { Aviso, Boton, Campo, Cargando, DETALLE_PUESTO, Modal, NOMBRE_PUESTO, OpcionesBoton, Tabla, TituloPagina, mensajeDeError, useCarga, type Columna } from "@/components/ui";
import type { Perfil, Puesto } from "@/types/database";
import { ModalEditarUsuario } from "./_componentes/ModalEditarUsuario";

function Usuarios() {
  const { datos, perfil: yo } = useSesion();
  const { datos: usuarios, cargando, error, recargar } = useCarga(() => datos.usuarios(), [datos]);
  const [abierto, setAbierto] = useState(false);
  const [f, setF] = useState<{ nombre: string; email: string; clave: string; puesto: Puesto | "" }>({ nombre: "", email: "", clave: "", puesto: "" });
  const [errForm, setErrForm] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "exito" | "error"; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [editando, setEditando] = useState<Perfil | "yo" | null>(null);

  const crear = async () => {
    if (!f.nombre.trim() || !/^\S+@\S+\.\S+$/.test(f.email) || f.clave.length < 6 || !f.puesto) {
      setErrForm("Elige el puesto y completa nombre, un correo válido y una contraseña de al menos 6 caracteres.");
      return;
    }
    const puesto = f.puesto;
    setOcupado("crear");
    setErrForm(null);
    try {
      await datos.crearUsuario({ ...f, puesto, rol: "cobrador", nombre: f.nombre.trim(), email: f.email.trim() });
      setAbierto(false);
      setAviso({ tipo: "exito", texto: `${NOMBRE_PUESTO[puesto]} ${f.email} creado. Dale su contraseña en persona.` });
      setF({ nombre: "", email: "", clave: "", puesto: "" });
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
    {
      clave: "rol",
      titulo: "Puesto",
      celda: (u) =>
        u.rol === "administrador" ? (
          <span className="rounded-full bg-marca-suave px-2.5 py-0.5 text-sm font-semibold text-marca-oscura">Dueño</span>
        ) : (
          <span>{u.puesto ? NOMBRE_PUESTO[u.puesto] : <span className="text-amarillo">Cobrador · falta elegir puesto</span>}</span>
        ),
    },
    {
      clave: "estado",
      titulo: "Estado",
      celda: (u) => <span className={`font-semibold ${u.activo ? "text-verde" : "text-rojo"}`}>{u.activo ? "Activo" : "Desactivado"}</span>,
    },
    {
      clave: "acciones",
      titulo: "",
      celda: (u) =>
        // La cuenta del dueño no se desactiva ni cambia de rol (lo exige la base de datos)
        u.id === yo.id || u.rol === "administrador" ? null : (
          <div className="flex flex-wrap justify-end gap-1">
            <Boton variante="secundario" tamano="chico" onClick={() => setEditando(u)}>
              Editar
            </Boton>
            <Boton
              variante={u.activo ? "fantasma" : "secundario"}
              tamano="chico"
              cargando={ocupado === u.id}
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
      <TituloPagina
        titulo="Usuarios"
        sub="Solo el dueño administra el sistema. Cada trabajador entra con su propio usuario: el cajero de oficina o el cobrador de ruta."
        accion={
          <>
            <Boton variante="secundario" tamano="grande" onClick={() => setEditando("yo")}>
              Cambiar mi contraseña
            </Boton>
            <Boton tamano="grande" onClick={() => setAbierto(true)}>
              + Nuevo trabajador
            </Boton>
          </>
        }
      />
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

      {editando && (
        <ModalEditarUsuario
          usuario={editando}
          alCerrar={() => setEditando(null)}
          alGuardar={(texto) => {
            setEditando(null);
            setAviso({ tipo: "exito", texto });
            recargar();
          }}
        />
      )}

      <Modal
        abierto={abierto}
        titulo="Nuevo trabajador"
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
          <OpcionesBoton
            etiqueta="Puesto"
            obligatorio
            valor={f.puesto}
            alCambiar={(v) => setF({ ...f, puesto: v as Puesto })}
            opciones={(["oficina", "ruta"] as const).map((p) => ({ valor: p, texto: NOMBRE_PUESTO[p] }))}
          />
          {f.puesto && <p className="-mt-2 text-sm text-tenue">{DETALLE_PUESTO[f.puesto]}</p>}
          <Campo etiqueta="Nombre" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} obligatorio ayuda="Así aparece en el sistema y en los pagos que registre." />
          <Campo etiqueta="Correo" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} obligatorio autoComplete="off" ayuda="Con este correo inicia sesión." />
          <Campo etiqueta="Contraseña inicial" type="text" value={f.clave} onChange={(e) => setF({ ...f, clave: e.target.value })} obligatorio ayuda="Mínimo 6 caracteres." autoComplete="new-password" />
          <p className="text-sm text-tenue">
            Los dos solo registran pagos y ven quién no paga. No ven el panel de dinero ni los reportes, no crean contratos, no anulan pagos.
          </p>
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
