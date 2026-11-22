"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getDatos, type Datos } from "@/lib/supabase/datos";
import type { Empresa, Perfil } from "@/types/database";
import { Cargando } from "@/components/ui/Tarjeta";
import { mensajeDeError } from "@/components/ui/formato";
import { inicioPara, rutaPermitida } from "./menu";
import { marcarActividad, ultimaActividad, vencioPorInactividad } from "@/lib/inactividad";

interface ValorSesion {
  perfil: Perfil;
  datos: Datos;
  empresas: Empresa[];
  esAdmin: boolean;
  /** el dueño: el único que ve el Panel del dueño y los ingresos (otro administrador ve todo lo demás) */
  esDueno: boolean;
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
  const saliendo = useRef(false);

  // Si la sesión se cierra sola (venció, o se cerró en todos los equipos), se vuelve al login con aviso
  // en vez de seguir mostrando pantallas que ya no pueden leer datos ("No tienes permiso").
  useEffect(() => {
    if (!valor) return;
    return valor.datos.alPerderSesion(() => {
      // react-doctor-disable-next-line nextjs-no-client-side-redirect
      if (!saliendo.current) window.location.replace(`/login?volver=${encodeURIComponent(window.location.pathname)}&motivo=sesion`);
    });
  }, [valor]);

  // A los 20 minutos sin actividad la sesión se cierra sola y la página se recarga en el ingreso:
  // así nadie queda con una pantalla abierta que ya no deja hacer nada.
  useEffect(() => {
    if (!valor) return;
    let ultimaEscritura = 0;
    const alActuar = () => {
      const ahora = Date.now();
      if (ahora - ultimaEscritura < 15_000) return; // no se escribe en cada movimiento
      ultimaEscritura = ahora;
      marcarActividad();
    };
    const revisar = async () => {
      if (saliendo.current || !vencioPorInactividad(ultimaActividad())) return;
      saliendo.current = true;
      try {
        await valor.datos.salir();
      } finally {
        // react-doctor-disable-next-line nextjs-no-client-side-redirect
        window.location.replace(`/login?motivo=inactividad&volver=${encodeURIComponent(window.location.pathname)}`);
      }
    };
    // al abrir: si estuvo cerrada o dormida más de 20 minutos, sale enseguida; si no hay registro, empieza a contar
    if (ultimaActividad() === null) marcarActividad();
    void revisar();
    const eventos = ["pointerdown", "keydown", "wheel", "touchstart", "scroll", "mousemove"] as const;
    for (const e of eventos) window.addEventListener(e, alActuar, { passive: true, capture: true });
    const alVolver = () => {
      if (document.visibilityState === "visible") void revisar();
    };
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("focus", alVolver);
    const reloj = window.setInterval(() => void revisar(), 30_000);
    return () => {
      for (const e of eventos) window.removeEventListener(e, alActuar, { capture: true });
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("focus", alVolver);
      window.clearInterval(reloj);
    };
  }, [valor]);

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
        if (vivo) setValor({ perfil, datos, empresas, esAdmin: perfil.rol === "administrador", esDueno: perfil.rol === "administrador" && perfil.es_dueno === true });
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
    saliendo.current = true;
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
  if (!contexto) return <Cargando texto="Verificando sesión…" variante="pantalla" />;
  return (
    <Contexto.Provider value={contexto}>
      <GuardaRol perfil={contexto.perfil} ruta={ruta}>
        {children}
      </GuardaRol>
    </Contexto.Provider>
  );
}

/** El cobrador solo entra a "Registrar pago" y "¿Quién no paga?"; cualquier otra pantalla lo lleva a registrar pago. */
function GuardaRol({ perfil, ruta, children }: { perfil: Perfil; ruta: string; children: ReactNode }) {
  const router = useRouter();
  const permitida = rutaPermitida(perfil, ruta.replace(/\/$/, "") || "/");
  const inicio = inicioPara(perfil);
  useEffect(() => {
    // Mientras tanto se muestra "Cargando…": el cobrador nunca ve la pantalla bloqueada.
    // react-doctor-disable-next-line nextjs-no-client-side-redirect
    if (!permitida) router.replace(inicio);
  }, [permitida, router, inicio]);
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
