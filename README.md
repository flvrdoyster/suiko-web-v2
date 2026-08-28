# 환세취호전 웹 에뮬레이터 (suiko-web-v2)

**▶ 바로 플레이: [suiko.atah.io](https://suiko.atah.io/kr.html)**

## 개요

Compile이 Windows 95로 발매한 환세취호전(幻世酔虎伝)의 웹 에뮬레이터 프로젝트.  
suiko-web(삭제)의 후속으로, 에뮬레이터 백엔드와 세이브 데이터 구조를 새로이 다시 설계함.

### 구성

+ **`docs/`** — 배포용 웹 에뮬레이터. GitHub Pages로 `https://suiko.atah.io`에 서빙됨. KR(`kr.html`)·JP(`jp.html`)가 하나의 공유 디스크 이미지(`final-shared.img`)를 사용.
+ **`src/`** / **`test/`** — FAT16 파일 단위 추출/주입 라이브러리(`fat16.js`)와 테스트. 세이브 데이터 저장, KR 텍스트 패치 주입에 공용으로 쓰임.
+ **`tools/`** — 베이스 디스크 이미지 빌드 도구(`strip-image.js`, `build-image.js`, `build-jp-image.js`, `bake-fonts.js`)와 사운드폰트 청감 확인용 `midi2mp3.sh`(빌드 파이프라인과 무관한 독립 도구).
+ **`kr-patch/`** — 정식 KR 번역을 저본으로 한 전면 개정 파이프라인(추출·검수 에디터·재삽입).
+ **`original/`** — 원본 게임 파일(저장소에는 없음, 로컬에 직접 준비 필요).

그래픽 **추출**(`GENSE.FLD` 아카이브 · CNS 이미지)은 [compile-gfx](https://github.com/flvrdoyster/compile-gfx)로
일원화되어 있음 — `compile-gfx fld original/jp/GENSE.FLD out/`.
이 저장소에는 **재삽입** 쪽만 둔다(`kr-patch/tools/cara-fnt.js`의 폰트 교체 등).

### 로컬 준비

배포 사이트를 이용하는 데는 필요 없고, **저장소의 도구를 돌릴 때만** 필요하다.

```
npm install
```

`iconv-lite`(CP949 인코딩) 하나를 받는다. 텍스트 파이프라인(`kr-patch/tools/hwanse-text.js`,
`hwanse-names.js`, `gense-text.js`, `gense-names.js`, `demo-menu.js`)이 전부 이 모듈에
의존하므로, 새로 클론한 뒤 이걸 건너뛰면 `Cannot find module 'iconv-lite'`로 실패한다.

---

## 기술 노트

역공학 분석 및 구현 상세: [`NOTES.md`](NOTES.md)

---

## 크레딧

**에뮬레이터**: [DosWasmX](https://github.com/nbarkhina/DosWasmX) — MIT License  
**MIDI 사운드폰트 렌더링**: [SpessaSynth](https://github.com/spessasus/SpessaSynth) — Apache-2.0 License  
**번역 수정 및 웹 배포**: flvrdoyster

---

## 소프트웨어 고지 / Software Notice

본 저장소는 환세취호전의 원본(일본어)과 국내 발매판(한국어)을 브라우저 환경에서 실행하기 위한 도구를 포함합니다.

원본 게임은 Compile이 개발하였으며, 게임 자산(그래픽, 음악 등)의 모든 권리는 원저작권자에게 있습니다.

본 프로젝트는 비상업적 보존 목적으로만 운영됩니다. 저작권자로서 자료 삭제를 원하실 경우 Issue를 열어주시면 즉시 대응하겠습니다.

This repository contains tools for running original and Korean-localized versions of the Gensei Suikoden (幻世酔虎伝) in a browser environment.

The games were originally developed by Compile. All rights to the games and their assets (graphics, music, etc.) belong to their respective copyright holders.

This project exists solely for non-commercial preservation. If you are a rights holder and would like this material removed, please open an issue and it will be promptly addressed.
