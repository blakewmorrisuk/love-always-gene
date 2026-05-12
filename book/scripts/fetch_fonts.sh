#!/usr/bin/env bash
#
# fetch_fonts.sh — Download the four font families used by `Love, Always`
# from Google Fonts' GitHub repositories and place them in book/fonts/.
#
# All four families are licensed for embedding in PDFs:
#   - Cormorant Garamond — SIL Open Font License 1.1
#   - Source Serif 4     — SIL Open Font License 1.1
#   - Caveat             — SIL Open Font License 1.1
#   - JetBrains Mono     — SIL Open Font License 1.1
#
# Run from book/:   make fonts   (or:  bash scripts/fetch_fonts.sh)

set -euo pipefail

cd "$(dirname "$0")/.."
mkdir -p fonts
cd fonts

fetch() {
    local url="$1"
    local out="$2"
    if [[ -f "$out" ]]; then
        echo "  exists: $out"
        return
    fi
    echo "  fetching: $out"
    curl -fsSL -o "$out" "$url"
}

echo "Downloading Cormorant Garamond..."
CG_BASE="https://github.com/google/fonts/raw/main/ofl/cormorantgaramond"
fetch "$CG_BASE/CormorantGaramond-Regular.ttf"      CormorantGaramond-Regular.ttf
fetch "$CG_BASE/CormorantGaramond-Italic.ttf"       CormorantGaramond-Italic.ttf
fetch "$CG_BASE/CormorantGaramond-SemiBold.ttf"     CormorantGaramond-SemiBold.ttf
fetch "$CG_BASE/CormorantGaramond-SemiBoldItalic.ttf" CormorantGaramond-SemiBoldItalic.ttf

echo "Downloading Source Serif 4..."
SS_BASE="https://github.com/adobe-fonts/source-serif/raw/release/OTF"
fetch "$SS_BASE/SourceSerif4-Regular.otf"           SourceSerif4-Regular.otf
fetch "$SS_BASE/SourceSerif4-It.otf"                SourceSerif4-Italic.otf
fetch "$SS_BASE/SourceSerif4-Semibold.otf"          SourceSerif4-SemiBold.otf
fetch "$SS_BASE/SourceSerif4-SemiboldIt.otf"        SourceSerif4-SemiBoldItalic.otf

echo "Downloading Caveat..."
CV_BASE="https://github.com/google/fonts/raw/main/ofl/caveat"
fetch "$CV_BASE/Caveat%5Bwght%5D.ttf"               Caveat-Regular.ttf
# The variable-axis file above covers Regular through SemiBold. The class
# pulls SemiBold from the same file via fontspec features; we duplicate the
# filename to keep the class file simple.
cp -f Caveat-Regular.ttf Caveat-SemiBold.ttf

echo "Downloading JetBrains Mono..."
JBM_BASE="https://github.com/JetBrains/JetBrainsMono/raw/master/fonts/ttf"
fetch "$JBM_BASE/JetBrainsMono-Regular.ttf"         JetBrainsMono-Regular.ttf
fetch "$JBM_BASE/JetBrainsMono-SemiBold.ttf"        JetBrainsMono-SemiBold.ttf

echo
echo "Done. Fonts installed:"
ls -1
