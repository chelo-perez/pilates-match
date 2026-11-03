# Trabajo Más Fácil (repo: pilates-match)

App mobile multi-tenant que conecta **instructores de Pilates** con **estudios** de CABA. Cada **Cámara** (ej. CAPIAF) es un tenant. Un solo APK; el branding interno depende de la cámara.

## Stack
- React Native + Expo SDK 54, TypeScript, `react@19.1.0` fijado (no actualizar: causaba crash al abrir)
- Navegación: `@react-navigation/native-stack` + `@react-navigation/bottom-tabs`
- Estado: Zustand (`src/store/index.ts`). El auth store **no persiste sesión** (`partialize: () => ({})`); la sesión se valida siempre contra Supabase en `App.tsx`
- Datos: Supabase (proyecto `tkhaiovstwgqzabvxxss`) + TanStack Query
- Íconos de tabs: Lottie (`lottie-react-native`, JSON en `assets/lottie/`, componente `src/components/LottieTab.tsx`). Íconos internos: Feather
- Build: EAS, cuenta **chelo.perez3** (`owner` en app.json), perfil `preview` (APK). Plan gratis = cupo mensual limitado de builds

## Roles (valores exactos en DB)
`instructor`, `estudio` (NO "studio"), `camara_admin`, `super_admin`

## Navegación (`src/navigation/index.tsx`)
- Sin user → Login / RegisterRole / RegisterInstructor / RegisterStudio
- instructor → InstructorTabs (Inicio, Propuestas, Horarios, Tarifas, Perfil) + EvaluateStudio
- estudio → StudioTabs (Inicio, Buscar, Historial, Evaluar) + InstructorProfile, RequestMatch, EvaluateInstructor, MembershipPaywall
- camara_admin → CamaraTabs (Inicio, Directorio, Estudios, Tarifas, Reportes) + VerifyInstructor
- super_admin → AdminHome (placeholder)
- Los `name` de Tab.Screen chocan con los del Stack externo en TypeScript: por eso `createBottomTabNavigator<any>()` y se reutilizan nombres del stack. El texto visible va siempre en `tabBarLabel`, en español.

## Design system (`src/components/ui/index.tsx`)
- Fuente única: **Nunito** (Regular/Medium/SemiBold/Bold). No usar DM_Sans ni Playfair.
- Colores válidos: `sage, sageMid, sageLight, sageLighter, cream, white, dark, mid, light, border, borderLight, gold, goldLight, okBg/okTx, warnBg/warnTx, redBg/redTx, blueBg/blueTx`. Cualquier otro (lavender, blush, sand, success, danger, goldMid…) rompe tsc.
- Componentes: Card, Button, Badge, Avatar, ScoreDisplay, Input, EmptyState, LoadingScreen, TariffMatchPill (prop `status`)
- Dashboards: hero verde (`colors.sage`; cámara `#2D3F31`) con KPI cards flotando encima (`marginTop: -16`). Respetar safe area (`paddingTop: 52` o `useSafeAreaInsets`).
- Reemplazo = dorado (`gold/goldLight`), nunca rojo. Sin emojis de colores en la UI.
- Confirmaciones de guardado: `Toast` animado (`src/components/Toast.tsx` + `src/hooks/useToast.ts`), no `Alert`. Cada pantalla que use `showToast` debe renderizar `<Toast {...toast} onHide={hideToast} />`.
- Barrios: lista fija de 38 barrios de CABA; selección de zonas con `src/components/ZonasCABA.tsx` (agrupado por zona + "Toda CABA").

## Reglas de datos
- `verification_status` se guarda en español (`verificado`, `pendiente`, `rechazado`); el código tolera también `verified`/`pending`.
- Upsert con `onConflict` puede fallar en silencio → usar select + update/insert explícito.
- Tarifas instructor: `instructor_rates` (`rate_regular`, `rate_replacement`). Rangos de la cámara: `rate_ranges` (`class_type` = `regular` | `reemplazo`, `min_ars`, `max_ars`).
- Evaluaciones: `CreateEvaluationDTO` usa `score_technique, score_punctuality, score_student_care, score_presentation`.
- Storage: buckets `avatars` y `certifications`. En Expo, subir archivos con `expo-file-system` → base64 → `Uint8Array` (los Blob de `fetch(uri)` fallan en Android).
- Notificaciones: Edge Function `send-match-notification` + trigger `on_match_created`. `supabase/` está excluido del tsconfig.

## Antes de cualquier build (obligatorio)
1. `npx tsc --noEmit` → 0 errores
2. `npx expo export --platform android` → bundle OK (detecta imports a archivos inexistentes que tsc no ve)
3. Archivos en UTF-8 (hubo un caso de acentos corruptos)
4. Commit + push, recién ahí `eas build --platform android --profile preview --non-interactive`

Los builds son lentos y con cupo: no gastar uno sin pasar 1 y 2.

## Secretos
Nunca commitear tokens. `EXPO_TOKEN` va como variable de entorno, no en archivos.

## Pendientes conocidos
- Verificar que el Toast quedó integrado en todas las pantallas donde se reemplazó `Alert`
- Subir `icon.png` (solo la manito) y `splash.png` definitivos a `assets/`
- Probar end-to-end el registro de instructor y de estudio
- Panel super_admin real
- Navegación StudiosScreen → detalle de estudio (bug recurrente)
- Alinear a los prototipos aprobados: búsqueda con filtros, detalle de propuesta, agenda semanal, centro de notificaciones, evaluación mutua
- Planes y precios en el paywall (Inicial $15.000, Básico $35.000, CAPIAF $25.000, Premium estudio $70.000, Premium instructor $25.000; 50% off primeros 3 meses)

## Forma de trabajo
Resultados concretos y cambios aplicados, sin explicaciones largas. Consistencia visual entre todas las pantallas antes de cada build.
