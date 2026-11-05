#!/bin/bash
# Publica la versión web (EAS Hosting). Es donde los estudios pagan su plan con Mercado Pago.
# Uso: scripts/deploy-web.sh          (vista previa con URL propia)
#      scripts/deploy-web.sh --prod   (versión publicada)
set -euo pipefail
rm -rf dist
npx expo export --platform web --output-dir dist
# El bundle usa import.meta: el script tiene que cargarse como módulo
sed -i 's/<script src=/<script type="module" src=/g' dist/index.html
npx eas deploy --non-interactive "$@"
