#!/usr/bin/env bash
set -euo pipefail

TARGET_HOST="${TARGET_HOST:-mcglothi@hopper.home.timmcg.net}"
REMOTE_BASE="${REMOTE_BASE:-/home/mcglothi/code/.venvs/open-webui/lib/python3.12/site-packages/open_webui}"
LOCAL_OVERLAY="$(cd "$(dirname "$0")/.." && pwd)/integrations/open-webui/laptime-telemetry-overlay.js"
REMOTE_OVERLAY="${REMOTE_BASE}/static/laptime-telemetry-overlay.js"
REMOTE_INDEX="${REMOTE_BASE}/frontend/index.html"
SCRIPT_TAG='<script src="/static/laptime-telemetry-overlay.js" defer crossorigin="use-credentials"></script>'

echo "Copying overlay script to ${TARGET_HOST}:${REMOTE_OVERLAY}"
scp "${LOCAL_OVERLAY}" "${TARGET_HOST}:${REMOTE_OVERLAY}"

echo "Injecting overlay script tag into Hopper Open WebUI index"
ssh "${TARGET_HOST}" "python3 - <<'PY'
from pathlib import Path

index_path = Path('${REMOTE_INDEX}')
script_tag = '${SCRIPT_TAG}'
html = index_path.read_text()
if script_tag not in html:
    backup_path = index_path.with_suffix('.html.bak.laptime')
    backup_path.write_text(html)
    marker = '<link rel=\"stylesheet\" href=\"/static/custom.css\" crossorigin=\"use-credentials\" />'
    if marker not in html:
        raise SystemExit('Could not find injection marker in index.html')
    html = html.replace(marker, marker + '\\n\\t\\t' + script_tag, 1)
    index_path.write_text(html)
PY"

echo "Restarting Hopper Open WebUI user service"
ssh "${TARGET_HOST}" "systemctl --user restart open-webui.service && systemctl --user --no-pager --full status open-webui.service | sed -n '1,40p'"

echo "Done. Verify at https://llm.home.timmcg.net after the service is listening."
