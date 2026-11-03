#!/bin/bash
# Acquisition des images SamaTroc — pool séquentiel avec retries (anti-429)
OUT=/home/z/my-project/.imgsearch
IMG=/home/z/my-project/public/images/listings
mkdir -p "$OUT" "$IMG"

search() {
  local key="$1"; local q="$2"; local count="$3"
  local attempt=1
  while [ $attempt -le 4 ]; do
    if [ -s "$OUT/$key.json" ]; then echo "SKIP $key (déjà fait)"; return 0; fi
    echo "[$key] tentative $attempt"
    z-ai image-search -q "$q" --count "$count" --gl us --no-rank -o "$OUT/$key.json" > "$OUT/$key.log" 2>&1
    if [ -s "$OUT/$key.json" ] && grep -q '"success": *true' "$OUT/$key.json"; then
      echo "OK $key"; return 0
    fi
    rm -f "$OUT/$key.json"
    if grep -q "429" "$OUT/$key.log"; then
      echo "429 sur $key, attente 25s..."; sleep 25
    else
      echo "Erreur $key, attente 8s..."; sleep 8
    fi
    attempt=$((attempt+1))
  done
  echo "FAIL $key"
}

gen_hero() {
  local attempt=1
  while [ $attempt -le 4 ]; do
    if [ -s /home/z/my-project/public/images/hero.png ]; then echo "HERO déjà fait"; return 0; fi
    z-ai image -p "Photorealistic wide photo of a smiling young Senegalese woman wearing a colorful yellow top and a green African headwrap, happily using a smartphone, standing in a sunny vibrant Dakar street market with colorful fabric stalls blurred in background, warm golden afternoon light, shallow depth of field, professional photography, high quality" -o /home/z/my-project/public/images/hero.png -s 1344x768 > "$OUT/hero.log" 2>&1
    if [ -s /home/z/my-project/public/images/hero.png ]; then echo "HERO OK"; return 0; fi
    echo "hero retry, attente 20s..."; sleep 20
    attempt=$((attempt+1))
  done
  echo "HERO FAIL"
}

# Hero d'abord (1 seule tâche)
gen_hero
sleep 5

# Recherche 1 par 1 (le service limite la concurrence)
search "iphone"     "black iPhone 11 smartphone product photo" 4
search "clothes"    "stack of folded women clothes jeans lot" 4
search "bike"       "mountain bicycle parked outdoors" 3
search "sofa"       "grey two seater sofa living room furniture" 3
search "sandals"    "women leather sandals shoes fashion" 3
search "ps4"        "playstation 4 dualshock game controller" 3
search "table"      "wooden dining table with chairs" 3
search "kidsclothes" "colorful children clothes pile" 3
search "books"      "stack of books on desk" 2
search "perfume"    "perfume bottle cosmetics product" 2
search "football"   "soccer football ball on grass" 2
search "laptop"     "laptop computer on desk" 2
search "tv"         "flat screen television living room" 2
search "guitar"     "acoustic guitar leaning wall" 2
search "handbag"    "brown leather handbag" 2
search "stroller"   "baby stroller pram" 2
echo "SEARCHES_DONE"

# Téléchargement (3 premières par recherche)
download() {
  local key="$1"
  local f="$OUT/$key.json"
  [ -f "$f" ] || { echo "MISS $key"; return; }
  local i=0
  grep -o '"original_url": *"[^"]*"' "$f" | sed 's/.*"\(https[^"]*\)"/\1/' | head -3 | while read -r url; do
    i=$((i+1))
    ext="${url##*.}"
    case "$ext" in png|jpg|jpeg|webp) ;; *) ext="jpg" ;; esac
    [ -f "$IMG/${key}-${i}.${ext}" ] && continue
    curl -sL --max-time 60 -A "Mozilla/5.0" "$url" -o "$IMG/${key}-${i}.${ext}" && echo "DL ${key}-${i}.${ext}" || echo "FAIL $key-$i"
  done
}

for k in iphone clothes bike sofa sandals ps4 table kidsclothes books perfume football laptop tv guitar handbag stroller; do
  download "$k"
done

for f in "$IMG"/*; do
  size=$(stat -c%s "$f" 2>/dev/null || echo 0)
  if [ "$size" -lt 8000 ]; then rm -f "$f"; fi
done
echo "ALL_DONE"
