# suiko-web-v2 — 진행 상황 & 노트

배포 중: **https://suiko.atah.io** (`docs/CNAME`), GitHub Pages(`docs/` 폴더) — KR(`kr.html`)·
JP(`jp.html`) 모두 서비스, 공유 디스크 이미지 하나(`docs/final-shared.img`) 사용.

## 1. 완료

- **엔진**: doswasmx(nbarkhina/DosWasmX, MIT) 커스텀 재빌드. MIDI 브리지 패치 포함 —
  상세는 "3.1 사운드 구조" 참고. 재빌드에는 emsdk 3.1.49 +
  caiiiycuk/binaryen-fwasm-exceptions의 macOS wasm-opt 필요.
- **세이브**: `src/fat16.js`(FAT16 파일 단위 추출/주입) + `docs/suiko-save.js`(부팅 전
  IndexedDB → 디스크 이미지 주입, 부팅 후 폴링으로 변경 감지 시 SAVEDATA만 추출 저장).
  doswasmx의 디스크 전체 저장 방식을 대체, 디렉토리 엔트리 날짜/시각도 같이 보존. 저장/복원 시
  토스트 알림. `test/fat16.test.js`로 검증.
- **이미지 크기**: 원본 94MB → gzip 전송 기준 약 34.9MB(`tools/strip-image.js` + SC-55 SF3
  변환 53MB→9MB + `kr-patch/tools/slim-image.js`가 핵심 레버).
- **부팅 자동화**: 스캔디스크 프롬프트·로고 애니메이션·부트 메뉴 지연 제거, WIN.INI로 게임
  자동 실행.
- **배포 로딩**: 디스크 이미지 gzip 저장 + 매직바이트 감지 `DecompressionStream` 인플레이트.
- **UI 전면 재구성**: gensei-pc98의 `style.css` 기반 + `suiko-overrides.css` 최소 델타(4:3
  화면비). 로고·게인 기반 뮤트·단일 토스트·전체화면 롱프레스 이식. 모바일 레이아웃(정사각형
  화면비 clamp 포함) 실기 검증 완료.
- **doswasmx 데모 코드 정리**: 미사용 UI(Browse/Save Drive/Settings/Login 모달, CPU 드롭다운,
  자체 모바일 터치 UI) 삭제, Bootstrap/Popper/font-awesome/FileSaver/nipplejs 제거. `docs/script.js`
  내 대응 죽은 코드(설정/로그인/클라우드 저장 클러스터 + 기타 트리거 없는 메서드, 총 36개
  메서드·421줄)도 제거 완료(2026-07) — `docs/main.js`가 이름으로 직접 호출하는 wasm 콜백은
  전부 보존 확인. `MyClass`/`myClass`도 `SuikoEmulator`/`emulator`로 개명.
- **그래픽 에셋 교체(CNS)**: `GENSE.FLD` 안 `cara_fnt.cns`(KR 캐릭터 이름 폰트) 교체, 실기
  확인 완료 — 포맷 역공학 상세는 "3.2 이미지 구조" 참고.
- **JP 빌드**: 하나의 이미지에 `C:\GENSE`(KR)·`C:\GENSEJP`(JP) 공존, `docs/jp.html`은 언어
  플래그만 다름. 세이브는 언어 독립적 IndexedDB 키로 KR↔JP 호환. 일본어 폰트 베이킹 완료.
- **KR↔JP 대사 매칭**: 두 언어의 전체 대사(KR 14,812줄/JP 14,813줄)를 1:1 대응시켜
  `translation.json`의 각 `dialogue` 항목에 `jp`/`jpOffset` 필드로 확정 반영 완료 — 충돌·누락
  0건. 상세 방법은 "3.3 텍스트 구조" 참고.
- **KR 정식 번역 오타·오역 수정**: 게임 데이터(`HWANSE.EXE`)에 내장된 기존 정식 한글 번역의
  오타·오역을 찾아 고치는 작업(새 번역 아님). 스마슈→아타호 존댓말 오류 전수 수정 완료,
  판단 기준은 `GUIDE.md`에 문서화. 파이프라인은 "3.3 텍스트 구조" 참고.
- **배포 세이브 데이터 초기화**: 배포 이미지의 SAVEDATA 폴더를 파일 없는 순수 빈 폴더로
  정리(신규 유저는 직접 플레이해서 첫 세이브 생성). 이 과정에서 `Fat16.injectDirFiles()`가
  "기존 디렉토리 엔트리가 없으면 조용히 skip"하던 회귀 버그를 발견해 수정(빈 슬롯도 생성하도록,
  `test/fat16.test.js` 회귀 테스트 추가) — `docs/fat16.js`가 `src/fat16.js`와 별도 물리
  파일(브라우저가 직접 로드)이라는 것도 이때 확인해 동기화함.

## 2. 진행 중 / 남은 작업

- KR "과한 의역"(원문에서 멀어진 번역) 검토 — 사용자가 직접 진행 중, 종료 시점 없음
- 대사 길이 확장(PE 재작성 패처)은 기술적으로 가능하나 **진행하지 않기로 결정**(2026-07) —
  원본 바이트 길이 제약 안에서 조사·어미 교체로 대응

## 3. 기술 노트

### 3.1 사운드 구조 (MIDI 브리지 + 사운드폰트)

doswasmx는 원래 MIDI를 직접 재생하지 않음 — `src/gui/sdlmain.cpp`의 `MIDI_RawOutByte`/
`MIDI_Available` 스텁을 패치해서, 게임이 내보내는 raw MIDI 바이트를 그대로
`window.SuikoMidi.raw()`로 JS 쪽에 브리지하도록 만듦(엔진 재빌드 필요).

JS 쪽은 Win95 MIDI 매퍼가 "External MIDI Port"로 설정돼 있으면 그 브리지를 타고
spessasynth(JS 소프트신스)로 흘러 SC-55.sf3(9MB, 원본 롤랜드 SC-55 sf2 53MB에서 변환)로
렌더링됨. 매퍼 기본값은 베이스 이미지의 `SYSTEM.DAT` 레지스트리 하이브에 베이킹돼있어 부팅만
하면 자동 적용, 사용자 조작 불필요.

### 3.2 이미지 구조 (GENSE.FLD / CNS)

**GENSE.FLD 아카이브**: `FLDF0100` 매직 + u32 항목 수 + 고정 20바이트 항목 테이블(이름 12바이트
+ u32 오프셋 + u32 크기), 그 뒤로 파일이 빈틈없이 이어붙음(377개 항목 검증, gap 0).

**CNS 압축 포맷**: 헤더(width/height/팔레트수) + 팔레트 + 픽셀 인덱스가 하나의 LZ 스트림으로
압축. 옵코드 `0x00`(종료)/`0x01-0x3F`(매치, 4가지 인코딩 폭)/`0x40-0x7F`(리터럴 런)/
`0x80-0xFF`(리터럴+매치 결합).

**교체 시 하드 제약 두 가지**(실기에서 화면 깨짐으로 확인): ①교체 파일은 원본과 정확히 같은
저장 크기여야 함 — 크기가 다르면 `GENSE.FLD` 테이블의 이후 모든 파일 오프셋이 밀려 다음
스프라이트부터 깨짐. ②압축 스트림이 소비하는 입력 바이트 수도 원본과 정확히 같아야 함 —
종료 코드 뒤 패딩만으로는 부족, 토큰 표현을 늘려(출력은 동일 유지) 정확히 맞춤
(`inflateToSize()`). 압축은 DP 기반 최소 비용 타일링(`compressCns()`)으로 원본보다 작게 생성.

**결과**: `cara_fnt.cns` 교체 실기 확인 완료. 범용 추출 도구(`kr-patch/tools/cns-extract.js`)로
377개 중 365개(97%) 추출 성공 — 나머지 12개는 다중 프레임 등 다른 CNS 하위 포맷으로 추정,
미해독 상태로 남겨둠(이 패치 범위에는 불필요).

### 3.3 텍스트 구조 (HWANSE.EXE)

텍스트는 `GENSE.FLD`가 아니라 **PE `.data` 섹션**에 CP949(JP는 CP932) 인라인 리터럴로 있고,
`'@'`(0x40) 바이트로 라인이 끝난다. 대사 620줄만 relocation 포인터로 직접 가리켜지는 "장면
진입점"이고 나머지는 그 진입점에서 `@`를 세며 순차로 읽히는 하이브리드 참조 구조 — 압축은
없음(PC-98판과 같은 계열).

**바이트 길이 제약**: 라인을 늘리면 그 뒤 모든 `.data`가 밀리고 relocation이 깨지므로,
`build()`가 원본과 동일 바이트 길이를 강제한다. 글자 수를 줄여야 하는 수정은 조사·어미 교체로
음절 수를 맞추고, 안 되면 스킵(길이 확장 패처 자체는 "2. 남은 작업" 참고, 진행 안 하기로 결정).

**추출**: KR 14,812줄·JP 14,813줄(초기 필터가 로마자 스탭명·전각 영숫자·문장부호-only 대사를
누락했던 걸 완화해서 잡음, 이후 노이즈로 확인된 바이너리 찌꺼기 구간은 `NOISE_RANGES`로 양쪽
추출기에서 하드코딩 제외). 라운드트립(추출→재조립) 바이트 완전 동일 확인. 이름·라벨은 별도
포맷(KR 389개·JP 435개)으로 같은 파이프라인에서 추출.

**KR↔JP 매칭**: KR·JP는 라인 순서가 서로 대응하지 않아(반복 화자 등장 횟수는 비슷해도 인덱스
격차 불규칙) 자동 정렬이 불가능 — 사람이 듬성듬성 찍은 기준점(`kr-jp-links.json`)에서 양쪽
배열을 같은 간격으로 내려가며 자동으로 대응 텍스트를 채우는 "앵커 캐스케이드" 방식을 로컬 웹
에디터에 구현해 전량 검수, 충돌·누락 0건까지 맞춘 뒤 `translation.json`의 `dialogue` 각 항목에
`jp`/`jpOffset` 필드로 확정 반영(`kr-patch/tools/bake-jp.js`). 이후 `extract.js`의
`mergeReview()`가 재추출 시에도 이 필드를 보존.

**산출물**: `kr-patch/tools/hwanse-text.js`·`hwanse-names.js`·`hwanse-font.js`(KR 추출/빌드),
`gense-text.js`·`gense-names.js`(JP 참고 전용), `search-jp.js`(JP 키워드 검색), `editor.js`+
`editor.html`(로컬 웹 에디터), `pe-reloc.js`(PE 섹션 테이블/relocation 파서, 청크 접근 시도에서
만듦 — 자동 청크 나누기 자체는 장면 경계가 안 맞아 기각), `extract.js`/`build.js`/`inject.js`
(파이프라인), `bake-jp.js`, `translation/translation.json`(KR 전량, `dialogue`/`labels`/`fonts`
세 섹션), `translation/jp-reference.json`(JP 참고 전량), `translation/kr-jp-links.json`(KR↔JP
수동 앵커 입력), `translation/GUIDE.md`(수정 판단 기준).

## 4. 기타

### 4.1 자매 프로젝트 (gensei-pc98)

이 프로젝트의 웹 에뮬레이터 UI는 `gensei-pc98`(환세 시리즈 PC-98 한글화, NP2kai 기반)의
UI를 바탕으로 만들어짐. 같은 사이트 계열(atah.io)에서 서빙되지만 공유 패키지/서브모듈은
안 씀 — 정적 사이트라 빌드 파이프라인 도입 비용이 수동 이식 비용보다 크다고 판단.

`suiko-overrides.css`와 gensei-pc98의 `style.css`는 구조를 맞춰 관리한다. 가로 모드
대응·세이브 토스트·`chrome-hidden` 접기·전체화면 등 **공용 UI/로직을 고칠 때는 다른 쪽에도
해당 사항이 있는지 확인**할 것. 그대로 복사는 안 되고 매번 다음을 맞춰 조정해야 한다:

- 종횡비: 이쪽 640×480(4:3) vs gensei-pc98 640×400(8:5)
- DOM id: `#canvasDiv` vs gensei-pc98 `#canvas-wrap`
- 기능 적용 범위: 다중 디스크 여부, 버튼 유무 등 리포별 차이

### 4.2 참고 자료

- `.vendor-tmp/`(doswasmx 소스 클론, gitignored)는 재빌드 필요시 대비 로컬 보존 — 절차는
  "1. 완료"의 엔진 재빌드 항목 참고
- 커밋/푸시는 사용자가 명시적으로 요청할 때만 진행
