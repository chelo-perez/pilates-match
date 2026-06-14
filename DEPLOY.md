# PilatesMatch — Guía de deploy paso a paso

## Lo que ya está hecho ✅
- Schema completo de base de datos con RLS
- 27 archivos de código fuente (5.800+ líneas)
- 20 pantallas completas (3 roles)
- Design system, hooks, store, navegación, API layer
- Edge Function para push notifications
- Scripts de configuración

---

## Lo que falta hacer (en orden) 

### Paso 1 — Crear cuenta en Supabase (5 min)

1. Ir a [supabase.com](https://supabase.com) → **New project**
2. Nombre: `pilates-match` · Región: `South America (São Paulo)`
3. Guardar la contraseña generada
4. Esperar ~2 min que el proyecto se cree

Copiar de **Settings → API**:
- `Project URL` → va en `EXPO_PUBLIC_SUPABASE_URL`
- `anon public key` → va en `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `service_role key` → guardar aparte (solo para scripts)

De **Settings → General**:
- `Reference ID` → va en `SUPABASE_PROJECT_ID`

---

### Paso 2 — Configurar variables de entorno (2 min)

```bash
cd pilates-match
cp .env.example .env.local
# Editar .env.local con los valores de Supabase
```

---

### Paso 3 — Ejecutar el setup automático (10 min)

```bash
chmod +x setup.sh
bash setup.sh
```

El script hace automáticamente:
- Verifica Node.js 18+
- Instala todas las dependencias npm
- Instala Expo CLI, EAS CLI y Supabase CLI
- Linkea con tu proyecto de Supabase
- Aplica las migraciones de base de datos
- Crea los storage buckets
- Genera los tipos TypeScript
- Configura Expo y EAS

---

### Paso 4 — Configuración manual en Supabase Dashboard (5 min)

#### 4a. Aplicar script adicional

En [supabase.com](https://supabase.com) → tu proyecto → **SQL Editor**:

Pegar y ejecutar el contenido de:
```
supabase/migrations/002_additional_config.sql
```

Esto crea:
- Tabla `push_tokens` para notificaciones
- Trigger automático de creación de perfil al registrarse
- Políticas de Storage para avatars y certificaciones

#### 4b. Activar extensión pg_cron

En **Database → Extensions**, buscar `pg_cron` y activarla.

Luego en SQL Editor:
```sql
SELECT cron.schedule(
  'reset-matches-monthly',
  '0 0 1 * *',
  'SELECT reset_monthly_matches()'
);
```

#### 4c. Crear Storage buckets (si setup.sh no los creó)

En **Storage → New bucket**:
- `avatars` → marcar **Public bucket** ✓
- `certifications` → NO marcar público

---

### Paso 5 — Descargar las fuentes (3 min)

Descargar e instalar en `assets/fonts/`:

**DM Sans** → [fonts.google.com/specimen/DM+Sans](https://fonts.google.com/specimen/DM+Sans)
- `DMSans-Regular.ttf`
- `DMSans-Medium.ttf`  
- `DMSans-SemiBold.ttf`

**Playfair Display** → [fonts.google.com/specimen/Playfair+Display](https://fonts.google.com/specimen/Playfair+Display)
- `PlayfairDisplay-Medium.ttf`

---

### Paso 6 — Correr en desarrollo (2 min)

```bash
npx expo start
```

Opciones:
- Presionar `i` → abre en simulador iOS (requiere Xcode en Mac)
- Presionar `a` → abre en emulador Android (requiere Android Studio)
- Escanear QR → abre en tu celular con la app **Expo Go**

> 💡 Para probar en celular real sin Xcode/Android Studio, usá Expo Go. Es la forma más rápida de ver la app funcionando.

---

### Paso 7 — Build para producción

#### iOS (requiere Apple Developer — USD 99/año)

```bash
# 1. Crear cuenta en developer.apple.com
# 2. Completar eas.json con tu appleId y teamId

eas build --platform ios --profile production
# EAS maneja automáticamente los certificados y provisioning profiles
```

#### Android (requiere Google Play — USD 25 único pago)

```bash
# 1. Crear cuenta en play.google.com/console
# 2. Crear la app en Play Console
# 3. Descargar el JSON de service account y guardarlo como google-play-key.json

eas build --platform android --profile production
```

---

### Paso 8 — Publicar en los stores

```bash
# iOS → App Store
eas submit --platform ios

# Android → Google Play
eas submit --platform android
```

---

## Crear el primer usuario de la Cámara

Después del deploy, crear el admin de la Cámara directamente en Supabase:

**SQL Editor:**
```sql
-- 1. Primero, registrar via la app (pantalla de login → registrarse → rol Cámara)
-- 2. Luego, verificar que el role esté correcto:
SELECT id, email, role FROM users ORDER BY created_at DESC LIMIT 5;

-- Si el role no es camara_admin, corregir:
UPDATE users SET role = 'camara_admin' WHERE email = 'admin@camarapilates.org.ar';
```

---

## Checklist previo al lanzamiento

```
□ Schema aplicado sin errores (migrations 001 y 002)
□ Storage buckets creados (avatars público, certifications privado)
□ Trigger de creación de usuario funcionando
□ Cron job de reset de matches configurado
□ Edge Function deployada (send-match-notification)
□ Variables de entorno en EAS configuradas
□ App corre en simulador sin errores
□ Login funciona con los 3 roles
□ Evaluación crea registro en DB
□ Búsqueda devuelve instructores verificados
□ Match de tarifas calcula correctamente
□ Push notification llega al instructor
□ Build de producción generado
□ TestFlight / Play Console (beta interna) probado con 5 estudios
□ Stores aprobados → lanzamiento público
```

---

## Comandos útiles durante el desarrollo

```bash
# Ver logs en tiempo real
npx expo start --clear

# Regenerar tipos TypeScript si cambiás el schema
npm run db:types

# Aplicar nuevas migraciones
supabase db push

# Ver logs de Edge Functions
supabase functions logs send-match-notification

# Reset completo de la DB (¡CUIDADO! borra todo)
supabase db reset
```

---

## Estructura de costos mensuales (producción)

| Servicio | Plan | Costo |
|----------|------|-------|
| Supabase | Pro | USD 25/mes |
| Expo (EAS) | Gratuito hasta 1.000 usuarios | USD 0 |
| Google Maps | Dentro del crédito gratuito | USD 0* |
| Resend (emails) | Plan gratuito | USD 0 |
| **Total** | | **~USD 25/mes** |

*Si supera el crédito gratuito de USD 200/mes: costo variable según uso.

Apple Developer (USD 99/año) y Google Play (USD 25 único) son costos de una sola vez.

---

## Soporte

Ante cualquier error, los logs más útiles son:

```bash
# Errores de build
eas build:list
eas build:view [BUILD_ID]

# Errores de la DB
# Supabase Dashboard → Database → Logs

# Errores de la app
npx expo start --clear
```
