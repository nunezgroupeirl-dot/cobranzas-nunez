# Cobranzas Núñez

Sistema web de cobranzas para las 4 empresas de Andrés Núñez (financiamiento de mototaxis y motos con cuotas semanales). Reemplaza los cuadernos: clientes, motos, contratos con cronograma automático, pagos con evidencia, semáforo de morosos y consulta pública por DNI.

| | |
|---|---|
| **Frontend** | Next.js 15 (App Router, export estático) · React 19 · TypeScript · Tailwind CSS 4 |
| **Base de datos** | Supabase: PostgreSQL + Auth + Storage + 1 Edge Function |
| **Hosting** | Cloudflare Pages (carpeta `out/`) |
| **Equipo** | Jefferson (base de datos, backend e integración) · Gianfranco (pantallas de registro) · Petit (pantallas de consulta y carga de datos) |

## Pantallas

| Ruta | Qué hace | Quién |
|---|---|---|
| `/login` | Ingreso | Todos |
| `/clientes`, `/clientes/nuevo`, `/clientes/ficha?id=`, `/clientes/editar?id=` | Lista con semáforo, alta con hasta 6 fotos, ficha completa | Administrador y cobrador |
| `/contratos`, `/contratos/nuevo`, `/contratos/ver?id=` | Motos, contratos, cronograma, cierre de contrato (solo admin) | Administrador y cobrador |
| `/pagos`, `/pagos/nuevo` | Historial y registro de pagos con foto; anular (solo admin) | Administrador y cobrador |
| `/morosos` | ¿Quién no paga? Copiar para WhatsApp y Excel | Administrador y cobrador |
| `/panel` | Panel del dueño: cobrado hoy y en la semana, deuda por empresa | Administrador |
| `/reportes` | Excel de clientes y de pagos por fechas | Administrador |
| `/usuarios` | Crear, desactivar y cambiar rol de usuarios | Administrador |
| `/importar` | Cargar clientes activos desde la plantilla Excel | Administrador |
| `/configuracion` | Empresas (razón social, RUC) y cuentas de cobro | Administrador |
| `/consulta` | El cliente consulta su deuda con su DNI (sin sesión) | Público |
| `/qr` | Hoja A4 con el QR de la consulta para imprimir | Público |

## Reglas del negocio

- **Semáforo:** verde al día · amarillo 1 a 3 semanas de atraso · rojo 4 o más.
- Cada pago se aplica a la **cuota pendiente más antigua** y guarda la fecha real de pago.
- Todo pago lleva **foto**. No se acepta un **n.º de operación** ni una **imagen** ya registrados.
- Sin intereses ni mora: la cuota es fija. Un contrato pagado completo pasa a **terminado**.
- Lo registrado hasta las **10:00 p.m.** (hora de Lima) cuenta para ese día.
- **Cobrador:** ve todo y registra clientes, motos y pagos; no borra, no anula, no ve el panel ni los reportes.

Las reglas viven en la base de datos (`supabase/esquema.sql`). `src/lib/supabase/reglas.ts` es una copia solo para el modo de prueba.

## Empezar en tu computadora

Requisitos: Node.js 20 o superior y Git.

```bash
npm install
npm run dev          # http://localhost:3000
```

Sin `.env.local`, `npm run dev` funciona en **modo prueba** con datos falsos guardados en el navegador:

| Usuario | Correo | Contraseña |
|---|---|---|
| Administrador | `admin@prueba.pe` | `admin123` |
| Cobrador | `cobrador@prueba.pe` | `cobrador123` |

Para trabajar con Supabase: copia `.env.example` como `.env.local` y pega la **Project URL** y la llave **anon public** (Supabase → Project Settings → API). **Nunca** la `service_role`.

Para probar en la tablet desde tu red local: `npm run dev -- -H 0.0.0.0` y abre `http://IP-de-tu-pc:3000`.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run typecheck` | Revisión de tipos |
| `npm run lint` | ESLint |
| `npm run build` | Genera el sitio estático en `out/` |
| `npm run check` | Las tres anteriores juntas (antes de cada entrega) |
| `npm run preview` | Sirve `out/` en local para probar el build |
| `npm run deploy` | Build + subida directa a Cloudflare Pages con Wrangler |

## Estructura

```
supabase/
  esquema.sql                 TODA la base de datos: tablas, reglas, vistas, RLS, storage, datos iniciales
  functions/usuarios/         Edge Function para crear usuarios (usa la service_role del servidor)
src/
  app/(app)/…                 pantallas con sesión (layout.tsx = marco con menú)
  app/login, consulta, qr     pantallas sin sesión
  components/ui/              componentes base (Gianfranco)
  components/layout/          menú, filtro ?empresa=, sesión (Gianfranco)
  components/reportes/        PDF del cronograma (Petit)
  lib/fotos.ts                compresión (~200 KB), SHA-256 de la original, subida
  lib/exportar.ts             WhatsApp y Excel sin librerías
  lib/supabase/datos.ts       interfaz única de datos (getDatos)
  lib/supabase/real.ts        implementación con Supabase
  lib/supabase/simulado.ts    modo prueba en el navegador
  types/database.ts           tipos de tablas, vistas y funciones
docs/
  DESPLIEGUE.md               paso a paso: Supabase, GitHub y Cloudflare
  Plantilla_clientes_Cobranzas_Nunez.xlsx
  guia-rapida.md · lista-de-pruebas.md · entregas/
public/_headers               cabeceras de seguridad de Cloudflare
```

Las pantallas solo usan `getDatos()`; nunca llaman a Supabase directo.

## Seguridad

- El frontend es público: solo lleva la llave **anon**. Lo que cada usuario puede ver o cambiar lo decide la base de datos con **RLS** y funciones `security definer`.
- Pagos, contratos y cuotas **no se escriben directo**: solo con `registrar_pago`, `crear_contrato`, `anular_pago` y `cerrar_contrato`.
- Las fotos están en buckets **privados** y se ven con URL firmada de 1 hora.
- La tabla `auditoria` guarda quién creó o cambió cada cliente, moto, contrato y pago.
- Datos personales (DNI, dirección, celular): Ley 29733. El público solo ve nombre, placa, deuda y cronograma.

## Cómo se entregan los cambios

Jefferson es el único que hace commits. Gianfranco y Petit trabajan solo en sus carpetas y entregan un ZIP con `src/` y `CAMBIOS.md` (ver `docs/entregas/`). Antes de integrar: `npm run check`.

Despliegue paso a paso: **[docs/DESPLIEGUE.md](docs/DESPLIEGUE.md)**.
