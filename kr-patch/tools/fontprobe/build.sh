#!/bin/sh
set -e
cd "$(dirname "$0")"
mkdir -p ../../build
i686-w64-mingw32-gcc -Os -march=i486 -mno-sse -fexec-charset=CP949 \
  -ffreestanding -fno-builtin -fno-stack-protector -fno-asynchronous-unwind-tables \
  -nostdlib -e _start@0 -Wl,--subsystem,windows:4.0 \
  -Wl,--major-os-version,4 -Wl,--minor-os-version,0 \
  -Wl,--disable-dynamicbase -Wl,--disable-nxcompat -Wl,--disable-reloc-section \
  -o ../../build/FNTPROBE.EXE fontprobe.c -lkernel32 -luser32 -lgdi32
mkdir -p ../../../docs/probe
cp ../../build/FNTPROBE.EXE ../../../docs/probe/FNTPROBE.EXE
echo "built kr-patch/build/FNTPROBE.EXE (+ docs/probe/)"
