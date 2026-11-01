#!/usr/bin/env bash
# Content check: counts and required fields after seeding.
set -u
export MSYS_NO_PATHCONV=1
cd "$(dirname "$0")/.."
fail=0
wp() { docker compose run --rm -T cli wp "$@" 2>/dev/null | tr -d '\r'; }
expect() { if [[ "$2" == "$3" ]]; then echo "ok   $1 = $2"; else echo "FAIL $1: got '$2', want '$3'"; fail=1; fi; }

expect "product categories" "$(wp term list product_category --format=count)" 4
expect "products"           "$(wp post list --post_type=product --format=count)" 20
expect "inventory"          "$(wp post list --post_type=inventory --format=count)" 7
expect "projects"           "$(wp post list --post_type=project --format=count)" 7
expect "posts"              "$(wp post list --post_type=post --format=count)" 6
expect "pages"              "$(wp post list --post_type=page --format=count)" 10
expect "inventory statuses" "$(wp eval 'foreach(["available","reserved","sold"] as $s){echo count(get_posts(["post_type"=>"inventory","numberposts"=>-1,"meta_key"=>"status","meta_value"=>$s])),",";}')" "4,2,1,"
expect "products without sku" "$(wp eval 'echo count(array_filter(get_posts(["post_type"=>"product","numberposts"=>-1]),fn($p)=>!get_post_meta($p->ID,"sku",true)));')" 0
expect "products without pdf" "$(wp eval 'echo count(array_filter(get_posts(["post_type"=>"product","numberposts"=>-1]),fn($p)=>get_post_mime_type((int)get_post_meta($p->ID,"datasheet",true))!=="application/pdf"));')" 0
expect "products without image" "$(wp eval 'echo count(array_filter(get_posts(["post_type"=>"product","numberposts"=>-1]),fn($p)=>!has_post_thumbnail($p)));')" 0
exit $fail
