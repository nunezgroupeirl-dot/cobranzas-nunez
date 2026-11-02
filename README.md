# Cobranzas Núñez

Sistema web de cobranzas para financiamiento de mototaxis y motos con cuotas semanales. Reemplaza los cuadernos: clientes, motos, contratos con cronograma automático, pagos con foto del comprobante, semáforo de morosos, panel del dueño y consulta pública por DNI.

| | |
|---|---|
| **Frontend** | Next.js 15 (export estático) · React 19 · TypeScript · Tailwind CSS 4 |
| **Base de datos** | Supabase: PostgreSQL + Auth + Storage + 1 Edge Function |
| **Hosting** | Cloudflare Pages (carpeta `out/`) + Worker de fotos con R2 (`fotos/`) + Worker de mantenimiento (`keep-alive/`) |

## Pantallas

| Ruta | Qué hace | Quién |
|---|---|---|
| `/login` | Ingreso | Todos |
| `/clientes` · `/clientes/nuevo` · `/clientes/ficha?id=` · `/clientes/editar?id=` | Lista con semáforo, alta con fotos, ficha completa | Dueño |
| `/contratos` · `/contratos/nuevo` · `/contratos/ver?id=` | Motos, contratos, cronograma, contrato para imprimir (PDF) y hojas firmadas escaneadas | Dueño |
| `/pagos/nuevo` | Registrar un pago con foto del comprobante | Dueño y cobradores |
| `/pagos` | Historial de pagos (anular, filtrar por fechas) | Dueño |
| `/morosos` | ¿Quién no paga? Copiar para WhatsApp y Excel | Dueño y cobradores |
| `/panel` | Cobrado hoy y en la semana, deuda por empresa | Dueño |
| `/reportes` | Excel de clientes y de pagos por fechas | Dueño |
| `/usuarios` | Crear y desactivar cobradores | Dueño |
| `/importar` | Cargar clientes desde la plantilla Excel | Dueño |
| `/configuracion` | Agregar, editar y eliminar empresas y cuentas de cobro | Dueño |
| `/consulta` · `/qr` | El cliente consulta su deuda con su DNI · hoja con el QR | Público |

## Reglas del negocio

- **Semáforo:** verde al día · amarillo 1 a 3 semanas de atraso · rojo 4 o más.
- Cada pago se aplica a la **cuota pendiente más antigua** y guarda la fecha real de pago.
- Todo pago lleva **foto**. No se acepta un **n.º de operación** ni una **imagen** ya registrados.
- Sin intereses ni mora: la cuota es fija. Un contrato pagado completo pasa a **terminado**.
- Lo registrado hasta las **10:00 p.m.** (hora de Lima) cuenta para ese día.

Las reglas viven en la base de datos (`supabase/esquema.sql`). `src/lib/supabase/reglas.ts` es una copia solo para el modo de prueba.

## Seguridad

- **Un solo dueño.** Solo la cuenta `correo_dueno()` (en `esquema.sql`) puede ser administrador: anular pagos, cerrar contratos, crear usuarios, importar, configurar y ver panel y reportes. Lo garantiza la base de datos (función, disparador y restricción en la tabla), no solo la pantalla. Todo usuario nuevo es **cobrador**: solo registra pagos y ve ¿Quién no paga?; no crea ni edita clientes, motos ni contratos (también lo impide la base de datos).
- **RLS en todas las tablas.** El frontend solo lleva la llave pública (anon). Lo que cada usuario puede ver o cambiar lo decide la base de datos.
- Pagos, contratos y cuotas **no se escriben directo**: solo con `registrar_pago`, `crear_contrato`, `anular_pago` y `cerrar_contrato`.
- **El dueño tiene CRUD de todo:** empresas, cuentas, clientes, motos y contratos se pueden crear, editar y eliminar. Borrar algo con datos ligados (una empresa con clientes, una cuenta con pagos, una moto con contrato) lo impide la base de datos. Eliminar un cliente o un contrato pide escribir su DNI o placa y borra también sus pagos y fotos.
- Fotos **privadas** en Cloudflare R2 (o Supabase Storage si no se configura R2), visibles solo con enlace firmado de 1 hora. El Worker `fotos/` valida la sesión de Supabase en cada subida o borrado.
- La tabla `auditoria` guarda quién creó o cambió cada cliente, moto, contrato y pago.
- Todo el tráfico va por **HTTPS** (Cloudflare + Supabase) con cabeceras de seguridad (`public/_headers`).
- Datos personales (DNI, dirección, celular): Ley 29733. La consulta pública solo muestra nombre, placa, deuda y cronograma.

## Desarrollo

Requisitos: Node.js 20 o superior.

```bash
npm install
npm run dev          # http://localhost:3000
```

Sin `.env.local`, la app arranca en **modo prueba** con datos falsos guardados en el navegador (`admin@prueba.pe` / `admin123`, `cobrador@prueba.pe` / `cobrador123`).

Para usar Supabase: copia `.env.example` como `.env.local` y pega la **Project URL** y la llave **anon**. Nunca la `service_role`.

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run check` | Tipos + ESLint + build (antes de cada push) |
| `npm run build` | Genera el sitio estático en `out/` |
| `npm run preview` | Sirve `out/` en local |

## Despliegue

**1. Supabase**
1. Nuevo proyecto, región **São Paulo**.
2. **SQL Editor** → pega todo `supabase/esquema.sql` → **Run**. Se puede volver a ejecutar sin perder datos.
3. **Authentication → Sign In / Providers** → desactiva **Allow new users to sign up**.
4. **Authentication → Users → Add user** con el correo del dueño y **Auto Confirm User**. Queda como administrador automáticamente.
5. **Edge Functions** → función `usuarios` con `supabase/functions/usuarios/index.ts`.
6. **Database → Settings → SSL Configuration** → activa **Enforce SSL on incoming connections**.
7. Plan **Pro** antes del uso real (fotos, respaldos diarios, sin pausas).

**2. Cloudflare Pages**
- Conectar el repositorio. Preset **Next.js (Static HTML Export)**, build `npm run build`, salida `out`.
- Variables: `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Luego, en Supabase → **Authentication → URL Configuration → Site URL**: la dirección de Cloudflare.

**3. Fotos en Cloudflare R2 (10 GB gratis)**
- **R2 Object Storage → Create bucket** → `cobranzas-nunez-fotos` (privado).
- **Workers & Pages → Create → Worker** `cobranzas-nunez-fotos` → pega `fotos/index.js`.
- **Settings → Bindings → R2 bucket**: nombre `FOTOS`, bucket `cobranzas-nunez-fotos`.
- Variables: `SUPABASE_URL`, `SUPABASE_ANON_KEY` y el secreto `FIRMA_SECRETA` (texto largo al azar).
- En Pages agrega `NEXT_PUBLIC_FOTOS_URL` = dirección del Worker y vuelve a publicar.

**4. Keep-alive (solo si Supabase está en plan gratis)**
Worker aparte que hace una consulta liviana cada 6 horas para que el proyecto no se pause:
- **Workers & Pages → Create → Worker** → pega `keep-alive/index.js`.
- Variables: `SUPABASE_URL` (texto) y `SUPABASE_ANON_KEY` (secreto).
- **Settings → Trigger events → Cron Triggers** → `0 */6 * * *`.
- O desde `keep-alive/`: `npx wrangler deploy` y `npx wrangler secret put SUPABASE_ANON_KEY`.

## Estructura

```
supabase/esquema.sql          toda la base de datos: tablas, reglas, vistas, RLS, storage, datos iniciales
supabase/functions/usuarios/  Edge Function para crear cobradores
fotos/                        Worker de Cloudflare que guarda las fotos en R2 con los mismos permisos
keep-alive/                   Worker de Cloudflare que evita la pausa de Supabase (plan gratis)
public/plantilla-clientes.xlsx plantilla para importar clientes
src/app/(app)/…               pantallas con sesión
src/app/login, consulta, qr   pantallas sin sesión
src/components/               componentes de interfaz, menú y PDF del cronograma
src/lib/supabase/datos.ts     interfaz única de datos (getDatos): real.ts o modo prueba
```
