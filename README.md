# 환세취호전 한국어판 개선 패치 (suiko-web-v2)

**▶ 패치 적용: [suiko.atah.io/patch.html](https://suiko.atah.io/patch.html)**  
**▶ 웹에서 바로 플레이: [suiko.atah.io](https://suiko.atah.io/kr.html)** (패치 적용본)

## 개요

환세취호전(幻世酔虎伝, Compile, 1997)의 국내 정식으로 발매된 한국어판을 저본으로 한 **번역 개선**·**호환성 패치**와 **웹 에뮬레이터** 프로젝트. 
suiko-web(삭제)의 후속으로, 에뮬레이터 백엔드와 세이브 데이터 구조를 새로이 다시 설계했다.
패치된 실행 파일은 Windows 95/98과 NT 계열(XP~11) 양쪽을 모두 대응한다.

## 주요 내용

### 번역 개선

- 정식판 대사 14,812줄·레이블(아이템·기술·장비 이름) 390개를 원문(일본어)과 1:1로 대조해
  전수 검토
- 의미 왜곡·오기·누락 수정(예: 획득 금액 10배 오기), 문장부호·표기 정리
- 캐릭터 말투 정비 — 주연·조연별 어미 체계, 린샹의 상대별 존대·반존대·반말 분기

번역 판단 기준은 [`kr-patch/translation/GUIDE.md`](kr-patch/translation/GUIDE.md)에 있다.

### 호환성 패치

- 스테이터스 창에서 기술을 볼 때 튕기는 문제(현행 Windows) 수정 — 기술 MP 부족 표시도 바로잡음
- 현행 Windows에서 글자 크기·간격이 어긋나는 문제 수정
- `Alt + Enter` 창 모드 추가
- 전체 화면에서 `Alt + Tab` 후 돌아오면 화면이 검게 남는 문제 수정

## 패치 사용

[패치 페이지](https://suiko.atah.io/patch.html)에 정식판의 실행 파일(`HWANSE.EXE` 또는 `HWANSE2.EXE`)과
`GENSE.FLD`를 넣으면, 브라우저 안에서 패치를 입힌 두 파일을 내려받을 수 있다. 파일은 서버로 가지 않는다.
받은 파일을 게임 폴더에 넣고 `HWANSE.EXE`로 실행한다.

## 저장소 구성

+ **`kr-patch/`** — 번역·패치 파이프라인. 원본 추출, 검수 에디터, 텍스트 재삽입,
  호환성 패치 적용까지. 번역 데이터는 `kr-patch/translation/translation.json`.
+ **`docs/`** — 웹 에뮬레이터. GitHub Pages로 `suiko.atah.io`에 서빙. KR(`kr.html`)·JP(`jp.html`)가
  하나의 공유 디스크 이미지(`final-shared.img`)를 사용.
+ **`src/`** / **`test/`** — FAT16 파일 단위 추출/주입 라이브러리(`fat16.js`)와 테스트.
+ **`tools/`** — 웹 에뮬레이터용 베이스 디스크 이미지 빌드 도구, 사운드폰트 청감 확인용 `midi2mp3.sh`.
+ **`original/`** — 원본 게임 파일(저장소에는 없음, 로컬에 직접 준비).

그래픽 **추출**(`GENSE.FLD` 아카이브 · CNS 이미지)은 [compile-gfx](https://github.com/flvrdoyster/compile-gfx)로
일원화되어 있다. 이 저장소에는 재삽입 쪽만 둔다.

## 직접 빌드

패치를 쓰는 데는 필요 없고, 저장소의 도구를 돌릴 때만 필요하다. `original/kr/`에 정식판
`HWANSE.EXE`·`GENSE.FLD`를 준비한 뒤:

```
npm install
node kr-patch/tools/build.js      # → kr-patch/build/HWANSE.EXE (번역 + 호환성 패치)
node kr-patch/tools/cara-fnt.js   # → kr-patch/build/GENSE.FLD (대회 장면 글자 그래픽)
```

`npm install`은 `iconv-lite`(CP949 인코딩) 하나를 받는다. 텍스트 파이프라인 전체가 이 모듈에
의존하므로 건너뛰면 `Cannot find module 'iconv-lite'`로 실패한다.

---

## 기술 노트

진행 상황, 남은 작업, 역공학·구현 상세: [`NOTES.md`](NOTES.md)

---

## 크레딧

**번역 개선 · 호환성 패치 · 웹 배포**: flvrdoyster  
**에뮬레이터**: [DosWasmX](https://github.com/nbarkhina/DosWasmX) — MIT License  
**MIDI 사운드폰트 렌더링**: [SpessaSynth](https://github.com/spessasus/SpessaSynth) — Apache-2.0 License

---

## 소프트웨어 고지 / Software Notice

본 저장소는 환세취호전의 국내 정식으로 발매된 한국어판을 대상으로 한 번역 개선·호환성 패치와,
원본(일본어) 및 한국어판을 브라우저 환경에서 실행하기 위한 도구를 포함합니다. 패치 사용에는
정식판이 필요합니다.

원본 게임은 Compile이 개발하였으며, 게임 자산(그래픽, 음악 등)의 모든 권리는 원저작권자에게 있습니다.

본 프로젝트는 비상업적 보존 목적으로만 운영됩니다. 저작권자로서 자료 삭제를 원하실 경우 Issue를 열어주시면 즉시 대응하겠습니다.

This repository contains a translation revision and compatibility patch for the Korean release
of Gensei Suikoden (幻世酔虎伝), along with tools for running the original and Korean versions
in a browser environment. Using the patch requires the retail release.

The games were originally developed by Compile. All rights to the games and their assets (graphics, music, etc.) belong to their respective copyright holders.

This project exists solely for non-commercial preservation. If you are a rights holder and would like this material removed, please open an issue and it will be promptly addressed.
