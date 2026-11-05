#!/bin/bash
# Publica una actualización (OTA) al canal indicado: preview (versión de prueba) o production (Play Store).
# La versión de Play Store no muestra pagos dentro de la app (política de Google Play): ver src/lib/payments.ts
# Uso: scripts/publish-update.sh <preview|production> "mensaje"
set -euo pipefail
CHANNEL="${1:?canal: preview o production}"
MSG="${2:?mensaje}"
case "$CHANNEL" in
  preview)    export EXPO_PUBLIC_IN_APP_PAYMENTS=1 ;;
  production) export EXPO_PUBLIC_IN_APP_PAYMENTS=0 ;;
  *) echo "Canal desconocido: $CHANNEL"; exit 1 ;;
esac
EAS_SKIP_AUTO_FINGERPRINT=1 npx eas update --channel "$CHANNEL" --message "$MSG" --non-interactive
