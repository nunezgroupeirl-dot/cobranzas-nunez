/** ¿Es un PDF? Por tipo (archivo elegido) o por extensión (archivo guardado). */
export const esPdf = (x: Blob | string) => (typeof x === "string" ? /\.pdf($|\?)/i.test(x) : x.type === "application/pdf");
