"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useSesion } from "@/components/layout/Sesion";
import { filtrarPorEmpresa, useConEmpresa, useEmpresa } from "@/components/layout/empresa";
import { Aviso, BotonEnlace, COLOR_HEX, Cargando, EtiquetaSemaforo, Tabla, TituloPagina, formatoFecha, formatoSoles, useCarga, type Columna, Placa } from "@/components/ui";
import type { Color, EstadoCliente } from "@/types/database";
import { claveBusqueda, coincide, normalizar } from "./_componentes/buscar";

type Fila = EstadoCliente & { sin_contrato?: boolean };

const COLORES_VALIDOS = new Set<string>(["verde", "amarillo", "rojo"]);

export default function PaginaClientes() {
  const { datos, esAdmin } = useSesion();
  const router = useRouter();
  const empresa = useEmpresa();
  const conEmpresa = useConEmpresa();
  const [texto, setTexto] = useState("");
  // ?color=rojo llega desde el semáforo del panel
  const colorInicial = useSearchParams().get("color") ?? "";
  const [color, setColor] = useState<Color | "">(() => (COLORES_VALIDOS.has(colorInicial) ? (colorInicial as Color) : ""));

  const { datos: filas, cargando, error } = useCarga(async () => {
    const [estado, clientes] = await Promise.all([datos.estadoClientes(), datos.clientes()]);
    const conContrato = new Set(estado.map((e) => e.cliente_id));
    const sinContrato: Fila[] = clientes
      .filter((c) => !conContrato.has(c.id))
      .map((c) => ({
        contrato_id: "",
        cliente_id: c.id,
        cliente: c.nombres,
        dni: c.dni,
        placa: "",
        celular: c.celular,
        empresa_id: c.empresa_id,
        empresa: "",
        cuota: 0,
        semanas_atraso: 0,
        deuda: 0,
        color: "verde",
        ultimo_pago: null,
        proxima_cuota: null,
        sin_contrato: true,
      }));
    return [...estado, ...sinContrato] as Fila[];
  }, [datos]);

  // clave de búsqueda por fila, calculada solo cuando llegan los datos
  const indice = useMemo(() => new Map((filas ?? []).map((f) => [f, claveBusqueda(f.cliente, f.dni, f.placa)])), [filas]);

  const visibles = useMemo(() => {
    const q = normalizar(texto);
    return filtrarPorEmpresa(filas ?? [], empresa)
      .filter((f) => (!color || (!f.sin_contrato && f.color === color)) && coincide(indice.get(f) ?? "", q))
      .sort((a, b) => Number(a.sin_contrato ?? false) - Number(b.sin_contrato ?? false) || a.cliente.localeCompare(b.cliente));
  }, [filas, indice, texto, color, empresa]);

  const columnas: Columna<Fila>[] = [
    { clave: "cliente", titulo: "Cliente", celda: (f) => <span className="font-semibold">{f.cliente}</span> },
    { clave: "dni", titulo: "DNI", celda: (f) => <span className="num">{f.dni}</span> },
    { clave: "placa", titulo: "Placa", celda: (f) => <Placa placa={f.placa} tamano="chico" /> },
    { clave: "empresa", titulo: "Empresa", celda: (f) => f.empresa || "—", ocultarEnMovil: true },
    {
      clave: "estado",
      titulo: "Estado",
      celda: (f) => (f.sin_contrato ? <span className="text-sm text-tenue">Sin contrato</span> : <EtiquetaSemaforo color={f.color} semanas={f.semanas_atraso} />),
    },
    { clave: "deuda", titulo: "Deuda", numero: true, celda: (f) => (f.sin_contrato ? "—" : formatoSoles(f.deuda)) },
    { clave: "ultimo", titulo: "Último pago", celda: (f) => formatoFecha(f.ultimo_pago), ocultarEnMovil: true },
  ];

  const colores: { valor: Color | ""; texto: string }[] = [
    { valor: "", texto: "Todos" },
    { valor: "verde", texto: "Al día" },
    { valor: "amarillo", texto: "1–3 sem." },
    { valor: "rojo", texto: "4+ sem." },
  ];

  return (
    <>
      <TituloPagina
        titulo="Clientes"
        sub={filas ? `${visibles.length} de ${filas.length}` : undefined}
        accion={
          esAdmin && (
            <BotonEnlace href={conEmpresa("/clientes/nuevo")} tamano="grande">
              + Nuevo cliente
            </BotonEnlace>
          )
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <input
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar por nombre, DNI o placa"
          aria-label="Buscar cliente"
          className="min-h-14 flex-1 rounded-2xl border border-borde bg-superficie px-5 text-lg focus:border-marca focus:ring-3 focus:ring-marca/20 focus:outline-none"
        />
        <div className="flex gap-2 overflow-x-auto" role="group" aria-label="Filtrar por color">
          {colores.map((c) => (
            <button
              key={c.valor || "todos"}
              onClick={() => setColor(c.valor)}
              aria-pressed={color === c.valor}
              className={`min-h-12 rounded-xl border px-4 font-semibold whitespace-nowrap ${
                color === c.valor ? "border-tinta bg-tinta text-white" : "border-borde bg-superficie"
              }`}
            >
              {c.texto}
            </button>
          ))}
        </div>
      </div>

      {error && <Aviso tipo="error">{error}</Aviso>}
      {cargando && !filas ? (
        <Cargando />
      ) : (
        <Tabla
          columnas={columnas}
          filas={visibles}
          claveFila={(f) => f.contrato_id || `cli-${f.cliente_id}`}
          alTocar={(f) => router.push(conEmpresa(`/clientes/ficha?id=${f.cliente_id}`))}
          acento={(f) => (f.sin_contrato ? undefined : COLOR_HEX[f.color])}
          vacio={texto ? "No se encontró ningún cliente con esa búsqueda." : "Todavía no hay clientes."}
        />
      )}
    </>
  );
}
