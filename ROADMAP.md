# 진행 상황 & 남은 작업

배포 중: **https://flvrdoyster.github.io/suiko-web-v2/** (KR만, `docs/` 폴더 기준 GitHub Pages)

## 완료

- **엔진**: doswasmx(nbarkhina/DosWasmX, MIT)를 커스텀 재빌드. `src/gui/sdlmain.cpp`의 `MIDI_RawOutByte`/`MIDI_Available` 스텁을 패치해 MIDI 바이트를 `window.SuikoMidi.raw()`로 브리지. 재빌드 방법은 메모리(`suiko-web-v2-wasm-rebuild`)에 기록됨 — emsdk 3.1.49 + caiiiycuk/binaryen-fwasm-exceptions의 macOS wasm-opt 필요.
- **색감/PCM**: doswasmx 그대로 정상 동작 확인.
- **MIDI 사운드폰트**: Win95 MIDI 매퍼를 "External MIDI Port"로 설정하면 게임 MIDI가 브리지를 타고 JS의 spessasynth로 흘러 SC-55.sf3(9MB, 원본 sf2 53MB에서 변환)로 렌더링. 이 MIDI 매퍼 기본값은 **베이스 이미지에 베이킹됨**(수동 설정 후 doswasmx "Export Hard Drive"로 내보낸 이미지의 SYSTEM.DAT를 그대로 채택) — 부팅하면 자동으로 적용, 사용자 조작 불필요.
- **세이브**: `src/fat16.js` — FAT16 파일 단위 추출/주입. 게임의 `C:\GENSE\SAVEDATA\`(SAVEDAT1~6.DAT, 각 1274B 고정)만 추출해 IndexedDB에 저장하고, 베이스 이미지에 재주입하는 방식(디스크 전체 재저장 없음). `test/fat16.test.js`로 검증됨.
- **사이즈**: 원본 94MB → gzip 전송 기준 최종 KR 이미지 약 27.9MB. `tools/strip-image.js`(불필요 Win95 컴포넌트 삭제 + 서양 폰트 삭제 + 빈 공간 제로화) + SC-55 SF3 변환(53MB→9MB)이 핵심 레버. 참고: 오디오 SC-55.sf3(9MB)는 gzip 압축이 거의 안 되므로 그대로 서빙.
- **부팅 자동화**: `MSDOS.SYS`에 `AutoScan=0` 추가해 스캔디스크 프롬프트 제거. WIN.INI `load=` 로 게임 자동 실행.
- **UI**: gensei-pc98 스타일(top-bar, 시작 오버레이, 가상 게임패드) 이식. doswasmx 데모 UI(Browse/Save Drive/CPU 설정 등)는 `suiko-ui.css`로 화면에서만 숨김 — 코드/기능은 그대로 남아있음(재활용 가능).
- **배포**: GitHub Pages, `docs/` 폴더, 디스크 이미지는 gzip으로 저장하고 `script.js`의 `load_url_request`에 매직바이트(`1f 8b`) 감지 후 `DecompressionStream`으로 인플레이트하는 패치 추가.

## 남은 작업

### 1. 하네스 정리 (원래 Task 4)
지금 `docs/index.html`은 doswasmx의 방대한 데모 하네스(rivets 바인딩, 클라우드 로그인, 드래그드롭, 여러 모달 등 2900줄 `script.js`)를 그대로 두고 CSS로 안 보이게만 한 상태. 목표는:
- 실제로 쓰는 기능(엔진 부팅, gzip 이미지 로드, 세이브 저장/복원)만 남기고 나머지 죽은 코드 제거
- 지금 `saveDrive()`/`exportHardDrive()` 같은 디스크 전체 저장 로직이 남아있는데, 이걸 `src/fat16.js` 기반 SAVEDATA 전용 저장으로 교체
- 구체적으로: 세이브 트리거(주기적 폴링 또는 게임 내 저장 이벤트 감지) → `Module.FS.readFile()`로 현재 디스크 상태 획득 → `Fat16.extractDirFiles(img, 'GENSE/SAVEDATA')` → IndexedDB 저장. 부팅 전: IndexedDB에서 세이브 있으면 베이스 이미지 로드 후 `Fat16.injectDirFiles()`로 주입 → `Module.FS.writeFile()`

### 2. JP 빌드 (원래 Task 6)
- `original/jp/`(GENSE.EXE 등)를 KR과 동일한 방식으로 Win95 이미지에 설치해 JP 베이스 이미지 제작 (`tools/build-image.js`, `tools/strip-image.js` 재사용)
- **세이브 호환 확인**: KR/JP는 세이브 포맷이 같다고 확인됐음(사용자 보장) — 실제로 KR에서 저장한 SAVEDATA를 JP 베이스에 주입해서 정상 로드되는지, 반대 방향도 검증 필요
- 언어 진입은 URL 분리(`kr.html`/`jp.html` 또는 `index.html`+`jp.html`), 세이브는 언어 독립적 키로 공용 IndexedDB 스토어 사용

### 3. 자잘한 마무리
- **MIDI 재생 초기 딜레이**: 사운드폰트 로딩 중 도착한 MIDI 메시지를 큐잉했다가 준비되면 flush하도록 이미 고쳤지만, 사용자가 "10 msgs 정도 밀린다"고 보고 — 근본 원인(로딩 자체가 오래 걸림, 또는 큐 flush 타이밍) 추가 조사 여지 있음. 우선순위 낮음으로 보류됨.
- **가상 게임패드 실기 검증**: 모바일 터치 기기 또는 브라우저 DevTools 모바일 에뮬레이션으로 아직 실사용 테스트 안 함.
- **README**: 사용자가 직접 관리 중이므로 별도 작업 없음.
- `.vendor-tmp/`(doswasmx 소스 클론, gitignored)는 재빌드가 다시 필요할 때를 위해 로컬에 보존됨. 재빌드 절차는 메모리 `suiko-web-v2-wasm-rebuild.md` 참고.

## 참고 자료
- 계획 원본: `~/.claude/plans/harmonic-dancing-gem.md`
- 프로젝트 결정사항 메모리: `suiko-web-v2-project`, `suiko-web-v2-original-files`, `suiko-web-v2-save-structure`, `suiko-web-v2-wasm-rebuild` (Claude 메모리 디렉토리)
