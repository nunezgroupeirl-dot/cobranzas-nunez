"use client";
import { useMemo, useState } from "react";
import { SoloAdmin, useSesion } from "@/components/layout/Sesion";
import { Aviso, Boton, Tabla, Tarjeta, TituloPagina, formatoFecha, formatoSoles, mensajeDeError, textoDocumento, type Columna, Placa } from "@/components/ui";
import { descargarExcel } from "@/lib/exportar";
import type { FilaImportacion } from "@/types/database";
import { claveEmpresa } from "@/lib/texto";

/** Columnas de la plantilla (public/plantilla-clientes.xlsx, hoja "Clientes") */
const COLUMNAS: Record<keyof Omit<FilaImportacion, "fila">, string> = {
  empresa: "EMPRESA",
  nombres: "NOMBRES Y APELLIDOS",
  dni: "DNI",
  celular: "CELULAR",
  direccion: "DIRECCION",
  referencia: "REFERENCIA",
  tipo: "TIPO DE MOTO",
  placa: "PLACA",
  marca: "MARCA",
  color: "COLOR",
  cuota: "CUOTA", // "CUOTA S/" o la antigua "CUOTA SEMANAL S/"
  nro_cuotas: "N DE CUOTAS",
  fecha_inicio: "FECHA 1 CUOTA",
  frecuencia: "FRECUENCIA",
  cuotas_pagadas: "CUOTAS YA PAGADAS",
  ultimo_pago: "FECHA ULTIMO PAGO",
  observaciones: "OBSERVACIONES",
  precio: "PRECIO", // opcional
  inicial: "INICIAL", // opcional
};

type Valor = string | number | boolean | Date | null;

type Estado = "lista" | "error" | "ejemplo" | "importada" | "fallida";
interface FilaVista {
  datos: FilaImportacion;
  estado: Estado;
  mensaje: string;
}

const normalizarEncabezado = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const texto = (v: Valor): string => (v === null || v === undefined ? "" : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).trim());

const numero = (v: Valor): number | null => {
  if (v === null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/** Acepta fecha de Excel, "dd/mm/aaaa" o "aaaa-mm-dd" */
const fecha = (v: Valor): string | null => {
  if (v === null || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const t = String(v).trim();
  let m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
};

function validar(f: FilaImportacion, empresas: Set<string>): string | null {
  if (!f.empresa) return "Falta la empresa.";
  if (!empresas.has(claveEmpresa(f.empresa))) return `La empresa "${f.empresa}" no existe. Revisa el nombre en Configuración.`;
  if (!f.nombres) return "Falta el nombre.";
  if (f.dni && !/^\d{8,12}$/.test(f.dni)) return "El DNI debe tener 8 números (Carné de Extranjería: 9 a 12).";
  if (!f.cuota || f.cuota <= 0) return "Falta la cuota.";
  if (!f.nro_cuotas || !Number.isInteger(f.nro_cuotas) || f.nro_cuotas < 1) return "Falta el número de cuotas.";
  if (!f.fecha_inicio) return "Falta la fecha de la 1.ª cuota (formato día/mes/año).";
  if (f.cuotas_pagadas !== null && (f.cuotas_pagadas < 0 || f.cuotas_pagadas > f.nro_cuotas)) return "Las cuotas pagadas no pueden ser más que el número de cuotas.";
  return null;
}

function Importar() {
  const { datos, empresas } = useSesion();
  const [archivo, setArchivo] = useState<string | null>(null);
  const [filas, setFilas] = useState<FilaVista[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [avance, setAvance] = useState<{ hechas: number; total: number } | null>(null);

  const nombresEmpresas = useMemo(() => new Set(empresas.map((e) => claveEmpresa(e.nombre))), [empresas]);
  const conteo = useMemo(() => {
    const c: Record<Estado, number> = { lista: 0, error: 0, ejemplo: 0, importada: 0, fallida: 0 };
    filas.forEach((f) => c[f.estado]++);
    return c;
  }, [filas]);

  const leer = async (f: File | undefined) => {
    if (!f) return;
    setError(null);
    setFilas([]);
    setLeyendo(true);
    try {
      const { default: leerExcel, readSheetNames } = await import("read-excel-file");
      const hojas = await readSheetNames(f);
      const hoja = hojas.find((h) => normalizarEncabezado(h) === "CLIENTES") ?? hojas[0];
      const crudas = (await leerExcel(f, { sheet: hoja })) as Valor[][];
      if (crudas.length < 2) throw new Error("La hoja no tiene filas de clientes.");

      const encabezados = crudas[0].map((h) => normalizarEncabezado(texto(h)));
      const indice = {} as Record<keyof typeof COLUMNAS, number>;
      for (const [clave, nombre] of Object.entries(COLUMNAS) as [keyof typeof COLUMNAS, string][]) {
        indice[clave] = encabezados.findIndex((h) => h === nombre || h.startsWith(`${nombre} `));
      }
      const faltan = (["empresa", "nombres", "cuota"] as const).filter((c) => indice[c] < 0);
      if (faltan.length) throw new Error(`No es la plantilla de clientes: faltan las columnas ${faltan.map((c) => COLUMNAS[c]).join(", ")}.`);

      const valor = (r: Valor[], c: keyof typeof COLUMNAS): Valor => (indice[c] >= 0 ? (r[indice[c]] ?? null) : null);
      const vista: FilaVista[] = [];
      crudas.slice(1).forEach((r, i) => {
        const d: FilaImportacion = {
          fila: i + 2,
          empresa: texto(valor(r, "empresa")),
          nombres: texto(valor(r, "nombres")),
          // Si Excel guardó el DNI como número, se pierde el 0 inicial: se repone solo en ese caso
          dni: typeof valor(r, "dni") === "number" ? String(valor(r, "dni")).padStart(8, "0") : texto(valor(r, "dni")).replace(/\D/g, ""),
          celular: texto(valor(r, "celular")).replace(/\D/g, ""),
          direccion: texto(valor(r, "direccion")),
          referencia: texto(valor(r, "referencia")),
          tipo: texto(valor(r, "tipo")),
          placa: texto(valor(r, "placa")).toUpperCase(),
          marca: texto(valor(r, "marca")),
          color: texto(valor(r, "color")),
          cuota: numero(valor(r, "cuota")),
          nro_cuotas: numero(valor(r, "nro_cuotas")),
          fecha_inicio: fecha(valor(r, "fecha_inicio")),
          frecuencia: texto(valor(r, "frecuencia")),
          cuotas_pagadas: numero(valor(r, "cuotas_pagadas")),
          ultimo_pago: fecha(valor(r, "ultimo_pago")),
          observaciones: texto(valor(r, "observaciones")),
          precio: numero(valor(r, "precio")),
          inicial: numero(valor(r, "inicial")),
        };
        if (!d.nombres && !d.dni && !d.placa) return; // fila vacía
        if (/EJEMPLO/i.test(d.nombres) || /^EJEMPLO/i.test(d.observaciones)) {
          vista.push({ datos: d, estado: "ejemplo", mensaje: "Fila de ejemplo: no se importa." });
          return;
        }
        const problema = validar(d, nombresEmpresas);
        vista.push({ datos: d, estado: problema ? "error" : "lista", mensaje: problema ?? "Lista para importar." });
      });

      // DNI + placa repetidos dentro del mismo archivo
      const placas = new Map<string, number>();
      vista.forEach((v) => v.datos.placa && placas.set(v.datos.placa, (placas.get(v.datos.placa) ?? 0) + 1));
      vista.forEach((v) => {
        if (v.estado === "lista" && v.datos.placa && (placas.get(v.datos.placa) ?? 0) > 1) {
          v.estado = "error";
          v.mensaje = `La placa ${v.datos.placa} está repetida en el archivo.`;
        }
      });

      setArchivo(f.name);
      setFilas(vista);
    } catch (e) {
      const mensaje = mensajeDeError(e);
      setError(
        /inline string|zip|unsupported|corrupt/i.test(mensaje)
          ? "No se pudo leer el archivo. Ábrelo en Excel, guárdalo otra vez como .xlsx («Libro de Excel») y vuelve a elegirlo."
          : mensaje,
      );
    } finally {
      setLeyendo(false);
    }
  };

  const importar = async () => {
    const pendientes = filas.filter((f) => f.estado === "lista");
    if (!pendientes.length) return;
    if (!confirm(`¿Importar ${pendientes.length} clientes? Cada uno queda con su contrato y cronograma.`)) return;
    setAvance({ hechas: 0, total: pendientes.length });

    // Varias filas a la vez (unas 4x más rápido con 1 500 clientes), pero las filas del
    // mismo DNI van juntas y en orden: así dos contratos del mismo cliente no chocan.
    const porDni = new Map<string, FilaVista[]>();
    for (const f of pendientes) porDni.set(f.datos.dni, [...(porDni.get(f.datos.dni) ?? []), f]);
    const grupos = [...porDni.values()];
    let hechas = 0;

    const importarGrupo = async (grupo: FilaVista[]) => {
      for (const f of grupo) {
        // react-doctor-disable-next-line async-await-in-loop
        await datos.importarCliente(f.datos).then(
          () => {
            f.estado = "importada";
            f.mensaje = "Importada.";
          },
          (e: unknown) => {
            f.estado = "fallida";
            f.mensaje = mensajeDeError(e);
          },
        );
        hechas++;
        setAvance({ hechas, total: pendientes.length });
        setFilas([...filas]);
      }
    };
    const trabajador = async () => {
      for (let g = grupos.shift(); g; g = grupos.shift()) await importarGrupo(g);
    };
    await Promise.all(Array.from({ length: Math.min(IMPORTAR_A_LA_VEZ, grupos.length) }, trabajador));
  };

  const descargarProblemas = () => {
    const malas = filas.filter((f) => f.estado === "error" || f.estado === "fallida");
    descargarExcel(`importacion_con_errores_${new Date().toISOString().slice(0, 10)}`, [
      {
        nombre: "Errores",
        columnas: ["Fila", "Empresa", "Cliente", "DNI", "Placa", "Problema"],
        filas: malas.map((f) => [f.datos.fila, f.datos.empresa, f.datos.nombres, f.datos.dni, f.datos.placa, f.mensaje]),
        anchos: [6, 28, 32, 10, 10, 60],
      },
    ]);
  };

  const columnas: Columna<FilaVista>[] = [
    { clave: "fila", titulo: "Fila", celda: (f) => <span className="num text-tenue">{f.datos.fila}</span> },
    {
      clave: "cliente",
      titulo: "Cliente",
      celda: (f) => (
        <span>
          <span className="block font-semibold">{f.datos.nombres || "—"}</span>
          <span className="num text-sm text-tenue">{textoDocumento(f.datos.dni)}</span>
        </span>
      ),
    },
    { clave: "placa", titulo: "Placa", celda: (f) => <Placa placa={f.datos.placa} tamano="chico" /> },
    { clave: "empresa", titulo: "Empresa", celda: (f) => f.datos.empresa, ocultarEnMovil: true },
    {
      clave: "cuotas",
      titulo: "Cuotas",
      ocultarEnMovil: true,
      celda: (f) => (
        <span className="text-sm">
          {f.datos.cuotas_pagadas ?? 0}/{f.datos.nro_cuotas ?? "—"} de {formatoSoles(f.datos.cuota)} · desde {formatoFecha(f.datos.fecha_inicio)}
        </span>
      ),
    },
    {
      clave: "estado",
      titulo: "Estado",
      celda: (f) => {
        const color =
          f.estado === "importada" ? "text-verde" : f.estado === "lista" ? "text-marca" : f.estado === "ejemplo" ? "text-tenue" : "text-rojo";
        return <span className={`text-sm font-semibold ${color}`}>{f.mensaje}</span>;
      },
    },
  ];

  const importando = avance !== null && avance.hechas < avance.total;

  return (
    <>
      <TituloPagina titulo="Importar clientes" sub="Carga los clientes activos desde la plantilla Excel." />
      <div className="flex flex-col gap-4">
        <Tarjeta titulo="1. Elegir el archivo">
          <ol className="mb-4 list-decimal space-y-1 pl-5 text-tenue">
            <li>
              Usa la{" "}
              <a href="/plantilla-clientes.xlsx" download="Plantilla_clientes_Nunez_y_Asociados.xlsx" className="font-semibold text-marca underline">
                plantilla de clientes
              </a>{" "}
              (hoja «Clientes»). Las filas de EJEMPLO se ignoran.
            </li>
            <li>Los nombres de la columna EMPRESA deben ser iguales a los de Configuración.</li>
            <li>Cada fila crea el cliente (o usa el que ya existe por DNI o por nombre), su moto y su contrato con las cuotas ya pagadas. Si falta el DNI o la placa, igual se importa y queda en «Datos pendientes».</li>
            <li>Si importas el mismo archivo dos veces, las filas ya importadas se rechazan solas.</li>
          </ol>
          <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-marca p-6 text-center font-semibold text-marca hover:bg-marca-suave">
            {leyendo ? "Leyendo el archivo…" : archivo ? `Archivo: ${archivo} · elegir otro` : "Elegir archivo .xlsx"}
            <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" disabled={importando} onChange={(e) => {
                leer(e.target.files?.[0]);
                e.target.value = ""; // así se puede volver a elegir el mismo archivo
              }}
            />
          </label>
          {error && (
            <div className="mt-3">
              <Aviso tipo="error">{error}</Aviso>
            </div>
          )}
        </Tarjeta>

        {filas.length > 0 && (
          <Tarjeta
            titulo="2. Revisar e importar"
            accion={
              <div className="flex flex-wrap gap-2">
                {conteo.error + conteo.fallida > 0 && (
                  <Boton variante="secundario" tamano="chico" onClick={descargarProblemas}>
                    Descargar errores
                  </Boton>
                )}
                <Boton tamano="chico" onClick={importar} disabled={conteo.lista === 0} cargando={importando}>
                  Importar {conteo.lista} {conteo.lista === 1 ? "cliente" : "clientes"}
                </Boton>
              </div>
            }
          >
            <p className="mb-3 text-sm text-tenue">
              {conteo.lista} listas · {conteo.error} con errores · {conteo.ejemplo} de ejemplo
              {conteo.importada + conteo.fallida > 0 && ` · ${conteo.importada} importadas · ${conteo.fallida} rechazadas`}
            </p>
            {avance && (
              <div className="mb-4">
                <div className="h-3 overflow-hidden rounded-full bg-fondo">
                  <div className="h-full bg-marca transition-[width] duration-300" style={{ width: `${(avance.hechas / avance.total) * 100}%` }} />
                </div>
                <p className="mt-1 text-sm text-tenue">
                  {avance.hechas} de {avance.total}
                  {!importando && " · terminado"}
                </p>
              </div>
            )}
            <Tabla columnas={columnas} filas={filas} claveFila={(f) => String(f.datos.fila)} />
          </Tarjeta>
        )}
      </div>
    </>
  );
}

/** Filas que se envían a la base al mismo tiempo. Más de 4 no acelera y satura la conexión. */
const IMPORTAR_A_LA_VEZ = 4;

export default function PaginaImportar() {
  return (
    <SoloAdmin>
      <Importar />
    </SoloAdmin>
  );
}
