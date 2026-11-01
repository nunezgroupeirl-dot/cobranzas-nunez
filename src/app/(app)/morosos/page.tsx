"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useSesion } from "@/components/layout/Sesion";
import { filtrarPorEmpresa, useEmpresa } from "@/components/layout/empresa";
import { Aviso, Boton, COLOR_HEX, Cargando, EtiquetaSemaforo, Tabla, TituloPagina, formatoFecha, formatoSoles, hoyLima, useCarga, type Columna, Placa } from "@/components/ui";
import { copiarTexto, descargarExcel, enlaceWhatsApp, textoWhatsApp } from "@/lib/exportar";
import type { Color, Moroso } from "@/types/database";

export default function PaginaMorosos() {
  const { datos, empresas } = useSesion();
  const empresa = useEmpresa();
  const [color, setColor] = useState<Color | "">("");
  const [aviso, setAviso] = useState<string | null>(null);
  const { datos: morosos, cargando, error } = useCarga(() => datos.morosos(), [datos]);

  const lista = useMemo(() => filtrarPorEmpresa(morosos ?? [], empresa).filter((m) => !color || m.color === color), [morosos, empresa, color]);
  const total = lista.reduce((s, m) => s + m.deuda, 0);
  const nombreEmpresa = empresa ? empresas.find((e) => e.id === empresa)?.nombre : "Todas las empresas";
  const titulo = `¿Quién no paga? · ${nombreEmpresa} · ${formatoFecha(hoyLima())}`;

  const copiar = async () => {
    const ok = await copiarTexto(textoWhatsApp(lista, titulo));
    setAviso(ok ? "Lista copiada. Pégala en WhatsApp." : "No se pudo copiar. Mantén presionado para copiar manualmente.");
  };

  const excel = () =>
    descargarExcel(`morosos_${hoyLima()}`, [
      {
        nombre: "Morosos",
        columnas: ["Placa", "Cliente", "DNI", "Celular", "Empresa", "Semanas de atraso", "Color", "Cuota", "Deuda", "Último pago"],
        filas: lista.map((m) => [m.placa, m.cliente, m.dni, m.celular, m.empresa, m.semanas_atraso, m.color, m.cuota, m.deuda, formatoFecha(m.ultimo_pago)]),
      },
    ]);

  const columnas: Columna<Moroso>[] = [
    { clave: "placa", titulo: "Placa", celda: (m) => <Placa placa={m.placa} />, ocultarEnMovil: true },
    {
      clave: "cliente",
      titulo: "Cliente",
      celda: (m) => (
        <Link href={`/clientes/ficha?id=${m.cliente_id}`} className="font-semibold hover:text-marca hover:underline" onClick={(e) => e.stopPropagation()}>
          {m.cliente}
        </Link>
      ),
    },
    {
      clave: "celular",
      titulo: "Celular",
      celda: (m) =>
        m.celular ? (
          <span className="inline-flex items-center gap-3">
            <a href={`tel:${m.celular}`} className="num font-semibold text-marca underline">
              {m.celular}
            </a>
            <a
              href={enlaceWhatsApp(`Hola ${m.cliente.split(" ")[0]}, le recordamos que tiene ${m.semanas_atraso} semana(s) de atraso (${formatoSoles(m.deuda)}) de la moto ${m.placa}.`, m.celular)}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg bg-verde-suave px-2 py-1 text-sm font-bold text-verde"
            >
              WhatsApp
            </a>
          </span>
        ) : (
          "—"
        ),
    },
    { clave: "atraso", titulo: "Atraso", celda: (m) => <EtiquetaSemaforo color={m.color} semanas={m.semanas_atraso} /> },
    { clave: "deuda", titulo: "Deuda", numero: true, celda: (m) => <span className="font-bold">{formatoSoles(m.deuda)}</span>, ocultarEnMovil: true },
    { clave: "ultimo", titulo: "Último pago", celda: (m) => formatoFecha(m.ultimo_pago) },
    { clave: "empresa", titulo: "Empresa", celda: (m) => m.empresa, ocultarEnMovil: true },
  ];

  const filtros: { valor: Color | ""; texto: string }[] = [
    { valor: "", texto: "Todos" },
    { valor: "amarillo", texto: "🟡 1 a 3 semanas" },
    { valor: "rojo", texto: "🔴 4 o más" },
  ];

  return (
    <>
      <TituloPagina
        titulo="¿Quién no paga?"
        sub={morosos ? `${lista.length} clientes con atraso · deben ${formatoSoles(total)}` : undefined}
        accion={
          <>
            <Boton variante="secundario" onClick={excel} disabled={!lista.length}>
              Descargar Excel
            </Boton>
            <Boton onClick={copiar} disabled={!lista.length}>
              Copiar para WhatsApp
            </Boton>
          </>
        }
      />
      <div className="mb-4 flex gap-2 overflow-x-auto" role="group" aria-label="Filtrar por color">
        {filtros.map((f) => (
          <button
            key={f.valor || "todos"}
            onClick={() => setColor(f.valor)}
            aria-pressed={color === f.valor}
            className={`min-h-12 rounded-xl border px-4 font-semibold whitespace-nowrap ${color === f.valor ? "border-tinta bg-tinta text-white" : "border-borde bg-superficie"}`}
          >
            {f.texto}
          </button>
        ))}
      </div>
      {aviso && (
        <div className="mb-3">
          <Aviso tipo="exito" alCerrar={() => setAviso(null)}>
            {aviso}
          </Aviso>
        </div>
      )}
      {error && <Aviso tipo="error">{error}</Aviso>}
      {cargando && !morosos ? (
        <Cargando />
      ) : (
        <Tabla
          columnas={columnas}
          filas={lista}
          claveFila={(m) => m.contrato_id}
          acento={(m) => COLOR_HEX[m.color]}
          tituloMovil={(m) => (
            <span className="flex items-center justify-between gap-2">
              <span>
                <Placa placa={m.placa} tamano="chico" /> · {m.cliente}
              </span>
              <span className="num text-rojo">{formatoSoles(m.deuda)}</span>
            </span>
          )}
          vacio="Nadie tiene atraso. 🎉"
        />
      )}
    </>
  );
}
