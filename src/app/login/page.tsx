"use client";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Marca } from "@/components/layout/Marca";
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
    <main className="grid min-h-dvh bg-superficie md:grid-cols-[1.1fr_1fr]">
      {/* Marca: franja oscura arriba en celular, columna completa en tablet y PC */}
      <section className="flex flex-col justify-between bg-tinta px-6 py-8 text-white md:px-12 md:py-14">
        <h1>
          <Marca claro grande />
        </h1>
        <p className="mt-6 max-w-sm text-lg text-white/75 md:text-xl">
          Cuotas semanales, pagos con su comprobante y la lista de quién no paga, de las cuatro empresas en un solo lugar.
        </p>
      </section>
      <section className="flex items-center justify-center px-6 py-10 md:px-12">
        <div className="w-full max-w-sm">
          <h2 className="mb-1 text-3xl font-bold">Ingresar</h2>
          <p className="mb-6 text-tenue">Con el correo y la contraseña que te dio el dueño.</p>
          <Suspense>
            <FormularioIngreso />
          </Suspense>
          <p className="mt-8 border-t border-borde pt-5 text-tenue">
            ¿Eres cliente?{" "}
            <Link href="/consulta" className="font-semibold text-marca underline">
              Consulta tu deuda con tu DNI
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
