"use client";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getDatos } from "@/lib/supabase/datos";
import { Aviso, Boton, Campo, Cargando, mensajeDeError } from "@/components/ui";
import { inicioPara } from "@/components/layout/menu";
import type { Perfil } from "@/types/database";
import { PanelMarca } from "./PanelMarca";

/** Sin página pedida, cada uno entra a su pantalla de inicio (dueño: Clientes; cajero: Registrar pago; ruta: ¿Quién no paga?). */
const destino = (p: Perfil, pedido: string | null) => pedido ?? inicioPara(p);

function FormularioIngreso() {
  const router = useRouter();
  const pedido = useSearchParams().get("volver") ?? "";
  // solo rutas internas (evita redirigir a otro sitio)
  const pedidoValido = pedido.startsWith("/") && !pedido.startsWith("//") ? pedido : null;
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [modoPrueba, setModoPrueba] = useState(false);
  const [revisando, setRevisando] = useState(true);
  const [verClave, setVerClave] = useState(false);

  // Si ya hay sesión, ir directo. Mientras se revisa no se muestra el formulario (sin parpadeo).
  useEffect(() => {
    let vigente = true;
    const revisar = async () => {
      try {
        // El "return" de abajo descarta respuestas viejas (la pantalla ya cambió): necesita ambas respuestas.
        // react-doctor-disable-next-line async-defer-await
        const d = await getDatos();
        const haySesion = await d.sesion();
        if (!vigente) return;
        setModoPrueba(d.modoPrueba);
        // react-doctor-disable-next-line nextjs-no-client-side-redirect
        if (haySesion) router.replace(destino(haySesion, pedidoValido));
        else setRevisando(false);
      } catch (e) {
        if (!vigente) return;
        setError(mensajeDeError(e));
        setRevisando(false);
      }
    };
    void revisar();
    return () => {
      vigente = false;
    };
  }, [router, pedidoValido]);

  const ingresar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const d = await getDatos();
      router.replace(destino(await d.ingresar(email, clave), pedidoValido));
    } catch (err) {
      setError(mensajeDeError(err));
      setEnviando(false);
    }
  };

  if (revisando) return <Cargando texto="Verificando sesión…" />;

  return (
    <form onSubmit={ingresar} className="flex flex-col gap-4">
      {error && <Aviso tipo="error">{error}</Aviso>}
      <Campo etiqueta="Correo" type="email" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} obligatorio />
      <div className="relative">
        <Campo etiqueta="Contraseña" type={verClave ? "text" : "password"} autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} obligatorio className="pr-24" />
        <button
          type="button"
          onClick={() => setVerClave((v) => !v)}
          aria-pressed={verClave}
          className="absolute right-2 bottom-1.5 min-h-9 rounded-lg px-3 text-sm font-semibold text-marca hover:bg-marca-suave"
        >
          {verClave ? "Ocultar" : "Mostrar"}
        </button>
      </div>
      <Boton type="submit" tamano="grande" ancho cargando={enviando}>
        Ingresar
      </Boton>
      {modoPrueba && (
        <div className="rounded-2xl bg-amarillo-suave p-4 text-sm">
          <p className="font-bold text-amarillo">Modo prueba (sin base de datos)</p>
          <p className="mt-1">Dueño: admin@prueba.pe / admin123</p>
          <p>Cajero de oficina: cobrador@prueba.pe / cobrador123</p>
          <p>Cobrador de ruta: ruta@prueba.pe / ruta123</p>
        </div>
      )}
    </form>
  );
}

export default function PaginaLogin() {
  return (
    <main className="grid min-h-dvh bg-fondo md:grid-cols-[1.15fr_1fr]">
      <PanelMarca />
      <section className="flex flex-col items-center justify-center px-5 py-10 md:px-12">
        <div className="w-full max-w-md rounded-3xl border border-borde bg-superficie p-6 shadow-[0_20px_60px_-25px_rgba(20,20,20,0.35)] sm:p-8">
          <p className="text-sm font-semibold tracking-[0.18em] text-marca uppercase">Acceso del personal</p>
          <h2 className="mt-1 mb-1 text-3xl font-bold">Bienvenido</h2>
          <p className="mb-6 text-tenue">Ingresa con el correo y la contraseña que te dio el dueño.</p>
          <Suspense>
            <FormularioIngreso />
          </Suspense>
          <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-tenue">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-3.5" aria-hidden>
              <path d="M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            Conexión segura · solo personal autorizado
          </p>
        </div>

        <Link
          href="/consulta"
          className="group mt-5 flex w-full max-w-md items-center gap-4 rounded-2xl border border-borde bg-superficie p-4 transition hover:border-marca hover:shadow-md"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-tinta text-oro">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-6" aria-hidden>
              <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2" />
            </svg>
          </span>
          <span className="flex-1">
            <span className="block font-bold">¿Eres cliente?</span>
            <span className="block text-sm text-tenue">Consulta tu deuda y tu cronograma con tu DNI</span>
          </span>
          <span aria-hidden className="text-xl font-bold text-marca transition group-hover:translate-x-1">
            →
          </span>
        </Link>
        <p className="mt-8 text-xs text-tenue">© {new Date().getFullYear()} Inversiones Núñez &amp; Asociados</p>
      </section>
    </main>
  );
}
