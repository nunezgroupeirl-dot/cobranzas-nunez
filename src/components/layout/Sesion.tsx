"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getDatos, type Datos } from "@/lib/supabase/datos";
import type { Empresa, Perfil, Rol } from "@/types/database";
import { Cargando } from "@/components/ui/Tarjeta";
import { mensajeDeError } from "@/components/ui/formato";
import { INICIO_COBRADOR, rutaPermitida } from "./menu";

interface ValorSesion {
  perfil: Perfil;
  datos: Datos;
  empresas: Empresa[];
  esAdmin: boolean;
  salir: () => Promise<void>;
}

const Contexto = createContext<ValorSesion | null>(null);

export function useSesion(): ValorSesion {
  const v = useContext(Contexto);
  if (!v) throw new Error("useSesion debe usarse dentro de <ProveedorSesion>");
  return v;
}

/**
 * Carga la sesión; si no hay, manda al login.
 * El sitio es estático: la sesión vive en el navegador, así que esta comprobación es del lado
 * del cliente. La protección real de los datos la hace la base de datos (RLS).
 */
export function ProveedorSesion({ children }: { children: ReactNode }) {
  const router = useRouter();
  const ruta = usePathname();
  const [valor, setValor] = useState<Omit<ValorSesion, "salir"> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const datos = await getDatos();
        const perfil = await datos.sesion();
        if (!perfil) {
          // Mientras tanto se muestra "Verificando sesión…", así que no hay parpadeo de otra pantalla.
          // react-doctor-disable-next-line nextjs-no-client-side-redirect
          if (vivo) router.replace(`/login?volver=${encodeURIComponent(ruta)}`);
          return;
        }
        const empresas = await datos.empresas();
        if (vivo) setValor({ perfil, datos, empresas, esAdmin: perfil.rol === "administrador" });
      } catch (e) {
        if (vivo) setError(mensajeDeError(e));
      }
    })();
    return () => {
      vivo = false;
    };
    // Solo al montar: la sesión no cambia al navegar entre pantallas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const salir = useCallback(async () => {
    await valor?.datos.salir();
    router.replace("/login");
  }, [valor, router]);

  // Mismo objeto entre renders: las pantallas que leen la sesión no se redibujan de más
  const contexto = useMemo(() => (valor ? { ...valor, salir } : null), [valor, salir]);

  if (error)
    return (
      <div className="mx-auto mt-16 flex max-w-lg flex-col gap-4 p-4 text-center">
        <p className="text-lg font-semibold">No se pudo abrir el sistema.</p>
        <p className="text-tenue">{error}</p>
        <button onClick={() => window.location.reload()} className="mx-auto min-h-12 rounded-xl bg-marca px-5 font-semibold text-white">
          Intentar otra vez
        </button>
      </div>
    );
  if (!contexto) return <Cargando texto="Verificando sesión…" />;
  return (
    <Contexto.Provider value={contexto}>
      <GuardaRol rol={contexto.perfil.rol} ruta={ruta}>
        {children}
      </GuardaRol>
    </Contexto.Provider>
  );
}

/** El cobrador solo entra a "Registrar pago" y "¿Quién no paga?"; cualquier otra pantalla lo lleva a registrar pago. */
function GuardaRol({ rol, ruta, children }: { rol: Rol; ruta: string; children: ReactNode }) {
  const router = useRouter();
  const permitida = rutaPermitida(rol, ruta.replace(/\/$/, "") || "/");
  useEffect(() => {
    // Mientras tanto se muestra "Cargando…": el cobrador nunca ve la pantalla bloqueada.
    // react-doctor-disable-next-line nextjs-no-client-side-redirect
    if (!permitida) router.replace(INICIO_COBRADOR);
  }, [permitida, router]);
  if (!permitida) return <Cargando />;
  return <>{children}</>;
}

/** Envuelve contenido que solo puede ver el administrador. */
export function SoloAdmin({ children }: { children: ReactNode }) {
  const { esAdmin } = useSesion();
  if (!esAdmin)
    return (
      <div className="rounded-2xl border border-borde bg-superficie p-8 text-center">
        <p className="text-lg font-semibold">Esta pantalla es solo para el administrador.</p>
      </div>
    );
  return <>{children}</>;
}
