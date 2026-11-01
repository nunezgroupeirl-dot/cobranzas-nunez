/** Quita tildes, guiones y espacios para que "1234ab" encuentre "1234-AB" y "rios" encuentre "Ríos". */
export const normalizar = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]/g, "")
    .toLowerCase();

/**
 * Nombre de empresa comparable: sin tildes, puntos, espacios ni mayúsculas.
 * "NUÑEZ GROUP EIRL" = "Nuñez Group E.I.R.L.". Igual que public.clave_empresa() en la base.
 */
export const claveEmpresa = (t: string) => normalizar(t).replace(/[^a-z0-9]/g, "");

/** Une los campos buscables en un solo texto normalizado. Se calcula una vez por fila, no en cada tecla. */
export const claveBusqueda = (...partes: (string | null | undefined)[]) => partes.map((p) => normalizar(p ?? "")).join("|");

/** `true` si la consulta (ya normalizada) aparece en la clave. Consulta vacía = coincide todo. */
export const coincide = (clave: string, q: string) => !q || clave.indexOf(q) !== -1;
