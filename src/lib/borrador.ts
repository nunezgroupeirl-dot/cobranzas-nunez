/**
 * Borrador de un formulario largo (cliente nuevo o edición): se guarda solo en este navegador mientras se llena,
 * así un clic sin querer en otra sección no borra lo avanzado. Se borra al guardar o al descartarlo.
 * Los textos van en localStorage y las fotos aún no subidas en IndexedDB (localStorage no guarda archivos).
 */
const DIAS_VIGENCIA = 7;
const BASE = "cn-borradores";
const ALMACEN = "archivos";

interface Envoltura<T> {
  guardado: number;
  datos: T;
}

export function leerBorrador<T>(clave: string): T | null {
  try {
    const crudo = localStorage.getItem(clave);
    if (!crudo) return null;
    const e = JSON.parse(crudo) as Envoltura<T>;
    if (Date.now() - e.guardado > DIAS_VIGENCIA * 86_400_000) {
      localStorage.removeItem(clave);
      return null;
    }
    return e.datos;
  } catch {
    return null;
  }
}

export function guardarBorrador<T>(clave: string, datos: T): void {
  try {
    localStorage.setItem(clave, JSON.stringify({ guardado: Date.now(), datos } satisfies Envoltura<T>));
  } catch {
    /* sin espacio o sin almacenamiento: se sigue sin borrador */
  }
}

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(BASE, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(ALMACEN);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function operar<R>(modo: IDBTransactionMode, hacer: (s: IDBObjectStore) => IDBRequest<R>): Promise<R | undefined> {
  try {
    const db = await abrir();
    return await new Promise<R>((resolve, reject) => {
      const t = db.transaction(ALMACEN, modo);
      const r = hacer(t.objectStore(ALMACEN));
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    }).finally(() => db.close());
  } catch {
    return undefined; // navegador sin IndexedDB: las fotos no se recuperan, el resto sí
  }
}

/** Fotos elegidas que aún no se subieron (por tipo). */
export async function guardarArchivosBorrador(clave: string, archivos: Record<string, File>): Promise<void> {
  await operar("readwrite", (s) => s.put(archivos, clave));
}

export async function leerArchivosBorrador(clave: string): Promise<Record<string, File>> {
  return ((await operar("readonly", (s) => s.get(clave))) as Record<string, File> | undefined) ?? {};
}

export async function borrarBorrador(clave: string): Promise<void> {
  try {
    localStorage.removeItem(clave);
  } catch {
    /* nada que borrar */
  }
  await operar("readwrite", (s) => s.delete(clave));
}
