"use client";
import { useState } from "react";
import { SoloAdmin, useSesion } from "@/components/layout/Sesion";
import { Aviso, Boton, Campo, Cargando, Modal, NOMBRE_MEDIO, OpcionesBoton, Selector, Tabla, Tarjeta, TituloPagina, mensajeDeError, useCarga, type Columna } from "@/components/ui";
import { ENTIDADES_BANCO, esBilletera, nombreCuenta, partesCuenta } from "@/lib/cuentas";
import type { Cuenta, Empresa, MedioPago } from "@/types/database";
import { CamposEmpresa, type FormEmpresa } from "./_componentes/CamposEmpresa";

const MEDIOS_CUENTA: MedioPago[] = ["yape", "plin", "banco"];

/** La cuenta por partes: entidad, a nombre de quién y número. empresa_id "" = personal (sirve para todas las empresas). */
type FormCuenta = { id?: string; medio: MedioPago; entidad: string; empresa_id: string; titular: string; numero: string; activa: boolean };

const ENTIDAD_BILLETERA: Partial<Record<MedioPago, string>> = { yape: "Yape", plin: "Plin" };

const formDe = (c: Cuenta): FormCuenta => {
  const p = partesCuenta(c);
  return { id: c.id, medio: c.medio, entidad: p.entidad, empresa_id: c.empresa_id ?? "", titular: p.titular, numero: p.numero, activa: c.activa };
};

/** Bancos primero (BCP, Interbank…), luego Yape y Plin. */
const ordenEntidad = (e: string) => (e === "Yape" ? 1 : e === "Plin" ? 2 : 0);


function Configuracion() {
  const { datos } = useSesion();
  const { datos: info, cargando, error, recargar } = useCarga(async () => {
    const [empresas, cuentas] = await Promise.all([datos.empresas(), datos.todasLasCuentas()]);
    return { empresas, cuentas };
  }, [datos]);

  const [aviso, setAviso] = useState<{ tipo: "exito" | "error"; texto: string } | null>(null);
  const [empresa, setEmpresa] = useState<FormEmpresa | null>(null);
  const [cuenta, setCuenta] = useState<FormCuenta | null>(null);
  const [errForm, setErrForm] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const nombreEmpresa = (id: string | null) => info?.empresas.find((e) => e.id === id)?.nombre ?? "—";

  const guardarEmpresa = async () => {
    if (!empresa) return;
    if (!empresa.nombre.trim()) return setErrForm("Escribe el nombre de la empresa.");
    if (empresa.ruc && !/^\d{11}$/.test(empresa.ruc)) return setErrForm("El RUC debe tener 11 números.");
    setGuardando(true);
    setErrForm(null);
    try {
      await datos.guardarEmpresa(empresa);
      setEmpresa(null);
      setAviso({ tipo: "exito", texto: "Empresa guardada. Recarga la página para verla en el filtro de empresas." });
      recargar();
    } catch (e) {
      setErrForm(mensajeDeError(e));
    } finally {
      setGuardando(false);
    }
  };

  const guardarCuenta = async () => {
    if (!cuenta) return;
    const billetera = esBilletera(cuenta.medio);
    const entidad = billetera ? ENTIDAD_BILLETERA[cuenta.medio]! : cuenta.entidad.trim();
    const numero = cuenta.numero.replace(/\s+/g, "");
    if (!entidad) return setErrForm("Elige el banco.");
    if (!cuenta.empresa_id && !cuenta.titular.trim()) return setErrForm("Escribe a nombre de quién está (es una cuenta personal).");
    if (billetera && !/^9\d{8}$/.test(numero)) return setErrForm("El celular debe tener 9 números y empezar con 9.");
    if (!billetera && !/^[\d-]{8,24}$/.test(numero)) return setErrForm("Escribe el número de cuenta (solo números).");
    setGuardando(true);
    setErrForm(null);
    try {
      await datos.guardarCuenta({
        id: cuenta.id,
        medio: cuenta.medio,
        empresa_id: cuenta.empresa_id || null,
        entidad,
        titular: cuenta.titular.trim() || null,
        numero,
        nombre: nombreCuenta({ entidad, numero, titular: cuenta.titular }),
        activa: cuenta.activa,
      });
      setCuenta(null);
      setAviso({ tipo: "exito", texto: "Cuenta guardada." });
      recargar();
    } catch (e) {
      setErrForm(mensajeDeError(e));
    } finally {
      setGuardando(false);
    }
  };

  /** Eliminar empresa o cuenta. Si tiene datos ligados, la base de datos lo impide y se explica qué hacer. */
  const eliminar = async (texto: string, accion: () => Promise<void>, hecho: string) => {
    if (!confirm(texto)) return;
    try {
      await accion();
      setAviso({ tipo: "exito", texto: hecho });
      recargar();
    } catch (e) {
      setAviso({ tipo: "error", texto: mensajeDeError(e) });
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

  if (cargando && !info) return <Cargando variante="formulario" />;
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
        <div className="flex flex-wrap justify-end gap-1">
          <Boton variante="secundario" tamano="chico" onClick={() => { setErrForm(null); setEmpresa({ ...e }); }}>
            Editar
          </Boton>
          <Boton
            variante="borrar"
            tamano="chico"
            onClick={() =>
              eliminar(`¿Eliminar la empresa "${e.nombre}"? Solo se puede si no tiene clientes, vehículos, cuentas ni contratos.`, () => datos.eliminarEmpresa(e.id), `Empresa "${e.nombre}" eliminada. Recarga la página para quitarla del filtro.`)
            }
          >
            Eliminar
          </Boton>
        </div>
      ),
    },
  ];

  const colCuentas: Columna<Cuenta>[] = [
    {
      clave: "entidad",
      titulo: "Medio",
      celda: (c) => <span className={`font-bold ${c.activa ? "" : "text-tenue line-through"}`}>{partesCuenta(c).entidad}</span>,
    },
    {
      clave: "titular",
      titulo: "A nombre de",
      celda: (c) => {
        const { titular } = partesCuenta(c);
        return <span className={c.activa ? "" : "text-tenue line-through"}>{titular || nombreEmpresa(c.empresa_id)}</span>;
      },
    },
    { clave: "numero", titulo: "Número", celda: (c) => <span className={`num ${c.activa ? "" : "text-tenue line-through"}`}>{partesCuenta(c).numero}</span> },
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
          <Boton variante="secundario" tamano="chico" onClick={() => { setErrForm(null); setCuenta(formDe(c)); }}>
            Editar
          </Boton>
          <Boton variante="fantasma" tamano="chico" onClick={() => cambiarActiva(c)}>
            {c.activa ? "Desactivar" : "Activar"}
          </Boton>
          <Boton
            variante="borrar"
            tamano="chico"
            onClick={() => eliminar(`¿Eliminar la cuenta "${c.nombre}"? Si ya tiene pagos, no se podrá: desactívala.`, () => datos.eliminarCuenta(c.id), `Cuenta "${c.nombre}" eliminada.`)}
          >
            Eliminar
          </Boton>
        </div>
      ),
    },
  ];

  // las cuentas de cada empresa (bancos primero, luego Yape y Plin) y al final los Yape/Plin personales
  const enOrden = (lista: Cuenta[]) =>
    [...lista].sort(
      (a, b) =>
        Number(b.activa) - Number(a.activa) ||
        ordenEntidad(partesCuenta(a).entidad) - ordenEntidad(partesCuenta(b).entidad) ||
        partesCuenta(a).entidad.localeCompare(partesCuenta(b).entidad, "es"),
    );
  const porEmpresa = [
    ...info.empresas.map((e) => ({ clave: e.id, titulo: e.nombre, ayuda: "", lista: enOrden(info.cuentas.filter((c) => c.empresa_id === e.id)) })),
    {
      clave: "personales",
      titulo: "Personales",
      ayuda: "Cuentas personales (de banco, Yape o Plin) que sirven para cobrar a clientes de todas las empresas.",
      lista: enOrden(info.cuentas.filter((c) => !c.empresa_id)),
    },
  ].filter((g) => g.lista.length > 0 || g.clave !== "personales");


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
        <Tarjeta
          titulo="Empresas"
          accion={
            <Boton tamano="chico" onClick={() => { setErrForm(null); setEmpresa({ nombre: "", ruc: "" }); }}>
              + Agregar empresa
            </Boton>
          }
        >
          <p className="mb-3 text-sm text-tenue">El nombre debe coincidir con la columna EMPRESA de la plantilla Excel para poder importar clientes.</p>
          <Tabla columnas={colEmpresas} filas={info.empresas} claveFila={(e) => e.id} />
        </Tarjeta>
        <Tarjeta
          titulo="Cuentas de cobro"
          accion={
            <Boton tamano="chico" onClick={() => { setErrForm(null); setCuenta({ medio: "banco", entidad: "BCP", empresa_id: info.empresas[0]?.id ?? "", titular: "", numero: "", activa: true }); }}>
              + Agregar cuenta
            </Boton>
          }
        >
          <p className="mb-3 text-sm text-tenue">
            Son las cuentas que se eligen al registrar un pago. Si un Yape llega a su tope, desactívalo: los pagos anteriores se conservan.
          </p>
          <div className="flex flex-col gap-2">
            {porEmpresa.map((g) => {
              const medios = [...new Set(g.lista.filter((c) => c.activa).map((c) => partesCuenta(c).entidad))];
              return (
                <details key={g.clave} className="group rounded-2xl border border-borde bg-superficie">
                  <summary className="flex min-h-14 cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 [&::-webkit-details-marker]:hidden">
                    <span aria-hidden className="inline-block text-marca transition-transform group-open:rotate-90">
                      ▸
                    </span>
                    <span className="text-lg font-bold">{g.titulo}</span>
                    <span className="text-sm text-tenue">
                      {g.lista.length === 0 ? "Sin cuentas todavía" : `${g.lista.length} ${g.lista.length === 1 ? "cuenta" : "cuentas"} · ${medios.join(", ") || "todas desactivadas"}`}
                    </span>
                  </summary>
                  <div className="border-t border-borde p-3">
                    {g.ayuda && <p className="mb-2 text-sm text-tenue">{g.ayuda}</p>}
                    {g.lista.length > 0 ? (
                      <Tabla columnas={colCuentas} filas={g.lista} claveFila={(c) => c.id} />
                    ) : (
                      <p className="text-sm text-tenue">Esta empresa aún no tiene cuentas. Agrégalas con “+ Agregar cuenta”.</p>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        </Tarjeta>
      </div>

      <Modal
        abierto={empresa !== null}
        titulo={empresa?.id ? "Editar empresa" : "Nueva empresa"}
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
        {empresa && <CamposEmpresa empresa={empresa} alCambiar={setEmpresa} error={errForm} />}
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
              etiqueta="Tipo de cuenta"
              obligatorio
              opciones={MEDIOS_CUENTA.map((m) => ({ valor: m, texto: NOMBRE_MEDIO[m] }))}
              valor={cuenta.medio}
              alCambiar={(v) => {
                const medio = v as MedioPago;
                setCuenta({ ...cuenta, medio, entidad: ENTIDAD_BILLETERA[medio] ?? (ENTIDAD_BILLETERA[cuenta.medio] ? "BCP" : cuenta.entidad) });
              }}
            />
            {!esBilletera(cuenta.medio) && (
              <>
                <Campo etiqueta="Banco" value={cuenta.entidad} onChange={(e) => setCuenta({ ...cuenta, entidad: e.target.value })} list="entidades-banco" obligatorio ayuda="Elige de la lista o escribe otro." />
                <datalist id="entidades-banco">
                  {ENTIDADES_BANCO.map((x) => (
                    <option key={x} value={x} />
                  ))}
                </datalist>
              </>
            )}
            <Selector
              etiqueta="Empresa"
              opciones={info.empresas.map((e) => ({ valor: e.id, texto: e.nombre }))}
              value={cuenta.empresa_id}
              onChange={(e) => setCuenta({ ...cuenta, empresa_id: e.target.value })}
              vacio="Ninguna: es personal (sirve para todas)"
              ayuda="Opcional: una cuenta personal (de banco, Yape o Plin) sirve para cobrar a clientes de todas las empresas."
            />
            <Campo
              etiqueta="A nombre de"
              value={cuenta.titular}
              onChange={(e) => setCuenta({ ...cuenta, titular: e.target.value })}
              placeholder="Ej.: Andrés Alexander Núñez Torres"
              obligatorio={!cuenta.empresa_id}
              ayuda={cuenta.empresa_id ? "Déjalo vacío si la cuenta está a nombre de la empresa." : "La persona dueña de la cuenta."}
            />
            <Campo
              etiqueta={esBilletera(cuenta.medio) ? "Número de celular" : "Número de cuenta"}
              inputMode="numeric"
              value={cuenta.numero}
              onChange={(e) => setCuenta({ ...cuenta, numero: e.target.value.replace(/[^\d-]/g, "") })}
              maxLength={esBilletera(cuenta.medio) ? 9 : 24}
              obligatorio
            />
            {(cuenta.entidad || ENTIDAD_BILLETERA[cuenta.medio]) && cuenta.numero && (
              <p className="text-sm text-tenue">
                Se verá así al registrar pagos:{" "}
                <b className="text-tinta">
                  {nombreCuenta({ entidad: ENTIDAD_BILLETERA[cuenta.medio] ?? cuenta.entidad, numero: cuenta.numero, titular: cuenta.titular })}
                </b>
              </p>
            )}
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
