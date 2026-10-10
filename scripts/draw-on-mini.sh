#!/usr/bin/env bash
# Runs draw-overnight on the Mac Mini instead of the MacBook, so the MacBook
# stays free. Greg, 9 October 2026: heavy jobs belong on the Mini.
#
#   npm run draw-on-mini -- start    copy the repo and drawings over, then draw
#   npm run draw-on-mini -- status   the last lines of the Mini's draw log
#   npm run draw-on-mini -- fetch    bring the drawings and sheets back
#
# Measured 9 October 2026 (M1, 16 GB): the saved 8-bit model fits (peak MLX
# 11.99 GB, 2.5 GB swap), draws the same picture as the MacBook (mean diff
# 0.32/255), at ~5.4 min a picture, so ~16 min a puzzle against ~9-10 here.
#
# The Mini needs, once: uv, mflux 0.20.0 (`uv tool install mflux==0.20.0`),
# node (brew), and ~/.cache/mflux-saved/z-image-turbo-q8 copied from here.
# Drawings are copied over first: draw-overnight skips what is already drawn,
# and without them it would redraw every puzzle.
set -euo pipefail

HOST="${MINI_HOST:-mini}"
REMOTE="quiz"
cd "$(dirname "$0")/.."

case "${1:-}" in
  start)
    if ssh "$HOST" 'pgrep -f draw-overnight >/dev/null'; then
      echo "Already drawing on $HOST. Use status." >&2; exit 1
    fi
    git ls-files | rsync -a --files-from=- . "$HOST:$REMOTE/"
    # -u: never clobber the Mini's newer log or drawings with older copies from here.
    rsync -au .cache/catchphrase/ "$HOST:$REMOTE/.cache/catchphrase/"
    ssh "$HOST" "export PATH=/opt/homebrew/bin:\$HOME/.local/bin:\$PATH
      cd $REMOTE && npm ci --silent --no-audit --no-fund \
      && nohup npm run draw-overnight > .cache/catchphrase/mini.out 2>&1 < /dev/null &"
    echo "Drawing on $HOST. npm run draw-on-mini -- status"
    ;;
  status)
    ssh "$HOST" "tail -n 3 $REMOTE/.cache/catchphrase/draw.log; pgrep -f draw-overnight >/dev/null && echo running || echo stopped"
    ;;
  fetch)
    rsync -a "$HOST:$REMOTE/.cache/catchphrase/" .cache/catchphrase/
    echo "Fetched into .cache/catchphrase. Counts only: $(ls .cache/catchphrase/*.png | wc -l) drawings."
    ;;
  *)
    echo "usage: draw-on-mini.sh start|status|fetch" >&2; exit 2
    ;;
esac
