#!/bin/sh
# Builds FNTPROBE.EXE (Win95-compatible, no CRT) into kr-patch/build/.
# Needs mingw-w64 (brew install mingw-w64). Source strings are UTF-8, compiled to CP949.
set -e
cd "$(dirname "$0")"
mkdir -p ../../build
i686-w64-mingw32-gcc -Os -march=i486 -mno-sse -fexec-charset=CP949 \
  -ffreestanding -fno-builtin -fno-stack-protector -fno-asynchronous-unwind-tables \
  -nostdlib -e _start@0 -Wl,--subsystem,windows:4.0 \
  -Wl,--major-os-version,4 -Wl,--minor-os-version,0 \
  -Wl,--disable-dynamicbase -Wl,--disable-nxcompat -Wl,--disable-reloc-section \
  -o ../../build/FNTPROBE.EXE fontprobe.c -lkernel32 -luser32 -lgdi32
# docs/probe.html (Win95 run) fetches it from here; gitignored.
mkdir -p ../../../docs/probe
cp ../../build/FNTPROBE.EXE ../../../docs/probe/FNTPROBE.EXE
echo "built kr-patch/build/FNTPROBE.EXE (+ docs/probe/)"
