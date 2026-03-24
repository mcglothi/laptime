#!/usr/bin/env bash
set -euo pipefail

HOST="${1:-laptime.run}"
HOURS="${2:-24}"
ACCOUNT_TAG="${CLOUDFLARE_ACCOUNT_TAG:-61cc466d686066cc3b0262f078fd77db}"
BW_ITEM="${CLOUDFLARE_BW_ITEM:-PAT/Cloudflare/API Token}"

if ! command -v bw >/dev/null 2>&1; then
  echo "bw CLI is required" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required" >&2
  exit 1
fi

if [[ ! -f "${HOME}/.bw_session" ]]; then
  echo "~/.bw_session is missing; run bwu first" >&2
  exit 1
fi

date_hours_ago() {
  local hours="$1"
  if date -u -v-"${hours}"H +%Y-%m-%dT%H:%M:%SZ >/dev/null 2>&1; then
    date -u -v-"${hours}"H +%Y-%m-%dT%H:%M:%SZ
  else
    date -u -d "${hours} hours ago" +%Y-%m-%dT%H:%M:%SZ
  fi
}

BW_SESSION="$(<"${HOME}/.bw_session")"
CF_EMAIL="$(bw get username "${BW_ITEM}" --session "${BW_SESSION}")"
CF_KEY="$(bw get password "${BW_ITEM}" --session "${BW_SESSION}")"
START="$(date_hours_ago "${HOURS}")"
END="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

read -r -d '' QUERY <<'EOF' || true
query($accountTag: string, $host: string, $start: Time, $end: Time) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      hourly: rumPageloadEventsAdaptiveGroups(
        limit: 240
        orderBy: [datetimeHour_ASC]
        filter: {
          datetime_geq: $start
          datetime_lt: $end
          requestHost: $host
          bot: 0
        }
      ) {
        dimensions { datetimeHour }
        count
        sum { visits }
      }
      referrers: rumPageloadEventsAdaptiveGroups(
        limit: 12
        orderBy: [sum_visits_DESC]
        filter: {
          datetime_geq: $start
          datetime_lt: $end
          requestHost: $host
          bot: 0
        }
      ) {
        dimensions { refererHost }
        count
        sum { visits }
      }
      countries: rumPageloadEventsAdaptiveGroups(
        limit: 10
        orderBy: [sum_visits_DESC]
        filter: {
          datetime_geq: $start
          datetime_lt: $end
          requestHost: $host
          bot: 0
        }
      ) {
        dimensions { countryName }
        count
        sum { visits }
      }
    }
  }
}
EOF

JSON="$(
  jq -n \
    --arg q "${QUERY}" \
    --arg account "${ACCOUNT_TAG}" \
    --arg host "${HOST}" \
    --arg start "${START}" \
    --arg end "${END}" \
    '{query:$q,variables:{accountTag:$account,host:$host,start:$start,end:$end}}'
)"

RAW="$(
  curl -sS https://api.cloudflare.com/client/v4/graphql \
    -H "Content-Type: application/json" \
    -H "X-Auth-Email: ${CF_EMAIL}" \
    -H "X-Auth-Key: ${CF_KEY}" \
    --data "${JSON}"
)"

if [[ "$(jq -r '.errors != null and (.errors | length > 0)' <<<"${RAW}")" == "true" ]]; then
  jq '.errors' <<<"${RAW}" >&2
  exit 1
fi

jq '
  .data.viewer.accounts[0] as $a
  | {
      host: "'"${HOST}"'",
      window_hours: '"${HOURS}"',
      window_start_utc: "'"${START}"'",
      window_end_utc: "'"${END}"'",
      totals: {
        page_load_events: ($a.hourly | map(.count) | add // 0),
        visits: ($a.hourly | map(.sum.visits) | add // 0)
      },
      peak_hour: (
        ($a.hourly | max_by(.sum.visits))
        | {
            utc_hour: .dimensions.datetimeHour,
            visits: .sum.visits,
            page_load_events: .count
          }
      ),
      top_referrers: (
        $a.referrers
        | map({
            referer_host: (if .dimensions.refererHost == "" then "(direct/unknown)" else .dimensions.refererHost end),
            visits: .sum.visits,
            page_load_events: .count
          })
      ),
      top_countries: (
        $a.countries
        | map({
            country: .dimensions.countryName,
            visits: .sum.visits,
            page_load_events: .count
          })
      )
    }
' <<<"${RAW}"
