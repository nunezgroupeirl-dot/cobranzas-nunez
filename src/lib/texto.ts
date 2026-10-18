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
