#!/usr/bin/env bash
# Applies the local Supabase stub + all migrations to a scratch database and
# runs the database security tests. Requires a PostgreSQL server; override the
# connection with PGURL, e.g.
#   PGURL=postgresql://postgres@127.0.0.1:5432/postgres ./tests/rls/run.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PGURL="${PGURL:-postgresql://postgres@127.0.0.1:5432/postgres}"
DB="${TEST_DB:-gtp_rls_test}"

psql "$PGURL" -q -v ON_ERROR_STOP=1 \
  -c "select pg_terminate_backend(pid) from pg_stat_activity where datname = '$DB'" >/dev/null \
  -c "drop database if exists $DB" -c "create database $DB"
DATABASE_URL="${PGURL%/*}/$DB"

psql "$DATABASE_URL" -q -v ON_ERROR_STOP=1 -c "create schema if not exists public"
psql "$DATABASE_URL" -q -v ON_ERROR_STOP=1 -f "$ROOT/supabase/tests/harness/00_local_supabase_stub.sql" 2>&1 | grep -v 'WARNING\|HINT' || true

for migration in "$ROOT"/supabase/migrations/*.sql; do
  echo "applying $(basename "$migration")"
  psql "$DATABASE_URL" -q -v ON_ERROR_STOP=1 -f "$migration"
done

psql "$DATABASE_URL" -q -v ON_ERROR_STOP=1 -f "$ROOT/tests/rls/security.sql" 2>&1 |
  grep -E 'PASS|FAIL|summary|ALL PASSED|^-+\+|failed|\|' || true

psql "$DATABASE_URL" -q -t -A -c \
  "select case when bool_and(passed) then 0 else 1 end from test.results" |
  grep -q '^0$' || { echo "RLS security tests FAILED"; exit 1; }