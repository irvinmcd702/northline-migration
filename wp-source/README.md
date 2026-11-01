# wp-source — the "before" WordPress site

A local WordPress site of the fictional Northline Industrial Supply, built
from files so it can be recreated from zero.

    bash seed.sh            # start containers, install, import content
    bash tests/smoke.sh     # structure check
    bash tests/content.sh   # content counts check

Site: http://localhost:8080 (admin user `admin`, password in `.env`,
generated on the first run). Reset everything:

    docker compose down -v && bash seed.sh

- `mu-plugins/northline-types.php` — post types `product`, `project`,
  `inventory`, taxonomy `product_category`, ACF field groups (in code).
- `theme/northline-child/` — child theme of Twenty Twenty-Four.
- `content/` — texts and data; `import/import.php` loads them.

On Windows (Git Bash) the scripts set `MSYS_NO_PATHCONV=1`, otherwise
arguments such as `/blog/%postname%/` are rewritten into Windows paths.
