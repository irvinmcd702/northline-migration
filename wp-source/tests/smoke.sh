#!/usr/bin/env bash
# Smoke test: WordPress is up and has the Northline structure.
set -u
export MSYS_NO_PATHCONV=1
cd "$(dirname "$0")/.."
BASE=${WP_URL:-http://localhost:8080}
fail=0
check() { if eval "$2"; then echo "ok   $1"; else echo "FAIL $1"; fail=1; fi; }
wp() { docker compose run --rm -T cli wp "$@" 2>/dev/null; }

root=$(curl -s "$BASE/wp-json/")
types=$(curl -s "$BASE/wp-json/wp/v2/types")
check "site name"            '[[ "$root" == *"\"name\":\"Northline Industrial Supply\""* ]]'
check "type product"         '[[ "$types" == *"\"product\":"* ]]'
check "type project"         '[[ "$types" == *"\"project\":"* ]]'
check "type inventory"       '[[ "$types" == *"\"inventory\":"* ]]'
check "product_category api" '[[ $(curl -s -o /dev/null -w "%{http_code}" "$BASE/wp-json/wp/v2/product_category") == 200 ]]'
check "permalinks"           '[[ $(wp option get permalink_structure | tr -d "\r") == "/blog/%postname%/" ]]'
check "products archive"     '[[ $(curl -s -o /dev/null -w "%{http_code}" "$BASE/products/") == 200 ]]'
exit $fail
