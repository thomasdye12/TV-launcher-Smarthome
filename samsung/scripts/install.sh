#!/usr/bin/env bash
set -euo pipefail
if [ "$#" -ne 2 ]; then
  echo 'Usage: TIZEN_SDK_ROOT=/path/to/tizen-studio bash scripts/install.sh TV_IP CERT_PROFILE' >&2
  exit 2
fi
: "${TIZEN_SDK_ROOT:?Set TIZEN_SDK_ROOT to your official Tizen SDK installation}"
cd "$(dirname "$0")/.."
node scripts/configure.cjs
sdk="$TIZEN_SDK_ROOT"
serial="$1:26101"
"$sdk/tools/sdb" connect "$serial"
"$sdk/tools/sdb" devices | awk -v id="$serial" '$1 == id && $2 == "device" {found=1} END {exit !found}'
"$sdk/tools/ide/bin/tizen" build-web -- "$PWD/dist/tv-app"
mkdir -p dist/signed
"$sdk/tools/ide/bin/tizen" package -t wgt -s "$2" -o "$PWD/dist/signed" -- "$PWD/dist/tv-app/.buildResult"
cp 'dist/signed/TV Launcher.wgt' dist/signed/TVLauncher.wgt
"$sdk/tools/ide/bin/tizen" install-permit -s "$serial"
"$sdk/tools/ide/bin/tizen" install -s "$serial" -n "$PWD/dist/signed/TVLauncher.wgt"
"$sdk/tools/ide/bin/tizen" run -s "$serial" -p HelloTV001.Test
