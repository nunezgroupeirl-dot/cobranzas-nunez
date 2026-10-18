import { normalizar } from "@/lib/texto";

export { normalizar };

/** Une los campos buscables en un solo texto normalizado. Se calcula una vez por fila, no en cada tecla. */
export const claveBusqueda = (...partes: (string | null | undefined)[]) => partes.map((p) => normalizar(p ?? "")).join("|");

/** `true` si la consulta (ya normalizada) aparece en la clave. Consulta vacía = coincide todo. */
export const coincide = (clave: string, q: string) => !q || clave.indexOf(q) !== -1;
