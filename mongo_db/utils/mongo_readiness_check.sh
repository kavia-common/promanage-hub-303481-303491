#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$HERE"

DB_CONN_FILE="db_connection.txt"

echo "[mongo_readiness_check] Working dir: $HERE"
if [[ ! -f "$DB_CONN_FILE" ]]; then
  echo "[mongo_readiness_check] ERROR: $DB_CONN_FILE not found."
  exit 1
fi

URI="$(awk '{print $2}' "$DB_CONN_FILE")"
if [[ -z "${URI:-}" ]]; then
  echo "[mongo_readiness_check] ERROR: Could not parse URI from $DB_CONN_FILE"
  exit 1
fi

echo "[mongo_readiness_check] URI: $URI"
echo "[mongo_readiness_check] Checking port 5001..."
(ss -ltnp 2>/dev/null | grep ':5001' || true)

echo "[mongo_readiness_check] Pinging MongoDB..."
mongosh "$URI" --quiet --eval "db.adminCommand('ping')"

echo "[mongo_readiness_check] Verifying collections and counts..."
mongosh "$URI" --quiet --eval "printjson({db: db.getName(), collections: db.getCollectionNames().sort()}); printjson({users: db.users.countDocuments(), projects: db.projects.countDocuments(), statuses: db.workflow_statuses.countDocuments(), tasks: db.tasks.countDocuments(), comments: db.comments.countDocuments(), activity_logs: db.activity_logs.countDocuments()});"

echo "[mongo_readiness_check] OK"
