#!/bin/sh
set -e
# wait for Postgres (compose healthcheck normally covers this; belt and braces)
i=0
until node -e "const {Client}=require('pg');const c=new Client({connectionString:process.env.DATABASE_URL});c.connect().then(()=>c.end()).catch(()=>process.exit(1))"; do
  i=$((i+1)); [ "$i" -gt 30 ] && echo "Postgres not reachable" && exit 1
  sleep 1
done
set +e
npx tsx scripts/ensure-seed.ts
rc=$?
set -e
if [ "$rc" -eq 10 ]; then
  echo "→ empty database, seeding demo data"
  SEED_KEEP_ASSETS=1 npx tsx scripts/seed.ts
elif [ "$rc" -ne 0 ]; then
  exit "$rc"
fi
exec "$@"
