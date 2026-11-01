/**
 * Punto único de acceso a datos para las pantallas.
 * - Con NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY → Supabase (real.ts).
 * - Sin ellas, en `npm run dev` o con NEXT_PUBLIC_MODO_PRUEBA=1 → DATOS DE PRUEBA en el
 *   navegador (simulado.ts), con las mismas reglas que la base de datos.
 * - Sin ellas en producción → error de configuración (nunca datos falsos por accidente).
 * Las pantallas solo importan getDatos(); así el modo no las toca.
 */
import type {
  Bucket,
  Cliente,
  ConsultaPublica,
  Contrato,
  CrearContratoArgs,
  Cuenta,
  Cuota,
  Documento,
  Empresa,
  EstadoCliente,
  FilaImportacion,
  Moroso,
  Moto,
  Pago,
  Perfil,
  RegistrarPagoArgs,
  RegistrarPagoResultado,
  ResumenEmpresa,
  CobranzaSemana,
  Rol,
} from "@/types/database";

export class ErrorDatos extends Error {
  codigo: string;
  constructor(codigo: string, mensaje?: string) {
    super(mensaje ?? codigo);
    this.codigo = codigo;
  }
}

export type NuevoCliente = Omit<Cliente, "id" | "creado_en"> & { id?: string };
export type NuevaMoto = Omit<Moto, "id"> & { id?: string };
export interface FiltroPagos {
  contrato_id?: string;
  desde?: string;
  hasta?: string;
  incluir_anulados?: boolean;
}
export interface NuevoUsuario {
  nombre: string;
  email: string;
  clave: string;
  rol: Rol;
}

export interface Datos {
  modoPrueba: boolean;
  // sesión
  sesion(): Promise<Perfil | null>;
  ingresar(email: string, clave: string): Promise<Perfil>;
  salir(): Promise<void>;
  // catálogos
  empresas(): Promise<Empresa[]>;
  cuentas(): Promise<Cuenta[]>; // solo activas
  todasLasCuentas(): Promise<Cuenta[]>; // incluye desactivadas (Configuración)
  guardarEmpresa(e: Pick<Empresa, "id" | "nombre" | "ruc">): Promise<void>;
  guardarCuenta(c: Omit<Cuenta, "id"> & { id?: string }): Promise<void>;
  // vistas
  estadoClientes(): Promise<EstadoCliente[]>;
  morosos(): Promise<Moroso[]>;
  resumenEmpresas(): Promise<ResumenEmpresa[]>;
  /** Cobrado vs esperado de las últimas semanas, por empresa (solo el dueño). */
  cobranzaSemanal(semanas?: number): Promise<CobranzaSemana[]>;
  /** Espacio que ocupan las fotos en Supabase Storage (solo el dueño). */
  usoFotos(): Promise<{ bytes: number; archivos: number }>;
  // clientes
  clientes(): Promise<Cliente[]>;
  cliente(id: string): Promise<Cliente | null>;
  guardarCliente(c: NuevoCliente): Promise<Cliente>;
  documentos(clienteId: string): Promise<Documento[]>;
  agregarDocumento(d: Omit<Documento, "id" | "creado_en">): Promise<Documento>;
  borrarDocumento(id: string): Promise<void>;
  // motos y contratos
  motos(): Promise<Moto[]>;
  guardarMoto(m: NuevaMoto): Promise<Moto>;
  contratos(): Promise<Contrato[]>;
  contrato(id: string): Promise<Contrato | null>;
  crearContrato(args: CrearContratoArgs): Promise<string>;
  cuotas(contratoId: string): Promise<Cuota[]>;
  cerrarContrato(contratoId: string, motivo: string): Promise<void>;
  importarCliente(fila: FilaImportacion): Promise<string>;
  // pagos
  pagos(filtro?: FiltroPagos): Promise<Pago[]>;
  registrarPago(args: RegistrarPagoArgs): Promise<RegistrarPagoResultado>;
  anularPago(pagoId: string, motivo: string): Promise<void>;
  // público
  consultaPublica(dni: string): Promise<ConsultaPublica | null>;
  // usuarios
  usuarios(): Promise<Perfil[]>;
  crearUsuario(u: NuevoUsuario): Promise<void>;
  actualizarUsuario(id: string, cambios: Partial<Pick<Perfil, "rol" | "activo">>): Promise<void>;
  // archivos
  subirArchivo(bucket: Bucket, ruta: string, archivo: Blob): Promise<void>;
  borrarArchivo(bucket: Bucket, ruta: string): Promise<void>;
  urlArchivo(bucket: Bucket, ruta: string): Promise<string | null>;
}

let instancia: Datos | null = null;

export function hayConexionReal(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** Modo de prueba permitido: en desarrollo, o si se pide explícitamente (demo). */
function modoPruebaPermitido(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_MODO_PRUEBA === "1";
}

export async function getDatos(): Promise<Datos> {
  if (instancia) return instancia;
  if (hayConexionReal() && process.env.NEXT_PUBLIC_MODO_PRUEBA !== "1") {
    const { crearDatosReales } = await import("./real");
    instancia = crearDatosReales();
  } else if (modoPruebaPermitido()) {
    const { crearDatosSimulados } = await import("./simulado");
    instancia = crearDatosSimulados();
  } else {
    throw new ErrorDatos(
      "CONFIGURACION",
      "Falta configurar la conexión a la base de datos (NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY).",
    );
  }
  return instancia;
}
