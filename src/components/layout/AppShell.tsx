"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { BuscadorGlobal } from "./BuscadorGlobal";
import { useConEmpresa } from "./empresa";
import { Marca } from "./Marca";
import { FiltroEmpresa } from "./FiltroEmpresa";
import { menuPara, type ItemMenu } from "./menu";
import { RecordatorioReporte } from "./RecordatorioReporte";
import { useSesion } from "./Sesion";

function Icono({ d, className = "size-6" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={d} />
    </svg>
  );
}

const NOMBRE_ROL = { administrador: "Dueño", cobrador: "Cobrador" } as const;

function activo(rutaActual: string, items: ItemMenu[]): string | null {
  const ruta = rutaActual.length > 1 ? rutaActual.replace(/\/$/, "") : rutaActual;
  const coincide = items.filter((i) => ruta === i.href || ruta.startsWith(`${i.href}/`));
  return coincide.sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;
}

export function AppShell({ children }: { children: ReactNode }) {
  const { perfil, datos, salir } = useSesion();
  const ruta = usePathname();
  const conEmpresa = useConEmpresa();
  const items = menuPara(perfil.rol);
  const actual = activo(ruta, items);
  const [masAbierto, setMasAbierto] = useState(false);

  const enBarra = items.filter((i) => i.enCelular).slice(0, 4);
  const hrefsBarra = new Set(enBarra.map((i) => i.href));
  const enMas = items.filter((i) => !hrefsBarra.has(i.href));

  return (
    <div className="min-h-dvh md:flex">
      {/* Menú lateral: tablet y escritorio */}
      <aside className="no-imprimir sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-borde bg-tinta text-white md:flex">
        <div className="px-5 pt-6 pb-6">
          <Marca claro />
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {items.map((i) => (
            <Link
              key={i.href}
              href={conEmpresa(i.href)}
              aria-current={actual === i.href ? "page" : undefined}
              className={`relative flex min-h-12 items-center gap-3 rounded-xl px-3 font-medium transition-colors ${
                actual === i.href
                  ? "bg-white/10 text-white before:absolute before:inset-y-2.5 before:left-0 before:w-1 before:rounded-full before:bg-[#5fc2c2]"
                  : "text-white/70 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icono d={i.icono} />
              {i.texto}
            </Link>
          ))}
        </nav>
        <div className="border-t border-white/10 p-4">
          {datos.modoPrueba && <p className="mb-3 rounded-lg bg-amarillo-suave px-2.5 py-1.5 text-xs font-semibold text-amarillo">Modo prueba: datos falsos</p>}
          <p className="truncate font-semibold">{perfil.nombre}</p>
          <p className="text-sm text-white/60">{NOMBRE_ROL[perfil.rol]}</p>
          <button onClick={salir} className="mt-3 min-h-11 w-full rounded-xl border border-white/20 font-semibold hover:bg-white/10">
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-imprimir sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-borde bg-fondo/95 px-4 py-3 backdrop-blur sm:px-6">
          <div className="shrink-0 md:hidden">
            <Marca chico />
          </div>
          <div className="flex min-w-0 flex-1 justify-end md:justify-start">
            <BuscadorGlobal />
          </div>
          <FiltroEmpresa compacto />
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-28 sm:px-6 md:pb-10">
          <RecordatorioReporte />
          {children}
        </main>
      </div>

      {/* Menú inferior: celular */}
      <nav className="no-imprimir fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-borde bg-superficie pb-[env(safe-area-inset-bottom)] md:hidden">
        {enBarra.map((i) => (
          <Link
            key={i.href}
            href={conEmpresa(i.href)}
            className={`flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${actual === i.href ? "text-marca" : "text-tenue"}`}
          >
            <Icono d={i.icono} />
            {i.corto}
          </Link>
        ))}
        <button onClick={() => setMasAbierto(true)} className="flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs font-semibold text-tenue">
          <Icono d="M4 6h16M4 12h16M4 18h16" />
          Más
        </button>
      </nav>

      {masAbierto && (
        <div className="fixed inset-0 z-50 flex items-end md:hidden">
          <button type="button" aria-label="Cerrar menú" className="absolute inset-0 bg-tinta/50" onClick={() => setMasAbierto(false)} />
          <div className="relative w-full rounded-t-3xl bg-superficie p-4 pb-8">
            {datos.modoPrueba && <p className="mb-3 rounded-xl bg-amarillo-suave px-3 py-2 text-sm font-semibold text-amarillo">Modo prueba: datos falsos</p>}
            <div className="flex flex-col gap-1">
              {enMas.map((i) => (
                <Link key={i.href} href={conEmpresa(i.href)} onClick={() => setMasAbierto(false)} className="flex min-h-14 items-center gap-3 rounded-xl px-3 font-semibold hover:bg-fondo">
                  <Icono d={i.icono} />
                  {i.texto}
                </Link>
              ))}
              <button onClick={salir} className="flex min-h-14 items-center gap-3 rounded-xl px-3 font-semibold text-rojo hover:bg-rojo-suave">
                <Icono d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
