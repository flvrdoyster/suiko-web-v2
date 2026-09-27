#include <windows.h>

void *memset(void *d, int c, unsigned n) { char *p = d; while (n--) *p++ = (char)c; return d; }
void *memcpy(void *d, const void *s, unsigned n) { char *p = d; const char *q = s; while (n--) *p++ = *q++; return d; }

#define NSLOT 5
#define LF_BASE 0x52768
#define LF_SIZE 0x3c
#define MAXVAR 9

static const char *SLOT_NAME[NSLOT] = { "0 기본", "1 저장날짜", "2 크레딧", "3 기술이름", "4 챕터제목" };
static const char *SAMPLE = "환세취호전 아타호 0123456789 HP/MP";
static const char *CELLS[] = { "환", "세", "취", "아", "0", "7", "H", "M", "/" };
#define NCELL (sizeof(CELLS) / sizeof(CELLS[0]))
#define CELL_PITCH 56

#define BMP_W 1500
#define GRID_X 100
#define CELL_X (BMP_W - NCELL * CELL_PITCH)

typedef struct { char name[48]; LOGFONTA lf; HFONT font; TEXTMETRICA tm; } Variant;
static Variant var[NSLOT][MAXVAR];
static int nvar[NSLOT];

static char dir[MAX_PATH];
static HANDLE txt;
static char line[1024];

static void out(const char *s) { DWORD n; WriteFile(txt, s, lstrlenA(s), &n, NULL); }
#define P(...) do { wsprintfA(line, __VA_ARGS__); out(line); } while (0)

static void path(char *dst, const char *name) { lstrcpyA(dst, dir); lstrcatA(dst, name); }

static int readLogfonts(const char *exe, LOGFONTA *lf) {
  HANDLE f = CreateFileA(exe, GENERIC_READ, FILE_SHARE_READ, NULL, OPEN_EXISTING, 0, NULL);
  DWORD n;
  if (f == INVALID_HANDLE_VALUE) return 0;
  SetFilePointer(f, LF_BASE, NULL, FILE_BEGIN);
  ReadFile(f, lf, NSLOT * LF_SIZE, &n, NULL);
  CloseHandle(f);
  return n == NSLOT * LF_SIZE;
}

static int extent(HDC dc, const char *s) { SIZE sz; GetTextExtentPoint32A(dc, s, lstrlenA(s), &sz); return sz.cx; }

static void addVariant(int s, const LOGFONTA *base, int aa, int h16, int wm1, int normal) {
  Variant *v = &var[s][nvar[s]++];
  v->lf = *base;
  if (!aa) {
    lstrcpyA(v->name, "원본");
    return;
  }
  lstrcpyA(v->name, "비AA");
  v->lf.lfQuality = NONANTIALIASED_QUALITY;
  if (h16) { v->lf.lfHeight = 16; lstrcatA(v->name, " 높이16"); }
  if (wm1) { v->lf.lfWidth += v->lf.lfWidth < 0 ? 1 : -1; lstrcatA(v->name, " 폭-1"); }
  if (normal) { v->lf.lfWeight = FW_NORMAL; lstrcatA(v->name, " 보통"); }
}

static int bandH(const TEXTMETRICA *tm) { return (tm->tmHeight > 14 ? tm->tmHeight : 14) + 6; }

void __stdcall start(void) {
  LOGFONTA lf[NSLOT];
  char exe[MAX_PATH], tmp[MAX_PATH], face[LF_FACESIZE];
  char *cmd = GetCommandLineA(), *arg;
  HDC dc;
  int s, v, h, w, n, i, total = 0, y;
  OSVERSIONINFOA ver;
  BOOL smooth = FALSE;
  UINT smoothType = 0;

  GetModuleFileNameA(NULL, dir, MAX_PATH);
  for (i = lstrlenA(dir); i > 0 && dir[i - 1] != '\\'; i--) {}
  dir[i] = 0;

  arg = cmd;
  if (*arg == '"') { arg++; while (*arg && *arg != '"') arg++; if (*arg) arg++; }
  else while (*arg && *arg != ' ') arg++;
  while (*arg == ' ') arg++;
  if (*arg) lstrcpynA(exe, arg, MAX_PATH); else path(exe, "HWANSE.EXE");

  path(tmp, "FNTPROBE.TXT");
  txt = CreateFileA(tmp, GENERIC_WRITE, 0, NULL, CREATE_ALWAYS, 0, NULL);
  if (txt == INVALID_HANDLE_VALUE) { MessageBoxA(NULL, "FNTPROBE.TXT 생성 실패", "fontprobe", MB_OK); ExitProcess(1); }
  if (!readLogfonts(exe, lf)) {
    P("HWANSE.EXE를 읽을 수 없음: %s\r\n", exe);
    CloseHandle(txt);
    MessageBoxA(NULL, "HWANSE.EXE를 찾을 수 없습니다. 같은 폴더에 두거나 경로를 인자로 주세요.", "fontprobe", MB_OK);
    ExitProcess(1);
  }

  for (s = 0; s < NSLOT; s++) {
    addVariant(s, &lf[s], 0, 0, 0, 0);
    for (h = 0; h <= (lf[s].lfHeight == 0); h++)
      for (w = 0; w <= (lf[s].lfWidth != 0); w++)
        for (n = 0; n <= 1; n++) addVariant(s, &lf[s], 1, h, w, n);
  }

  dc = CreateCompatibleDC(NULL);
  ver.dwOSVersionInfoSize = sizeof(ver);
  GetVersionExA(&ver);
  SystemParametersInfoA(SPI_GETFONTSMOOTHING, 0, &smooth, 0);
  SystemParametersInfoA(SPI_GETFONTSMOOTHINGTYPE, 0, &smoothType, 0);
  P("fontprobe 2\r\nexe: %s\r\nOS: %lu.%lu.%lu platform %lu  ACP %u  LOGPIXELSY %d  BITSPIXEL %d  fontsmoothing %d type %u\r\n"
    "BMP: 8bpp gray ramp, rows top to bottom in this order; grid x=%d, cells x=%d pitch %d: ",
    exe, ver.dwMajorVersion, ver.dwMinorVersion, ver.dwBuildNumber & 0xffff, ver.dwPlatformId,
    GetACP(), GetDeviceCaps(dc, LOGPIXELSY), GetDeviceCaps(dc, BITSPIXEL), smooth, smoothType,
    GRID_X, CELL_X, CELL_PITCH);
  for (i = 0; i < (int)NCELL; i++) P("%s ", CELLS[i]);
  P("\r\n\r\nslot\tvariant\treq_h\treq_w\treq_wt\treq_q\t=> face\ttmHeight\ttmAscent\ttmDescent\ttmIntLead\ttmExtLead\t"
    "tmAveW\ttmMaxW\ttmWeight\ttmOverhang\ttmPitchFam\ttmCharSet\tx(가)\tx(A)\tx(0)\tx(sample)\tband_y\tband_h\r\n");

  for (s = 0; s < NSLOT; s++) {
    for (v = 0; v < nvar[s]; v++) {
      Variant *p = &var[s][v];
      HGDIOBJ old;
      p->font = CreateFontIndirectA(&p->lf);
      old = SelectObject(dc, p->font);
      GetTextMetricsA(dc, &p->tm);
      face[0] = 0;
      GetTextFaceA(dc, LF_FACESIZE, face);
      P("%s\t%s\t%ld\t%ld\t%ld\t%d\t=> %s\t%ld\t%ld\t%ld\t%ld\t%ld\t%ld\t%ld\t%ld\t%ld\t0x%02x\t%d\t%d\t%d\t%d\t%d\t%d\t%d\r\n",
        SLOT_NAME[s], p->name, p->lf.lfHeight, p->lf.lfWidth, p->lf.lfWeight, p->lf.lfQuality, face,
        p->tm.tmHeight, p->tm.tmAscent, p->tm.tmDescent, p->tm.tmInternalLeading,
        p->tm.tmExternalLeading, p->tm.tmAveCharWidth, p->tm.tmMaxCharWidth,
        p->tm.tmWeight, p->tm.tmOverhang, p->tm.tmPitchAndFamily, p->tm.tmCharSet,
        extent(dc, "가"), extent(dc, "A"), extent(dc, "0"), extent(dc, SAMPLE), total, bandH(&p->tm));
      SelectObject(dc, old);
      total += bandH(&p->tm);
    }
    out("\r\n");
  }

  {
    struct { BITMAPINFOHEADER h; RGBQUAD pal[256]; } bi;
    BITMAPFILEHEADER fh;
    BYTE *bits;
    HBITMAP bmp;
    HGDIOBJ oldBmp;
    RECT r;
    HANDLE f;
    DWORD nw, stride = (BMP_W + 3) & ~3u, size;

    memset(&bi, 0, sizeof(bi));
    bi.h.biSize = sizeof(bi.h);
    bi.h.biWidth = BMP_W;
    bi.h.biHeight = -total;
    bi.h.biPlanes = 1;
    bi.h.biBitCount = 8;
    bi.h.biClrUsed = 256;
    for (i = 0; i < 256; i++) { bi.pal[i].rgbRed = bi.pal[i].rgbGreen = bi.pal[i].rgbBlue = (BYTE)i; }
    bmp = CreateDIBSection(dc, (BITMAPINFO *)&bi, DIB_RGB_COLORS, (void **)&bits, NULL, 0);
    oldBmp = SelectObject(dc, bmp);
    r.left = 0; r.top = 0; r.right = BMP_W; r.bottom = total;
    FillRect(dc, &r, (HBRUSH)GetStockObject(BLACK_BRUSH));
    SetBkMode(dc, TRANSPARENT);

    y = 0;
    for (s = 0; s < NSLOT; s++) {
      for (v = 0; v < nvar[s]; v++) {
        Variant *p = &var[s][v];
        const char *c = SAMPLE;
        int x = GRID_X;
        HGDIOBJ old = SelectObject(dc, GetStockObject(ANSI_VAR_FONT));
        SetTextColor(dc, RGB(128, 128, 128));
        wsprintfA(line, "%d %s", s, p->name);
        TextOutA(dc, 2, y + 2, line, lstrlenA(line));
        SelectObject(dc, p->font);
        SetTextColor(dc, RGB(255, 255, 255));
        while (*c) {
          int nb = IsDBCSLeadByte((BYTE)*c) ? 2 : 1;
          TextOutA(dc, x, y + 2, c, nb);
          x += p->tm.tmMaxCharWidth * nb / 2;
          c += nb;
        }
        for (i = 0; i < (int)NCELL; i++) TextOutA(dc, CELL_X + i * CELL_PITCH, y + 2, CELLS[i], lstrlenA(CELLS[i]));
        SelectObject(dc, old);
        y += bandH(&p->tm);
      }
    }
    GdiFlush();

    size = stride * total;
    fh.bfType = 0x4d42;
    fh.bfOffBits = sizeof(fh) + sizeof(bi);
    fh.bfSize = fh.bfOffBits + size;
    fh.bfReserved1 = fh.bfReserved2 = 0;
    path(tmp, "FNTPROBE.BMP");
    f = CreateFileA(tmp, GENERIC_WRITE, 0, NULL, CREATE_ALWAYS, 0, NULL);
    WriteFile(f, &fh, sizeof(fh), &nw, NULL);
    WriteFile(f, &bi, sizeof(bi), &nw, NULL);
    WriteFile(f, bits, size, &nw, NULL);
    CloseHandle(f);
    SelectObject(dc, oldBmp);
    DeleteObject(bmp);
  }

  CloseHandle(txt);
  for (s = 0; s < NSLOT; s++) for (v = 0; v < nvar[s]; v++) DeleteObject(var[s][v].font);
  DeleteDC(dc);
  ExitProcess(0);
}
