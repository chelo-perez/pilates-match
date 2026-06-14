# PilatesMatch

App móvil para la Cámara de Pilates de Buenos Aires.  
Conecta estudios e instructores con evaluaciones, búsqueda y match de tarifas.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| App móvil | React Native + Expo SDK 52 |
| Navegación | React Navigation v6 |
| Backend / DB | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Estado global | Zustand |
| Data fetching | TanStack Query v5 |
| Formularios | React Hook Form + Zod |
| Push notifications | Expo Notifications |
| Storage (docs) | Supabase Storage |
| Build / Deploy | EAS Build |

---

## Estructura del proyecto

```
pilates-match/
├── App.tsx                    # Entry point, providers
├── src/
│   ├── types/
│   │   └── database.ts        # Tipos TypeScript del schema
│   ├── lib/
│   │   ├── supabase.ts        # Cliente Supabase + helpers
│   │   └── api.ts             # Todos los servicios de API
│   ├── store/
│   │   └── index.ts           # Estado global (Zustand)
│   ├── hooks/
│   │   └── index.ts           # Custom hooks con React Query
│   ├── components/
│   │   └── ui/
│   │       └── index.tsx      # Design system completo
│   ├── screens/
│   │   ├── auth/              # Login, registro por rol
│   │   ├── studio/            # Home, búsqueda, evaluación, match
│   │   ├── instructor/        # Perfil, disponibilidad, tarifas
│   │   └── camara/            # Dashboard, directorio, verificación
│   └── navigation/
│       └── index.tsx          # Navegación por rol
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql   # Schema completo + RLS
│   └── functions/
│       └── send-match-notification/ # Edge Function push notifications
└── assets/fonts/              # DM Sans + Playfair Display
```

---

## Setup inicial

### 1. Clonar y dependencias

```bash
git clone https://github.com/camara-pilates/pilates-match
cd pilates-match
npm install
```

### 2. Crear proyecto en Supabase

1. Crear proyecto en [supabase.com](https://supabase.com)
2. Ir a **Settings → API** y copiar la URL y la anon key

### 3. Variables de entorno

```bash
cp .env.example .env.local
# Completar con los valores de Supabase
```

### 4. Aplicar el schema

```bash
# Instalar CLI de Supabase
npm install -g supabase

# Linkear con el proyecto
supabase link --project-ref TU_PROJECT_ID

# Aplicar migraciones
supabase db push
```

### 5. Configurar Storage buckets

En el dashboard de Supabase, crear:
- `avatars` → público
- `certifications` → privado (requiere signed URLs)

### 6. Configurar Expo

```bash
npm install -g eas-cli
eas login
eas init  # genera app.json con el project ID
```

### 7. Fonts

Descargar y colocar en `assets/fonts/`:
- [DM Sans](https://fonts.google.com/specimen/DM+Sans): Regular, Medium, SemiBold
- [Playfair Display](https://fonts.google.com/specimen/Playfair+Display): Medium

### 8. Correr en desarrollo

```bash
npx expo start

# iOS simulator
npx expo run:ios

# Android
npx expo run:android
```

---

## Build para producción

```bash
# Build iOS (requiere cuenta Apple Developer USD 99/año)
eas build --platform ios --profile production

# Build Android
eas build --platform android --profile production

# Publicar en stores
eas submit --platform ios
eas submit --platform android
```

---

## Deploy Edge Functions

```bash
supabase functions deploy send-match-notification
```

---

## Regenerar tipos TypeScript desde la DB

```bash
npm run db:types
```

Ejecutar cada vez que se modifique el schema.

---

## Arquitectura de seguridad

Toda la seguridad vive en la base de datos via **Row Level Security (RLS)**:

- **Estudios** solo ven sus propias evaluaciones y matches
- **Instructores** solo ven sus propios datos y evaluaciones que les hicieron
- **Cámara** tiene acceso de lectura a todo y escritura sobre instructores
- **Tarifas** son privadas: un estudio nunca ve las tarifas de otro estudio

El cliente React Native usa la **anon key** de Supabase — las políticas RLS
garantizan que cada usuario solo acceda a lo que le corresponde, sin código
adicional en el frontend.

---

## Flujo de match de tarifas

```
Instructor publica tarifa mínima
       ↓
Estudio configura presupuesto máximo
       ↓
Al buscar: app compara sin revelar montos
       ↓
Verde  = tarifa_instructor ≤ presupuesto_estudio
Amarillo = solo uno de los dos tipos es compatible
Rojo   = ninguno es compatible
       ↓
Al solicitar reemplazo: se revelan los montos a ambas partes
```

---

## Cámara: límite de matches para no socios

```sql
-- En memberships:
-- matches_limit = NULL → ilimitado (socios)
-- matches_limit = 3    → no socios

-- La función can_studio_match() verifica esto antes de cada match
-- El contador matches_used_month se resetea el 1° de cada mes
-- via la función reset_monthly_matches() (cron job en Supabase)
```

Para configurar el cron job en Supabase:
```sql
-- En Supabase Dashboard → Database → Extensions → pg_cron
SELECT cron.schedule('reset-matches', '0 0 1 * *', 'SELECT reset_monthly_matches()');
```

---

## Roadmap técnico

### Etapa 1 (MVP) ✅
- [x] Schema completo de base de datos
- [x] RLS por rol
- [x] Auth con 3 roles
- [x] Evaluaciones con 4 criterios
- [x] Match de tarifas
- [x] Límite de matches para no socios
- [x] Panel de la Cámara

### Etapa 2
- [ ] App del instructor (perfil activo)
- [ ] Match mutuo (aceptar/rechazar)
- [ ] Evaluación de estudios por instructores
- [ ] Chat en tiempo real (Supabase Realtime)
- [ ] Perfil público del estudio

### Futuro
- [ ] Sistema de pagos (Mercado Pago)
- [ ] Analytics avanzados para la Cámara
- [ ] Web app para administración
- [ ] API pública para integraciones
