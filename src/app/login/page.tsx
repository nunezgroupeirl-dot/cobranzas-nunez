"use client";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getDatos } from "@/lib/supabase/datos";
import { Aviso, Boton, Campo, Cargando, mensajeDeError } from "@/components/ui";

function FormularioIngreso() {
  const router = useRouter();
  const pedido = useSearchParams().get("volver") ?? "";
  // solo rutas internas (evita redirigir a otro sitio)
  const volver = pedido.startsWith("/") && !pedido.startsWith("//") ? pedido : "/clientes";
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [modoPrueba, setModoPrueba] = useState(false);
  const [revisando, setRevisando] = useState(true);

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
        if (haySesion) router.replace(volver);
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
  }, [router, volver]);

  const ingresar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const d = await getDatos();
      await d.ingresar(email, clave);
      router.replace(volver);
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
      <Campo etiqueta="Contraseña" type="password" autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} obligatorio />
      <Boton type="submit" tamano="grande" ancho cargando={enviando}>
        Ingresar
      </Boton>
      {modoPrueba && (
        <div className="rounded-2xl bg-amarillo-suave p-4 text-sm">
          <p className="font-bold text-amarillo">Modo prueba (sin base de datos)</p>
          <p className="mt-1">Administrador: admin@prueba.pe / admin123</p>
          <p>Cobrador: cobrador@prueba.pe / cobrador123</p>
        </div>
      )}
    </form>
  );
}

export default function PaginaLogin() {
  return (
    <main className="grid min-h-dvh place-items-center bg-tinta p-4">
      <div className="w-full max-w-md rounded-3xl bg-superficie p-6 shadow-2xl sm:p-8">
        <p className="text-xs font-semibold tracking-[0.2em] text-tenue uppercase">Cobranzas</p>
        <h1 className="mb-6 text-3xl font-extrabold">Núñez</h1>
        <Suspense>
          <FormularioIngreso />
        </Suspense>
      </div>
    </main>
  );
}
