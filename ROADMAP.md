# 진행 상황 & 남은 작업

배포 중: **https://suiko.atah.io** (커스텀 도메인, `docs/CNAME`), GitHub Pages(`docs/` 폴더 기준) — KR(`docs/kr.html`)·JP(`docs/jp.html`) 모두 서비스, 하나의 공유 디스크 이미지(`docs/final-shared.img`) 사용

## 완료

- **엔진**: doswasmx(nbarkhina/DosWasmX, MIT)를 커스텀 재빌드. `src/gui/sdlmain.cpp`의 `MIDI_RawOutByte`/`MIDI_Available` 스텁을 패치해 MIDI 바이트를 `window.SuikoMidi.raw()`로 브리지. 재빌드 방법은 메모리(`suiko-web-v2-wasm-rebuild`)에 기록됨 — emsdk 3.1.49 + caiiiycuk/binaryen-fwasm-exceptions의 macOS wasm-opt 필요.
- **색감/PCM**: doswasmx 그대로 정상 동작 확인.
- **MIDI 사운드폰트**: Win95 MIDI 매퍼를 "External MIDI Port"로 설정하면 게임 MIDI가 브리지를 타고 JS의 spessasynth로 흘러 SC-55.sf3(9MB, 원본 sf2 53MB에서 변환)로 렌더링. MIDI 매퍼 기본값은 **베이스 이미지에 베이킹됨**(수동 설정 후 doswasmx "Export Hard Drive"로 내보낸 이미지의 SYSTEM.DAT를 그대로 채택) — 부팅하면 자동 적용, 사용자 조작 불필요.
- **세이브**: `src/fat16.js`(FAT16 파일 단위 추출/주입) + `docs/suiko-save.js`(부팅 전 IndexedDB → 디스크 이미지 주입, 부팅 후 폴링으로 변경 감지 시 SAVEDATA만 추출 저장). doswasmx의 디스크 전체 저장 방식을 완전히 대체함. 디렉토리 엔트리의 날짜/시각 필드도 같이 보존해 복원된 세이브가 원래 저장 시각을 유지. 저장/복원 시 토스트 알림. `test/fat16.test.js`로 검증.
- **사이즈**: 원본 94MB → `tools/strip-image.js`(불필요 Win95 컴포넌트·서양 폰트 삭제, 빈 공간 제로화) + SC-55 SF3 변환(53MB→9MB)이 핵심 레버. KR+JP 통합 후 현재 gzip 전송 기준 약 34.9MB(`kr-patch/tools/slim-image.js`로 WIN386.SWP·미사용 KOFONT.TTF 추가 삭제 + 재압축, `NOTES.md` 참고).
- **부팅 자동화**: `MSDOS.SYS`에 `AutoScan=0`, `Logo=0`, `BootDelay=0` 추가해 스캔디스크 프롬프트·부팅 로고 애니메이션·부트 메뉴 지연 제거. WIN.INI `load=`로 게임 자동 실행.
- **저장 아키텍처 정리**: doswasmx 원본의 전체 디스크(~90MB) IndexedDB 스냅샷 경로(재시작/종료 시 `saveDrive()`)를 제거. 이 경로가 살아있으면 배포 이미지를 갱신해도 한 번이라도 저장한 유저는 스냅샷 시점의 실행파일에 계속 갇힘 — `suiko-save.js`가 SAVEDATA만 분리 저장/주입하는 방식으로 이미 대체했으므로 불필요해진 상태였음.
- **배포 로딩**: 디스크 이미지를 gzip으로 저장, `script.js`의 `load_url_request`에 매직바이트(`1f 8b`) 감지 후 `DecompressionStream` 인플레이트 패치.
- **UI 전면 재구성**: doswasmx 데모 페이지에 스타일만 얹는 방식에서, **gensei-pc98의 `style.css`를 그대로 가져와 기반으로 삼고** `suiko-overrides.css`로 최소 델타(4:3 화면비, `#canvasDiv` 특이사항)만 얹는 방식으로 전환. 로고 이미지, `footer.js`(atah.io 공용, `data-emulator="dos"` 분기), 게인 기반 뮤트(AudioContext suspend/resume 대신 — 브라우저가 조작 시 자동 재개시키는 문제 회피), 단일 `#toast` 알림 채널(로딩 상태·ESC 힌트·세이브 알림 통합), 전체화면 ESC 롱프레스(Keyboard Lock API) 이식.
- **미사용 코드 대거 제거**: doswasmx 데모 UI(헤더, Browse/Save Drive/Settings/Login 버튼, 모달 4개, CPU·Advanced 드롭다운, doswasmx 자체 모바일 터치 UI)를 실제로 삭제(`kr.html` 412→135줄대). Bootstrap/Popper/font-awesome/FileSaver/nipplejs 제거(전부 도달 불가 경로에서만 참조됨을 확인 후 제거). rivets.bind() 호출도 삭제된 요소에 맞춰 정리.
- **모바일 버그 수정**: doswasmx 자체 `mobileMode` 분기가 삭제된 요소(`#divTouchSurface` 등)를 참조해 부팅 시 예외로 죽던 문제 → `mobileMode` 항상 false로 우회(모바일 UX는 gensei-pc98 가상 게임패드+반응형 CSS로 전담). 부팅 후 레이아웃이 흔들리던 문제(`resizeCanvas()`의 인라인 스타일 조작) 수정. 가로 모드에서 캔버스 위아래가 잘리던 문제 → `@media (orientation: landscape) and (pointer: coarse)`로 세로(뷰포트 높이) 기준 4:3 계산 추가.
- **iOS Chrome·모바일 가로/세로 실기 테스트 완료** (LAN 서버로 검증).

## 남은 작업

### 1. JP 빌드 — 완료
- 이미지 하나(`docs/final-shared.img`)에 `C:\GENSE`(KR, HWANSE.EXE)와 `C:\GENSEJP`(JP, GENSE.EXE)를 같이 담는 구조로 확정(~90MB Windows 설치 중복 회피). `tools/build-jp-image.js`로 `GENSEJP` 폴더 생성(exe/fld/미디/PCM 데이터 + `SAVEDATA`를 KR과 동일한 6개 빈 슬롯으로 시딩 — 우리 저장 로직은 기존 슬롯 파일만 덮어쓰고 새로 할당하지 않기 때문)
- `docs/jp.html` 신설 — `kr.html`과 구조 동일, `window.SUIKO_LANG='jp'`만 다름. `docs/suiko-lang.js`가 부팅 직전 `WIN.INI`의 `load=`를 언어별 실행 파일로 패치, `docs/suiko-save.js`도 언어별 `SAVEDATA` 경로(`GENSE/SAVEDATA` vs `GENSEJP/SAVEDATA`)를 사용하되 IndexedDB 키는 언어 독립적이라 KR↔JP 세이브 호환 확인됨
- **일본어 폰트**: 게임 내 텍스트 두부 현상 확인 후 사용자 제공 폰트(`original/font/ja.ttf`, "Ume Gothic O5", 코드페이지 932) 설치. Win95 폰트는 `WINDOWS\FONTS`+레지스트리(`SYSTEM.DAT`)로 관리되고 앱은 폰트 이름이 아니라 charset으로 선택(HWANSE.EXE/GENSE.EXE 어디에도 폰트 이름 문자열 없음 확인) — MIDI 매퍼 때와 같은 방식으로 실제 에뮬레이터에서 Control Panel로 수동 설치 후 "Export Hard Drive"로 캡처, `tools/bake-fonts.js`로 폰트 파일+`SYSTEM.DAT`를 베이스 이미지에 베이킹. JP 정상 렌더링 확인됨
- **한국어 폰트**: 같은 절차로 `original/font/ko.ttf`("KoddiUD OnGothic", 코드페이지 949, 기존 `GULIM.TTC`와 동일 코드페이지)도 설치해봤으나 KR 게임은 여전히 기존 `GULIM.TTC`로 렌더링됨 — Win95가 코드페이지 기준으로 폰트를 고르기 때문에 같은 코드페이지 내 우선순위(`SYSTEM.DAT`의 `AssocSystemFont` 등)를 못 바꾼 것으로 추정. **사용자 판단으로 보류 확정** — KR은 GULIM 유지, ko.ttf는 이미지에 설치는 되어 있으나 실제로 안 쓰임. 필요해지면 `AssocSystemFont` 레지스트리 값 직접 수정 또는 `GULIM.TTC` 파일 자체를 ko.ttf 내용으로 덮어쓰는 방법(파일명 유지, 포인터 안 건드림) 시도 가능

### 2. KR 정식 번역 오타·오역 수정 — 진행 중
- 웹 관련 작업이 아니라 **게임 데이터 자체**(`HWANSE.EXE`의 PE `.data` 섹션)에 내장된 기존 정식
  한글 번역의 오타·오역을 찾아 고치는 작업. 새 번역이 아니라 기존 번역의 부분 수정
- 역공학 완료: 텍스트 위치·인코딩·라인 포맷(대사/이름·라벨/폰트 세 종류)·길이 변경 불가 정책까지
  전부 확정. 추출→검수→빌드→주입→배포 파이프라인(`kr-patch/`) 구축 완료. 기술적 근거는
  [`NOTES.md`](NOTES.md), 수정 판단 기준(오탈자/용어/과잉의역 구분, 캐릭터별 말투 등)은
  [`kr-patch/translation/GUIDE.md`](kr-patch/translation/GUIDE.md) 참고
- 로컬 웹 에디터(`kr-patch/tools/editor.js`)로 사람이 직접 검수하며 `translation.json`의
  `fixed` 필드를 채우는 방식으로 진행 중. 현재까지 대사 239건, 라벨 60건 반영·배포됨
- 남은 건 계속 플레이하며 오타·오역을 찾아 `GUIDE.md` 기준으로 다듬는 것 — 종료 시점이 정해진
  작업이 아니라 발견되는 대로 누적 수정

### 3. 자잘한 후속 확인
- **`#githubDiv`("View source on GitHub" 링크, `github_logo.png`)**: `finishInitialization()`에서 `$('#githubDiv').show()`로 실제 노출될 수 있는 코드가 남아있음 — 완전히 죽은 코드가 아니라 부팅 후 화면에 나타날 가능성 있음. 필요/불필요 확인 후 제거 또는 유지 결정
- **MIDI 재생 초기 딜레이**: 사운드폰트 로딩 중 도착한 메시지를 큐잉→flush 처리했지만 약간의 지연 보고됨. 우선순위 낮음, 보류
- `.vendor-tmp/`(doswasmx 소스 클론, gitignored)는 재빌드 필요시 대비 로컬 보존. 절차는 메모리 `suiko-web-v2-wasm-rebuild.md` 참고

## 참고 자료
- KR 번역 수정 작업의 기술적 근거: [`NOTES.md`](NOTES.md), 수정 판단 기준: [`kr-patch/translation/GUIDE.md`](kr-patch/translation/GUIDE.md)
- 계획 원본: `~/.claude/plans/harmonic-dancing-gem.md`
- 프로젝트 결정사항 메모리: `suiko-web-v2-project`, `suiko-web-v2-original-files`, `suiko-web-v2-save-structure`, `suiko-web-v2-wasm-rebuild` (Claude 메모리 디렉토리)
- 커밋/푸시는 사용자가 명시적으로 요청할 때만 (메모리 `feedback-commit-push-explicit-only`)
