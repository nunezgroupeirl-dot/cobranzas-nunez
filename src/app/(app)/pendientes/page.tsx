"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { SoloAdmin, useSesion } from "@/components/layout/Sesion";
import { filtrarPorEmpresa, useConEmpresa, useEmpresa } from "@/components/layout/empresa";
import { Aviso, Boton, Cargando, Modal, TituloPagina, hoyLima, useCarga } from "@/components/ui";
import { descargarExcel } from "@/lib/exportar";
import { claveBusqueda, coincide, normalizar } from "@/lib/texto";
import { FormMoto } from "../contratos/_componentes/FormMoto";
import { CLAVES_FALTANTES, FALTANTES, VISTAS, calcularPendientes, contarPorDato, filasDeVista, type Faltante, type FilaPendiente, type Vista } from "./_componentes/faltantes";
import { TarjetaPendiente } from "./_componentes/TarjetaPendiente";
import { AvisoContratos, PestanasVista } from "./_componentes/PestanasVista";

const GRUPOS = [
  { clave: "cliente", titulo: "Del cliente" },
  { clave: "moto", titulo: "Del vehículo" },
  { clave: "contrato", titulo: "Del contrato" },
] as const;
const POR_PAGINA = 40;
const TODO_COMPLETO: Record<Vista, string> = {
  cliente: "Todo completo: a ningún cliente ni vehículo le falta un dato.",
  contratos: "Todos los contratos activos están llenados y firmados.",
};
const CUENTA: Record<Vista, string> = { cliente: "contratos con datos pendientes", contratos: "contratos sin llenar o sin firmar" };

function Pendientes() {
  const { datos, empresas } = useSesion();
  const empresa = useEmpresa();
  const router = useRouter();
  const conEmpresa = useConEmpresa();
  // ?vista=contratos llega desde el número rojo del menú
  const vista: Vista = useSearchParams().get("vista") === "contratos" ? "contratos" : "cliente";
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
    const nombres = new Map(empresas.map((e) => [e.id, e.nombre]));
    return calcularPendientes({ estados, contratos, clientes, motos, documentos, empresas: nombres }).map((f) => ({ ...f, clave: claveBusqueda(f.cliente, f.placa) }));
  }, [datos, empresas]);

  const porVista = useMemo(() => {
    const base = filtrarPorEmpresa(todas ?? [], empresa);
    return { cliente: filasDeVista(base, "cliente"), contratos: filasDeVista(base, "contratos") };
  }, [todas, empresa]);
  const deEmpresa = porVista[vista];
  const grupos = GRUPOS.filter((g) => (VISTAS[vista].grupos as readonly string[]).includes(g.clave));
  const claves = CLAVES_FALTANTES.filter((k) => grupos.some((g) => g.clave === FALTANTES[k].grupo));

  const cambiarVista = (v: Vista) => {
    setDato("");
    setCuantos(POR_PAGINA);
    router.replace(conEmpresa(v === "contratos" ? "/pendientes?vista=contratos" : "/pendientes"), { scroll: false });
  };
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
    descargarExcel(`${vista === "contratos" ? "contratos_pendientes" : "datos_pendientes"}_${hoyLima()}`, [
      {
        nombre: VISTAS[vista].titulo,
        columnas: ["Cliente", "Placa", "Empresa", ...claves.map((k) => FALTANTES[k].texto), ...(vista === "cliente" ? ["Qué revisar"] : [])],
        filas: lista.map((f) => [
          f.cliente,
          f.placa ?? (f.moto?.placa_tramite ? "EN TRÁMITE" : ""),
          f.empresa,
          ...claves.map((k) => (f.faltan.includes(k) ? "FALTA" : "")),
          ...(vista === "cliente" ? [f.nota ?? ""] : []),
        ]),
      },
    ]);

  return (
    <>
      <TituloPagina
        titulo="Datos pendientes"
        sub="De cada contrato activo, lo que falta completar. El contrato va en su propia pestaña. Toca un dato para ver solo a quiénes les falta."
        accion={
          <Boton variante="secundario" tamano="grande" onClick={excel} disabled={!lista.length}>
            Descargar lista (Excel)
          </Boton>
        }
      />
      {error && <Aviso tipo="error">{error}</Aviso>}
      {cargando && !todas ? (
        <Cargando variante="tarjetas" />
      ) : (
        <>
          <PestanasVista vista={vista} cuentas={{ cliente: porVista.cliente.length, contratos: porVista.contratos.length }} alCambiar={cambiarVista} />
          {vista === "contratos" && porVista.contratos.length > 0 && <AvisoContratos cuantos={porVista.contratos.length} />}

          <div className={`mb-4 grid gap-3 ${grupos.length > 1 ? "md:grid-cols-2" : ""}`}>
            {grupos.map((g) => (
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
              <b className="text-tinta">{lista.length}</b> de {deEmpresa.length} {CUENTA[vista]}
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
            <Aviso tipo="exito">{TODO_COMPLETO[vista]}</Aviso>
          ) : (
            <ul className="flex flex-col gap-3">
              {lista.slice(0, cuantos).map((f) => (
                <TarjetaPendiente key={f.contrato_id || `cli-${f.cliente_id}`} fila={f} resaltado={dato} alEditarMoto={() => setEditandoMoto(f)} />
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

      <Modal abierto={editandoMoto !== null} titulo={`Completar vehículo · ${editandoMoto?.cliente ?? ""}`} alCerrar={() => setEditandoMoto(null)}>
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

