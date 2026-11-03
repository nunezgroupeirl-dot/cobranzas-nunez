import type { Perfil, Rol } from "@/types/database";

export interface ItemMenu {
  href: string;
  texto: string;
  corto: string; // para el menú inferior del celular
  icono: string; // trazo SVG (24x24)
  roles: Rol[];
  enCelular: boolean; // aparece en la barra inferior
  /** solo para el cajero de oficina (además del dueño) */
  soloOficina?: boolean;
}

const TODOS: Rol[] = ["administrador", "cobrador"];
const ADMIN: Rol[] = ["administrador"];

export const MENU: ItemMenu[] = [
  { href: "/clientes", texto: "Clientes", corto: "Clientes", icono: "M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M22 19v-1a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8", roles: TODOS, enCelular: true, soloOficina: true },
  { href: "/pendientes", texto: "Datos pendientes", corto: "Pendientes", icono: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M12 11v3M12 17h.01", roles: ADMIN, enCelular: false },
  { href: "/pagos/nuevo", texto: "Registrar pago", corto: "Pagar", icono: "M12 5v14M5 12h14", roles: TODOS, enCelular: true },
  { href: "/morosos", texto: "¿Quién no paga?", corto: "Morosos", icono: "M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0", roles: TODOS, enCelular: true },
  { href: "/contratos", texto: "Motos y contratos", corto: "Contratos", icono: "M5 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4M19 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4M7 15h8l2-5h-4l-2-3H8M14 10l-3 5", roles: ADMIN, enCelular: true },
  { href: "/pagos", texto: "Historial de pagos", corto: "Historial", icono: "M3 6h18v12H3zM3 10h18M7 15h3", roles: ADMIN, enCelular: false },
  { href: "/panel", texto: "Panel del dueño", corto: "Panel", icono: "M4 20V10M10 20V4M16 20v-7M22 20H2", roles: ADMIN, enCelular: true },
  { href: "/reportes", texto: "Reportes", corto: "Reportes", icono: "M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M9 15l3 3 3-3M12 11v7", roles: ADMIN, enCelular: false },
  { href: "/usuarios", texto: "Usuarios", corto: "Usuarios", icono: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4 21v-1a6 6 0 0 1 12 0v1M19 8v6M22 11h-6", roles: ADMIN, enCelular: false },
  { href: "/importar", texto: "Importar clientes", corto: "Importar", icono: "M12 3v12M7 10l5 5 5-5M5 21h14", roles: ADMIN, enCelular: false },
  { href: "/configuracion", texto: "Configuración", corto: "Ajustes", icono: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z", roles: ADMIN, enCelular: false },
];

type QuienEs = Pick<Perfil, "rol" | "puesto">;

/** El cajero de oficina (o un cobrador sin puesto elegido) ve los clientes, sin editarlos. El cobrador de ruta no. */
export const veClientes = (p: QuienEs) => p.rol === "administrador" || p.puesto !== "ruta";

/** Menú según el rol. El cobrador de ruta ve primero "¿Quién no paga?" (es su lista de visitas). */
export const menuPara = (perfil: QuienEs) => {
  const items = MENU.filter((m) => m.roles.includes(perfil.rol) && (!m.soloOficina || veClientes(perfil)));
  return perfil.rol === "cobrador" && perfil.puesto === "ruta" ? [...items].sort((a, b) => Number(b.href === "/morosos") - Number(a.href === "/morosos")) : items;
};

/** Los trabajadores solo registran pagos y ven quién no paga (el cajero, además, consulta clientes).
 *  Cajero de oficina → empieza en "Registrar pago"; cobrador de ruta (puerta a puerta) → en "¿Quién no paga?". */
export const inicioPara = (perfil: QuienEs) =>
  perfil.rol === "administrador" ? "/clientes" : perfil.puesto === "ruta" ? "/morosos" : "/pagos/nuevo";

const RUTAS_TRABAJADOR = ["/pagos/nuevo", "/morosos"];
// solo consulta: la lista y la ficha (no nuevo ni editar)
const RUTAS_CAJERO = ["/clientes", "/clientes/ficha"];
export const rutaPermitida = (perfil: QuienEs, ruta: string) =>
  perfil.rol === "administrador" ||
  RUTAS_TRABAJADOR.some((r) => ruta === r || ruta.startsWith(`${r}/`)) ||
  (veClientes(perfil) && RUTAS_CAJERO.includes(ruta));
