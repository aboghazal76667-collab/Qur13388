#!/usr/bin/env bash
#
# Download the raw corpora and regenerate the bundled dataset.
#
# Only needed when changing how the dataset is built — src/data/generated/ is
# committed, so a fresh clone runs without this.
#
#   ./scripts/fetch-data.sh
#
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p data-raw

# Uthmani text, surah metadata.
curl -sSL -o data-raw/quran.json \
  https://raw.githubusercontent.com/risan/quran-json/main/dist/quran.json

# Quranic Arabic Corpus morphology: per-segment root, lemma, POS and features.
curl -sSL -o data-raw/quran-morphology.txt \
  https://raw.githubusercontent.com/mustafa0x/quran-morphology/master/quran-morphology.txt

node scripts/build-data.js
