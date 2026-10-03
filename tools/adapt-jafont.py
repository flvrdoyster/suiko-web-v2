#!/usr/bin/env python3
import argparse
import gzip
import json
import sys

from fontTools.ttLib import TTFont

JIS_BIT = 1 << 17
DROP_TABLES = ['GPOS', 'GDEF', 'FFTM', 'vhea', 'vmtx', 'DSIG']
KEEP_CMAP = {(1, 0), (3, 1)}


def adapt(src, dst, strip_hints):
    f = TTFont(src, recalcBBoxes=False)
    upm = f['head'].unitsPerEm
    os2 = f['OS/2']
    hhea = f['hhea']

    asc = os2.sTypoAscender
    desc = -os2.sTypoDescender
    if asc + desc != upm:
        raise SystemExit(f'typo ascender+descender is {asc + desc}, expected {upm}')
    os2.usWinAscent = asc
    os2.usWinDescent = desc
    hhea.ascent = asc
    hhea.descent = -desc
    hhea.lineGap = 0
    os2.sTypoLineGap = 0

    os2.xAvgCharWidth = upm // 2
    hhea.advanceWidthMax = upm
    f['head'].xMin = 0
    f['head'].xMax = upm
    hhea.minLeftSideBearing = 0
    hhea.minRightSideBearing = 0
    hhea.xMaxExtent = upm

    os2.ulCodePageRange1 |= JIS_BIT
    os2.version = 1
    os2.fsSelection |= 1 << 6
    for attr in ('sxHeight', 'sCapHeight', 'usDefaultChar', 'usBreakChar', 'usMaxContext'):
        if hasattr(os2, attr):
            delattr(os2, attr)

    cmap = f['cmap']
    cmap.tables = [t for t in cmap.tables if (t.platformID, t.platEncID) in KEEP_CMAP]
    if not any((t.platformID, t.platEncID, t.format) == (3, 1, 4) for t in cmap.tables):
        raise SystemExit('no (3,1) format 4 cmap subtable')

    for tag in DROP_TABLES:
        if tag in f:
            del f[tag]
    f['post'].formatType = 3.0
    f['post'].extraNames = []
    f['post'].mapping = {}

    if strip_hints:
        for tag in ('fpgm', 'prep', 'cvt ', 'gasp'):
            if tag in f:
                del f[tag]
        glyf = f['glyf']
        for name in glyf.keys():
            g = glyf[name]
            if hasattr(g, 'program'):
                g.program.fromBytecode(b'')
        f['maxp'].maxSizeOfInstructions = 0
        f['maxp'].maxStackElements = 0
        f['maxp'].maxFunctionDefs = 0
        f['maxp'].maxStorage = 0
        f['maxp'].maxTwilightPoints = 0

    f.save(dst)


def verify(path, texts_json):
    f = TTFont(path)
    upm = f['head'].unitsPerEm
    os2 = f['OS/2']
    hhea = f['hhea']
    cm3 = next(t for t in f['cmap'].tables if (t.platformID, t.platEncID) == (3, 1))
    report = {
        'tables': sorted(k for k in f.keys() if k != 'GlyphOrder'),
        'cellHeight': os2.usWinAscent + os2.usWinDescent,
        'upm': upm,
        'xAvgCharWidth': os2.xAvgCharWidth,
        'advanceWidthMax': hhea.advanceWidthMax,
        'bboxWidth': f['head'].xMax - f['head'].xMin,
        'xMaxExtent': hhea.xMaxExtent,
        'jisBit': bool(os2.ulCodePageRange1 & JIS_BIT),
        'regularBit': bool(os2.fsSelection & (1 << 6)),
        'os2Version': os2.version,
        'cmap': [(t.platformID, t.platEncID, t.format) for t in f['cmap'].tables],
    }
    problems = []
    if report['cellHeight'] != upm:
        problems.append('cell height != em')
    if report['xAvgCharWidth'] * 2 != upm:
        problems.append('xAvgCharWidth != em/2')
    if report['advanceWidthMax'] != upm:
        problems.append('advanceWidthMax != em')
    if report['bboxWidth'] != upm or report['xMaxExtent'] != upm:
        problems.append('font bbox width != em')
    if not report['jisBit']:
        problems.append('JIS code page bit off')
    if not report['regularBit']:
        problems.append('REGULAR bit off')
    hm = f['hmtx']
    cmap = cm3.cmap
    if texts_json:
        data = json.load(open(texts_json, encoding='utf-8'))
        chars = set()
        for sec in ('dialogue', 'labels'):
            for e in data[sec]:
                chars.update(e['text'])
        chars.discard('　')
        missing = sorted(c for c in chars if ord(c) not in cmap)
        report['usedChars'] = len(chars)
        report['missingChars'] = [f'U+{ord(c):04X}' for c in missing]
        over = [c for c in chars if ord(c) in cmap and hm[cmap[ord(c)]][0] > upm]
        report['usedWiderThanEm'] = [f'U+{ord(c):04X}' for c in over]
    return report, problems


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src')
    ap.add_argument('dst')
    ap.add_argument('--texts', help='jp-reference.json to check glyph coverage against')
    ap.add_argument('--strip-hints', action='store_true')
    args = ap.parse_args()
    adapt(args.src, args.dst, args.strip_hints)
    report, problems = verify(args.dst, args.texts)
    raw = open(args.dst, 'rb').read()
    report['bytes'] = len(raw)
    report['gzipBytes'] = len(gzip.compress(raw, 9))
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if problems:
        print('PROBLEMS:', problems, file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
