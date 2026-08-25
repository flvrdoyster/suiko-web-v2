#!/bin/zsh
# midi2mp3.sh — render extracted game MIDI to MP3 with a soundfont, for by-ear QA.
#
# Not part of the build/deploy pipeline (the game's actual MIDI playback is the
# browser-side bridge — see NOTES.md "3.1 사운드 구조"). This is a standalone listening
# tool: point it at a folder of *.mid pulled from the game data and it batch-renders
# *.mp3 next to each one via fluidsynth + ffmpeg, so soundfont changes/conversions
# (e.g. docs/SC-55.sf3 vs the original SC-55.sf2) can be A/B'd by ear without booting
# the emulator. Requires fluidsynth and ffmpeg on PATH (macOS: brew install fluid-synth
# ffmpeg).
#
# 사용법:
#   ./midi2mp3.sh                  → 현재 폴더의 *.mid 변환 (사운드폰트 자동 탐지)
#   ./midi2mp3.sh haiyuki          → 지정 폴더 변환
#   ./midi2mp3.sh haiyuki suiko    → 여러 폴더 한꺼번에
#   ./midi2mp3.sh -s 다른.sf2 폴더  → 사운드폰트 직접 지정 (.sf2/.sf3 둘 다 가능)
#
# 사운드폰트를 안 주면: 이 스크립트와 같은 폴더의 .sf2/.sf3 파일을 먼저 찾고,
# 없으면 리포에 실제로 실려 배포되는 ../docs/SC-55.sf3로 자동 폴백한다.

# 스크립트가 위치한 폴더 (어디서 실행하든 사운드폰트를 찾기 위함)
SCRIPT_DIR="${0:A:h}"

SF=""

# -s / --sf2 로 사운드폰트 직접 지정 (선택, 옵션 이름은 하위호환용으로 유지)
while [[ "$1" == -* ]]; do
  case "$1" in
    -s|--sf2) SF="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) echo "알 수 없는 옵션: $1"; exit 1 ;;
  esac
done

# 사운드폰트 자동 탐지: 지정 안 했으면 스크립트 폴더의 .sf2/.sf3 중 첫 번째,
# 그것도 없으면 리포 배포판 docs/SC-55.sf3로 폴백
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

# 폴더 인자가 없으면 현재 폴더 사용
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
    # 이미 변환된 mp3가 있으면 건너뜀
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
