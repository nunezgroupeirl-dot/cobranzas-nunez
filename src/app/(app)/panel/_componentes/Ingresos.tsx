"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useSesion } from "@/components/layout/Sesion";
import { Aviso, Cargando, NOMBRE_MEDIO, Tarjeta, formatoFecha, formatoSoles, hoyLima, useCarga } from "@/components/ui";
import type { MedioPago, Pago } from "@/types/database";

/**
 * Lo cobrado por días (lunes a domingo), semanas, meses o años, con flechas para ir atrás,
 * cuánto entró por cada medio (Yape, Plin, banco…) y la lista de cada pago con su cuenta y n.º de operación.
 * Cuenta solo pagos de cuotas (no anulados); las iniciales no están aquí.
 */

type Vista = "dias" | "semanas" | "meses" | "anios";

const VISTAS: { valor: Vista; texto: string }[] = [
  { valor: "dias", texto: "Días" },
  { valor: "semanas", texto: "Semanas" },
  { valor: "meses", texto: "Meses" },
  { valor: "anios", texto: "Años" },
];

const MEDIOS: MedioPago[] = ["yape", "plin", "banco", "agente", "efectivo"];
const COLOR_MEDIO: Record<MedioPago, string> = {
  yape: "#742284",
  plin: "#0f8a8a",
  banco: "#1d4ed8",
  agente: "#a64b07",
  efectivo: "#1f7a45",
};

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Set", "Oct", "Nov", "Dic"];
const MESES_LARGO = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre"];
const SEMANAS_POR_PAGINA = 8;

/* ---------- fechas "AAAA-MM-DD" (sin horas: se cuentan en UTC para no correr el día) ---------- */
const aFecha = (s: string) => new Date(`${s}T00:00:00Z`);
const aTexto = (d: Date) => d.toISOString().slice(0, 10);
const sumarDias = (s: string, n: number) => {
  const d = aFecha(s);
  d.setUTCDate(d.getUTCDate() + n);
  return aTexto(d);
};
const lunesDe = (s: string) => sumarDias(s, -((aFecha(s).getUTCDay() + 6) % 7));
const diaMes = (s: string) => `${Number(s.slice(8, 10))}/${Number(s.slice(5, 7))}`;

interface Barra {
  clave: string;
  etiqueta: string;
  sub?: string;
  futuro: boolean;
  esHoy: boolean;
}

interface PagoVista extends Pago {
  cliente: string;
  cliente_id: string;
  empresa_id: string;
  empresa: string;
  cuenta: string;
}

/** Las barras del periodo que se está viendo y el rango de fechas que cubren. */
function periodo(vista: Vista, atras: number, hoy: string, primerAnio: number) {
  const barras: Barra[] = [];
  let titulo = "";
  if (vista === "dias") {
    const lunes = sumarDias(lunesDe(hoy), -7 * atras);
    for (let i = 0; i < 7; i++) {
      const f = sumarDias(lunes, i);
      barras.push({ clave: f, etiqueta: DIAS[i], sub: diaMes(f), futuro: f > hoy, esHoy: f === hoy });
    }
    const domingo = sumarDias(lunes, 6);
    titulo = atras === 0 ? "Esta semana" : atras === 1 ? "Semana pasada" : `Semana del ${formatoFecha(lunes)}`;
    return { barras, desde: lunes, hasta: domingo, titulo, rango: `${formatoFecha(lunes)} al ${formatoFecha(domingo)}` };
  }
  if (vista === "semanas") {
    const ultima = sumarDias(lunesDe(hoy), -7 * SEMANAS_POR_PAGINA * atras);
    const primera = sumarDias(ultima, -7 * (SEMANAS_POR_PAGINA - 1));
    for (let i = 0; i < SEMANAS_POR_PAGINA; i++) {
      const l = sumarDias(primera, 7 * i);
      barras.push({ clave: l, etiqueta: diaMes(l), sub: `al ${diaMes(sumarDias(l, 6))}`, futuro: l > hoy, esHoy: l === lunesDe(hoy) });
    }
    titulo = atras === 0 ? `Últimas ${SEMANAS_POR_PAGINA} semanas` : `${SEMANAS_POR_PAGINA} semanas anteriores`;
    const hasta = sumarDias(ultima, 6);
    return { barras, desde: primera, hasta, titulo, rango: `${formatoFecha(primera)} al ${formatoFecha(hasta)}` };
  }
  if (vista === "meses") {
    const anio = Number(hoy.slice(0, 4)) - atras;
    for (let m = 1; m <= 12; m++) {
      const clave = `${anio}-${String(m).padStart(2, "0")}`;
      barras.push({ clave, etiqueta: MESES[m - 1], futuro: clave > hoy.slice(0, 7), esHoy: clave === hoy.slice(0, 7) });
    }
    return { barras, desde: `${anio}-01-01`, hasta: `${anio}-12-31`, titulo: `Año ${anio}`, rango: "de enero a diciembre" };
  }
  const actual = Number(hoy.slice(0, 4));
  for (let a = Math.min(primerAnio, actual); a <= actual; a++) barras.push({ clave: String(a), etiqueta: String(a), futuro: false, esHoy: a === actual });
  return { barras, desde: `${barras[0].clave}-01-01`, hasta: `${actual}-12-31`, titulo: "Todos los años", rango: "" };
}

const claveDe = (vista: Vista, fecha: string) =>
  vista === "dias" ? fecha : vista === "semanas" ? lunesDe(fecha) : vista === "meses" ? fecha.slice(0, 7) : fecha.slice(0, 4);

/** Nombre de una barra para el detalle: "lunes 17/11/2026", "semana del 17/11", "noviembre 2026"… */
function nombreBarra(vista: Vista, clave: string) {
  if (vista === "dias") return `${DIAS[(aFecha(clave).getUTCDay() + 6) % 7]} ${formatoFecha(clave)}`;
  if (vista === "semanas") return `semana del ${formatoFecha(clave)} al ${formatoFecha(sumarDias(clave, 6))}`;
  if (vista === "meses") return `${MESES_LARGO[Number(clave.slice(5, 7)) - 1]} ${clave.slice(0, 4)}`;
  return `año ${clave}`;
}

export function Ingresos({ empresa }: { empresa: string | null }) {
  const { datos, empresas } = useSesion();
  const hoy = hoyLima();
  const [vista, setVista] = useState<Vista>("dias");
  const [atras, setAtras] = useState(0);
  const [elegida, setElegida] = useState<string | null>(null);

  // todos los pagos vigentes con su cliente, empresa y cuenta (son pocos: se filtra en el navegador)
  const { datos: base, cargando, error } = useCarga(async () => {
    const [pagos, contratos, clientes, cuentas] = await Promise.all([
      datos.pagos({ incluir_anulados: false }),
      datos.contratos(),
      datos.clientes(),
      datos.cuentas().catch(() => []),
    ]);
    const contrato = new Map(contratos.map((c) => [c.id, c]));
    const cliente = new Map(clientes.map((c) => [c.id, c.nombres]));
    const cuenta = new Map(cuentas.map((c) => [c.id, c.nombre]));
    const nombreEmpresa = new Map(empresas.map((e) => [e.id, e.nombre]));
    return pagos
      .filter((p) => !p.anulado)
      .map((p): PagoVista => {
        const co = contrato.get(p.contrato_id);
        return {
          ...p,
          cliente_id: co?.cliente_id ?? "",
          cliente: (co && cliente.get(co.cliente_id)) || "—",
          empresa_id: co?.empresa_id ?? "",
          empresa: (co && nombreEmpresa.get(co.empresa_id)) || "—",
          cuenta: (p.cuenta_id && cuenta.get(p.cuenta_id)) || "",
        };
      });
  }, [datos, empresas]);

  const calc = useMemo(() => {
    const pagos = (base ?? []).filter((p) => !empresa || p.empresa_id === empresa);
    const primerAnio = pagos.reduce((m, p) => Math.min(m, Number(p.fecha_pago.slice(0, 4))), Number(hoy.slice(0, 4)));
    const per = periodo(vista, atras, hoy, primerAnio);
    const enRango = pagos.filter((p) => p.fecha_pago >= per.desde && p.fecha_pago <= per.hasta);
    const porBarra = new Map<string, { total: number; medios: Record<MedioPago, number> }>();
    for (const b of per.barras) porBarra.set(b.clave, { total: 0, medios: { yape: 0, plin: 0, banco: 0, agente: 0, efectivo: 0 } });
    for (const p of enRango) {
      const b = porBarra.get(claveDe(vista, p.fecha_pago));
      if (!b) continue;
      b.total += p.monto;
      b.medios[p.medio] += p.monto;
    }
    const tope = Math.max(1, ...[...porBarra.values()].map((b) => b.total));
    // lo que se detalla abajo: la barra tocada o todo el periodo
    const detalle = (elegida && porBarra.has(elegida) ? enRango.filter((p) => claveDe(vista, p.fecha_pago) === elegida) : enRango).sort(
      (a, b) => b.fecha_pago.localeCompare(a.fecha_pago) || b.creado_en.localeCompare(a.creado_en),
    );
    const porMedio = MEDIOS.map((m) => {
      const suyos = detalle.filter((p) => p.medio === m);
      return { medio: m, total: suyos.reduce((t, p) => t + p.monto, 0), n: suyos.length };
    }).filter((x) => x.n > 0);
    // a qué cuenta llegó (Yape de Andrés, BCP de Romi…)
    const cuentas = new Map<string, { nombre: string; medio: MedioPago; total: number; n: number }>();
    for (const p of detalle) {
      const nombre = p.cuenta || (p.entidad_origen ? `${NOMBRE_MEDIO[p.medio]} · ${p.entidad_origen}` : NOMBRE_MEDIO[p.medio]);
      const c = cuentas.get(nombre) ?? { nombre, medio: p.medio, total: 0, n: 0 };
      c.total += p.monto;
      c.n += 1;
      cuentas.set(nombre, c);
    }
    return {
      ...per,
      porBarra,
      tope,
      totalPeriodo: enRango.reduce((t, p) => t + p.monto, 0),
      detalle,
      totalDetalle: detalle.reduce((t, p) => t + p.monto, 0),
      porMedio,
      porCuenta: [...cuentas.values()].sort((a, b) => b.total - a.total),
      // se puede ir atrás mientras haya pagos antes del periodo que se ve
      hayAntes: pagos.some((p) => p.fecha_pago < per.desde),
    };
  }, [base, empresa, vista, atras, elegida, hoy]);

  const cambiarVista = (v: Vista) => {
    setVista(v);
    setAtras(0);
    setElegida(null);
  };
  const mover = (n: number) => {
    setAtras((a) => Math.max(0, a + n));
    setElegida(null);
  };

  const nav = "inline-flex min-h-10 items-center gap-1 rounded-xl border border-borde bg-superficie px-3 text-sm font-semibold hover:border-marca disabled:opacity-40 disabled:hover:border-borde";

  return (
    <Tarjeta className="mt-4" titulo="Ingresos (lo cobrado)">
      {/* días / semanas / meses / años */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-borde bg-fondo p-1" role="group" aria-label="Ver por">
          {VISTAS.map((v) => (
            <button
              key={v.valor}
              type="button"
              onClick={() => cambiarVista(v.valor)}
              aria-pressed={vista === v.valor}
              className={`min-h-9 rounded-lg px-4 text-sm font-semibold ${vista === v.valor ? "bg-tinta text-white" : "text-tenue hover:text-tinta"}`}
            >
              {v.texto}
            </button>
          ))}
        </div>
        {vista !== "anios" && (
          <div className="flex items-center gap-2">
            <button type="button" className={nav} onClick={() => mover(1)} disabled={!calc.hayAntes}>
              ‹ {vista === "dias" ? "Semana anterior" : vista === "semanas" ? "Anteriores" : "Año anterior"}
            </button>
            {atras > 0 && (
              <button type="button" className={nav} onClick={() => mover(-atras)}>
                Hoy
              </button>
            )}
            <button type="button" className={nav} onClick={() => mover(-1)} disabled={atras === 0}>
              {vista === "dias" ? "Siguiente" : vista === "semanas" ? "Siguientes" : "Año siguiente"} ›
            </button>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2">
        <p>
          <span className="font-display text-lg font-bold">{calc.titulo}</span>
          {calc.rango && <span className="text-sm text-tenue"> · {calc.rango}</span>}
        </p>
        <p className="text-sm text-tenue">
          Total: <b className="num font-display text-2xl text-verde">{formatoSoles(calc.totalPeriodo)}</b>
        </p>
      </div>

      {cargando && !base ? (
        <div className="mt-3">
          <Cargando />
        </div>
      ) : error ? (
        <Aviso tipo="error">{error}</Aviso>
      ) : (
        <>
          {/* una barra por día / semana / mes / año, partida por medio de pago */}
          <div
            className="mt-3 grid h-60 items-end gap-1 overflow-x-auto sm:gap-2"
            style={{ gridTemplateColumns: `repeat(${calc.barras.length}, minmax(2.75rem, 1fr))` }}
            role="radiogroup"
            aria-label="Elegir para ver el detalle"
          >
            {calc.barras.map((b) => {
              const d = calc.porBarra.get(b.clave)!;
              const activa = elegida === b.clave;
              return (
                <button
                  key={b.clave}
                  type="button"
                  role="radio"
                  aria-checked={activa}
                  disabled={b.futuro}
                  onClick={() => setElegida(activa ? null : b.clave)}
                  aria-label={`${nombreBarra(vista, b.clave)}: ${formatoSoles(d.total)}`}
                  className={`group flex h-full flex-col items-stretch justify-end gap-1 rounded-xl px-0.5 pt-1 pb-1 sm:px-1.5 ${activa ? "bg-marca-suave" : b.futuro ? "" : "hover:bg-fondo"}`}
                >
                  <span className={`num text-center text-[11px] leading-tight font-semibold sm:text-xs ${d.total ? "text-tinta" : "text-tenue"}`}>
                    {b.futuro ? "" : d.total ? formatoSoles(d.total).replace("S/ ", "") : "0"}
                  </span>
                  <span className="relative flex flex-1 flex-col justify-end">
                    <span className="flex flex-col-reverse overflow-hidden rounded-t-md" style={{ height: `${(d.total / calc.tope) * 100}%` }}>
                      {MEDIOS.filter((m) => d.medios[m] > 0).map((m) => (
                        <span key={m} style={{ height: `${(d.medios[m] / d.total) * 100}%`, background: COLOR_MEDIO[m], opacity: activa || !elegida ? 1 : 0.55 }} />
                      ))}
                    </span>
                    {!d.total && !b.futuro && <span className="h-0.5 rounded bg-borde" />}
                  </span>
                  <span className={`text-center text-xs leading-tight ${b.esHoy ? "font-bold text-marca" : activa ? "font-bold text-tinta" : b.futuro ? "text-tenue/60" : "text-tenue"}`}>
                    {b.etiqueta}
                    {b.sub && <span className="block text-[10px] font-normal">{b.sub}</span>}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-xs text-tenue">Toca un {vista === "dias" ? "día" : vista === "semanas" ? "semana" : vista === "meses" ? "mes" : "año"} para ver solo sus pagos.</p>

          {/* por medio y por cuenta */}
          <div className="mt-5 border-t border-borde pt-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-display font-bold">
                {elegida ? `Pagos del ${nombreBarra(vista, elegida)}` : `Pagos de ${calc.titulo.toLowerCase()}`}
                <span className="font-normal text-tenue"> · {calc.detalle.length} pagos · </span>
                <span className="num text-verde">{formatoSoles(calc.totalDetalle)}</span>
              </h3>
              {elegida && (
                <button type="button" onClick={() => setElegida(null)} className="text-sm font-semibold text-marca hover:underline">
                  ✕ Ver todo el periodo
                </button>
              )}
            </div>

            {calc.detalle.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-borde p-6 text-center text-tenue">No hay pagos en este periodo.</p>
            ) : (
              <>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <div>
                    <p className="mb-1.5 text-sm font-semibold text-tenue">Por medio de pago</p>
                    <ul className="flex flex-wrap gap-2">
                      {calc.porMedio.map((m) => (
                        <li key={m.medio} className="flex items-center gap-2 rounded-xl border border-borde bg-fondo px-3 py-2">
                          <span className="size-3 rounded-sm" style={{ background: COLOR_MEDIO[m.medio] }} aria-hidden />
                          <span className="text-sm font-semibold">{NOMBRE_MEDIO[m.medio]}</span>
                          <span className="num text-sm font-bold">{formatoSoles(m.total)}</span>
                          <span className="text-xs text-tenue">({m.n})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-1.5 text-sm font-semibold text-tenue">A qué cuenta llegó</p>
                    <ul className="divide-y divide-borde rounded-xl border border-borde">
                      {calc.porCuenta.map((c) => (
                        <li key={c.nombre} className="flex items-center gap-2 px-3 py-2 text-sm">
                          <span className="size-2.5 shrink-0 rounded-full" style={{ background: COLOR_MEDIO[c.medio] }} aria-hidden />
                          <span className="min-w-0 flex-1 truncate" title={c.nombre}>
                            {c.nombre}
                          </span>
                          <span className="text-xs text-tenue">{c.n}</span>
                          <span className="num font-bold">{formatoSoles(c.total)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* cada pago */}
                <div className="mt-4 overflow-x-auto rounded-xl border border-borde">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-fondo text-tenue">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Fecha</th>
                        <th className="px-3 py-2 font-semibold">Cliente</th>
                        {!empresa && <th className="px-3 py-2 font-semibold">Empresa</th>}
                        <th className="px-3 py-2 text-right font-semibold">Monto</th>
                        <th className="px-3 py-2 font-semibold">Medio y cuenta</th>
                        <th className="px-3 py-2 font-semibold">N.º operación</th>
                        <th className="px-3 py-2 font-semibold">Registró</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calc.detalle.slice(0, 300).map((p) => (
                        <tr key={p.id} className="border-t border-borde align-top">
                          <td className="num px-3 py-2 whitespace-nowrap">{formatoFecha(p.fecha_pago)}</td>
                          <td className="px-3 py-2">
                            {p.cliente_id ? (
                              <Link href={`/clientes/ficha?id=${p.cliente_id}`} className="font-semibold hover:text-marca hover:underline">
                                {p.cliente}
                              </Link>
                            ) : (
                              p.cliente
                            )}
                          </td>
                          {!empresa && <td className="px-3 py-2 text-tenue">{p.empresa}</td>}
                          <td className="num px-3 py-2 text-right font-bold whitespace-nowrap">{formatoSoles(p.monto)}</td>
                          <td className="px-3 py-2">
                            <span className="inline-flex items-center gap-1.5 font-semibold">
                              <span className="size-2.5 rounded-full" style={{ background: COLOR_MEDIO[p.medio] }} aria-hidden />
                              {NOMBRE_MEDIO[p.medio]}
                              {p.entidad_origen ? ` · ${p.entidad_origen}` : ""}
                            </span>
                            {p.cuenta && <span className="block text-xs text-tenue">{p.cuenta}</span>}
                          </td>
                          <td className="num px-3 py-2 text-tenue">{p.nro_operacion || "—"}</td>
                          <td className="px-3 py-2 text-tenue">{p.registrado_por_nombre || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {calc.detalle.length > 300 && <p className="mt-2 text-xs text-tenue">Se muestran los 300 más recientes. Toca un día, semana o mes para ver menos.</p>}
              </>
            )}
          </div>
          <p className="mt-3 text-xs text-tenue">Solo pagos de cuotas registrados en el sistema (sin anulados). Las iniciales no se cuentan aquí.</p>
        </>
      )}
    </Tarjeta>
  );
}
