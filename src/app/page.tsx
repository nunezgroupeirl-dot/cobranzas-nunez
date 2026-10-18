import { redirect } from "next/navigation";

/** La raíz manda a Clientes (si no hay sesión, Clientes manda al login). */
export default function Inicio() {
  redirect("/clientes/");
}
