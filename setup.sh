#!/bin/bash
# ============================================================
# PilatesMatch — Setup automático completo
# Ejecutar desde la raíz del proyecto: bash setup.sh
# ============================================================

set -e  # Parar si cualquier comando falla

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC}  $1"; }
err()  { echo -e "${RED}✗${NC} $1"; exit 1; }
step() { echo -e "\n${BLUE}▶ $1${NC}"; }

echo ""
echo "╔═══════════════════════════════════════╗"
echo "║       PilatesMatch — Setup            ║"
echo "╚═══════════════════════════════════════╝"
echo ""

# ── 0. Verificar requisitos ─────────────────────────────────
step "Verificando requisitos del sistema"

command -v node >/dev/null 2>&1 || err "Node.js no está instalado. Instalá desde https://nodejs.org (v18+)"
command -v npm  >/dev/null 2>&1 || err "npm no está instalado"
command -v git  >/dev/null 2>&1 || err "git no está instalado"

NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VER" -lt 18 ]; then
  err "Necesitás Node.js 18 o superior. Versión actual: $(node -v)"
fi
log "Node $(node -v) · npm $(npm -v)"

# ── 1. Variables de entorno ─────────────────────────────────
step "Configurando variables de entorno"

if [ ! -f ".env.local" ]; then
  if [ -f ".env.example" ]; then
    cp .env.example .env.local
    warn ".env.local creado desde .env.example"
    warn "IMPORTANTE: Completá las variables antes de continuar"
    echo ""
    echo "  Abrí .env.local y completá:"
    echo "  • EXPO_PUBLIC_SUPABASE_URL"
    echo "  • EXPO_PUBLIC_SUPABASE_ANON_KEY"
    echo ""
    read -p "¿Ya completaste .env.local? (s/n): " READY
    if [[ "$READY" != "s" && "$READY" != "S" ]]; then
      warn "Completá .env.local y volvé a ejecutar setup.sh"
      exit 0
    fi
  else
    err ".env.example no encontrado"
  fi
else
  log ".env.local ya existe"
fi

# Verificar que las variables críticas estén seteadas
source .env.local 2>/dev/null || true
if [ -z "$EXPO_PUBLIC_SUPABASE_URL" ] || [ "$EXPO_PUBLIC_SUPABASE_URL" = "https://xxxxxxxxxxxx.supabase.co" ]; then
  err "EXPO_PUBLIC_SUPABASE_URL no está configurada en .env.local"
fi
if [ -z "$EXPO_PUBLIC_SUPABASE_ANON_KEY" ] || [[ "$EXPO_PUBLIC_SUPABASE_ANON_KEY" == "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."* ]]; then
  err "EXPO_PUBLIC_SUPABASE_ANON_KEY no está configurada en .env.local"
fi
log "Variables de entorno OK"

# ── 2. Instalar dependencias ────────────────────────────────
step "Instalando dependencias npm"
npm install
log "Dependencias instaladas"

# ── 3. Instalar Expo CLI y EAS CLI ──────────────────────────
step "Instalando herramientas globales"

if ! command -v expo &>/dev/null; then
  npm install -g expo-cli
  log "expo-cli instalado"
else
  log "expo-cli ya instalado ($(expo --version))"
fi

if ! command -v eas &>/dev/null; then
  npm install -g eas-cli
  log "eas-cli instalado"
else
  log "eas-cli ya instalado ($(eas --version))"
fi

if ! command -v supabase &>/dev/null; then
  npm install -g supabase
  log "supabase CLI instalado"
else
  log "supabase CLI ya instalado"
fi

# ── 4. Supabase ─────────────────────────────────────────────
step "Configurando Supabase"

if [ -z "$SUPABASE_PROJECT_ID" ]; then
  warn "SUPABASE_PROJECT_ID no configurado — saltando link automático"
  warn "Ejecutá manualmente: supabase link --project-ref TU_PROJECT_ID"
else
  supabase link --project-ref "$SUPABASE_PROJECT_ID" --password "" 2>/dev/null || \
    warn "No se pudo linkear automáticamente. Ejecutá: supabase link --project-ref $SUPABASE_PROJECT_ID"
fi

# Aplicar migraciones
echo ""
echo "¿Aplicar el schema de base de datos ahora? (s/n): "
read APPLY_DB
if [[ "$APPLY_DB" == "s" || "$APPLY_DB" == "S" ]]; then
  supabase db push && log "Schema aplicado correctamente" || warn "Error aplicando schema — verificá la conexión"
fi

# ── 5. Storage buckets ──────────────────────────────────────
step "Creando Storage buckets en Supabase"
echo ""
echo "Creando buckets via API de Supabase..."

SUPABASE_SERVICE_KEY=""
if [ -n "$SUPABASE_ACCESS_TOKEN" ]; then
  # Obtener service role key via Management API
  curl -s -X POST \
    "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_ID/storage/buckets" \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"id":"avatars","name":"avatars","public":true}' >/dev/null 2>&1 && \
    log "Bucket 'avatars' creado (público)" || warn "Bucket 'avatars' ya existente o error"

  curl -s -X POST \
    "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_ID/storage/buckets" \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"id":"certifications","name":"certifications","public":false}' >/dev/null 2>&1 && \
    log "Bucket 'certifications' creado (privado)" || warn "Bucket 'certifications' ya existente o error"
else
  warn "SUPABASE_ACCESS_TOKEN no configurado"
  warn "Creá los buckets manualmente en: https://supabase.com/dashboard/project/$SUPABASE_PROJECT_ID/storage/buckets"
  warn "  • 'avatars' → público"
  warn "  • 'certifications' → privado"
fi

# ── 6. Generar tipos TypeScript ─────────────────────────────
step "Generando tipos TypeScript desde el schema"

if [ -n "$SUPABASE_PROJECT_ID" ]; then
  npx supabase gen types typescript \
    --project-id "$SUPABASE_PROJECT_ID" \
    > src/lib/database.types.ts 2>/dev/null && \
    log "Tipos TypeScript generados en src/lib/database.types.ts" || \
    warn "No se pudieron generar tipos — ejecutá: npm run db:types"
fi

# ── 7. Expo / EAS ───────────────────────────────────────────
step "Configurando Expo"

echo ""
read -p "¿Tenés cuenta en expo.dev? (s/n): " HAS_EXPO
if [[ "$HAS_EXPO" == "s" || "$HAS_EXPO" == "S" ]]; then
  expo login && log "Sesión de Expo iniciada" || warn "Login fallido"
  eas init --id "" 2>/dev/null && log "Proyecto EAS inicializado" || warn "Inicializá EAS manualmente: eas init"
else
  warn "Creá cuenta en https://expo.dev y luego ejecutá: expo login && eas init"
fi

# ── 8. Fuentes ──────────────────────────────────────────────
step "Verificando fuentes"

FONTS_OK=true
for font in \
  "assets/fonts/DMSans-Regular.ttf" \
  "assets/fonts/DMSans-Medium.ttf" \
  "assets/fonts/DMSans-SemiBold.ttf" \
  "assets/fonts/PlayfairDisplay-Medium.ttf"; do
  if [ ! -f "$font" ]; then
    FONTS_OK=false
    warn "Falta: $font"
  fi
done

if [ "$FONTS_OK" = false ]; then
  echo ""
  echo "  Descargá las fuentes desde:"
  echo "  • DM Sans: https://fonts.google.com/specimen/DM+Sans"
  echo "  • Playfair Display: https://fonts.google.com/specimen/Playfair+Display"
  echo "  Copiá los archivos .ttf a assets/fonts/"
fi

# ── 9. Deploy Edge Functions ────────────────────────────────
step "Deploying Edge Functions"

if command -v supabase &>/dev/null && [ -n "$SUPABASE_PROJECT_ID" ]; then
  read -p "¿Deployar Edge Functions ahora? (s/n): " DEPLOY_FN
  if [[ "$DEPLOY_FN" == "s" || "$DEPLOY_FN" == "S" ]]; then
    supabase functions deploy send-match-notification && \
      log "Edge Function 'send-match-notification' deployada" || \
      warn "Error deployando Edge Function"
  fi
fi

# ── 10. Resumen final ───────────────────────────────────────
echo ""
echo "╔═══════════════════════════════════════════════════╗"
echo "║           Setup completado                        ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""
echo "  Para correr en desarrollo:"
echo "    npx expo start"
echo ""
echo "  Para abrir en simulador:"
echo "    npx expo start --ios      (requiere Xcode)"
echo "    npx expo start --android  (requiere Android Studio)"
echo ""
echo "  Para build de producción:"
echo "    eas build --platform ios --profile production"
echo "    eas build --platform android --profile production"
echo ""
echo "  Para publicar en stores:"
echo "    eas submit --platform ios"
echo "    eas submit --platform android"
echo ""
