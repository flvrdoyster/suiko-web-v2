#!/bin/zsh
SCRIPT_DIR="${0:A:h}"

SF=""

while [[ "$1" == -* ]]; do
  case "$1" in
    -s|--sf2) SF="$2"; shift 2 ;;
    -h|--help)
      cat <<'USAGE'
사용법:
  ./midi2mp3.sh                  → 현재 폴더의 *.mid 변환 (사운드폰트 자동 탐지)
  ./midi2mp3.sh haiyuki          → 지정 폴더 변환
  ./midi2mp3.sh haiyuki suiko    → 여러 폴더 한꺼번에
  ./midi2mp3.sh -s 다른.sf2 폴더  → 사운드폰트 직접 지정 (.sf2/.sf3 둘 다 가능)
USAGE
      exit 0 ;;
    *) echo "알 수 없는 옵션: $1"; exit 1 ;;
  esac
done

if [[ -z "$SF" ]]; then
  SF=$(print -r -- "$SCRIPT_DIR"/*.(sf2|sf3)(N) | head -1)
fi
if [[ -z "$SF" ]]; then
  SF=$(print -r -- "$SCRIPT_DIR"/../docs/SC-55.sf3(N))
fi

if [[ -z "$SF" || ! -f "$SF" ]]; then
  echo "오류: 사운드폰트(.sf2/.sf3)를 찾을 수 없음."
  echo "      $SCRIPT_DIR 안에 두거나 -s 옵션으로 지정하세요."
  exit 1
fi

dirs=("$@")
[[ ${#dirs[@]} -eq 0 ]] && dirs=(".")

echo "사운드폰트: $(basename "$SF")"

count=0
for DIR in "${dirs[@]}"; do
  if [[ ! -d "$DIR" ]]; then
    echo "건너뜀(폴더 아님): $DIR"
    continue
  fi

  files=("$DIR"/*.mid(N))
  if [[ ${#files[@]} -eq 0 ]]; then
    echo "건너뜀(.mid 없음): $DIR"
    continue
  fi

  echo "── $DIR (${#files[@]}개)"
  for f in "${files[@]}"; do
    base="${f%.*}"
    if [[ -f "${base}.mp3" ]]; then
      echo "  이미 있음: $(basename "${base}.mp3")"
      continue
    fi
    echo "  변환 중: $(basename "$f")"
    if fluidsynth -ni -g 1.0 -F "${base}.wav" "$SF" "$f" -q >/dev/null 2>&1 && \
       ffmpeg -i "${base}.wav" -q:a 2 "${base}.mp3" -loglevel error; then
      ((count++))
    else
      echo "  실패: $(basename "$f")"
    fi
    rm -f "${base}.wav"
  done
done

echo "완료: ${count}개 변환됨"
