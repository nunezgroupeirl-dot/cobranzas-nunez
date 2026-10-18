"use client";
import { useState } from "react";
import { SoloAdmin, useSesion } from "@/components/layout/Sesion";
import { Aviso, Boton, Campo, Cargando, Modal, NOMBRE_MEDIO, OpcionesBoton, Selector, Tabla, Tarjeta, TituloPagina, mensajeDeError, useCarga, type Columna } from "@/components/ui";
import type { Cuenta, Empresa, MedioPago } from "@/types/database";

const MEDIOS_CUENTA: MedioPago[] = ["yape", "plin", "banco"];

type FormCuenta = { id?: string; empresa_id: string; nombre: string; medio: MedioPago; activa: boolean };

function Configuracion() {
  const { datos } = useSesion();
  const { datos: info, cargando, error, recargar } = useCarga(async () => {
    const [empresas, cuentas] = await Promise.all([datos.empresas(), datos.todasLasCuentas()]);
    return { empresas, cuentas };
  }, [datos]);

  const [aviso, setAviso] = useState<{ tipo: "exito" | "error"; texto: string } | null>(null);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [cuenta, setCuenta] = useState<FormCuenta | null>(null);
  const [errForm, setErrForm] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const nombreEmpresa = (id: string) => info?.empresas.find((e) => e.id === id)?.nombre ?? "—";

  const guardarEmpresa = async () => {
    if (!empresa) return;
    if (!empresa.nombre.trim()) return setErrForm("Escribe el nombre de la empresa.");
    if (empresa.ruc && !/^\d{11}$/.test(empresa.ruc)) return setErrForm("El RUC debe tener 11 números.");
    setGuardando(true);
    setErrForm(null);
    try {
      await datos.guardarEmpresa({ id: empresa.id, nombre: empresa.nombre, ruc: empresa.ruc || null });
      setEmpresa(null);
      setAviso({ tipo: "exito", texto: "Empresa guardada. Recarga la página para verla con el nuevo nombre en el filtro de empresas." });
      recargar();
    } catch (e) {
      setErrForm(mensajeDeError(e));
    } finally {
      setGuardando(false);
    }
  };

  const guardarCuenta = async () => {
    if (!cuenta) return;
    if (!cuenta.empresa_id) return setErrForm("Elige la empresa.");
    if (!cuenta.nombre.trim()) return setErrForm("Escribe un nombre que Adrián reconozca, por ejemplo: Yape Andrés ***356.");
    setGuardando(true);
    setErrForm(null);
    try {
      await datos.guardarCuenta(cuenta);
      setCuenta(null);
      setAviso({ tipo: "exito", texto: "Cuenta guardada." });
      recargar();
    } catch (e) {
      setErrForm(mensajeDeError(e));
    } finally {
      setGuardando(false);
    }
  };

  const cambiarActiva = async (c: Cuenta) => {
    try {
      await datos.guardarCuenta({ ...c, activa: !c.activa });
      setAviso({ tipo: "exito", texto: c.activa ? `"${c.nombre}" desactivada: ya no aparece al registrar pagos.` : `"${c.nombre}" activada.` });
      recargar();
    } catch (e) {
      setAviso({ tipo: "error", texto: mensajeDeError(e) });
    }
  };

  if (cargando && !info) return <Cargando />;
  if (error) return <Aviso tipo="error">{error}</Aviso>;
  if (!info) return null;

  const colEmpresas: Columna<Empresa>[] = [
    { clave: "nombre", titulo: "Empresa", celda: (e) => <span className="font-semibold">{e.nombre}</span> },
    { clave: "ruc", titulo: "RUC", celda: (e) => <span className="num">{e.ruc ?? "—"}</span> },
    {
      clave: "cuentas",
      titulo: "Cuentas activas",
      numero: true,
      celda: (e) => <span className="num">{info.cuentas.filter((c) => c.empresa_id === e.id && c.activa).length}</span>,
    },
    {
      clave: "acciones",
      titulo: "",
      celda: (e) => (
        <Boton variante="secundario" tamano="chico" onClick={() => { setErrForm(null); setEmpresa({ ...e }); }}>
          Editar
        </Boton>
      ),
    },
  ];

  const colCuentas: Columna<Cuenta>[] = [
    { clave: "nombre", titulo: "Cuenta", celda: (c) => <span className={`font-semibold ${c.activa ? "" : "text-tenue line-through"}`}>{c.nombre}</span> },
    { clave: "medio", titulo: "Medio", celda: (c) => NOMBRE_MEDIO[c.medio] },
    { clave: "empresa", titulo: "Empresa", celda: (c) => nombreEmpresa(c.empresa_id) },
    {
      clave: "estado",
      titulo: "Estado",
      celda: (c) => <span className={`font-semibold ${c.activa ? "text-verde" : "text-tenue"}`}>{c.activa ? "Activa" : "Desactivada"}</span>,
    },
    {
      clave: "acciones",
      titulo: "",
      celda: (c) => (
        <div className="flex flex-wrap justify-end gap-1">
          <Boton variante="secundario" tamano="chico" onClick={() => { setErrForm(null); setCuenta({ ...c }); }}>
            Editar
          </Boton>
          <Boton variante="fantasma" tamano="chico" onClick={() => cambiarActiva(c)}>
            {c.activa ? "Desactivar" : "Activar"}
          </Boton>
        </div>
      ),
    },
  ];

  return (
    <>
      <TituloPagina titulo="Configuración" sub="Empresas y cuentas donde llega el dinero." />
      {aviso && (
        <div className="mb-4">
          <Aviso tipo={aviso.tipo} alCerrar={() => setAviso(null)}>
            {aviso.texto}
          </Aviso>
        </div>
      )}
      <div className="flex flex-col gap-4">
        <Tarjeta titulo="Empresas">
          <p className="mb-3 text-sm text-tenue">El nombre debe coincidir con la columna EMPRESA de la plantilla Excel para poder importar clientes.</p>
          <Tabla columnas={colEmpresas} filas={info.empresas} claveFila={(e) => e.id} />
        </Tarjeta>
        <Tarjeta
          titulo="Cuentas de cobro"
          accion={
            <Boton tamano="chico" onClick={() => { setErrForm(null); setCuenta({ empresa_id: info.empresas[0]?.id ?? "", nombre: "", medio: "yape", activa: true }); }}>
              + Agregar cuenta
            </Boton>
          }
        >
          <p className="mb-3 text-sm text-tenue">
            Son las cuentas que se eligen al registrar un pago. Si un Yape llega a su tope, desactívalo: los pagos anteriores se conservan.
          </p>
          <Tabla columnas={colCuentas} filas={info.cuentas} claveFila={(c) => c.id} vacio="Todavía no hay cuentas. Agrega las de Yape, Plin y bancos." />
        </Tarjeta>
      </div>

      <Modal
        abierto={empresa !== null}
        titulo="Editar empresa"
        alCerrar={() => setEmpresa(null)}
        pie={
          <>
            <Boton variante="secundario" onClick={() => setEmpresa(null)}>
              Cancelar
            </Boton>
            <Boton cargando={guardando} onClick={guardarEmpresa}>
              Guardar
            </Boton>
          </>
        }
      >
        {empresa && (
          <div className="flex flex-col gap-4">
            <Campo etiqueta="Razón social" value={empresa.nombre} onChange={(e) => setEmpresa({ ...empresa, nombre: e.target.value })} obligatorio />
            <Campo
              etiqueta="RUC"
              inputMode="numeric"
              maxLength={11}
              value={empresa.ruc ?? ""}
              onChange={(e) => setEmpresa({ ...empresa, ruc: e.target.value.replace(/\D/g, "") })}
              ayuda="11 números. Opcional."
            />
            {errForm && <Aviso tipo="error">{errForm}</Aviso>}
          </div>
        )}
      </Modal>

      <Modal
        abierto={cuenta !== null}
        titulo={cuenta?.id ? "Editar cuenta" : "Nueva cuenta"}
        alCerrar={() => setCuenta(null)}
        pie={
          <>
            <Boton variante="secundario" onClick={() => setCuenta(null)}>
              Cancelar
            </Boton>
            <Boton cargando={guardando} onClick={guardarCuenta}>
              Guardar
            </Boton>
          </>
        }
      >
        {cuenta && (
          <div className="flex flex-col gap-4">
            <OpcionesBoton
              etiqueta="Medio"
              obligatorio
              opciones={MEDIOS_CUENTA.map((m) => ({ valor: m, texto: NOMBRE_MEDIO[m] }))}
              valor={cuenta.medio}
              alCambiar={(v) => setCuenta({ ...cuenta, medio: v as MedioPago })}
            />
            <Selector
              etiqueta="Empresa"
              obligatorio
              opciones={info.empresas.map((e) => ({ valor: e.id, texto: e.nombre }))}
              value={cuenta.empresa_id}
              onChange={(e) => setCuenta({ ...cuenta, empresa_id: e.target.value })}
            />
            <Campo
              etiqueta="Nombre de la cuenta"
              value={cuenta.nombre}
              onChange={(e) => setCuenta({ ...cuenta, nombre: e.target.value })}
              placeholder="Ej.: Yape Andrés ***356"
              ayuda="Como la reconoce quien registra los pagos. No pongas el número completo."
              obligatorio
            />
            {errForm && <Aviso tipo="error">{errForm}</Aviso>}
          </div>
        )}
      </Modal>
    </>
  );
}

export default function PaginaConfiguracion() {
  return (
    <SoloAdmin>
      <Configuracion />
    </SoloAdmin>
  );
}
