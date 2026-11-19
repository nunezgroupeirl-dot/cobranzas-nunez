import type { Cuenta, MedioPago } from "@/types/database";

/** Bancos y billeteras más usados (se puede escribir otro). */
export const ENTIDADES_BANCO = ["BCP", "Interbank", "BBVA", "Scotiabank", "Banco de la Nación", "Caja Huancayo", "Caja Arequipa"];

/** Yape y Plin: el número es un celular (9 números); en banco, el número de cuenta. */
export const esBilletera = (medio: MedioPago) => medio === "yape" || medio === "plin";

/** Medio del pago para mostrar: "Banco · Lemon" cuando pagó desde una entidad que no está entre las cuentas. */
export const textoMedio = (nombreMedio: string, entidadOrigen?: string | null) => (entidadOrigen ? `${nombreMedio} · ${entidadOrigen}` : nombreMedio);

/** Lo que se ve al registrar pagos y en los reportes: "BCP 1947379402012 · Andrés Núñez" (igual que en la base). */
export function nombreCuenta(p: { entidad: string; numero: string; titular?: string | null }): string {
  const numero = p.numero.replace(/\s+/g, "");
  return `${p.entidad.trim()} ${numero}${p.titular?.trim() ? ` · ${p.titular.trim()}` : ""}`;
}

/** Entidad, número y titular de una cuenta (las antiguas, sin partes, se leen de su nombre). */
export function partesCuenta(c: Pick<Cuenta, "nombre" | "medio"> & Partial<Pick<Cuenta, "entidad" | "numero" | "titular">>) {
  if (c.entidad && c.numero) return { entidad: c.entidad, numero: c.numero, titular: c.titular ?? "" };
  const [antes, titular = ""] = c.nombre.split(" · ");
  const [entidad = "", ...resto] = antes.trim().split(/\s+/);
  return { entidad: entidad || (c.medio === "yape" ? "Yape" : c.medio === "plin" ? "Plin" : "Banco"), numero: resto.join(" "), titular };
}

/**
 * Opciones para elegir la cuenta donde llegó un pago: primero las de la empresa del contrato,
 * luego las personales (sirven para todas) y al final las de otras empresas (con su nombre).
 */
export function opcionesDeCuenta(cuentas: Cuenta[], empresaId: string | null | undefined, nombresEmpresa: Map<string, string>) {
  const orden = (c: Cuenta) => (c.empresa_id === empresaId ? 0 : c.empresa_id ? 2 : 1);
  return [...cuentas]
    .sort((a, b) => orden(a) - orden(b) || a.nombre.localeCompare(b.nombre, "es"))
    .map((c) => ({
      valor: c.id,
      // la cuenta a nombre de la empresa (sin titular) lleva el nombre de la empresa, para que no salga "sin nombre"
      texto:
        orden(c) === 1
          ? `${c.nombre} (personal)`
          : orden(c) === 0
            ? partesCuenta(c).titular
              ? c.nombre
              : `${c.nombre} · ${nombresEmpresa.get(c.empresa_id ?? "") ?? ""}`
            : `${c.nombre} (${nombresEmpresa.get(c.empresa_id ?? "") ?? ""})`,
    }));
}
