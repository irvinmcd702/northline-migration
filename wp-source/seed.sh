#!/usr/bin/env bash
# Builds the Northline WordPress site from scratch (safe to re-run).
set -euo pipefail
export MSYS_NO_PATHCONV=1  # Git Bash on Windows rewrites /paths in arguments
cd "$(dirname "$0")"

if [[ ! -f .env ]]; then
	printf 'DB_PASSWORD=%s\nWP_ADMIN_PASSWORD=%s\n' \
		"$(head -c 18 /dev/urandom | base64 | tr -dc A-Za-z0-9)" \
		"$(head -c 18 /dev/urandom | base64 | tr -dc A-Za-z0-9)" > .env
fi
set -a; source .env; set +a

wp() { docker compose run --rm -T cli wp "$@"; }

docker compose up -d db wordpress
for _ in $(seq 1 60); do
	wp core version >/dev/null 2>&1 && wp db check >/dev/null 2>&1 && break
	sleep 2
done

if ! wp core is-installed >/dev/null 2>&1; then
	wp core install --url=http://localhost:8080 --title="Northline Industrial Supply" \
		--admin_user=admin --admin_password="$WP_ADMIN_PASSWORD" \
		--admin_email=admin@northline.test --skip-email
fi

wp option update blogdescription "Pumps, compressors and industrial valves since 1998"
wp plugin install advanced-custom-fields wordpress-seo contact-form-7 --activate
wp theme activate northline-child
wp rewrite structure '/blog/%postname%/'
wp rewrite flush --hard

if [[ -f import/import.php && -d content ]]; then
	wp eval-file /import/import.php
	wp rewrite flush --hard
fi
