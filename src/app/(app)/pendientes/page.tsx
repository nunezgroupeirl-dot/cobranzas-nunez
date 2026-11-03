"use client";
import { useMemo, useState } from "react";
import { SoloAdmin, useSesion } from "@/components/layout/Sesion";
import { filtrarPorEmpresa, useEmpresa } from "@/components/layout/empresa";
import { Aviso, Boton, Cargando, Modal, TituloPagina, hoyLima, useCarga } from "@/components/ui";
import { descargarExcel } from "@/lib/exportar";
import { claveBusqueda, coincide, normalizar } from "@/lib/texto";
import { FormMoto } from "../contratos/_componentes/FormMoto";
import { CLAVES_FALTANTES, FALTANTES, calcularPendientes, contarPorDato, type Faltante, type FilaPendiente } from "./_componentes/faltantes";
import { TarjetaPendiente } from "./_componentes/TarjetaPendiente";

const GRUPOS = [
  { clave: "cliente", titulo: "Del cliente" },
  { clave: "moto", titulo: "De la moto" },
  { clave: "contrato", titulo: "Del contrato" },
] as const;
const POR_PAGINA = 40;

function Pendientes() {
  const { datos } = useSesion();
  const empresa = useEmpresa();
  const [dato, setDato] = useState<Faltante | "">("");
  const [texto, setTexto] = useState("");
  const [cuantos, setCuantos] = useState(POR_PAGINA);
  const [editandoMoto, setEditandoMoto] = useState<FilaPendiente | null>(null);

  const { datos: todas, cargando, error, recargar } = useCarga(async () => {
    const [estados, contratos, clientes, motos, documentos] = await Promise.all([
      datos.estadoClientes(),
      datos.contratos(),
      datos.clientes(),
      datos.motos(),
      datos.resumenDocumentos(),
    ]);
    return calcularPendientes({ estados, contratos, clientes, motos, documentos }).map((f) => ({ ...f, clave: claveBusqueda(f.cliente, f.placa) }));
  }, [datos]);

  const deEmpresa = useMemo(() => filtrarPorEmpresa(todas ?? [], empresa), [todas, empresa]);
  const cuenta = useMemo(() => contarPorDato(deEmpresa), [deEmpresa]);
  const lista = useMemo(() => {
    const q = normalizar(texto);
    return deEmpresa.filter((f) => (!dato || f.faltan.includes(dato)) && (!q || coincide(f.clave, q)));
  }, [deEmpresa, dato, texto]);

  const elegir = (k: Faltante) => {
    setDato((d) => (d === k ? "" : k));
    setCuantos(POR_PAGINA);
  };

  const excel = () =>
    descargarExcel(`datos_pendientes_${hoyLima()}`, [
      {
        nombre: "Pendientes",
        columnas: ["Cliente", "Placa", "Empresa", ...CLAVES_FALTANTES.map((k) => FALTANTES[k].texto), "Qué revisar"],
        filas: lista.map((f) => [f.cliente, f.placa ?? "", f.empresa, ...CLAVES_FALTANTES.map((k) => (f.faltan.includes(k) ? "FALTA" : "")), f.nota ?? ""]),
      },
    ]);

  return (
    <>
      <TituloPagina
        titulo="Datos pendientes"
        sub="De cada contrato activo, lo que falta completar. Toca un dato para ver solo a quiénes les falta."
        accion={
          <Boton variante="secundario" tamano="grande" onClick={excel} disabled={!lista.length}>
            Descargar lista (Excel)
          </Boton>
        }
      />
      {error && <Aviso tipo="error">{error}</Aviso>}
      {cargando && !todas ? (
        <Cargando />
      ) : (
        <>
          <div className="mb-4 grid gap-3 md:grid-cols-3">
            {GRUPOS.map((g) => (
              <section key={g.clave} className="rounded-2xl border border-borde bg-superficie p-3">
                <h2 className="mb-2 text-sm font-bold tracking-wide text-tenue uppercase">{g.titulo}</h2>
                <div className="flex flex-wrap gap-2">
                  {CLAVES_FALTANTES.filter((k) => FALTANTES[k].grupo === g.clave).map((k) => (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={dato === k}
                      onClick={() => elegir(k)}
                      disabled={!cuenta[k]}
                      className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition disabled:opacity-40 ${
                        dato === k ? "border-marca bg-marca text-white" : "border-borde bg-fondo hover:border-marca"
                      }`}
                    >
                      {FALTANTES[k].texto}
                      <span className={`num rounded-full px-2 py-0.5 text-xs ${dato === k ? "bg-white/20" : "bg-superficie"}`}>{cuenta[k]}</span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-3">
            <input
              type="search"
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value);
                setCuantos(POR_PAGINA);
              }}
              placeholder="Buscar por cliente o placa"
              className="min-h-12 flex-1 rounded-2xl border border-borde bg-superficie px-4 focus:border-marca focus:outline-none"
              aria-label="Buscar"
            />
            <p className="text-sm text-tenue">
              <b className="text-tinta">{lista.length}</b> de {deEmpresa.length} contratos con datos pendientes
              {dato && (
                <>
                  {" "}· {FALTANTES[dato].texto}{" "}
                  <button type="button" className="font-semibold text-marca underline" onClick={() => setDato("")}>
                    quitar filtro
                  </button>
                </>
              )}
            </p>
          </div>

          {deEmpresa.length === 0 ? (
            <Aviso tipo="exito">Todo completo: ningún contrato activo tiene datos pendientes.</Aviso>
          ) : (
            <ul className="flex flex-col gap-3">
              {lista.slice(0, cuantos).map((f) => (
                <TarjetaPendiente key={f.contrato_id} fila={f} resaltado={dato} alEditarMoto={() => setEditandoMoto(f)} />
              ))}
            </ul>
          )}
          {lista.length > cuantos && (
            <div className="mt-4 flex justify-center">
              <Boton variante="secundario" onClick={() => setCuantos((n) => n + POR_PAGINA)}>
                Ver {Math.min(POR_PAGINA, lista.length - cuantos)} más
              </Boton>
            </div>
          )}
        </>
      )}

      <Modal abierto={editandoMoto !== null} titulo={`Completar moto · ${editandoMoto?.cliente ?? ""}`} alCerrar={() => setEditandoMoto(null)}>
        {editandoMoto?.moto && (
          <FormMoto
            moto={editandoMoto.moto}
            abrirFicha
            alCancelar={() => setEditandoMoto(null)}
            alGuardar={() => {
              setEditandoMoto(null);
              recargar();
            }}
          />
        )}
      </Modal>
    </>
  );
}

export default function PaginaPendientes() {
  return (
    <SoloAdmin>
      <Pendientes />
    </SoloAdmin>
  );
}

