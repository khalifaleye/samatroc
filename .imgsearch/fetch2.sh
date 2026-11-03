#!/bin/bash
# Acquisition images SamaTroc — synchrone, stdout parsing
IMG=/home/z/my-project/public/images/listings
mkdir -p "$IMG"

fetch() {
  local key="$1"; local q="$2"; local n="${3:-3}"
  local json
  json=$(timeout 120 z-ai image-search -q "$q" --count 5 --gl us --no-rank 2>/dev/null | sed -n '/^{/,$p')
  if [ -z "$json" ]; then echo "FAIL $key"; return; fi
  local i=0
  echo "$json" | grep -o '"original_url": *"[^"]*"' | sed 's/.*"\(https[^"]*\)"/\1/' | head -"$n" | while read -r url; do
    i=$((i+1))
    ext="${url##*.}"
    case "$ext" in png|jpg|jpeg|webp) ;; *) ext="jpg" ;; esac
    curl -sL --max-time 40 -A "Mozilla/5.0" "$url" -o "$IMG/${key}-${i}.${ext}" && echo "DL ${key}-${i}.${ext}" || echo "FAILDL $key-$i"
  done
}

fetch "iphone"      "black iPhone 11 smartphone product photo" 3
fetch "clothes"     "stack of folded women clothes jeans lot" 3
fetch "bike"        "mountain bicycle parked outdoors full view" 2
fetch "sofa"        "grey two seater sofa living room furniture" 2
fetch "sandals"     "women leather sandals shoes fashion product" 2
fetch "ps4"         "playstation 4 dualshock wireless game controller" 2
fetch "table"       "wooden dining table with chairs" 2
fetch "kidsclothes" "colorful children kids clothes pile" 3
fetch "books"       "stack of books on wooden desk" 2
fetch "perfume"     "perfume bottle cosmetics product photography" 2
fetch "football"    "soccer football ball on grass" 2
fetch "laptop"      "laptop computer on desk product photo" 2
fetch "tv"          "flat screen television living room" 2
fetch "guitar"      "acoustic guitar leaning against wall" 2
fetch "handbag"     "brown leather handbag fashion product" 2
fetch "stroller"    "modern baby stroller pram outdoors" 2

# Nettoyage des fichiers trop petits
for f in "$IMG"/*; do
  s=$(stat -c%s "$f" 2>/dev/null || echo 0)
  [ "$s" -lt 8000 ] && rm -f "$f"
done
echo "DONE"
ls "$IMG" | wc -l
