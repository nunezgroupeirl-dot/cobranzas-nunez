"use client";
import { Suspense, type ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ProveedorSesion } from "@/components/layout/Sesion";
import { Cargando } from "@/components/ui/Tarjeta";

/** Marco de todas las pantallas con sesión iniciada */
export default function LayoutApp({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<Cargando />}>
      <ProveedorSesion>
        <AppShell>{children}</AppShell>
      </ProveedorSesion>
    </Suspense>
  );
}
