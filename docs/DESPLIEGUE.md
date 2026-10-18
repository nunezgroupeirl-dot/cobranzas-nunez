# Despliegue · Cobranzas Núñez

Orden: **1. Supabase → 2. GitHub → 3. Cloudflare → 4. Primer uso.** Unos 40 minutos.

---

## 1. Supabase (base de datos)

### 1.1 Crear el proyecto
1. Entra a <https://supabase.com> → **New project**.
2. Nombre: `cobranzas-nunez`. Región: **South America (São Paulo)**, la más cercana a Lima.
3. Guarda la contraseña de la base de datos en un lugar seguro.

> **Plan:** para desarrollar sirve el gratis. Antes de que Andrés lo use de verdad, pasa a **Pro** (unos US$ 25 al mes): el plan gratis pausa el proyecto tras una semana sin uso, solo guarda 1 GB de fotos y no tiene respaldos diarios.

### 1.2 Crear toda la base de datos
1. **SQL Editor** → **New query**.
2. Pega **todo** `supabase/esquema.sql` → **Run**.
3. Debe terminar en *Success*. Se puede volver a ejecutar si cambias algo: no borra datos.

Crea tablas, reglas de pagos, vistas, seguridad (RLS), los buckets privados `evidencias` y `documentos`, la auditoría y las 4 empresas con su RUC (Inversiones Anne, Inversiones Comerciales Yarhua, Nuñez Group y Grupo Comercial Romi).

### 1.3 Cerrar el registro público
**Authentication → Sign In / Providers** → desactiva **Allow new users to sign up**.
Los usuarios solo se crean desde la pantalla Usuarios del sistema.

### 1.4 Primer administrador (Andrés)
1. **Authentication → Users → Add user → Create new user**: correo y contraseña de Andrés, marca **Auto Confirm User**.
2. En **SQL Editor** ejecuta (con su correo):
   ```sql
   update public.perfiles
   set rol = 'administrador', activo = true, nombre = 'Andrés Núñez'
   where email = 'correo-de-andres@ejemplo.com';
   ```

### 1.5 Función para crear usuarios
Crear usuarios necesita la llave secreta `service_role`, que nunca va en el frontend. Por eso vive en una Edge Function.

**Opción A: panel web**
1. **Edge Functions → Deploy a new function → Via Editor**.
2. Nombre: `usuarios` (exacto).
3. Borra el ejemplo, pega `supabase/functions/usuarios/index.ts` → **Deploy**.

**Opción B: Supabase CLI**
```bash
npx supabase login
npx supabase link --project-ref TU_PROJECT_REF
npx supabase functions deploy usuarios
```

### 1.6 Datos para el frontend
**Project Settings → API**: copia la **Project URL** y la llave **anon public**.

---

## 2. GitHub

Nombre del repositorio: **`cobranzas-nunez`**, **privado**.

```bash
cd C:\Users\jeffe\cobranzas-nunez
git init -b main
git add .
git commit -m "Versión 1.0: sistema de cobranzas completo"
git remote add origin https://github.com/TU_USUARIO/cobranzas-nunez.git
git push -u origin main
```

Antes de cada commit: `npm run check`.

---

## 3. Cloudflare Pages (la página web)

1. <https://dash.cloudflare.com> → **Workers & Pages → Create → Pages → Connect to Git**.
2. Elige el repositorio `cobranzas-nunez`.
3. Configuración del build:

   | Campo | Valor |
   |---|---|
   | Framework preset | Next.js (Static HTML Export) |
   | Build command | `npm run build` |
   | Build output directory | `out` |

4. **Environment variables** (Production y Preview):

   | Variable | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | la Project URL de Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | la llave anon public |

   La versión de Node la toma de `.nvmrc` (20).
5. **Save and Deploy**. Quedará en `https://cobranzas-nunez.pages.dev`.
6. Dominio propio (opcional): **Custom domains → Set up a custom domain**.

Cada `git push` a `main` vuelve a publicar solo.

> Sin las variables, el sitio muestra "Falta configurar la conexión a la base de datos" en vez de usar datos falsos.
> Para una demo con datos falsos usa un proyecto aparte con `NEXT_PUBLIC_MODO_PRUEBA=1`.

**Alternativa sin Git:** `npm run deploy` (pide iniciar sesión en Cloudflare la primera vez).

### 3.1 Avisar a Supabase de la dirección
Supabase → **Authentication → URL Configuration → Site URL**: `https://cobranzas-nunez.pages.dev` (o tu dominio).

---

## 4. Primer uso (con Andrés)

1. Entra con el usuario de Andrés.
2. **Configuración**:
   - Revisa los nombres y RUC de las 4 empresas (ya vienen cargados). La columna EMPRESA del Excel se compara sin puntos, tildes ni mayúsculas.
   - Agrega las cuentas: 5 Yape, 2 Plin y los bancos. Usa nombres que Adrián reconozca ("Yape Andrés ***356").
3. **Usuarios**: crea a Adrián y a los demás como **cobrador**.
4. **Importar clientes**: elige la plantilla llena. Revisa la vista previa, importa y descarga las filas con error para corregirlas.
5. Revisa 10 clientes al azar contra el cuaderno: deuda, cuotas pagadas y placa.
6. Imprime la hoja **/qr** y ponla en la oficina.
7. Fija el enlace del sistema en el navegador de la tablet de Adrián.

---

## Mantenimiento

| Tarea | Dónde |
|---|---|
| Respaldos | Supabase Pro: diarios y automáticos (Database → Backups) |
| Ver errores | Supabase → Logs · Cloudflare → Deployments |
| Cambiar la base de datos | Edita `supabase/esquema.sql`, ejecútalo en el SQL Editor y actualiza `src/types/database.ts` |
| Quitar acceso a un trabajador | Pantalla Usuarios → Desactivar |
| Un Yape llegó a su tope | Configuración → Desactivar la cuenta |
| Ver quién hizo qué | SQL Editor: `select * from auditoria order by creado_en desc limit 100;` |
