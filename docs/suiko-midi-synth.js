var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};

// node_modules/spessasynth_core/dist/index.js
function readBigEndian(dataArray, bytesAmount, offset = 0) {
  let out = 0;
  for (let i = 0; i < bytesAmount; i++) out = out << 8 | dataArray[offset + i];
  return out >>> 0;
}
function readLE64Indexed(dataArray, bytesAmount) {
  const res = readLE64(dataArray, bytesAmount, dataArray.currentIndex);
  dataArray.currentIndex += bytesAmount;
  return res;
}
function readLE64(dataArray, bytesAmount, offset = 0) {
  let out = 0n;
  for (let i = 0; i < bytesAmount; i++) out |= BigInt(dataArray[offset + i]) << BigInt(i * 8);
  return Number(out);
}
function readLittleEndianIndexed(dataArray, bytesAmount) {
  const res = readLittleEndian(dataArray, bytesAmount, dataArray.currentIndex);
  dataArray.currentIndex += bytesAmount;
  return res;
}
function readLittleEndian(dataArray, bytesAmount, offset = 0) {
  let out = 0;
  for (let i = 0; i < bytesAmount; i++) out |= dataArray[offset + i] << i * 8;
  return out >>> 0;
}
function writeLittleEndianIndexed(dataArray, number, byteTarget) {
  for (let i = 0; i < byteTarget; i++) dataArray[dataArray.currentIndex++] = number >> i * 8 & 255;
}
function writeWord(dataArray, word) {
  dataArray[dataArray.currentIndex++] = word & 255;
  dataArray[dataArray.currentIndex++] = word >> 8;
}
function writeDword(dataArray, dword) {
  writeLittleEndianIndexed(dataArray, dword, 4);
}
function writeQword(dataArray, qword) {
  const qb = BigInt(qword);
  for (let i = 0n; i < 8n; i++) dataArray[dataArray.currentIndex++] = Number(qb >> i * 8n & 255n);
}
function signedInt16(byte1, byte2) {
  const val = byte2 << 8 | byte1;
  if (val > 32767) return val - 65536;
  return val;
}
function readBinaryString(dataArray, bytes = dataArray.length, offset = 0) {
  let string = "";
  for (let i = 0; i < bytes; i++) {
    const byte = dataArray[offset + i];
    if (byte === 0) return string;
    string += String.fromCharCode(byte);
  }
  return string;
}
function readBinaryStringIndexed(dataArray, bytes) {
  const startIndex = dataArray.currentIndex;
  dataArray.currentIndex += bytes;
  return readBinaryString(dataArray, bytes, startIndex);
}
function getStringBytes(string, addZero = false, ensureEven = false) {
  let len = string.length;
  if (addZero) len++;
  if (ensureEven && len % 2 !== 0) len++;
  const arr = new IndexedByteArray(len);
  writeBinaryStringIndexed(arr, string);
  return arr;
}
function writeBinaryStringIndexed(outArray, string, padLength = 0) {
  if (padLength > 0 && string.length > padLength) string = string.slice(0, padLength);
  for (let i = 0; i < string.length; i++) outArray[outArray.currentIndex++] = string.charCodeAt(i);
  if (padLength > string.length) for (let i = 0; i < padLength - string.length; i++) outArray[outArray.currentIndex++] = 0;
  return outArray;
}
function readVariableLengthQuantity(midiByteArray) {
  let out = 0;
  while (midiByteArray) {
    const byte = midiByteArray[midiByteArray.currentIndex++];
    out = out << 7 | byte & 127;
    if (byte >> 7 !== 1) break;
  }
  return out;
}
function arrayToHexString(arr) {
  let hexString = "";
  for (let i = 0; i < arr.length; i++) {
    const hex = arr[i].toString(16).padStart(2, "0").toUpperCase();
    hexString += hex;
    if (i < arr.length - 1) hexString += " ";
  }
  return hexString;
}
function fillWithDefaults(obj, defObj) {
  return {
    ...defObj,
    ...obj
  };
}
function toISODateString(date) {
  return date.toISOString().split(".")[0] + "Z";
}
function tryTranslate(dateString) {
  for (const translation of translations) {
    let translated = dateString;
    for (const [pt, english] of translation.entries()) {
      const regex = new RegExp(pt, "gi");
      translated = translated.replace(regex, english);
    }
    const date = new Date(translated);
    if (!Number.isNaN(date.getTime())) return date;
  }
}
function tryDotted(dateString) {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(dateString);
  if (match) {
    const day = Number.parseInt(match[1]);
    const month = Number.parseInt(match[2]) - 1;
    const year = Number.parseInt(match[3]);
    const date = new Date(year, month, day);
    if (!Number.isNaN(date.getTime())) return date;
  }
}
function tryAWE(dateString) {
  const match = /^(\d{1,2})\s{1,2}(\d{1,2})\s{1,2}(\d{2})$/.exec(dateString);
  if (match) {
    const day = match[1];
    const month = (Number.parseInt(match[2]) + 1).toString();
    const year = match[3];
    const date = /* @__PURE__ */ new Date(`${month}/${day}/${year}`);
    if (!Number.isNaN(date.getTime())) return date;
  }
}
function tryYear(dateString) {
  const match = /\b\d{4}\b/.exec(dateString);
  return match ? new Date(match[0]) : void 0;
}
function parseDateString(dateString) {
  dateString = dateString.trim();
  if (dateString.length === 0) return /* @__PURE__ */ new Date();
  const filtered = dateString.replaceAll(/\b(\d+)(st|nd|rd|th)\b/g, "$1").replace(/\s+at\s+/i, " ");
  const date = new Date(filtered);
  if (Number.isNaN(date.getTime())) {
    const translated = tryTranslate(dateString);
    if (translated) return translated;
    const dotted = tryDotted(dateString);
    if (dotted) return dotted;
    const awe = tryAWE(dateString);
    if (awe) return awe;
    const year = tryYear(dateString);
    if (year) return year;
    SpessaLog.warn(`Invalid date: "${dateString}". Replacing with the current date!`);
    return /* @__PURE__ */ new Date();
  }
  return date;
}
function getModulatorCurveValue(transformType, curveType, value) {
  const isBipolar = !!(transformType & 2);
  if (!!(transformType & 1)) value = 1 - value;
  switch (curveType) {
    case ModulatorCurveTypes.linear:
      if (isBipolar) return value * 2 - 1;
      return value;
    case ModulatorCurveTypes.switch:
      value = value > 0.5 ? 1 : 0;
      if (isBipolar) return value * 2 - 1;
      return value;
    case ModulatorCurveTypes.concave:
      if (isBipolar) {
        value = value * 2 - 1;
        if (value < 0) return -concave[Math.trunc(value * -MODULATOR_RESOLUTION)];
        return concave[Math.trunc(value * MODULATOR_RESOLUTION)];
      }
      return concave[Math.trunc(value * MODULATOR_RESOLUTION)];
    case ModulatorCurveTypes.convex:
      if (isBipolar) {
        value = value * 2 - 1;
        if (value < 0) return -convex[Math.trunc(value * -MODULATOR_RESOLUTION)];
        return convex[Math.trunc(value * MODULATOR_RESOLUTION)];
      }
      return convex[Math.trunc(value * MODULATOR_RESOLUTION)];
  }
}
function bitMaskToBool(num, bit) {
  return (num >> bit & 1) > 0;
}
function toNumericBool(bool) {
  return bool ? 1 : 0;
}
function getModSourceEnum(curveType, isBipolar, isNegative, isCC, index) {
  return new ModulatorSource(index, curveType, isCC, isBipolar, isNegative).toSourceEnum();
}
function getSDTA(bank, smplStartOffsets, smplEndOffsets, rf64, progressFunction) {
  let writtenCount = 0;
  const sampleData = [];
  const sampleSize = [];
  for (const s of bank.samples) {
    const r = s.getRawData(true);
    writtenCount++;
    progressFunction?.(writtenCount / bank.samples.length);
    SpessaLog.info(`%cWrote sample %c${writtenCount}. ${s.name}%c of %c${bank.samples.length}.`, ConsoleColors.info, ConsoleColors.recognized, ConsoleColors.info, ConsoleColors.recognized);
    sampleData.push(r);
    sampleSize.push(r.length);
    if (!s.isCompressed) sampleData.push(new Uint8Array(92));
  }
  const smpl = RIFFChunk.getParts("smpl", sampleData, rf64);
  const sdta = RIFFChunk.getParts("sdta", smpl, rf64, true);
  let offset = 0;
  for (const [i, sample] of bank.samples.entries()) {
    const size = sampleSize[i];
    let startOffset;
    let endOffset;
    if (sample.isCompressed) {
      startOffset = offset;
      endOffset = startOffset + size;
    } else {
      startOffset = offset / 2;
      endOffset = startOffset + size / 2;
      offset += 92;
    }
    offset += size;
    smplStartOffsets.push(startOffset);
    smplEndOffsets.push(endOffset);
  }
  return sdta;
}
function getSHDR(bank, smplStartOffsets, smplEndOffsets, rf64) {
  const sampleLength = 46;
  const shdrSize = sampleLength * (bank.samples.length + 1);
  const shdrData = new IndexedByteArray(shdrSize);
  const xshdrData = new IndexedByteArray(shdrSize);
  let maxSampleLink = 0;
  for (const [index, sample] of bank.samples.entries()) {
    writeBinaryStringIndexed(shdrData, sample.name.slice(0, 20), 20);
    writeBinaryStringIndexed(xshdrData, sample.name.slice(20), 20);
    const dwStart = smplStartOffsets[index];
    writeDword(shdrData, dwStart);
    xshdrData.currentIndex += 4;
    const dwEnd = smplEndOffsets[index];
    writeDword(shdrData, dwEnd);
    xshdrData.currentIndex += 4;
    let loopStart = sample.loopStart + dwStart;
    let loopEnd = sample.loopEnd + dwStart;
    if (sample.isCompressed) {
      loopStart -= dwStart;
      loopEnd -= dwStart;
    }
    writeDword(shdrData, loopStart);
    writeDword(shdrData, loopEnd);
    writeDword(shdrData, sample.sampleRate);
    shdrData[shdrData.currentIndex++] = sample.originalKey;
    shdrData[shdrData.currentIndex++] = sample.pitchCorrection;
    xshdrData.currentIndex += 14;
    const sampleLinkIndex = sample.linkedSample ? bank.samples.indexOf(sample.linkedSample) : 0;
    writeWord(shdrData, Math.max(0, sampleLinkIndex) & 65535);
    writeWord(xshdrData, Math.max(0, sampleLinkIndex) >> 16);
    maxSampleLink = Math.max(maxSampleLink, sampleLinkIndex);
    let type = sample.sampleType;
    if (sample.isCompressed) type |= 16;
    writeWord(shdrData, type);
    xshdrData.currentIndex += 2;
  }
  writeBinaryStringIndexed(shdrData, "EOS", sampleLength);
  writeBinaryStringIndexed(xshdrData, "EOS", sampleLength);
  return {
    pdta: RIFFChunk.write("shdr", shdrData, rf64),
    xdta: RIFFChunk.write("shdr", xshdrData, rf64)
  };
}
function writeSF2Elements(bank, rf64, isPreset, writeBankLSB = false) {
  const elements = isPreset ? bank.presets : bank.instruments;
  const genHeader = isPreset ? "pgen" : "igen";
  const modHeader = isPreset ? "pmod" : "imod";
  const bagHeader = isPreset ? "pbag" : "ibag";
  const hdrHeader = isPreset ? "phdr" : "inst";
  const hdrByteSize = isPreset ? 38 : 22;
  let currentGenIndex = 0;
  const generatorIndexes = new Array();
  let currentModIndex = 0;
  const modulatorIndexes = new Array();
  const generators = new Array();
  const modulators = new Array();
  let zoneIndex = 0;
  const zoneIndexes = new Array();
  const writeZone = (z) => {
    generatorIndexes.push(currentGenIndex);
    const gens = z.getWriteGenerators(bank);
    currentGenIndex += gens.length;
    generators.push(...gens);
    modulatorIndexes.push(currentModIndex);
    const mods = z.modulators;
    currentModIndex += mods.length;
    modulators.push(...mods);
  };
  for (const el of elements) {
    zoneIndexes.push(zoneIndex);
    writeZone(el.globalZone);
    for (const zone of el.zones) writeZone(zone);
    zoneIndex += el.zones.length + 1;
  }
  generators.push(new Generator(0, 0, false));
  modulators.push(new DecodedModulator(0, 0, 0, 0, 0));
  generatorIndexes.push(currentGenIndex);
  modulatorIndexes.push(currentModIndex);
  zoneIndexes.push(zoneIndex);
  const genData = new IndexedByteArray(generators.length * 4);
  for (const g of generators) g.write(genData);
  const modData = new IndexedByteArray(modulators.length * 10);
  for (const m of modulators) m.write(modData);
  const bagSize = modulatorIndexes.length * 4;
  const bagData = {
    pdta: new IndexedByteArray(bagSize),
    xdta: new IndexedByteArray(bagSize)
  };
  for (const [i, modulatorIndex] of modulatorIndexes.entries()) {
    const generatorIndex = generatorIndexes[i];
    writeWord(bagData.pdta, generatorIndex & 65535);
    writeWord(bagData.pdta, modulatorIndex & 65535);
    writeWord(bagData.xdta, generatorIndex >> 16);
    writeWord(bagData.xdta, modulatorIndex >> 16);
  }
  const hdrSize = (elements.length + 1) * hdrByteSize;
  const hdrData = {
    pdta: new IndexedByteArray(hdrSize),
    xdta: new IndexedByteArray(hdrSize)
  };
  for (const [i, el] of elements.entries()) el.write(hdrData, zoneIndexes[i], writeBankLSB);
  if (isPreset) {
    writeBinaryStringIndexed(hdrData.pdta, "EOP", 20);
    hdrData.pdta.currentIndex += 4;
    writeWord(hdrData.pdta, zoneIndex & 65535);
    hdrData.pdta.currentIndex += 12;
    writeBinaryStringIndexed(hdrData.xdta, "", 20);
    hdrData.xdta.currentIndex += 4;
    writeWord(hdrData.xdta, zoneIndex >> 16);
    hdrData.xdta.currentIndex += 12;
  } else {
    writeBinaryStringIndexed(hdrData.pdta, "EOI", 20);
    writeWord(hdrData.pdta, zoneIndex & 65535);
    writeBinaryStringIndexed(hdrData.xdta, "", 20);
    writeWord(hdrData.xdta, zoneIndex >> 16);
  }
  return {
    writeXdta: Math.max(currentGenIndex, currentModIndex, zoneIndex) > 65535,
    gen: {
      pdta: RIFFChunk.write(genHeader, genData, rf64),
      xdta: RIFFChunk.write(modHeader, new IndexedByteArray(4), rf64)
    },
    mod: {
      pdta: RIFFChunk.write(modHeader, modData, rf64),
      xdta: RIFFChunk.write(modHeader, new IndexedByteArray(10), rf64)
    },
    bag: {
      pdta: RIFFChunk.write(bagHeader, bagData.pdta, rf64),
      xdta: RIFFChunk.write(bagHeader, bagData.xdta, rf64)
    },
    hdr: {
      pdta: RIFFChunk.write(hdrHeader, hdrData.pdta, rf64),
      xdta: RIFFChunk.write(hdrHeader, hdrData.xdta, rf64)
    }
  };
}
function writeSF2Internal(bank, writeOptions) {
  const options = fillWithDefaults(writeOptions, DEFAULT_SF2_WRITE_OPTIONS);
  return writeSF(bank, options.software, options.writeDefaultModulators, options.writeExtendedLimits, false, false);
}
function writeSFEInternal(bank, writeOptions) {
  return writeSF(bank, fillWithDefaults(writeOptions, DEFAULT_SFE_WRITE_OPTIONS).software, true, true, true, true);
}
function writeSF(bank, software, writeDefaultModulators, writeExtendedLimits, writeBankLSB, rf64) {
  SpessaLog.groupCollapsed("%cSaving soundbank...", ConsoleColors.info);
  SpessaLog.group("%cWriting INFO...", ConsoleColors.info);
  const infoArrays = [];
  const writeSF2Info = (type, data) => {
    if (!data) return;
    infoArrays.push(...RIFFChunk.getParts(type, [getStringBytes(data, true, true)], rf64));
  };
  const info = bank.soundBankInfo;
  {
    const ifilData = new IndexedByteArray(4);
    writeWord(ifilData, info.version.major);
    writeWord(ifilData, info.version.minor);
    infoArrays.push(RIFFChunk.write("ifil", ifilData, rf64));
  }
  writeSF2Info("isng", info.soundEngine);
  writeSF2Info("INAM", info.name);
  writeSF2Info("irom", info.romInfo);
  if (info.romVersion) {
    const ifilData = new IndexedByteArray(4);
    writeWord(ifilData, info.romVersion.major);
    writeWord(ifilData, info.romVersion.minor);
    infoArrays.push(RIFFChunk.write("iver", ifilData, rf64));
  }
  writeSF2Info("ICRD", toISODateString(info.creationDate));
  writeSF2Info("IENG", info.engineer);
  writeSF2Info("IPRD", info.product);
  writeSF2Info("ICOP", info.copyright);
  writeSF2Info("ICMT", info?.subject ? (info?.comment ? info.comment + "\n" : "") + info.subject : info?.comment);
  writeSF2Info("ISFT", software);
  if (bank.defaultModulators.some((mod) => !SPESSASYNTH_DEFAULT_MODULATORS.some((m) => Modulator.isIdentical(m, mod, true))) && writeDefaultModulators) {
    const mods = bank.defaultModulators;
    SpessaLog.info(`%cWriting %c${mods.length}%c default modulators...`, ConsoleColors.info, ConsoleColors.recognized, ConsoleColors.info);
    const dmodData = new IndexedByteArray(10 + mods.length * 10);
    for (const mod of mods) mod.write(dmodData);
    writeLittleEndianIndexed(dmodData, 0, 10);
    infoArrays.push(...RIFFChunk.getParts("DMOD", [dmodData], rf64));
  }
  SpessaLog.groupEnd();
  SpessaLog.info("%cWriting SDTA...", ConsoleColors.info);
  const smplStartOffsets = [];
  const smplEndOffsets = [];
  const sdtaChunk = getSDTA(bank, smplStartOffsets, smplEndOffsets, rf64);
  SpessaLog.info("%cWriting PDTA...", ConsoleColors.info);
  SpessaLog.info("%cWriting SHDR...", ConsoleColors.info);
  const shdrChunk = getSHDR(bank, smplStartOffsets, smplEndOffsets, rf64);
  SpessaLog.group("%cWriting instruments...", ConsoleColors.info);
  const instData = writeSF2Elements(bank, rf64, false);
  SpessaLog.groupEnd();
  SpessaLog.group("%cWriting presets...", ConsoleColors.info);
  const presData = writeSF2Elements(bank, rf64, true, writeBankLSB);
  SpessaLog.groupEnd();
  const chunks = [
    presData.hdr,
    presData.bag,
    presData.mod,
    presData.gen,
    instData.hdr,
    instData.bag,
    instData.mod,
    instData.gen,
    shdrChunk
  ];
  const pdtaChunk = RIFFChunk.getParts("pdta", chunks.map((c) => c.pdta), rf64, true);
  if (writeExtendedLimits && (instData.writeXdta || presData.writeXdta || bank.presets.some((p) => p.name.length > 20) || bank.instruments.some((i) => i.name.length > 20) || bank.samples.some((s) => s.name.length > 20))) {
    SpessaLog.info(`%cWriting the xdta chunk as writeExtendedLimits is enabled and at least one condition was met.`, ConsoleColors.info, ConsoleColors.value);
    infoArrays.push(...RIFFChunk.getParts("xdta", chunks.map((c) => c.xdta), rf64, true));
  }
  const infoChunk = RIFFChunk.getParts("INFO", infoArrays, rf64, true);
  SpessaLog.info("%cWriting the output file...", ConsoleColors.info);
  const main = RIFFChunk.writeParts(rf64 ? "RIFS" : "RIFF", [
    getStringBytes(writeBankLSB ? "sfen" : "sfbk"),
    ...infoChunk,
    ...sdtaChunk,
    ...pdtaChunk
  ], rf64);
  SpessaLog.info(`%cSaved successfully! Final file size: %c${main.length}`, ConsoleColors.info, ConsoleColors.recognized);
  SpessaLog.groupEnd();
  return main.buffer;
}
function readPCM(data, bytesPerSample) {
  const maxSampleValue = Math.pow(2, bytesPerSample * 8 - 1);
  const maxUnsigned = Math.pow(2, bytesPerSample * 8);
  let normalizationFactor;
  let isUnsigned = false;
  if (bytesPerSample === 1) {
    normalizationFactor = 255;
    isUnsigned = true;
  } else normalizationFactor = maxSampleValue;
  const sampleLength = data.length / bytesPerSample;
  const sampleData = new Float32Array(sampleLength);
  if (bytesPerSample === 2) {
    const s16 = new Int16Array(data.buffer);
    const s16l = s16.length;
    for (let i = 0; i < s16l; i++) sampleData[i] = s16[i] / 32768;
  } else for (let i = 0; i < sampleData.length; i++) {
    let sample = readLittleEndianIndexed(data, bytesPerSample);
    if (isUnsigned) sampleData[i] = sample / normalizationFactor - 0.5;
    else {
      if (sample >= maxSampleValue) sample -= maxUnsigned;
      sampleData[i] = sample / normalizationFactor;
    }
  }
  return sampleData;
}
function readALAW(data, bytesPerSample) {
  const sampleLength = data.length / bytesPerSample;
  const sampleData = new Float32Array(sampleLength);
  for (let i = 0; i < sampleData.length; i++) {
    const input = readLittleEndianIndexed(data, bytesPerSample);
    let sample = input ^ 85;
    sample &= 127;
    const exponent = sample >> 4;
    let mantissa = sample & 15;
    if (exponent > 0) mantissa += 16;
    mantissa = (mantissa << 4) + 8;
    if (exponent > 1) mantissa = mantissa << exponent - 1;
    sampleData[i] = (input > 127 ? mantissa : -mantissa) / 32768;
  }
  return sampleData;
}
var IndexedByteArray, ConsoleColors, tr, inf, RIFFChunk, SpessaLog, SpessaSynthCoreUtils, MIDIMessageTypes, MIDIControllers, EMBEDDED_SOUND_BANK_ID, EFX_SENDS_GAIN_CORRECTION, GM2_DEFAULT_BANK, BankSelectHacks, MIDIPatchTools, OTHER, translations, DEFAULT_MIDI_CONTROLLERS, setResetValue, DEFAULT_DRUM_REVERB, RP_15_RESET_CC_NUMS, nonSkippableCCs, InterpolationTypes, stbvorbis, isReady, readySolver, atob, stb, KeyModifier, DEFAULT_GLOBAL_SYSTEM_PARAMETERS, MIN_TIMECENT, timecentLookupTable, MIN_ABS_CENT, MAX_ABS_CENT, absoluteCentLookupTable, MIN_CENTIBELS, CENTIBEL_LOOKUP_TABLE, GeneratorTypes, MAX_GENERATOR, GENERATORS_AMOUNT, GeneratorLimits, SampleTypes, ModulatorControllerSources, ModulatorCurveTypes, MODULATOR_RESOLUTION, MOD_CURVE_TYPES_AMOUNT, concave, convex, CONVEX_ATTACK, ModulatorSource, MODULATOR_TRANSFORMS, DEFAULT_RESONANT_MOD_SOURCE, Modulator, DecodedModulator, defaultSoundFont2Modulators, defaultSpessaSynthModulators, SPESSASYNTH_DEFAULT_MODULATORS, Generator, BasicZone, RESAMPLE_RATE, BasicSample, EmptySample, BasicInstrumentZone, BasicPresetZone, defaultGeneratorValues, BasicPreset, notGlobalizedTypes, BasicInstrument, DEFAULT_SF2_WRITE_OPTIONS, DEFAULT_SFE_WRITE_OPTIONS, DLSVerifier, DLSSources, DLSDestinations, DLSLoopTypes, WSMP_SIZE, WSMP_LOOP_SIZE, WaveSample, W_FORMAT_TAG, DLSSample, DownloadableSoundsSample, ConnectionSource, DEFAULT_DLS_REVERB, DEFAULT_DLS_CHORUS, invalidGeneratorTypes, ConnectionBlock, DownloadableSoundsArticulation, WaveLink, DownloadableSoundsRegion, DownloadableSoundsInstrument, DEFAULT_DLS_OPTIONS, DownloadableSounds, BasicSoundBank, VoiceModulator, HALF_PI$1, MIN_PAN$1, MAX_PAN$1, PAN_RESOLUTION$1, panTableLeft, panTableRight, AWE_NRPN_GENERATOR_MAPPINGS, INITIAL_MODULATORS, EFFECT_MODULATOR_TRANSFORM_MULTIPLIER, DEFAULT_CHANNEL_MIDI_PARAMETERS, DEFAULT_CHANNEL_SYSTEM_PARAMETERS, HALF_PI, MIN_PAN, MAX_PAN, PAN_RESOLUTION, PAN_TABLE_LEFT, PAN_TABLE_RIGHT, PI_2$1, DEPTH_MUL, LFO_SMOOTH_FRAC, PI_2, DEFAULT_GLOBAL_MIDI_PARAMETERS;
var init_dist = __esm({
  "node_modules/spessasynth_core/dist/index.js"() {
    IndexedByteArray = class extends Uint8Array {
      /**
      * The current index of the array.
      */
      currentIndex = 0;
      /**
      * Returns a section of an array.
      * @param start The beginning of the specified portion of the array.
      * @param end The end of the specified portion of the array. This is exclusive of the element at the index 'end'.
      */
      slice(start, end) {
        const a = super.slice(start, end);
        a.currentIndex = 0;
        return a;
      }
    };
    ConsoleColors = {
      warn: "color: orange;",
      unrecognized: "color: red;",
      info: "color: aqua;",
      recognized: "color: lime",
      value: "color: yellow; background-color: black;"
    };
    (() => {
      var l = Uint8Array, T = Uint16Array, ur = Int32Array, W = new l([
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        1,
        1,
        1,
        2,
        2,
        2,
        2,
        3,
        3,
        3,
        3,
        4,
        4,
        4,
        4,
        5,
        5,
        5,
        5,
        0,
        0,
        0,
        0
      ]), X = new l([
        0,
        0,
        0,
        0,
        1,
        1,
        2,
        2,
        3,
        3,
        4,
        4,
        5,
        5,
        6,
        6,
        7,
        7,
        8,
        8,
        9,
        9,
        10,
        10,
        11,
        11,
        12,
        12,
        13,
        13,
        0,
        0
      ]), wr = new l([
        16,
        17,
        18,
        0,
        8,
        7,
        9,
        6,
        10,
        5,
        11,
        4,
        12,
        3,
        13,
        2,
        14,
        1,
        15
      ]), Y = function(r, a) {
        for (var e = new T(31), f = 0; f < 31; ++f) e[f] = a += 1 << r[f - 1];
        for (var v = new ur(e[30]), f = 1; f < 30; ++f) for (var g = e[f]; g < e[f + 1]; ++g) v[g] = g - e[f] << 5 | f;
        return {
          b: e,
          r: v
        };
      }, Z = Y(W, 2), $ = Z.b, cr = Z.r;
      $[28] = 258, cr[258] = 28;
      var j = Y(X, 0), hr = j.b;
      j.r;
      var _ = new T(32768);
      for (i = 0; i < 32768; ++i) c = (i & 43690) >> 1 | (i & 21845) << 1, c = (c & 52428) >> 2 | (c & 13107) << 2, c = (c & 61680) >> 4 | (c & 3855) << 4, _[i] = ((c & 65280) >> 8 | (c & 255) << 8) >> 1;
      var c, i, A = function(r, a, e) {
        for (var f = r.length, v = 0, g = new T(a); v < f; ++v) r[v] && ++g[r[v] - 1];
        var k = new T(a);
        for (v = 1; v < a; ++v) k[v] = k[v - 1] + g[v - 1] << 1;
        var b;
        if (e) {
          b = new T(1 << a);
          var m = 15 - a;
          for (v = 0; v < f; ++v) if (r[v]) for (var U = v << 4 | r[v], x = a - r[v], n = k[r[v] - 1]++ << x, o = n | (1 << x) - 1; n <= o; ++n) b[_[n] >> m] = U;
        } else for (b = new T(f), v = 0; v < f; ++v) r[v] && (b[v] = _[k[r[v] - 1]++] >> 15 - r[v]);
        return b;
      }, M = new l(288);
      for (i = 0; i < 144; ++i) M[i] = 8;
      var i;
      for (i = 144; i < 256; ++i) M[i] = 9;
      var i;
      for (i = 256; i < 280; ++i) M[i] = 7;
      var i;
      for (i = 280; i < 288; ++i) M[i] = 8;
      var i, L = new l(32);
      for (i = 0; i < 32; ++i) L[i] = 5;
      var i, gr = A(M, 9, 1), br = A(L, 5, 1), q = function(r) {
        for (var a = r[0], e = 1; e < r.length; ++e) r[e] > a && (a = r[e]);
        return a;
      }, u = function(r, a, e) {
        var f = a / 8 | 0;
        return (r[f] | r[f + 1] << 8) >> (a & 7) & e;
      }, C = function(r, a) {
        var e = a / 8 | 0;
        return (r[e] | r[e + 1] << 8 | r[e + 2] << 16) >> (a & 7);
      }, kr = function(r) {
        return (r + 7) / 8 | 0;
      }, xr = function(r, a, e) {
        return (a == null || a < 0) && (a = 0), (e == null || e > r.length) && (e = r.length), new l(r.subarray(a, e));
      }, yr = [
        "unexpected EOF",
        "invalid block type",
        "invalid length/literal",
        "invalid distance",
        "stream finished",
        "no stream handler",
        ,
        "no callback",
        "invalid UTF-8 data",
        "extra field too long",
        "date not in range 1980-2099",
        "filename too long",
        "stream finishing",
        "invalid zip data"
      ], h = function(r, a, e) {
        var f = new Error(a || yr[r]);
        if (f.code = r, Error.captureStackTrace && Error.captureStackTrace(f, h), !e) throw f;
        return f;
      }, Sr = function(r, a, e, f) {
        var v = r.length, g = f ? f.length : 0;
        if (!v || a.f && !a.l) return e || new l(0);
        var k = !e, b = k || a.i != 2, m = a.i;
        k && (e = new l(v * 3));
        var U = function(fr) {
          var or = e.length;
          if (fr > or) {
            var lr = new l(Math.max(or * 2, fr));
            lr.set(e), e = lr;
          }
        }, x = a.f || 0, n = a.p || 0, o = a.b || 0, S = a.l, I = a.d, z = a.m, D = a.n, G = v * 8;
        do {
          if (!S) {
            x = u(r, n, 1);
            var H = u(r, n + 1, 3);
            if (n += 3, H) if (H == 1) S = gr, I = br, z = 9, D = 5;
            else if (H == 2) {
              var N = u(r, n, 31) + 257, s = u(r, n + 10, 15) + 4, d = N + u(r, n + 5, 31) + 1;
              n += 14;
              for (var F = new l(d), P = new l(19), t = 0; t < s; ++t) P[wr[t]] = u(r, n + t * 3, 7);
              n += s * 3;
              for (var rr = q(P), Ar = (1 << rr) - 1, Mr = A(P, rr, 1), t = 0; t < d; ) {
                var ar = Mr[u(r, n, Ar)];
                n += ar & 15;
                var w = ar >> 4;
                if (w < 16) F[t++] = w;
                else {
                  var E = 0, O = 0;
                  for (w == 16 ? (O = 3 + u(r, n, 3), n += 2, E = F[t - 1]) : w == 17 ? (O = 3 + u(r, n, 7), n += 3) : w == 18 && (O = 11 + u(r, n, 127), n += 7); O--; ) F[t++] = E;
                }
              }
              var er = F.subarray(0, N), y = F.subarray(N);
              z = q(er), D = q(y), S = A(er, z, 1), I = A(y, D, 1);
            } else h(1);
            else {
              var w = kr(n) + 4, J = r[w - 4] | r[w - 3] << 8, K = w + J;
              if (K > v) {
                m && h(0);
                break;
              }
              b && U(o + J), e.set(r.subarray(w, K), o), a.b = o += J, a.p = n = K * 8, a.f = x;
              continue;
            }
            if (n > G) {
              m && h(0);
              break;
            }
          }
          b && U(o + 131072);
          for (var Ur = (1 << z) - 1, zr = (1 << D) - 1, Q = n; ; Q = n) {
            var E = S[C(r, n) & Ur], p = E >> 4;
            if (n += E & 15, n > G) {
              m && h(0);
              break;
            }
            if (E || h(2), p < 256) e[o++] = p;
            else if (p == 256) {
              Q = n, S = null;
              break;
            } else {
              var nr = p - 254;
              if (p > 264) {
                var t = p - 257, B = W[t];
                nr = u(r, n, (1 << B) - 1) + $[t], n += B;
              }
              var R = I[C(r, n) & zr], V = R >> 4;
              R || h(3), n += R & 15;
              var y = hr[V];
              if (V > 3) {
                var B = X[V];
                y += C(r, n) & (1 << B) - 1, n += B;
              }
              if (n > G) {
                m && h(0);
                break;
              }
              b && U(o + 131072);
              var vr = o + nr;
              if (o < y) {
                var ir = g - y, Dr = Math.min(y, vr);
                for (ir + o < 0 && h(3); o < Dr; ++o) e[o] = f[ir + o];
              }
              for (; o < vr; ++o) e[o] = e[o - y];
            }
          }
          a.l = S, a.p = Q, a.b = o, a.f = x, S && (x = 1, a.m = z, a.d = I, a.n = D);
        } while (!x);
        return o != e.length && k ? xr(e, 0, o) : e.subarray(0, o);
      }, Tr = new l(0);
      function mr(r, a) {
        return Sr(r, { i: 2 }, a && a.out, a && a.dictionary);
      }
      var Er = typeof TextDecoder < "u" && new TextDecoder();
      try {
        Er.decode(Tr, { stream: true });
      } catch {
      }
      tr = mr;
    })();
    inf = tr;
    RIFFChunk = class RIFFChunk2 {
      /**
      * The chunks FourCC code.
      */
      header;
      /**
      * Chunk's size, in bytes.
      */
      size;
      /**
      * Chunk's binary data. Note that this will have a length of 0 if "readData" was set to false.
      */
      data;
      /**
      * The size of the chunk's header in bytes.
      * This varies for 32-bit and 64-bit RIFF chunks.
      */
      headerSize;
      /**
      * Creates a new RIFF chunk.
      */
      constructor(header, size, data, headerSize = 8) {
        this.header = header;
        this.size = size;
        this.data = data;
        this.headerSize = headerSize;
      }
      /**
      * Reads a RIFF chunk from an array.
      * @param dataArray the array to read from.
      * @param rf64 if the chunk uses a 64-bit size.
      * @param readData if the data should be read as well.
      */
      static read(dataArray, rf64 = false, readData = true) {
        const header = readBinaryStringIndexed(dataArray, 4);
        let size = rf64 ? readLE64Indexed(dataArray, 8) : readLittleEndianIndexed(dataArray, 4);
        if (header === "") size = 0;
        const chunkData = readData ? dataArray.slice(dataArray.currentIndex, dataArray.currentIndex + size) : new IndexedByteArray(0);
        if (readData) {
          dataArray.currentIndex += size;
          if (size % 2 !== 0) dataArray.currentIndex++;
        }
        return new RIFFChunk2(header, size, chunkData, rf64 ? 12 : 8);
      }
      /**
      * Writes a RIFF chunk correctly.
      * @param header the fourCC code of the header.
      * @param data the binary chunk data.
      * @param isList if a "LIST" should be set as the chunk type and the actual type should be written at the start of the data.
      * @param rf64 if the chunk uses a 64-bit size.
      * @returns the binary data.
      */
      static write(header, data, rf64 = false, isList = false) {
        if (header.length !== 4) throw new Error(`Invalid header length: ${header}`);
        let dataStartOffset = rf64 ? 12 : 8;
        let headerWritten = header;
        const dataLength = data.length;
        let writtenSize = dataLength;
        if (isList) {
          dataStartOffset += 4;
          writtenSize += 4;
          headerWritten = "LIST";
        }
        let finalSize = dataStartOffset + dataLength;
        if (finalSize % 2 !== 0) finalSize++;
        const outArray = new IndexedByteArray(finalSize);
        writeBinaryStringIndexed(outArray, headerWritten);
        if (rf64) writeQword(outArray, writtenSize);
        else writeDword(outArray, writtenSize);
        if (isList) writeBinaryStringIndexed(outArray, header);
        outArray.set(data, dataStartOffset);
        return outArray;
      }
      /**
      * "Writes" a RIFF chunk as a list of binary blobs,
      * which can be appended to a list without using more memory,
      * then finally allocated at the end with `writeParts`.
      * This allows avoiding large array allocations and only one writeParts call at the end.
      * @param header  the fourCC code of the header.
      * @param chunks binary chunk data parts, will be combined in order.
      * @param isList if a "LIST" should be set as the chunk type and the actual type should be written at the start of the data.
      * @param rf64 if the chunk uses a 64-bit size.
      * @returns the chunk as binary blobs.
      */
      static getParts(header, chunks, rf64 = false, isList = false) {
        let headerWritten = header;
        let totalSize = chunks.reduce((len, c) => c.length + len, 0);
        if (isList) {
          totalSize += 4;
          headerWritten = "LIST";
        }
        let sizeBytes;
        if (rf64) {
          sizeBytes = new IndexedByteArray(8);
          writeQword(sizeBytes, totalSize);
        } else {
          sizeBytes = new IndexedByteArray(4);
          writeDword(sizeBytes, totalSize);
        }
        const parts = [getStringBytes(headerWritten), sizeBytes];
        if (isList) parts.push(getStringBytes(header));
        parts.push(...chunks);
        if (totalSize % 2 !== 0) parts.push(new Uint8Array(1));
        return parts;
      }
      /**
      * Writes RIFF chunk given binary blobs.
      * It merges them together into data and allocates one large array.
      * @param header  the fourCC code of the header.
      * @param chunks binary chunk data parts, will be combined in order.
      * @param isList if a "LIST" should be set as the chunk type and the actual type should be written at the start of the data.
      * @param rf64 if the chunk uses a 64-bit size.
      * @returns the binary data.
      */
      static writeParts(header, chunks, rf64 = false, isList = false) {
        let dataOffset = rf64 ? 12 : 8;
        let headerWritten = header;
        const dataLength = chunks.reduce((len, c) => c.length + len, 0);
        let writtenSize = dataLength;
        if (isList) {
          dataOffset += 4;
          writtenSize += 4;
          headerWritten = "LIST";
        }
        let finalSize = dataOffset + dataLength;
        if (finalSize % 2 !== 0) finalSize++;
        const outArray = new IndexedByteArray(finalSize);
        writeBinaryStringIndexed(outArray, headerWritten);
        if (rf64) writeQword(outArray, writtenSize);
        else writeDword(outArray, writtenSize);
        if (isList) writeBinaryStringIndexed(outArray, header);
        for (const c of chunks) {
          outArray.set(c, dataOffset);
          dataOffset += c.length;
        }
        return outArray;
      }
      /**
      * Finds a given type in a list.
      * @remarks
      * Also skips the current index to after the list FourCC.
      */
      static findListType(collection, type) {
        return collection.find((c) => {
          if (c.header !== "LIST") return false;
          c.data.currentIndex = 4;
          return readBinaryString(c.data, 4) === type;
        });
      }
    };
    SpessaLog = class SpessaLog2 {
      /**
      * The most verbose log level, prints out a lot of small details.
      */
      static infoEnabled = false;
      /**
      * The default log level, prints out warnings for unexpected and erroneous behavior.
      */
      static warnEnabled = true;
      /**
      * If grouping of the log messages is allowed. Recommended for the `info` verbosity level.
      */
      static groupEnabled = false;
      /**
      * Enables or disables logging.
      * @param enableInfo enables info.
      * @param enableWarn enables warning.
      * @param enableGroup enables groups.
      */
      static setLogLevel(enableInfo, enableWarn, enableGroup) {
        this.infoEnabled = enableInfo;
        this.warnEnabled = enableWarn;
        this.groupEnabled = enableGroup;
      }
      static info(...message) {
        if (this.infoEnabled) console.info(...message);
      }
      static warn(...message) {
        if (this.warnEnabled) console.warn(...message);
      }
      static group(...message) {
        if (this.groupEnabled) console.group(...message);
      }
      static groupCollapsed(...message) {
        if (this.groupEnabled) console.groupCollapsed(...message);
      }
      static groupEnd() {
        if (this.groupEnabled) console.groupEnd();
      }
      /**
      * @internal
      */
      static unsupported(what, syx, reason = "") {
        if (this.infoEnabled) this.info(`%cUnsupported %c${what}%c message: %c${arrayToHexString(syx)}%c. ${reason}`, ConsoleColors.warn, ConsoleColors.recognized, ConsoleColors.warn, ConsoleColors.unrecognized, ConsoleColors.warn);
      }
      /**
      * @internal
      */
      static gmInfo(what, value, unit = "") {
        if (this.infoEnabled) this.coolInfo(`General MIDI ${what}`, value, unit);
      }
      /**
      * @internal
      */
      static gmFail(what, syx) {
        if (this.infoEnabled) this.unsupported(`General MIDI ${what}`, syx);
      }
      /**
      * @internal
      */
      static gsInfo(what, value, unit = "") {
        if (this.infoEnabled) this.coolInfo(`Roland GS ${what}`, value, unit);
      }
      /**
      * @internal
      */
      static gsFail(what, syx, reason = "") {
        if (this.infoEnabled) this.unsupported(`Roland GS ${what}`, syx, reason);
      }
      /**
      * @internal
      */
      static xgInfo(what, value, unit = "") {
        if (this.infoEnabled) this.coolInfo(`Yamaha XG ${what}`, value, unit);
      }
      /**
      * @internal
      */
      static xgFail(what, syx, reason = "") {
        if (this.infoEnabled) this.unsupported(`Yamaha XG ${what}`, syx, reason);
      }
      /**
      * @internal
      */
      static coolInfo(what, value, unit = "") {
        if (!this.infoEnabled) return;
        if (unit) SpessaLog2.info(`%c${what}%c is now set to %c${value}%c ${unit}.`, ConsoleColors.recognized, ConsoleColors.info, ConsoleColors.value, ConsoleColors.info);
        else SpessaLog2.info(`%c${what}%c is now set to %c${value}%c.`, ConsoleColors.recognized, ConsoleColors.info, ConsoleColors.value, ConsoleColors.info);
      }
    };
    SpessaSynthCoreUtils = {
      ConsoleColors,
      readBigEndian,
      readLittleEndian,
      readLittleEndianIndexed,
      readBinaryString,
      readBinaryStringIndexed,
      readVariableLengthQuantity,
      inflateSync: inf
    };
    MIDIMessageTypes = {
      noteOff: 128,
      noteOn: 144,
      polyPressure: 160,
      controllerChange: 176,
      programChange: 192,
      channelPressure: 208,
      pitchWheel: 224,
      systemExclusive: 240,
      timecode: 241,
      songPosition: 242,
      songSelect: 243,
      tuneRequest: 246,
      clock: 248,
      start: 250,
      continue: 251,
      stop: 252,
      activeSensing: 254,
      reset: 255,
      sequenceNumber: 0,
      text: 1,
      copyright: 2,
      trackName: 3,
      instrumentName: 4,
      lyric: 5,
      marker: 6,
      cuePoint: 7,
      programName: 8,
      midiChannelPrefix: 32,
      midiPort: 33,
      endOfTrack: 47,
      setTempo: 81,
      smpteOffset: 84,
      timeSignature: 88,
      keySignature: 89,
      sequenceSpecific: 127
    };
    MIDIControllers = {
      bankSelect: 0,
      modulationWheel: 1,
      breathController: 2,
      undefinedCC3: 3,
      footController: 4,
      portamentoTime: 5,
      dataEntryMSB: 6,
      mainVolume: 7,
      balance: 8,
      undefinedCC9: 9,
      pan: 10,
      expression: 11,
      effectControl1: 12,
      effectControl2: 13,
      undefinedCC14: 14,
      undefinedCC15: 15,
      generalPurposeController1: 16,
      generalPurposeController2: 17,
      generalPurposeController3: 18,
      generalPurposeController4: 19,
      undefinedCC20: 20,
      undefinedCC21: 21,
      undefinedCC22: 22,
      undefinedCC23: 23,
      undefinedCC24: 24,
      undefinedCC25: 25,
      undefinedCC26: 26,
      undefinedCC27: 27,
      undefinedCC28: 28,
      undefinedCC29: 29,
      undefinedCC30: 30,
      undefinedCC31: 31,
      bankSelectLSB: 32,
      modulationWheelLSB: 33,
      breathControllerLSB: 34,
      undefinedCC3LSB: 35,
      footControllerLSB: 36,
      portamentoTimeLSB: 37,
      dataEntryLSB: 38,
      mainVolumeLSB: 39,
      balanceLSB: 40,
      undefinedCC9LSB: 41,
      panLSB: 42,
      expressionLSB: 43,
      effectControl1LSB: 44,
      effectControl2LSB: 45,
      undefinedCC14LSB: 46,
      undefinedCC15LSB: 47,
      undefinedCC16LSB: 48,
      undefinedCC17LSB: 49,
      undefinedCC18LSB: 50,
      undefinedCC19LSB: 51,
      undefinedCC20LSB: 52,
      undefinedCC21LSB: 53,
      undefinedCC22LSB: 54,
      undefinedCC23LSB: 55,
      undefinedCC24LSB: 56,
      undefinedCC25LSB: 57,
      undefinedCC26LSB: 58,
      undefinedCC27LSB: 59,
      undefinedCC28LSB: 60,
      undefinedCC29LSB: 61,
      undefinedCC30LSB: 62,
      undefinedCC31LSB: 63,
      sustainPedal: 64,
      portamentoOnOff: 65,
      sostenutoPedal: 66,
      softPedal: 67,
      legatoFootswitch: 68,
      hold2Pedal: 69,
      soundVariation: 70,
      filterResonance: 71,
      releaseTime: 72,
      attackTime: 73,
      brightness: 74,
      decayTime: 75,
      vibratoRate: 76,
      vibratoDepth: 77,
      vibratoDelay: 78,
      soundController10: 79,
      generalPurposeController5: 80,
      generalPurposeController6: 81,
      generalPurposeController7: 82,
      generalPurposeController8: 83,
      portamentoControl: 84,
      undefinedCC85: 85,
      undefinedCC86: 86,
      undefinedCC87: 87,
      undefinedCC88: 88,
      undefinedCC89: 89,
      undefinedCC90: 90,
      reverbDepth: 91,
      tremoloDepth: 92,
      chorusDepth: 93,
      variationDepth: 94,
      phaserDepth: 95,
      dataIncrement: 96,
      dataDecrement: 97,
      nonRegisteredParameterLSB: 98,
      nonRegisteredParameterMSB: 99,
      registeredParameterLSB: 100,
      registeredParameterMSB: 101,
      undefinedCC102LSB: 102,
      undefinedCC103LSB: 103,
      undefinedCC104LSB: 104,
      undefinedCC105LSB: 105,
      undefinedCC106LSB: 106,
      undefinedCC107LSB: 107,
      undefinedCC108LSB: 108,
      undefinedCC109LSB: 109,
      undefinedCC110LSB: 110,
      undefinedCC111LSB: 111,
      undefinedCC112LSB: 112,
      undefinedCC113LSB: 113,
      undefinedCC114LSB: 114,
      undefinedCC115LSB: 115,
      undefinedCC116LSB: 116,
      undefinedCC117LSB: 117,
      undefinedCC118LSB: 118,
      undefinedCC119LSB: 119,
      allSoundOff: 120,
      resetAllControllers: 121,
      localControlOnOff: 122,
      allNotesOff: 123,
      omniModeOff: 124,
      omniModeOn: 125,
      monoModeOn: 126,
      polyModeOn: 127
    };
    EMBEDDED_SOUND_BANK_ID = `SPESSASYNTH_EMBEDDED_BANK_${Math.random()}_DO_NOT_DELETE`;
    EFX_SENDS_GAIN_CORRECTION = 1 / Math.cos(Math.PI / 4) ** 2;
    GM2_DEFAULT_BANK = 121;
    BankSelectHacks = class {
      /**
      * GM2 has a different default bank number
      */
      static getDefaultBank(sys) {
        return sys === "gm2" ? GM2_DEFAULT_BANK : 0;
      }
      static getDrumBank(sys) {
        switch (sys) {
          default:
            throw new Error(`${sys} doesn't have a bank MSB for drums.`);
          case "gm2":
            return 120;
          case "xg":
            return 127;
        }
      }
      /**
      * Checks if this bank number is XG drums.
      */
      static isXGDrum(bankMSB) {
        return bankMSB === 120 || bankMSB === 127;
      }
      /**
      * Checks if this MSB is a valid XG MSB
      */
      static isValidXGMSB(bankMSB) {
        return this.isXGDrum(bankMSB) || bankMSB === 64 || bankMSB === GM2_DEFAULT_BANK;
      }
      static isSystemXG(system) {
        return system === "gm2" || system === "xg";
      }
      static addBankOffset(bankMSB, bankOffset, isXG) {
        if (this.isXGDrum(bankMSB) && isXG) return bankMSB;
        return Math.min(bankMSB + bankOffset, 127);
      }
      static subtractBankOffset(bankMSB, bankOffset, isXG) {
        if (this.isXGDrum(bankMSB) && isXG) return bankMSB;
        return Math.max(0, bankMSB - bankOffset);
      }
    };
    MIDIPatchTools = class MIDIPatchTools2 {
      /**
      * Converts a given `MIDIPatch` to a string.
      * The format is:
      * - `DRUM:program` for `GMGSDrum` set to `true`.
      * - `bankLSB:bankMSB:program` for `GMGSDrum` set to `false`.
      */
      static toMIDIString(patch) {
        if (patch.isGMGSDrum) return `DRUM:${patch.program}`;
        return `${patch.bankLSB}:${patch.bankMSB}:${patch.program}`;
      }
      /**
      * Gets `MIDIPatch` from a given string.
      */
      static fromMIDIString(string) {
        const parts = string.split(":");
        if (parts.length > 3 || parts.length < 2) throw new Error(`Invalid MIDI string: ${string}`);
        return string.startsWith("DRUM") ? {
          bankMSB: 0,
          bankLSB: 0,
          program: Number.parseInt(parts[1]),
          isGMGSDrum: true
        } : {
          bankLSB: Number.parseInt(parts[0]),
          bankMSB: Number.parseInt(parts[1]),
          program: Number.parseInt(parts[2]),
          isGMGSDrum: false
        };
      }
      /**
      * Converts a given `MIDIPatchFull`to string.
      * The format is:
      * - `<MIDIPatch string> D <name>` for `isDrum` set to `true`.
      * - `<MIDIPatch string> M <name>` for `isDrum` set to `true`.
      */
      static toFullMIDIString(patch) {
        return `${this.toMIDIString(patch)} ${patch.isDrum ? "D" : "M"} ${patch.name}`;
      }
      /**
      * Gets `MIDIPatchFull` from a given string.
      */
      static fromFullMIDIString(string) {
        const firstSpace = string.indexOf(" ");
        const secondSpace = string.indexOf(" ", firstSpace + 1);
        if (firstSpace === -1 || secondSpace === -1) throw new Error(`Invalid named MIDI string: ${string}`);
        const midiPart = string.slice(0, Math.max(0, firstSpace));
        const drumMode = string.slice(firstSpace + 1, secondSpace);
        const name = string.slice(Math.max(0, secondSpace + 1));
        return {
          ...MIDIPatchTools2.fromMIDIString(midiPart),
          isDrum: drumMode === "D",
          name
        };
      }
      /**
      * Checks if two MIDI patches represent the same one.
      */
      static matches(patch1, patch2) {
        if (patch1.isGMGSDrum || patch2.isGMGSDrum) return patch1.isGMGSDrum === patch2.isGMGSDrum && patch1.program === patch2.program;
        return patch1.program === patch2.program && patch1.bankLSB === patch2.bankLSB && patch1.bankMSB === patch2.bankMSB;
      }
      /**
      * A comparison function for `.sort()` or `.toSorted()`,
      * ordering the patches in ascending order.
      */
      static compare(a, b) {
        if (a.isGMGSDrum && !b.isGMGSDrum) return 1;
        if (!a.isGMGSDrum && b.isGMGSDrum) return -1;
        if (a.program !== b.program) return a.program - b.program;
        if (a.bankMSB !== b.bankMSB) return a.bankMSB - b.bankMSB;
        return a.bankLSB - b.bankLSB;
      }
      /**
      * Checks if the given `MIDIPatchFull` is an XG/GM2 drum patch.
      */
      static isXGDrum(p) {
        return p.isDrum && !p.isGMGSDrum;
      }
      /**
      * A sophisticated patch selection system based on the MIDI Patch system.
      * This is the algorithm that the synthesizer uses for selecting presets.
      * @param patches The `MIDIPatchFull` array to select from.
      * @param patch The `MIDIPatch` to select.
      * @param system The MIDI system to select for.
      * @returns The selected patch.
      */
      static selectPatch(patches, patch, system) {
        if (patches.length === 0) throw new Error("No presets!");
        if (patch.isGMGSDrum && BankSelectHacks.isSystemXG(system)) patch = {
          ...patch,
          isGMGSDrum: false,
          bankLSB: 0,
          bankMSB: BankSelectHacks.getDrumBank(system)
        };
        const { isGMGSDrum, bankLSB, bankMSB, program } = patch;
        const isXG = BankSelectHacks.isSystemXG(system);
        const xgDrums = BankSelectHacks.isXGDrum(bankMSB) && isXG;
        let p = patches.find((p2) => this.matches(p2, patch));
        if (p && (!xgDrums || xgDrums && this.isXGDrum(p))) return p;
        const returnReplacement = (pres) => {
          SpessaLog.info(`%cPreset %c${MIDIPatchTools2.toMIDIString(patch)}%c not found. (${system}) Replaced with %c${this.toFullMIDIString(pres)}`, ConsoleColors.warn, ConsoleColors.unrecognized, ConsoleColors.warn, ConsoleColors.value);
        };
        if (isGMGSDrum) {
          let p2 = patches.find((p3) => p3.isGMGSDrum && p3.program === program);
          if (p2) {
            returnReplacement(p2);
            return p2;
          }
          p2 = patches.find((p3) => p3.isDrum && p3.program === program);
          if (p2) {
            returnReplacement(p2);
            return p2;
          }
          p2 = this.getAnyDrums(patches, false);
          returnReplacement(p2);
          return p2;
        }
        if (xgDrums) {
          let p2 = patches.find((p3) => p3.program === program && p3.isDrum && !p3.isGMGSDrum);
          if (p2) {
            returnReplacement(p2);
            return p2;
          }
          p2 = patches.find((p3) => p3.isDrum && p3.program === program);
          if (p2 && p2.program < 49) {
            returnReplacement(p2);
            return p2;
          }
          p2 = this.getAnyDrums(patches, true);
          returnReplacement(p2);
          return p2;
        }
        const matchingPrograms = patches.filter((p2) => p2.program === program && !p2.isDrum);
        if (matchingPrograms.length === 0) {
          returnReplacement(patches[0]);
          return patches[0];
        }
        p = isXG ? matchingPrograms.find((p2) => p2.bankLSB === bankLSB) : matchingPrograms.find((p2) => p2.bankMSB === bankMSB);
        if (p) {
          returnReplacement(p);
          return p;
        }
        if (bankLSB !== 64 || !isXG) {
          const bank = Math.max(bankMSB, bankLSB);
          p = matchingPrograms.find((p2) => p2.bankLSB === bank || p2.bankMSB === bank);
          if (p) {
            returnReplacement(p);
            return p;
          }
        }
        returnReplacement(matchingPrograms[0]);
        return matchingPrograms[0];
      }
      static getAnyDrums(presets, preferXG) {
        const p = preferXG ? presets.find((p2) => this.isXGDrum(p2)) : presets.find((p2) => p2.isGMGSDrum);
        if (p) return p;
        return presets.find((p2) => p2.isDrum) ?? presets[0];
      }
    };
    OTHER = Object.freeze({ type: "Other" });
    translations = [/* @__PURE__ */ new Map([
      ["domingo", "Sunday"],
      ["segunda-feira", "Monday"],
      ["ter\xE7a-feira", "Tuesday"],
      ["quarta-feira", "Wednesday"],
      ["quinta-feira", "Thursday"],
      ["sexta-feira", "Friday"],
      ["s\xE1bado", "Saturday"],
      ["janeiro", "January"],
      ["fevereiro", "February"],
      ["mar\xE7o", "March"],
      ["abril", "April"],
      ["maio", "May"],
      ["junho", "June"],
      ["julho", "July"],
      ["agosto", "August"],
      ["setembro", "September"],
      ["outubro", "October"],
      ["novembro", "November"],
      ["dezembro", "December"]
    ])];
    DEFAULT_MIDI_CONTROLLERS = new Int16Array(128).fill(0);
    setResetValue = (i, v) => DEFAULT_MIDI_CONTROLLERS[i] = v << 7;
    setResetValue(MIDIControllers.mainVolume, 100);
    setResetValue(MIDIControllers.balance, 64);
    setResetValue(MIDIControllers.expression, 127);
    setResetValue(MIDIControllers.pan, 64);
    setResetValue(MIDIControllers.filterResonance, 64);
    setResetValue(MIDIControllers.releaseTime, 64);
    setResetValue(MIDIControllers.attackTime, 64);
    setResetValue(MIDIControllers.brightness, 64);
    setResetValue(MIDIControllers.decayTime, 64);
    setResetValue(MIDIControllers.vibratoRate, 64);
    setResetValue(MIDIControllers.vibratoDepth, 64);
    setResetValue(MIDIControllers.vibratoDelay, 64);
    setResetValue(MIDIControllers.generalPurposeController6, 64);
    setResetValue(MIDIControllers.generalPurposeController8, 64);
    setResetValue(MIDIControllers.registeredParameterLSB, 127);
    setResetValue(MIDIControllers.registeredParameterMSB, 127);
    setResetValue(MIDIControllers.nonRegisteredParameterLSB, 0);
    setResetValue(MIDIControllers.nonRegisteredParameterMSB, 0);
    DEFAULT_DRUM_REVERB = new Int8Array(128).fill(127);
    DEFAULT_DRUM_REVERB[35] = 0;
    DEFAULT_DRUM_REVERB[36] = 0;
    RP_15_RESET_CC_NUMS = [
      MIDIControllers.modulationWheel,
      MIDIControllers.expression,
      MIDIControllers.sustainPedal,
      MIDIControllers.portamentoOnOff,
      MIDIControllers.sostenutoPedal,
      MIDIControllers.softPedal,
      MIDIControllers.registeredParameterMSB,
      MIDIControllers.registeredParameterLSB
    ];
    nonSkippableCCs = /* @__PURE__ */ new Set([
      MIDIControllers.dataDecrement,
      MIDIControllers.dataIncrement,
      MIDIControllers.dataEntryMSB,
      MIDIControllers.dataEntryLSB,
      MIDIControllers.registeredParameterLSB,
      MIDIControllers.registeredParameterMSB,
      MIDIControllers.nonRegisteredParameterLSB,
      MIDIControllers.nonRegisteredParameterMSB,
      MIDIControllers.bankSelect,
      MIDIControllers.bankSelectLSB,
      MIDIControllers.resetAllControllers,
      MIDIControllers.monoModeOn,
      MIDIControllers.polyModeOn
    ]);
    InterpolationTypes = {
      linear: 0,
      nearestNeighbor: 1,
      hermite: 2
    };
    stbvorbis = void 0 !== stbvorbis ? stbvorbis : {};
    isReady = false;
    stbvorbis.isInitialized = new Promise((A) => readySolver = A);
    atob = function(A) {
      var I, g, B, E, Q, C, i, h = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=", o = "", G = 0;
      A = A.replace(/[^A-Za-z0-9\+\/\=]/g, "");
      do
        E = h.indexOf(A.charAt(G++)), Q = h.indexOf(A.charAt(G++)), C = h.indexOf(A.charAt(G++)), i = h.indexOf(A.charAt(G++)), I = E << 2 | Q >> 4, g = (15 & Q) << 4 | C >> 2, B = (3 & C) << 6 | i, o += String.fromCharCode(I), 64 !== C && (o += String.fromCharCode(g)), 64 !== i && (o += String.fromCharCode(B));
      while (G < A.length);
      return o;
    };
    (function() {
      var A, I, g, B, E, Q, h, a, S, s, w, y, c, $ = void 0 !== $ ? $ : {};
      $.wasmBinary = Uint8Array.from(atob("AGFzbQEAAAABpQEYYAJ/fwF/YAF/AGAAAX9gBH9/f38AYAAAYAN/f38Bf2ABfwF/YAJ/fwBgBn9/f39/fwF/YAR/f39/AX9gBX9/f39/AX9gB39/f39/f38Bf2AGf39/f39/AGAIf39/f39/f38Bf2AFf39/f38AYAd/f39/f39/AGADf39/AGABfwF9YAF9AX1gAnx/AXxgAnx/AX9gA3x8fwF8YAJ8fAF8YAF8AXwCngIPA2VudgZtZW1vcnkCAIACA2VudgV0YWJsZQFwAQQEA2Vudgl0YWJsZUJhc2UDfwADZW52DkRZTkFNSUNUT1BfUFRSA38AA2VudghTVEFDS1RPUAN/AANlbnYJU1RBQ0tfTUFYA38ABmdsb2JhbAhJbmZpbml0eQN8AANlbnYFYWJvcnQAAQNlbnYNZW5sYXJnZU1lbW9yeQACA2Vudg5nZXRUb3RhbE1lbW9yeQACA2VudhdhYm9ydE9uQ2Fubm90R3Jvd01lbW9yeQACA2Vudg5fX19hc3NlcnRfZmFpbAADA2VudgtfX19zZXRFcnJObwABA2VudgZfYWJvcnQABANlbnYWX2Vtc2NyaXB0ZW5fbWVtY3B5X2JpZwAFA3d2BgYCAQcHAQIBAQcBCAcFAAkGCQoHBgYGBgEFBgIBBgYKAAgLAAYGBgYGBgYBAAoMDAMGBQANCAoJAAwODA8OAQAGBgcEABAJEAERAAADBQwAAAMHBxIGAQAABwIFEwMOBw8HBgYQFAoVExYXFxcXFgQFBQYFAAYkB38BIwELfwEjAgt/ASMDC38BQQALfwFBAAt8ASMEC38BQQALB9MCFRBfX2dyb3dXYXNtTWVtb3J5AAgRX19fZXJybm9fbG9jYXRpb24AYwVfZnJlZQBfB19tYWxsb2MAXgdfbWVtY3B5AHkHX21lbXNldAB6BV9zYnJrAHsXX3N0Yl92b3JiaXNfanNfY2hhbm5lbHMAJhRfc3RiX3ZvcmJpc19qc19jbG9zZQAlFV9zdGJfdm9yYmlzX2pzX2RlY29kZQAoE19zdGJfdm9yYmlzX2pzX29wZW4AJBpfc3RiX3ZvcmJpc19qc19zYW1wbGVfcmF0ZQAnC2R5bkNhbGxfaWlpAHwTZXN0YWJsaXNoU3RhY2tTcGFjZQAMC2dldFRlbXBSZXQwAA8LcnVuUG9zdFNldHMAeAtzZXRUZW1wUmV0MAAOCHNldFRocmV3AA0Kc3RhY2tBbGxvYwAJDHN0YWNrUmVzdG9yZQALCXN0YWNrU2F2ZQAKCQoBACMACwR9VFl9Csb2A3YGACAAQAALGwEBfyMGIQEjBiAAaiQGIwZBD2pBcHEkBiABCwQAIwYLBgAgACQGCwoAIAAkBiABJAcLEAAjCEUEQCAAJAggASQJCwsGACAAJAsLBAAjCwsRACAABEAgABARIAAgABASCwvvBwEKfyAAQYADaiEHIAcoAgAhBQJAIAUEQCAAQfwBaiEEIAQoAgAhASABQQBKBEAgAEHwAGohCANAIAUgAkEYbGpBEGohCSAJKAIAIQEgAQRAIAgoAgAhAyAFIAJBGGxqQQ1qIQogCi0AACEGIAZB/wFxIQYgAyAGQbAQbGpBBGohAyADKAIAIQMgA0EASgRAQQAhAwNAIAEgA0ECdGohASABKAIAIQEgACABEBIgA0EBaiEDIAgoAgAhASAKLQAAIQYgBkH/AXEhBiABIAZBsBBsakEEaiEBIAEoAgAhBiAJKAIAIQEgAyAGSA0ACwsgACABEBILIAUgAkEYbGpBFGohASABKAIAIQEgACABEBIgAkEBaiECIAQoAgAhASACIAFODQMgBygCACEFDAAACwALCwsgAEHwAGohAyADKAIAIQEgAQRAIABB7ABqIQUgBSgCACECIAJBAEoEQEEAIQIDQAJAIAEgAkGwEGxqQQhqIQQgBCgCACEEIAAgBBASIAEgAkGwEGxqQRxqIQQgBCgCACEEIAAgBBASIAEgAkGwEGxqQSBqIQQgBCgCACEEIAAgBBASIAEgAkGwEGxqQaQQaiEEIAQoAgAhBCAAIAQQEiABIAJBsBBsakGoEGohASABKAIAIQEgAUUhBCABQXxqIQFBACABIAQbIQEgACABEBIgAkEBaiECIAUoAgAhASACIAFODQAgAygCACEBDAELCyADKAIAIQELIAAgARASCyAAQfgBaiEBIAEoAgAhASAAIAEQEiAHKAIAIQEgACABEBIgAEGIA2ohAyADKAIAIQEgAQRAIABBhANqIQUgBSgCACECIAJBAEoEQEEAIQIDQCABIAJBKGxqQQRqIQEgASgCACEBIAAgARASIAJBAWohAiAFKAIAIQcgAygCACEBIAIgB0gNAAsLIAAgARASCyAAQQRqIQIgAigCACEBIAFBAEoEQEEAIQEDQCAAQZQGaiABQQJ0aiEDIAMoAgAhAyAAIAMQEiAAQZQHaiABQQJ0aiEDIAMoAgAhAyAAIAMQEiAAQdgHaiABQQJ0aiEDIAMoAgAhAyAAIAMQEiABQQFqIQEgAigCACEDIAEgA0ghAyABQRBJIQUgBSADcQ0ACwtBACEBA0AgAEGgCGogAUECdGohAiACKAIAIQIgACACEBIgAEGoCGogAUECdGohAiACKAIAIQIgACACEBIgAEGwCGogAUECdGohAiACKAIAIQIgACACEBIgAEG4CGogAUECdGohAiACKAIAIQIgACACEBIgAEHACGogAUECdGohAiACKAIAIQIgACACEBIgAUEBaiEBIAFBAkcNAAsLGwAgAEHEAGohACAAKAIAIQAgAEUEQCABEF8LC3wBAX8gAEHUB2ohASABQQA2AgAgAEGAC2ohASABQQA2AgAgAEH4CmohASABQQA2AgAgAEGcCGohASABQQA2AgAgAEHVCmohASABQQA6AAAgAEH8CmohASABQQA2AgAgAEHUC2ohASABQQA2AgAgAEHYC2ohACAAQQA2AgAL8AQBB38jBiELIwZBEGokBiALQQhqIQcgC0EEaiEKIAshCCAAQSRqIQYgBiwAACEGAn8gBgR/IABBgAtqIQYgBigCACEGIAZBf0oEQCAFQQA2AgAgACABIAIQFgwCCyAAQRRqIQYgBiABNgIAIAEgAmohAiAAQRxqIQkgCSACNgIAIABB2ABqIQIgAkEANgIAIABBABAXIQkgCUUEQCAFQQA2AgBBAAwCCyAAIAcgCCAKEBghCSAJBEAgBygCACECIAgoAgAhCSAKKAIAIQggACACIAkgCBAaIQogByAKNgIAIABBBGohAiACKAIAIQggCEEASgRAQQAhAgNAIABBlAZqIAJBAnRqIQcgBygCACEHIAcgCUECdGohByAAQdQGaiACQQJ0aiEMIAwgBzYCACACQQFqIQIgAiAISA0ACwsgAwRAIAMgCDYCAAsgBSAKNgIAIABB1AZqIQAgBCAANgIAIAYoAgAhACAAIAFrDAILAkACQAJAAkACQCACKAIAIgNBIGsOBAECAgACCyACQQA2AgAgAEHUAGohAiAAEBkhAwJAIANBf0cEQANAIAIoAgAhAyADDQIgABAZIQMgA0F/Rw0ACwsLIAVBADYCACAGKAIAIQAgACABawwFCwwBCwwBCyAAQdQHaiEEIAQoAgAhBCAERQRAIAJBADYCACAAQdQAaiECIAAQGSEDAkAgA0F/RwRAA0AgAigCACEDIAMNAiAAEBkhAyADQX9HDQALCwsgBUEANgIAIAYoAgAhACAAIAFrDAMLCyAAEBMgAiADNgIAIAVBADYCAEEBBSAAQQIQFUEACwshACALJAYgAAsJACAAIAE2AlgLpgoBDH8gAEGAC2ohCiAKKAIAIQYCQAJAAkAgBkEATA0AA0AgACAEQRRsakGQC2ohAyADQQA2AgAgBEEBaiEEIAQgBkgNAAsgBkEESA0ADAELIAJBBEgEQEEAIQIFIAJBfWohBkEAIQIDQAJAIAEgAmohBCAELAAAIQMgA0HPAEYEQCAEQcATQQQQZCEEIARFBEAgAkEaaiEJIAkgBk4NAiACQRtqIQcgASAJaiELIAssAAAhAyADQf8BcSEFIAcgBWohBCAEIAZODQIgBUEbaiEEIAMEQEEAIQMDQCADIAdqIQggASAIaiEIIAgtAAAhCCAIQf8BcSEIIAQgCGohBCADQQFqIQMgAyAFRw0ACyAEIQMFIAQhAwtBACEEQQAhBQNAIAUgAmohByABIAdqIQcgBywAACEHIAQgBxApIQQgBUEBaiEFIAVBFkcNAAtBFiEFA0AgBEEAECkhBCAFQQFqIQUgBUEaRw0ACyAKKAIAIQUgBUEBaiEHIAogBzYCACADQWZqIQMgACAFQRRsakGIC2ohCCAIIAM2AgAgACAFQRRsakGMC2ohAyADIAQ2AgAgAkEWaiEEIAEgBGohBCAELQAAIQQgBEH/AXEhBCACQRdqIQMgASADaiEDIAMtAAAhAyADQf8BcSEDIANBCHQhAyADIARyIQQgAkEYaiEDIAEgA2ohAyADLQAAIQMgA0H/AXEhAyADQRB0IQMgBCADciEEIAJBGWohAyABIANqIQMgAy0AACEDIANB/wFxIQMgA0EYdCEDIAQgA3IhBCAAQYQLaiAFQRRsaiEDIAMgBDYCACALLQAAIQQgBEH/AXEhBCAJIARqIQQgASAEaiEEIAQsAAAhBCAEQX9GBH9BfwUgAkEGaiEEIAEgBGohBCAELQAAIQQgBEH/AXEhBCACQQdqIQMgASADaiEDIAMtAAAhAyADQf8BcSEDIANBCHQhAyADIARyIQQgAkEIaiEDIAEgA2ohAyADLQAAIQMgA0H/AXEhAyADQRB0IQMgBCADciEEIAJBCWohAyABIANqIQMgAy0AACEDIANB/wFxIQMgA0EYdCEDIAQgA3ILIQQgACAFQRRsakGUC2ohAyADIAQ2AgAgACAFQRRsakGQC2ohBCAEIAk2AgAgB0EERgRAIAYhAgwDCwsLIAJBAWohAiACIAZIDQEgBiECCwsgCigCACEGIAZBAEoNAQsMAQsgAiEEIAYhAkEAIQYDQAJAIABBhAtqIAZBFGxqIQkgACAGQRRsakGQC2ohAyADKAIAIQsgACAGQRRsakGIC2ohDSANKAIAIQggBCALayEDIAggA0ohBSADIAggBRshByAAIAZBFGxqQYwLaiEOIA4oAgAhAyAHQQBKBEBBACEFA0AgBSALaiEMIAEgDGohDCAMLAAAIQwgAyAMECkhAyAFQQFqIQUgBSAHSA0ACwsgCCAHayEFIA0gBTYCACAOIAM2AgAgBQRAIAZBAWohBgUgCSgCACEFIAMgBUYNASACQX9qIQIgCiACNgIAIAkgAEGEC2ogAkEUbGoiAikCADcCACAJIAIpAgg3AgggCSACKAIQNgIQIAooAgAhAgsgBiACSA0BIAQhAgwCCwsgByALaiECIApBfzYCACAAQdQHaiEBIAFBADYCACAAQdgKaiEBIAFBfzYCACAAIAZBFGxqQZQLaiEBIAEoAgAhASAAQZgIaiEEIAQgATYCACABQX9HIQEgAEGcCGohACAAIAE2AgALIAILhgUBCH8gAEHYCmohAiACKAIAIQMgAEEUaiECIAIoAgAhAgJ/AkAgA0F/RgR/QQEhAwwBBSAAQdAIaiEEIAQoAgAhBQJAIAMgBUgEQANAIABB1AhqIANqIQQgBCwAACEGIAZB/wFxIQQgAiAEaiECIAZBf0cNAiADQQFqIQMgAyAFSA0ACwsLIAFBAEchBiAFQX9qIQQgAyAESCEEIAYgBHEEQCAAQRUQFUEADAMLIABBHGohBCAEKAIAIQQgAiAESwR/IABBARAVQQAFIAMgBUYhBCADQX9GIQMgBCADcgR/QQAhAwwDBUEBCwsLDAELIAAoAhwhCCAAQdQHaiEGIAFBAEchBCACIQECQAJAAkACQAJAAkACQAJAAkADQCABQRpqIQUgBSAITw0BIAFBwBNBBBBkIQIgAg0CIAFBBGohAiACLAAAIQIgAg0DIAMEQCAGKAIAIQIgAgRAIAFBBWohAiACLAAAIQIgAkEBcSECIAINBgsFIAFBBWohAiACLAAAIQIgAkEBcSECIAJFDQYLIAUsAAAhAiACQf8BcSEHIAFBG2ohCSAJIAdqIQEgASAISw0GAkAgAgRAQQAhAgNAIAkgAmohAyADLAAAIQUgBUH/AXEhAyABIANqIQEgBUF/Rw0CIAJBAWohAiACIAdJDQALBUEAIQILCyAHQX9qIQMgAiADSCEDIAQgA3ENByABIAhLDQhBASACIAdHDQoaQQAhAwwAAAsACyAAQQEQFUEADAgLIABBFRAVQQAMBwsgAEEVEBVBAAwGCyAAQRUQFUEADAULIABBFRAVQQAMBAsgAEEBEBVBAAwDCyAAQRUQFUEADAILIABBARAVC0EACyEAIAALewEFfyMGIQUjBkEQaiQGIAVBCGohBiAFQQRqIQQgBSEHIAAgAiAEIAMgBSAGECohBCAEBH8gBigCACEEIABBkANqIARBBmxqIQggAigCACEGIAMoAgAhBCAHKAIAIQMgACABIAggBiAEIAMgAhArBUEACyEAIAUkBiAACxsBAX8gABAuIQEgAEHoCmohACAAQQA2AgAgAQv5AwIMfwN9IABB1AdqIQkgCSgCACEGIAYEfyAAIAYQSCELIABBBGohBCAEKAIAIQogCkEASgRAIAZBAEohDCAGQX9qIQ0DQCAMBEAgAEGUBmogBUECdGooAgAhDiAAQZQHaiAFQQJ0aigCACEPQQAhBANAIAQgAmohByAOIAdBAnRqIQcgByoCACEQIAsgBEECdGohCCAIKgIAIREgECARlCEQIA8gBEECdGohCCAIKgIAIREgDSAEayEIIAsgCEECdGohCCAIKgIAIRIgESASlCERIBAgEZIhECAHIBA4AgAgBEEBaiEEIAQgBkcNAAsLIAVBAWohBSAFIApIDQALCyAJKAIABSAAQQRqIQQgBCgCACEKQQALIQsgASADayEHIAkgBzYCACAKQQBKBEAgASADSiEJQQAhBQNAIAkEQCAAQZQGaiAFQQJ0aigCACEMIABBlAdqIAVBAnRqKAIAIQ1BACEGIAMhBANAIAwgBEECdGohBCAEKAIAIQQgDSAGQQJ0aiEOIA4gBDYCACAGQQFqIQYgBiADaiEEIAYgB0cNAAsLIAVBAWohBSAFIApIDQALCyALRSEEIAEgA0ghBSABIAMgBRshASABIAJrIQEgAEH8CmohACAEBEBBACEBBSAAKAIAIQIgAiABaiECIAAgAjYCAAsgAQvRAQECfyMGIQYjBkHgC2okBiAGIQUgBSAEEBwgBUEUaiEEIAQgADYCACAAIAFqIQEgBUEcaiEEIAQgATYCACAFQSRqIQEgAUEBOgAAIAUQHSEBIAEEQCAFEB4hASABBEAgASAFQdwLEHkaIAFBFGohBCAEKAIAIQQgBCAAayEAIAIgADYCACADQQA2AgAFIAUQEUEAIQELBSAFQdQAaiEAIAAoAgAhACAARSEAIAVB2ABqIQEgASgCACEBIAMgAUEBIAAbNgIAQQAhAQsgBiQGIAELrQECAX8BfiAAQQBB3AsQehogAQRAIABBxABqIQIgASkCACEDIAIgAzcCACAAQcgAaiECIANCIIghAyADpyEBIAFBA2ohASABQXxxIQEgAiABNgIAIABB0ABqIQIgAiABNgIACyAAQdQAaiEBIAFBADYCACAAQdgAaiEBIAFBADYCACAAQRRqIQEgAUEANgIAIABB8ABqIQEgAUEANgIAIABBgAtqIQAgAEF/NgIAC9BNAiN/A30jBiEZIwZBgAhqJAYgGUHwB2ohAiAZIgxB7AdqIR0gDEHoB2ohHiAAEDEhAQJ/IAEEQCAAQdMKaiEBIAEtAAAhASABQf8BcSEBIAFBAnEhAyADRQRAIABBIhAVQQAMAgsgAUEEcSEDIAMEQCAAQSIQFUEADAILIAFBAXEhASABBEAgAEEiEBVBAAwCCyAAQdAIaiEBIAEoAgAhASABQQFHBEAgAEEiEBVBAAwCCyAAQdQIaiEBAkACQCABLAAAQR5rIgEEQCABQSJGBEAMAgUMAwsACyAAEDAhASABQf8BcUEBRwRAIABBIhAVQQAMBAsgACACQQYQIiEBIAFFBEAgAEEKEBVBAAwECyACEEkhASABRQRAIABBIhAVQQAMBAsgABAjIQEgAQRAIABBIhAVQQAMBAsgABAwIQEgAUH/AXEhAyAAQQRqIRMgEyADNgIAIAFB/wFxRQRAIABBIhAVQQAMBAsgAUH/AXFBEEoEQCAAQQUQFUEADAQLIAAQIyEBIAAgATYCACABRQRAIABBIhAVQQAMBAsgABAjGiAAECMaIAAQIxogABAwIQMgA0H/AXEhBCAEQQ9xIQEgBEEEdiEEQQEgAXQhBSAAQeQAaiEaIBogBTYCAEEBIAR0IQUgAEHoAGohFCAUIAU2AgAgAUF6aiEFIAVBB0sEQCAAQRQQFUEADAQLIANBoH9qQRh0QRh1IQMgA0EASARAIABBFBAVQQAMBAsgASAESwRAIABBFBAVQQAMBAsgABAwIQEgAUEBcSEBIAFFBEAgAEEiEBVBAAwECyAAEDEhAUEAIAFFDQMaIAAQSiEBQQAgAUUNAxogAEHUCmohAwNAIAAQLyEBIAAgARBLIANBADoAACABDQALIAAQSiEBQQAgAUUNAxogAEEkaiEBIAEsAAAhAQJAIAEEQCAAQQEQFyEBIAENASAAQdgAaiEAIAAoAgAhAUEAIAFBFUcNBRogAEEUNgIAQQAMBQsLEEwgABAZIQEgAUEFRwRAIABBFBAVQQAMBAtBACEBA0AgABAZIQMgA0H/AXEhAyACIAFqIQQgBCADOgAAIAFBAWohASABQQZHDQALIAIQSSEBIAFFBEAgAEEUEBVBAAwECyAAQQgQLCEBIAFBAWohASAAQewAaiENIA0gATYCACABQbAQbCEBIAAgARBNIQEgAEHwAGohFSAVIAE2AgAgAUUEQCAAQQMQFUEADAQLIA0oAgAhAiACQbAQbCECIAFBACACEHoaIA0oAgAhAQJAIAFBAEoEQCAAQRBqIRYDQAJAIBUoAgAhCiAKIAZBsBBsaiEJIABBCBAsIQEgAUH/AXEhASABQcIARwRAQT8hAQwBCyAAQQgQLCEBIAFB/wFxIQEgAUHDAEcEQEHBACEBDAELIABBCBAsIQEgAUH/AXEhASABQdYARwRAQcMAIQEMAQsgAEEIECwhASAAQQgQLCECIAJBCHQhAiABQf8BcSEBIAIgAXIhASAJIAE2AgAgAEEIECwhASAAQQgQLCECIABBCBAsIQMgA0EQdCEDIAJBCHQhAiACQYD+A3EhAiABQf8BcSEBIAIgAXIhASABIANyIQEgCiAGQbAQbGpBBGohDiAOIAE2AgAgAEEBECwhASABQQBHIgMEf0EABSAAQQEQLAshASABQf8BcSECIAogBkGwEGxqQRdqIREgESACOgAAIAkoAgAhBCAOKAIAIQEgBEUEQCABBH9ByAAhAQwCBUEACyEBCyACQf8BcQRAIAAgARA8IQIFIAAgARBNIQIgCiAGQbAQbGpBCGohASABIAI2AgALIAJFBEBBzQAhAQwBCwJAIAMEQCAAQQUQLCEDIA4oAgAhASABQQBMBEBBACEDDAILQQAhBANAIANBAWohBSABIARrIQEgARAtIQEgACABECwhASABIARqIQMgDigCACEPIAMgD0oEQEHTACEBDAQLIAIgBGohBCAFQf8BcSEPIAQgDyABEHoaIA4oAgAhASABIANKBH8gAyEEIAUhAwwBBUEACyEDCwUgDigCACEBIAFBAEwEQEEAIQMMAgtBACEDQQAhAQNAIBEsAAAhBAJAAkAgBEUNACAAQQEQLCEEIAQNACACIANqIQQgBEF/OgAADAELIABBBRAsIQQgBEEBaiEEIARB/wFxIQUgAiADaiEPIA8gBToAACABQQFqIQEgBEH/AXEhBCAEQSBGBEBB2gAhAQwFCwsgA0EBaiEDIA4oAgAhBCADIARIDQALIAEhAyAEIQELCyARLAAAIQQCfwJAIAQEfyABQQJ1IQQgAyAETgRAIBYoAgAhAyABIANKBEAgFiABNgIACyAAIAEQTSEBIAogBkGwEGxqQQhqIQMgAyABNgIAIAFFBEBB4QAhAQwFCyAOKAIAIQQgASACIAQQeRogDigCACEBIAAgAiABEE4gAygCACECIBFBADoAACAOKAIAIQQMAgsgCiAGQbAQbGpBrBBqIQQgBCADNgIAIAMEfyAAIAMQTSEBIAogBkGwEGxqQQhqIQMgAyABNgIAIAFFBEBB6wAhAQwFCyAEKAIAIQEgAUECdCEBIAAgARA8IQEgCiAGQbAQbGpBIGohAyADIAE2AgAgAUUEQEHtACEBDAULIAQoAgAhASABQQJ0IQEgACABEDwhBSAFRQRAQfAAIQEMBQsgDigCACEBIAQoAgAhDyAFIQcgBQVBACEPQQAhB0EACyEDIA9BA3QhBSAFIAFqIQUgFigCACEPIAUgD00EQCABIQUgBAwDCyAWIAU2AgAgASEFIAQFIAEhBAwBCwwBCyAEQQBKBEBBACEBQQAhAwNAIAIgA2ohBSAFLAAAIQUgBUH/AXFBCkohDyAFQX9HIQUgDyAFcSEFIAVBAXEhBSABIAVqIQEgA0EBaiEDIAMgBEgNAAsFQQAhAQsgCiAGQbAQbGpBrBBqIQ8gDyABNgIAIARBAnQhASAAIAEQTSEBIAogBkGwEGxqQSBqIQMgAyABNgIAIAFFBEBB6QAhAQwCC0EAIQMgDigCACEFQQAhByAPCyEBIAkgAiAFIAMQTyEEIARFBEBB9AAhAQwBCyABKAIAIQQgBARAIARBAnQhBCAEQQRqIQQgACAEEE0hBCAKIAZBsBBsakGkEGohBSAFIAQ2AgAgBEUEQEH5ACEBDAILIAEoAgAhBCAEQQJ0IQQgBEEEaiEEIAAgBBBNIQQgCiAGQbAQbGpBqBBqIQUgBSAENgIAIARFBEBB+wAhAQwCCyAEQQRqIQ8gBSAPNgIAIARBfzYCACAJIAIgAxBQCyARLAAAIQMgAwRAIAEoAgAhAyADQQJ0IQMgACAHIAMQTiAKIAZBsBBsakEgaiEDIAMoAgAhBCABKAIAIQUgBUECdCEFIAAgBCAFEE4gDigCACEEIAAgAiAEEE4gA0EANgIACyAJEFEgAEEEECwhAiACQf8BcSEDIAogBkGwEGxqQRVqIQUgBSADOgAAIAJB/wFxIQIgAkECSwRAQYABIQEMAQsgAgRAIABBIBAsIQIgAhBSISUgCiAGQbAQbGpBDGohDyAPICU4AgAgAEEgECwhAiACEFIhJSAKIAZBsBBsakEQaiEbIBsgJTgCACAAQQQQLCECIAJBAWohAiACQf8BcSECIAogBkGwEGxqQRRqIQQgBCACOgAAIABBARAsIQIgAkH/AXEhAiAKIAZBsBBsakEWaiEcIBwgAjoAACAFLAAAIQsgDigCACECIAkoAgAhAyALQQFGBH8gAiADEFMFIAMgAmwLIQIgCiAGQbAQbGpBGGohCyALIAI2AgAgAkUEQEGGASEBDAILIAJBAXQhAiAAIAIQPCEQIBBFBEBBiAEhAQwCCyALKAIAIQIgAkEASgRAQQAhAgNAIAQtAAAhAyADQf8BcSEDIAAgAxAsIQMgA0F/RgRAQYwBIQEMBAsgA0H//wNxIQMgECACQQF0aiEXIBcgAzsBACACQQFqIQIgCygCACEDIAIgA0gNAAsgAyECCyAFLAAAIQMCQCADQQFGBEAgESwAACEDIANBAEciFwRAIAEoAgAhAyADRQRAIAIhAQwDCwUgDigCACEDCyAKIAZBsBBsaiAAIANBAnQgCSgCAGwQTSIfNgIcIB9FBEBBkwEhAQwECyABIA4gFxshASABKAIAIQ4gDkEASgRAIAogBkGwEGxqQagQaiEgIAkoAgAiCkEASiEJQwAAAAAhJUEAIQEDQCAXBH8gICgCACECIAIgAUECdGohAiACKAIABSABCyEEIAkEQCALKAIAIRggHCwAAEUhISAKIAFsISJBACEDQQEhAgNAIAQgAm4hEiASIBhwIRIgECASQQF0aiESIBIvAQAhEiASQf//A3GyISQgGyoCACEmICYgJJQhJCAPKgIAISYgJCAmkiEkICUgJJIhJCAiIANqIRIgHyASQQJ0aiESIBIgJDgCACAlICQgIRshJSADQQFqIQMgAyAKSCISBEBBfyAYbiEjIAIgI0sEQEGeASEBDAkLIBggAmwhAgsgEg0ACwsgAUEBaiEBIAEgDkgNAAsLIAVBAjoAACALKAIAIQEFIAJBAnQhASAAIAEQTSECIAogBkGwEGxqQRxqIQEgASACNgIAIAsoAgAhCCACRQRAQaUBIQEMBAsgCEEATARAIAghAQwCCyAcLAAARSEDQwAAAAAhJUEAIQEDQCAQIAFBAXRqIQQgBC8BACEEIARB//8DcbIhJCAbKgIAISYgJiAklCEkIA8qAgAhJiAkICaSISQgJSAkkiEkIAIgAUECdGohBCAEICQ4AgAgJSAkIAMbISUgAUEBaiEBIAEgCEgNAAsgCCEBCwsgAUEBdCEBIAAgECABEE4LIAZBAWohBiANKAIAIQEgBiABSA0BDAMLCwJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkAgAUE/aw5nABYBFgIWFhYWAxYWFhYEFhYWFhYFFhYWFhYWBhYWFhYWFgcWFhYWFhYWCBYJFgoWFgsWFhYMFhYWFg0WDhYWFhYPFhYWFhYQFhEWFhYSFhYWFhYWExYWFhYWFhYWFhYUFhYWFhYWFRYLIABBFBAVQQAMGwsgAEEUEBVBAAwaCyAAQRQQFUEADBkLIABBFBAVQQAMGAsgAEEDEBVBAAwXCyAAQRQQFUEADBYLIABBFBAVQQAMFQsgAEEDEBVBAAwUCyAAQQMQFUEADBMLIABBAxAVQQAMEgsgAEEDEBVBAAwRCyAAQQMQFUEADBALIBEsAAAhASABBEAgACAHQQAQTgsgAEEUEBVBAAwPCyAAQQMQFUEADA4LIABBAxAVQQAMDQsgAEEUEBVBAAwMCyAAQRQQFUEADAsLIABBAxAVQQAMCgsgCygCACEBIAFBAXQhASAAIBAgARBOIABBFBAVQQAMCQsgCygCACEBIAFBAXQhASAAIBAgARBOIABBAxAVQQAMCAsgGEEBdCEBIAAgECABEE4gAEEUEBVBAAwHCyAIQQF0IQEgACAQIAEQTiAAQQMQFUEADAYLCwsgAEEGECwhASABQQFqIQEgAUH/AXEhAgJAIAIEQEEAIQEDQAJAIABBEBAsIQMgA0UhAyADRQ0AIAFBAWohASABIAJJDQEMAwsLIABBFBAVQQAMBQsLIABBBhAsIQEgAUEBaiEBIABB9ABqIQ8gDyABNgIAIAFBvAxsIQEgACABEE0hASAAQfgBaiEOIA4gATYCACABRQRAIABBAxAVQQAMBAsgDygCACEBAn8gAUEASgR/QQAhBEEAIQcCQAJAAkACQAJAAkADQCAAQRAQLCEBIAFB//8DcSECIABB+ABqIAdBAXRqIQMgAyACOwEAIAFB//8DcSEBIAFBAUsNASABRQ0CIA4oAgAhBSAAQQUQLCEBIAFB/wFxIQIgBSAHQbwMbGohCiAKIAI6AAAgAUH/AXEhASABBEBBfyEBQQAhAgNAIABBBBAsIQMgA0H/AXEhCCAFIAdBvAxsakEBaiACaiEGIAYgCDoAACADQf8BcSEDIAMgAUohCCADIAEgCBshAyACQQFqIQIgCi0AACEBIAFB/wFxIQEgAiABSQRAIAMhAQwBCwtBACEBA0AgAEEDECwhAiACQQFqIQIgAkH/AXEhAiAFIAdBvAxsakEhaiABaiEIIAggAjoAACAAQQIQLCECIAJB/wFxIQIgBSAHQbwMbGpBMWogAWohCCAIIAI6AAACQAJAIAJB/wFxRQ0AIABBCBAsIQIgAkH/AXEhBiAFIAdBvAxsakHBAGogAWohECAQIAY6AAAgAkH/AXEhAiANKAIAIQYgAiAGTg0HIAgsAAAhAiACQR9HDQAMAQtBACECA0AgAEEIECwhBiAGQf//A2ohBiAGQf//A3EhECAFIAdBvAxsakHSAGogAUEEdGogAkEBdGohCSAJIBA7AQAgBkEQdCEGIAZBEHUhBiANKAIAIRAgBiAQSCEGIAZFDQggAkEBaiECIAgtAAAhBiAGQf8BcSEGQQEgBnQhBiACIAZIDQALCyABQQFqIQIgASADSARAIAIhAQwBCwsLIABBAhAsIQEgAUEBaiEBIAFB/wFxIQEgBSAHQbwMbGpBtAxqIQIgAiABOgAAIABBBBAsIQEgAUH/AXEhAiAFIAdBvAxsakG1DGohECAQIAI6AAAgBSAHQbwMbGpB0gJqIQkgCUEAOwEAIAFB/wFxIQFBASABdCEBIAFB//8DcSEBIAUgB0G8DGxqQdQCaiECIAIgATsBACAFIAdBvAxsakG4DGohBiAGQQI2AgAgCiwAACEBAkACQCABBEBBACEIQQIhAwNAIAUgB0G8DGxqQQFqIAhqIQIgAi0AACECIAJB/wFxIQIgBSAHQbwMbGpBIWogAmohAiACLAAAIQsgCwRAQQAhAQNAIBAtAAAhAyADQf8BcSEDIAAgAxAsIQMgA0H//wNxIQsgBigCACEDIAUgB0G8DGxqQdICaiADQQF0aiERIBEgCzsBACADQQFqIQMgBiADNgIAIAFBAWohASACLQAAIQsgC0H/AXEhCyABIAtJDQALIAosAAAhAgUgASECCyADIQEgCEEBaiEIIAJB/wFxIQMgCCADSQRAIAEhAyACIQEMAQsLIAFBAEoNAQVBAiEBDAELDAELQQAhAgNAIAUgB0G8DGxqQdICaiACQQF0aiEDIAMuAQAhAyAMIAJBAnRqIQggCCADOwEAIAJB//8DcSEDIAwgAkECdGpBAmohCCAIIAM7AQAgAkEBaiECIAIgAUgNAAsLIAwgAUEEQQEQZiAGKAIAIQECQCABQQBKBEBBACEBA0AgDCABQQJ0akECaiECIAIuAQAhAiACQf8BcSECIAUgB0G8DGxqQcYGaiABaiEDIAMgAjoAACABQQFqIQEgBigCACECIAEgAkgNAAsgAkECTARAIAIhAQwCC0ECIQEDQCAJIAEgHSAeEFUgHSgCACECIAJB/wFxIQIgBSAHQbwMbGpBwAhqIAFBAXRqIQMgAyACOgAAIB4oAgAhAiACQf8BcSECIAUgB0G8DGxqIAFBAXRqQcEIaiEDIAMgAjoAACABQQFqIQEgBigCACECIAEgAkgNAAsgAiEBCwsgASAESiECIAEgBCACGyEEIAdBAWohByAPKAIAIQEgByABSA0ADAUACwALIABBFBAVQQAMCgsgDigCACEBIABBCBAsIQIgAkH/AXEhAiABIAdBvAxsaiEDIAMgAjoAACAAQRAQLCECIAJB//8DcSECIAEgB0G8DGxqQQJqIQMgAyACOwEAIABBEBAsIQIgAkH//wNxIQIgASAHQbwMbGpBBGohAyADIAI7AQAgAEEGECwhAiACQf8BcSECIAEgB0G8DGxqQQZqIQMgAyACOgAAIABBCBAsIQIgAkH/AXEhAiABIAdBvAxsakEHaiEDIAMgAjoAACAAQQQQLCECIAJBAWohAiACQf8BcSEEIAEgB0G8DGxqQQhqIQMgAyAEOgAAIAJB/wFxIQIgAgRAIAEgB0G8DGxqQQlqIQJBACEBA0AgAEEIECwhByAHQf8BcSEHIAIgAWohBCAEIAc6AAAgAUEBaiEBIAMtAAAhByAHQf8BcSEHIAEgB0kNAAsLIABBBBAVQQAMCQsgAEEUEBUMAgsgAEEUEBUMAQsgBEEBdAwCC0EADAUFQQALCyEQIABBBhAsIQEgAUEBaiEBIABB/AFqIQUgBSABNgIAIAFBGGwhASAAIAEQTSEBIABBgANqIQ4gDiABNgIAIAFFBEAgAEEDEBVBAAwECyAFKAIAIQIgAkEYbCECIAFBACACEHoaIAUoAgAhAQJAIAFBAEoEQEEAIQcCQAJAAkACQAJAAkACQAJAA0AgDigCACEEIABBEBAsIQEgAUH//wNxIQIgAEGAAmogB0EBdGohAyADIAI7AQAgAUH//wNxIQEgAUECSw0BIABBGBAsIQIgBCAHQRhsaiEBIAEgAjYCACAAQRgQLCECIAQgB0EYbGpBBGohAyADIAI2AgAgASgCACEBIAIgAUkNAiAAQRgQLCEBIAFBAWohASAEIAdBGGxqQQhqIQIgAiABNgIAIABBBhAsIQEgAUEBaiEBIAFB/wFxIQEgBCAHQRhsakEMaiEIIAggAToAACAAQQgQLCEBIAFB/wFxIQIgBCAHQRhsakENaiEGIAYgAjoAACABQf8BcSEBIA0oAgAhAiABIAJODQMgCCwAACEBIAEEf0EAIQEDQCAAQQMQLCEDIABBARAsIQIgAgR/IABBBRAsBUEACyECIAJBA3QhAiACIANqIQIgAkH/AXEhAiAMIAFqIQMgAyACOgAAIAFBAWohASAILQAAIQIgAkH/AXEhAyABIANJDQALIAJB/wFxBUEACyEBIAFBBHQhASAAIAEQTSEBIAQgB0EYbGpBFGohCiAKIAE2AgAgAUUNBCAILAAAIQIgAgRAQQAhAgNAIAwgAmotAAAhC0EAIQMDQEEBIAN0IQkgCSALcSEJIAkEQCAAQQgQLCEJIAlB//8DcSERIAooAgAhASABIAJBBHRqIANBAXRqIRYgFiAROwEAIAlBEHQhCSAJQRB1IQkgDSgCACERIBEgCUwNCQUgASACQQR0aiADQQF0aiEJIAlBfzsBAAsgA0EBaiEDIANBCEkNAAsgAkEBaiECIAgtAAAhAyADQf8BcSEDIAIgA0kNAAsLIBUoAgAhASAGLQAAIQIgAkH/AXEhAiABIAJBsBBsakEEaiEBIAEoAgAhASABQQJ0IQEgACABEE0hASAEIAdBGGxqQRBqIQogCiABNgIAIAFFDQYgFSgCACECIAYtAAAhAyADQf8BcSEDIAIgA0GwEGxqQQRqIQIgAigCACECIAJBAnQhAiABQQAgAhB6GiAVKAIAIQIgBi0AACEBIAFB/wFxIQMgAiADQbAQbGpBBGohASABKAIAIQEgAUEASgRAQQAhAQNAIAIgA0GwEGxqIQIgAigCACEDIAAgAxBNIQIgCigCACEEIAQgAUECdGohBCAEIAI2AgAgCigCACECIAIgAUECdGohAiACKAIAIQQgBEUNCQJAIANBAEoEQCAILQAAIQkgA0F/aiECIAlB/wFxIQkgASAJcCEJIAlB/wFxIQkgBCACaiEEIAQgCToAACADQQFGDQEgASEDA0AgCC0AACEJIAlB/wFxIQQgAyAEbSEDIAooAgAgAUECdGohBCAEKAIAIQsgAkF/aiEEIAlB/wFxIQkgAyAJbyEJIAlB/wFxIQkgCyAEaiELIAsgCToAACACQQFKBEAgBCECDAELCwsLIAFBAWohASAVKAIAIQIgBi0AACEDIANB/wFxIQMgAiADQbAQbGpBBGohBCAEKAIAIQQgASAESA0ACwsgB0EBaiEHIAUoAgAhASAHIAFIDQAMCgALAAsgAEEUEBUMBgsgAEEUEBUMBQsgAEEUEBUMBAsgAEEDEBUMAwsgAEEUEBUMAgsgAEEDEBUMAQsgAEEDEBULQQAMBQsLIABBBhAsIQEgAUEBaiEBIABBhANqIQcgByABNgIAIAFBKGwhASAAIAEQTSEBIABBiANqIQogCiABNgIAIAFFBEAgAEEDEBVBAAwECyAHKAIAIQIgAkEobCECIAFBACACEHoaIAcoAgAhAQJAIAFBAEoEQEEAIQECQAJAAkACQAJAAkACQAJAAkACQANAIAooAgAhBCAEIAFBKGxqIQwgAEEQECwhAiACDQEgEygCACECIAJBA2whAiAAIAIQTSECIAQgAUEobGpBBGohCCAIIAI2AgAgAkUNAiAAQQEQLCECIAIEfyAAQQQQLCECIAJBAWohAiACQf8BcQVBAQshAiAEIAFBKGxqQQhqIQYgBiACOgAAIABBARAsIQICQCACBEAgAEEIECwhAiACQQFqIQIgAkH//wNxIQMgDCADOwEAIAJB//8DcSECIAJFDQFBACECIBMoAgAhAwNAIANBf2ohAyADEC0hAyAAIAMQLCEDIANB/wFxIQMgCCgCACENIA0gAkEDbGohDSANIAM6AAAgEygCACEDIANBf2ohAyADEC0hAyAAIAMQLCENIA1B/wFxIQkgCCgCACEDIAMgAkEDbGpBAWohCyALIAk6AAAgAyACQQNsaiEDIAMsAAAhCyALQf8BcSERIBMoAgAhAyADIBFMDQYgDUH/AXEhDSADIA1MDQcgCyAJQRh0QRh1RiENIA0NCCACQQFqIQIgDC8BACENIA1B//8DcSENIAIgDUkNAAsFIAxBADsBAAsLIABBAhAsIQIgAg0GIAYsAAAhAyATKAIAIgxBAEohAgJAAkAgA0H/AXFBAUoEQCACRQ0BQQAhAgNAIABBBBAsIQMgA0H/AXEhAyAIKAIAIQwgDCACQQNsakECaiEMIAwgAzoAACAGLQAAIQwgDEH/AXEgA0ohAyADRQ0LIAJBAWohAiATKAIAIQMgAiADSA0ACwwBBSACBEAgCCgCACEIQQAhAgNAIAggAkEDbGpBAmohDSANQQA6AAAgAkEBaiECIAIgDEgNAAsLIAMNAQsMAQtBACECA0AgAEEIECwaIABBCBAsIQMgA0H/AXEhCCAEIAFBKGxqQQlqIAJqIQMgAyAIOgAAIABBCBAsIQggCEH/AXEhDCAEIAFBKGxqQRhqIAJqIQ0gDSAMOgAAIAMtAAAhAyADQf8BcSEDIA8oAgAhDCAMIANMDQogCEH/AXEhAyAFKAIAIQggAyAISCEDIANFDQsgAkEBaiECIAYtAAAhAyADQf8BcSEDIAIgA0kNAAsLIAFBAWohASAHKAIAIQIgASACSA0ADAwACwALIABBFBAVQQAMDgsgAEEDEBVBAAwNCyAAQRQQFUEADAwLIABBFBAVQQAMCwsgAEEUEBVBAAwKCyAAQRQQFUEADAkLIABBFBAVQQAMCAsgAEEUEBVBAAwHCyAAQRQQFUEADAYACwALCyAAQQYQLCEBIAFBAWohASAAQYwDaiECIAIgATYCAAJAIAFBAEoEQEEAIQECQAJAAkACQANAIABBARAsIQMgA0H/AXEhAyAAQZADaiABQQZsaiEEIAQgAzoAACAAQRAQLCEDIANB//8DcSEEIAAgAUEGbGpBkgNqIQMgAyAEOwEAIABBEBAsIQQgBEH//wNxIQggACABQQZsakGUA2ohBCAEIAg7AQAgAEEIECwhCCAIQf8BcSEGIAAgAUEGbGpBkQNqIQwgDCAGOgAAIAMuAQAhAyADDQEgBC4BACEDIAMNAiAIQf8BcSEDIAcoAgAhBCADIARIIQMgA0UNAyABQQFqIQEgAigCACEDIAEgA0gNAAwGAAsACyAAQRQQFUEADAgLIABBFBAVQQAMBwsgAEEUEBVBAAwGAAsACwsgABAhIABB1AdqIQEgAUEANgIAIBMoAgAhAQJAIAFBAEoEQEEAIQEDQAJAIBQoAgAhAiACQQJ0IQIgACACEE0hAyAAQZQGaiABQQJ0aiECIAIgAzYCACAUKAIAIQMgA0EBdCEDIANB/v///wdxIQMgACADEE0hByAAQZQHaiABQQJ0aiEDIAMgBzYCACAAIBAQTSEHIABB2AdqIAFBAnRqIQQgBCAHNgIAIAIoAgAhAiACRQ0AIAMoAgAhAyADRSEDIAdFIQcgByADcg0AIBQoAgAhAyADQQJ0IQMgAkEAIAMQehogAUEBaiEBIBMoAgAhAiABIAJIDQEMAwsLIABBAxAVQQAMBQsLIBooAgAhASAAQQAgARBWIQFBACABRQ0DGiAUKAIAIQEgAEEBIAEQViEBQQAgAUUNAxogGigCACEBIABB3ABqIQIgAiABNgIAIBQoAgAhASAAQeAAaiECIAIgATYCACABQQF0IQIgAkH+////B3EhBCAFKAIAIQggCEEASgR/IA4oAgAhByABQQJtIQNBACECQQAhAQNAIAcgAUEYbGohBSAFKAIAIQUgBSADSSEGIAUgAyAGGyEGIAcgAUEYbGpBBGohBSAFKAIAIQUgBSADSSEMIAUgAyAMGyEFIAUgBmshBSAHIAFBGGxqQQhqIQYgBigCACEGIAUgBm4hBSAFIAJKIQYgBSACIAYbIQIgAUEBaiEBIAEgCEgNAAsgAkECdCEBIAFBBGoFQQQLIQEgEygCACECIAIgAWwhASAAQQxqIQIgBCABSyEDIAIgBCABIAMbIgI2AgAgAEHVCmohASABQQE6AAAgAEHEAGohASABKAIAIQECQCABBEAgAEHQAGohASABKAIAIQEgAEHIAGohAyADKAIAIQMgASADRwRAQcwWQcQTQaAgQYQXEAQLIABBzABqIQMgAygCACEDIAJB3AtqIQIgAiADaiECIAIgAU0NASAAQQMQFUEADAULCyAAEB8hASAAQShqIQAgACABNgIAQQEMAwsgACACQQYQIiEBIAFBAEchASACLAAAIQMgA0HmAEYhAyABIANxBEAgAkEBaiEBIAEsAAAhASABQekARgRAIAJBAmohASABLAAAIQEgAUHzAEYEQCACQQNqIQEgASwAACEBIAFB6ABGBEAgAkEEaiEBIAEsAAAhASABQeUARgRAIAJBBWohASABLAAAIQEgAUHhAEYEQCAAEDAhASABQf8BcUHkAEYEQCAAEDAhASABQf8BcUUEQCAAQSYQFUEADAoLCwsLCwsLCwsgAEEiEBULQQALIQAgGSQGIAALDwEBfyAAQdwLEE0hASABCz8BAX8gAEEkaiEBIAEsAAAhASABBH9BAAUgAEEUaiEBIAEoAgAhASAAQRhqIQAgACgCACEAIAEgAGsLIQAgAAuBAgECfyAAQdgKaiEBIAEoAgAhAQJ/AkAgAUF/Rw0AIAAQMCEBIABB1ABqIQIgAigCACECIAIEf0EABSABQf8BcUHPAEcEQCAAQR4QFUEADAMLIAAQMCEBIAFB/wFxQecARwRAIABBHhAVQQAMAwsgABAwIQEgAUH/AXFB5wBHBEAgAEEeEBVBAAwDCyAAEDAhASABQf8BcUHTAEcEQCAAQR4QFUEADAMLIAAQMyEBIAEEQCAAQdMKaiEBIAEsAAAhASABQQFxIQEgAUUNAiAAQdwKaiEBIAFBADYCACAAQdQKaiEBIAFBADoAACAAQSAQFQtBAAsMAQsgABBKCyEAIAALFAEBfwNAIAAQLiEBIAFBf0cNAAsLZQEEfyAAQRRqIQMgAygCACEFIAUgAmohBiAAQRxqIQQgBCgCACEEIAYgBEsEfyAAQdQAaiEAIABBATYCAEEABSABIAUgAhB5GiADKAIAIQAgACACaiEAIAMgADYCAEEBCyEAIAALaAECfyAAEDAhAiACQf8BcSECIAAQMCEBIAFB/wFxIQEgAUEIdCEBIAEgAnIhAiAAEDAhASABQf8BcSEBIAFBEHQhASACIAFyIQIgABAwIQAgAEH/AXEhACAAQRh0IQAgAiAAciEAIAALEwEBf0EEEF4hACAAQQA2AgAgAAsTAQF/IAAoAgAhASABEBAgABBfCyEAIAAoAgAhACAABH8gAEEEaiEAIAAoAgAFQQALIQAgAAsaACAAKAIAIQAgAAR/IAAoAgAFQQALIQAgAAvbBwISfwF9IwYhECMGQRBqJAYgEEEEaiELIBAhDCAEQQA2AgAgACgCACEGAkACQCAGDQBBICEFA0ACQCALQQA2AgAgDEEANgIAIAUgAkohBiACIAUgBhshBiABIAYgCyAMQQAQGyEKIAAgCjYCAAJAAkACQAJAIAwoAgAOAgEAAgsgAiAFTCEHIAdBAXMhBSAFQQFxIQUgBiAFdCEFQQFBAiAHGyEGIAYhCUEAIAggBxshCCAFIQYMAgsgCygCACEHIAQoAgAhBSAFIAdqIQUgBCAFNgIAIAEgB2ohAUEAIQkgAiAHayECDAELQQEhCUF/IQgLAkACQAJAIAlBA3EOAwABAAELDAELDAELIAoEQCAKIQYMAwUgBiEFDAILAAsLIAkEfyAIBSAKIQYMAQshEgwBCyAGQQRqIQogCigCACEIIAhBAnQhCCAIEF4hDSANRQRAEAYLIAooAgAhCCAIQQBKBEAgCEECdCEIIA1BACAIEHoaC0EAIQVBACEKIAEhCCAGIQECQAJAAkADQCALQQA2AgAgDEEANgIAIAJBIEghBiACQSAgBhshCSABIAggCUEAIAsgDBAUIQEgAUUEQEEgIQYgCSEBA0AgAiAGSiEGIAZFDQQgAUEBdCEGIAYgAkohASACIAYgARshASAAKAIAIQkgCSAIIAFBACALIAwQFCEJIAlFDQALIAkhAQsgBCgCACEGIAYgAWohBiAEIAY2AgAgCCABaiEIIAIgAWshBiAMKAIAIREgESAKaiEJAkACQCAFIAlIBEAgBUUhAiAFQQF0IQFBgCAgASACGyECIAAoAgAhASABQQRqIQUgBSgCACEFIAVBAEoEQCACQQJ0IQ5BACEBA0AgDSABQQJ0aiEHIAcoAgAhBSAFIA4QYCEFIAVFDQYgByAFNgIAIAFBAWohASAAKAIAIQcgB0EEaiEFIAUoAgAhBSABIAVIDQALIAUhDiAHIQEMAgsFIAAoAgAiAUEEaiEHIAUhAiAHKAIAIQ4MAQsMAQsgDkEASgRAIBFBAEohEyALKAIAIRRBACEHA0AgEwRAIBQgB0ECdGooAgAhFSANIAdBAnRqKAIAIRZBACEFA0AgFSAFQQJ0aiEPIA8qAgAhFyAXQwAAgD9eBEBDAACAPyEXBSAXQwAAgL9dBEBDAACAvyEXCwsgBSAKaiEPIBYgD0ECdGohDyAPIBc4AgAgBUEBaiEFIAUgEUcNAAsLIAdBAWohBSAFIA5IBEAgBSEHDAELCwsLIAIhBSAJIQogBiECDAAACwALEAYMAQsgAyANNgIAIAohEgsLIBAkBiASCzwBAX8gAEEIdCECIAFB/wFxIQEgAEEYdiEAIAAgAXMhACAAQQJ0QdAZaiEAIAAoAgAhACAAIAJzIQAgAAvvBAEFfyAAQdgLaiEGIAZBADYCACAAQdQLaiEGIAZBADYCACAAQdQAaiEIIAgoAgAhBgJ/IAYEf0EABSAAQSRqIQcCQAJAA0ACQCAAECAhBkEAIAZFDQUaIABBARAsIQYgBkUNACAHLAAAIQYgBg0CA0AgABAZIQYgBkF/Rw0ACyAIKAIAIQYgBkUNAUEADAULCwwBCyAAQSMQFUEADAILIABBxABqIQYgBigCACEGIAYEQCAAQcgAaiEGIAYoAgAhByAAQdAAaiEGIAYoAgAhBiAHIAZHBEBB0xNBxBNBuhhBixQQBAsLIABBjANqIQcgBygCACEGIAZBf2ohBiAGEC0hBiAAIAYQLCEIIAhBf0YEf0EABSAHKAIAIQYgCCAGSAR/IAUgCDYCACAAQZADaiAIQQZsaiEHIAcsAAAhBQJAAkAgBQR/IABB6ABqIQUgBSgCACEFIABBARAsIQYgAEEBECwhCCAGQQBHIQkgBywAACEGIAZFIQcgBUEBdSEGIAkgB3IEfwwCBSAAQeQAaiEKIAooAgAhCSAFIAlrIQkgCUECdSEJIAEgCTYCACAKKAIAIQEgASAFaiEJIAYhASAJQQJ1CwUgAEHkAGohBSAFKAIAIQZBACEIIAYhBSAGQQF1IQZBASEHDAELIQYMAQsgAUEANgIAIAYhAQsgAiAGNgIAIAhBAEchAiACIAdyBEAgAyABNgIABSAFQQNsIQIgAEHkAGohASABKAIAIQAgAiAAayEAIABBAnUhACADIAA2AgAgASgCACEAIAAgAmohACAAQQJ1IQULIAQgBTYCAEEBBUEACwsLCyEAIAALjB0CJ38DfSMGIRwjBkGAFGokBiAcQYAMaiEdIBxBgARqISQgHEGAAmohFCAcISAgAi0AACEHIAdB/wFxIQcgAEHcAGogB0ECdGohByAHKAIAIR4gAEGIA2ohByAHKAIAIRYgAkEBaiEHIActAAAhByAHQf8BcSEXIBYgF0EobGohIiAeQQF1IR9BACAfayEpIABBBGohGiAaKAIAIQcCfwJAIAdBAEoEfyAWIBdBKGxqQQRqISogAEH4AWohKyAAQfAAaiElIABB6ApqIRggAEHkCmohISAUQQFqISwDQAJAICooAgAhByAHIA1BA2xqQQJqIQcgBy0AACEHIAdB/wFxIQcgHSANQQJ0aiEVIBVBADYCACAWIBdBKGxqQQlqIAdqIQcgBy0AACEHIAdB/wFxIQ8gAEH4AGogD0EBdGohByAHLgEAIQcgB0UNACArKAIAIRAgAEEBECwhBwJAAkAgB0UNACAQIA9BvAxsakG0DGohByAHLQAAIQcgB0H/AXEhByAHQX9qIQcgB0ECdEGQCGohByAHKAIAISMgAEHYB2ogDUECdGohByAHKAIAIRkgIxAtIQcgB0F/aiEHIAAgBxAsIQggCEH//wNxIQggGSAIOwEAIAAgBxAsIQcgB0H//wNxIQcgGUECaiEIIAggBzsBACAQIA9BvAxsaiEmICYsAAAhByAHBEBBACETQQIhBwNAIBAgD0G8DGxqQQFqIBNqIQggCC0AACEIIAhB/wFxIRsgECAPQbwMbGpBIWogG2ohCCAILAAAIQwgDEH/AXEhJyAQIA9BvAxsakExaiAbaiEIIAgsAAAhCCAIQf8BcSEoQQEgKHQhCSAJQX9qIS0gCARAICUoAgAhCyAQIA9BvAxsakHBAGogG2ohCCAILQAAIQggCEH/AXEhCiALIApBsBBsaiEOIBgoAgAhCCAIQQpIBEAgABA0CyAhKAIAIQkgCUH/B3EhCCALIApBsBBsakEkaiAIQQF0aiEIIAguAQAhCCAIQX9KBEAgCyAKQbAQbGpBCGohDiAOKAIAIQ4gDiAIaiEOIA4tAAAhDiAOQf8BcSEOIAkgDnYhCSAhIAk2AgAgGCgCACEJIAkgDmshCSAJQQBIIQ5BACAJIA4bIRFBfyAIIA4bIQkgGCARNgIABSAAIA4QNSEJCyALIApBsBBsakEXaiEIIAgsAAAhCCAIBEAgCyAKQbAQbGpBqBBqIQggCCgCACEIIAggCUECdGohCCAIKAIAIQkLBUEAIQkLIAwEQEEAIQsgByEIA0AgCSAtcSEKIBAgD0G8DGxqQdIAaiAbQQR0aiAKQQF0aiEKIAouAQAhDCAJICh1IQogDEF/SgR/ICUoAgAhDiAOIAxBsBBsaiESIBgoAgAhCSAJQQpIBEAgABA0CyAhKAIAIREgEUH/B3EhCSAOIAxBsBBsakEkaiAJQQF0aiEJIAkuAQAhCSAJQX9KBEAgDiAMQbAQbGpBCGohEiASKAIAIRIgEiAJaiESIBItAAAhEiASQf8BcSESIBEgEnYhESAhIBE2AgAgGCgCACERIBEgEmshESARQQBIIRJBACARIBIbIRFBfyAJIBIbIQkgGCARNgIABSAAIBIQNSEJCyAOIAxBsBBsakEXaiERIBEsAAAhESARBEAgDiAMQbAQbGpBqBBqIQwgDCgCACEMIAwgCUECdGohCSAJKAIAIQkLIAlB//8DcQVBAAshCSAZIAhBAXRqIAk7AQAgCEEBaiEIIAtBAWohCyALICdHBEAgCiEJDAELCyAHICdqIQcLIBNBAWohEyAmLQAAIQggCEH/AXEhCCATIAhJDQALCyAYKAIAIQcgB0F/Rg0AICxBAToAACAUQQE6AAAgECAPQbwMbGpBuAxqIQcgBygCACETIBNBAkoEQCAjQf//A2ohG0ECIQcDQCAQIA9BvAxsakHACGogB0EBdGohCCAILQAAIQggCEH/AXEhCyAQIA9BvAxsaiAHQQF0akHBCGohCCAILQAAIQggCEH/AXEhCiAQIA9BvAxsakHSAmogB0EBdGohCCAILwEAIQggCEH//wNxIQggECAPQbwMbGpB0gJqIAtBAXRqIQkgCS8BACEJIAlB//8DcSEJIBAgD0G8DGxqQdICaiAKQQF0aiEMIAwvAQAhDCAMQf//A3EhDCAZIAtBAXRqIQ4gDi4BACEOIBkgCkEBdGohFSAVLgEAIRUgCCAJIAwgDiAVEDYhCCAZIAdBAXRqIQ4gDi4BACEJICMgCGshDAJAAkAgCQRAIAwgCEghFSAMIAggFRtBAXQhFSAUIApqIQogCkEBOgAAIBQgC2ohCyALQQE6AAAgFCAHaiELIAtBAToAACAVIAlMBEAgDCAISg0DIBsgCWshCAwCCyAJQQFxIQsgCwR/IAlBAWohCSAJQQF2IQkgCCAJawUgCUEBdSEJIAkgCGoLIQgFIBQgB2ohCSAJQQA6AAALCyAOIAg7AQALIAdBAWohByAHIBNIDQALCyATQQBKBEBBACEHA0AgFCAHaiEIIAgsAAAhCCAIRQRAIBkgB0EBdGohCCAIQX87AQALIAdBAWohByAHIBNHDQALCwwBCyAVQQE2AgALIA1BAWohDSAaKAIAIQcgDSAHSA0BDAMLCyAAQRUQFUEABQwBCwwBCyAAQcQAaiETIBMoAgAhCSAJBEAgAEHIAGohCCAIKAIAIQggAEHQAGohDSANKAIAIQ0gCCANRwRAQdMTQcQTQc8ZQecUEAQLCyAHQQJ0IQggJCAdIAgQeRogIi4BACEIIAgEQCAWIBdBKGxqKAIEIQ0gCEH//wNxIQxBACEIA0AgDSAIQQNsaiELIAstAAAhCyALQf8BcSELIB0gC0ECdGohCyALKAIAIQ8gHSANIAhBA2xqLQABQQJ0aiEKAkACQCAPRQ0AIAooAgAhDyAPRQ0ADAELIApBADYCACALQQA2AgALIAhBAWohCCAIIAxJDQALCyAWIBdBKGxqQQhqIQsgCywAACEIIAgEQCAWIBdBKGxqQQRqIQxBACEJIAchDQNAAkAgDUEASgRAIAwoAgAhD0EAIQdBACEIA0AgDyAIQQNsakECaiEKIAotAAAhCiAKQf8BcSEKIAkgCkYEQCAdIAhBAnRqIQogCigCACEQICAgB2ohCiAQBEAgCkEBOgAAIBQgB0ECdGohCiAKQQA2AgAFIApBADoAACAAQZQGaiAIQQJ0aiEKIAooAgAhCiAUIAdBAnRqIRAgECAKNgIACyAHQQFqIQcLIAhBAWohCCAIIA1IDQALBUEAIQcLIBYgF0EobGpBGGogCWohCCAILQAAIQggCEH/AXEhCCAAIBQgByAfIAggIBA3IAlBAWohCSALLQAAIQcgB0H/AXEhByAJIAdPDQAgGigCACENDAELCyATKAIAIQkLIAkEQCAAQcgAaiEHIAcoAgAhByAAQdAAaiEIIAgoAgAhCCAHIAhHBEBB0xNBxBNB8BlB5xQQBAsLICIuAQAhByAHBEAgFiAXQShsaigCBCENIB5BAUohDCAHQf//A3EhCANAIAhBf2ohCSANIAlBA2xqIQcgBy0AACEHIAdB/wFxIQcgAEGUBmogB0ECdGohByAHKAIAISAgDSAJQQNsakEBaiEHIActAAAhByAHQf8BcSEHIABBlAZqIAdBAnRqIQcgBygCACEPIAwEQEEAIQcDQCAgIAdBAnRqIQsgCyoCACEuIA8gB0ECdGoiECoCACIvQwAAAABeIQogLkMAAAAAXgRAIAoEQCAuITAgLiAvkyEuBSAuIC+SITALBSAKBEAgLiEwIC4gL5IhLgUgLiAvkyEwCwsgCyAwOAIAIBAgLjgCACAHQQFqIQcgByAfSA0ACwsgCEEBSgRAIAkhCAwBCwsLIBooAgAhByAHQQBKBEAgH0ECdCEJQQAhBwNAICQgB0ECdGohCCAIKAIAIQ0gAEGUBmogB0ECdGohCCANBEAgCCgCACEIIAhBACAJEHoaBSAIKAIAIQggAEHYB2ogB0ECdGohDSANKAIAIQ0gACAiIAcgHiAIIA0QOAsgB0EBaiEHIBooAgAhCCAHIAhIDQALIAhBAEoEQEEAIQcDQCAAQZQGaiAHQQJ0aiEIIAgoAgAhCCACLQAAIQkgCUH/AXEhCSAIIB4gACAJEDkgB0EBaiEHIBooAgAhCCAHIAhIDQALCwsgABAhIABB1QpqIQIgAiwAACEHIAcEQCAAQZgIaiEGIAYgKTYCACAeIAVrIQYgAEH4CmohByAHIAY2AgAgAEGcCGohBiAGQQE2AgAgAkEAOgAABSAAQfgKaiEHIAcoAgAhAiACBEAgBCADayEIIAIgCEgEQCACIANqIQMgBiADNgIAIAdBADYCAAUgAiAIayECIAcgAjYCACAGIAQ2AgAgBCEDCwsLIABB4ApqIQIgAigCACECIABB8ApqIQYgBigCACEHIABBnAhqIggoAgAhBgJAAkAgAiAHRgRAIAYEQCAAQdMKaiECIAIsAAAhAiACQQRxIQIgAgRAIABB9ApqIQIgAigCACECIABBmAhqIQYgBigCACEHIAUgA2shCSAJIAdqIQkgAiAJSSEJIAIgB0khDSACIAdrIQJBACACIA0bIQIgAiADaiECIAIgBUohByAFIAIgBxshAiAJBEAgASACNgIAIAYoAgAhACAAIAJqIQAgBiAANgIAQQEMBgsLCyAAQfQKaiECIAIoAgAhAiADIB9rIQYgBiACaiEGIABBmAhqIQIgAiAGNgIAIAhBATYCAAwBBSAAQZgIaiECIAYNAQsMAQsgBCADayEDIAIoAgAhBCADIARqIQMgAiADNgIACyATKAIAIQIgAgRAIABByABqIQIgAigCACECIABB0ABqIQAgACgCACEAIAIgAEcEQEHTE0HEE0HkGkHnFBAECwsgASAFNgIAQQELIQAgHCQGIAALqAIBBX8gAEHoCmohBSAFKAIAIQICQCACQQBIBEBBACEABSACIAFIBEAgAUEYSgRAIABBGBAsIQIgAUFoaiEBIAAgARAsIQAgAEEYdCEAIAAgAmohACAADwsgAkUEQCAAQeQKaiECIAJBADYCAAsgAEHkCmohAwJAAkACQANAIAAQLiECIAJBf0YNASAFKAIAIQQgAiAEdCECIAMoAgAhBiAGIAJqIQIgAyACNgIAIAUgBEEIaiICNgIAIAIgAUgNAAwCAAsACyAFQX82AgBBACEADAQLIARBeEgEQEEAIQAMBAsLCyAAQeQKaiEEIAQoAgAhA0EBIAF0IQAgAEF/aiEAIAMgAHEhACADIAF2IQMgBCADNgIAIAIgAWshASAFIAE2AgALCyAAC40CAAJAIABBAEgEf0EABSAAQYCAAUgEQCAAQRBIBEAgAEGACGohACAALAAAIQAMAwsgAEGABEgEQCAAQQV2IQAgAEGACGohACAALAAAIQAgAEEFaiEABSAAQQp2IQAgAEGACGohACAALAAAIQAgAEEKaiEACwwCCyAAQYCAgAhIBH8gAEGAgCBIBH8gAEEPdiEAIABBgAhqIQAgACwAACEAIABBD2oFIABBFHYhACAAQYAIaiEAIAAsAAAhACAAQRRqCwUgAEGAgICAAkgEfyAAQRl2IQAgAEGACGohACAALAAAIQAgAEEZagUgAEEediEAIABBgAhqIQAgACwAACEAIABBHmoLCwshAAsgAAuiAQEDfyAAQdQKaiECIAIsAAAhAQJAAkAgAQ0AIABB3ApqIQEgASgCACEBIAEEQEF/IQMFIAAQLyEBIAEEQCACLAAAIQEgAQ0CQaEUQcQTQfYLQbUUEAQFQX8hAwsLDAELIAFBf2pBGHRBGHUhASACIAE6AAAgAEHsCmohASABKAIAIQIgAkEBaiECIAEgAjYCACAAEDAhACAAQf8BcSEDCyADC6wCAQd/IABB3ApqIQIgAigCACEBAkAgAUUEQCAAQdgKaiEEIAQoAgAhASABQX9GBEAgAEHQCGohASABKAIAIQEgAUF/aiEBIABB4ApqIQMgAyABNgIAIAAQMSEBIAFFBEAgAkEBNgIADAMLIABB0wpqIQEgASwAACEBIAFBAXEhASABBH8gBCgCAAUgAEEgEBUMAwshAQsgAUEBaiEHIAQgBzYCACAAQdQIaiABaiEDIAMsAAAhBiAGQf8BcSEDIAZBf0cEQCACQQE2AgAgAEHgCmohAiACIAE2AgALIABB0AhqIQEgASgCACEBIAcgAU4EQCAEQX82AgALIABB1ApqIQAgACwAACEBIAEEQEHFFEHEE0HoC0HaFBAEBSAAIAY6AAAgAyEFCwsLIAULUQEDfyAAQRRqIQMgAygCACEBIABBHGohAiACKAIAIQIgASACSQR/IAFBAWohACADIAA2AgAgASwAAAUgAEHUAGohACAAQQE2AgBBAAshACAACyABAX8gABAyIQEgAQR/IAAQMwUgAEEeEBVBAAshACAAC2ABAX8gABAwIQEgAUH/AXFBzwBGBEAgABAwIQEgAUH/AXFB5wBGBEAgABAwIQEgAUH/AXFB5wBGBEAgABAwIQAgAEH/AXFB0wBGIQAFQQAhAAsFQQAhAAsFQQAhAAsgAAvZAwEGfyAAEDAhAQJ/IAFB/wFxBH8gAEEfEBVBAAUgABAwIQEgAEHTCmohAiACIAE6AAAgABAjIQUgABAjIQIgABAjGiAAECMhASAAQcwIaiEDIAMgATYCACAAECMaIAAQMCEBIAFB/wFxIQEgAEHQCGohAyADIAE2AgAgAEHUCGohBCAAIAQgARAiIQEgAUUEQCAAQQoQFUEADAILIABB8ApqIQQgBEF+NgIAIAIgBXEhAQJAIAFBf0cEQCADKAIAIQEgAUEASgRAA0ACQCABQX9qIQIgAEHUCGogAmohBiAGLAAAIQYgBkF/Rw0AIAFBAUwNBCACIQEMAQsLIAQgAjYCACAAQfQKaiEBIAEgBTYCAAsLCyAAQdUKaiEBIAEsAAAhASABBEAgAygCACEDIANBAEoEf0EAIQJBACEBA0AgAEHUCGogAWohBCAELQAAIQQgBEH/AXEhBCACIARqIQIgAUEBaiEBIAEgA0gNAAsgAkEbagVBGwshASAAQShqIQIgAigCACECIAEgA2ohASABIAJqIQEgAEEsaiEDIAMgAjYCACAAQTBqIQIgAiABNgIAIABBNGohASABIAU2AgALIABB2ApqIQAgAEEANgIAQQELCyEAIAALowEBB38gAEHoCmohAyADKAIAIQECQCABQRlIBEAgAEHkCmohBCABRQRAIARBADYCAAsgAEHUCmohBSAAQdwKaiEGA0AgBigCACEBIAEEQCAFLAAAIQEgAUUNAwsgABAuIQIgAkF/Rg0CIAMoAgAhASACIAF0IQIgBCgCACEHIAcgAmohAiAEIAI2AgAgAUEIaiECIAMgAjYCACABQRFIDQALCwsLrQUBCX8gABA0IAFBIGohAiACKAIAIQUCQAJAIAVFIgNFDQAgAUGkEGohAiACKAIAIQIgAg0AQX8hAQwBCyABQQRqIQIgAigCACECAkACQCACQQhKBEAgAUGkEGohAyADKAIAIQMgAw0BBSADDQELDAELIABB5ApqIQggCCgCACEJIAkQOiEHIAFBrBBqIQIgAigCACECIAJBAUoEQCABQaQQaigCACEKQQAhAwNAIAJBAXYhBSAFIANqIQQgCiAEQQJ0aiEGIAYoAgAhBiAGIAdLIQYgAiAFayECIAMgBCAGGyEDIAUgAiAGGyECIAJBAUoNAAsFQQAhAwsgAUEXaiECIAIsAAAhAiACRQRAIAFBqBBqIQIgAigCACECIAIgA0ECdGohAiACKAIAIQMLIAFBCGohASABKAIAIQEgASADaiEBIAEtAAAhASABQf8BcSEBIABB6ApqIQIgAigCACEAIAAgAUgEf0EAIQBBfwUgACABayEAIAkgAXYhASAIIAE2AgAgAwshASACIAA2AgAMAQsgAUEXaiEDIAMsAAAhAyADBEBBgRVBxBNB6gxBjBUQBAsCQCACQQBKBEAgASgCCCEIIABB5ApqIQlBACEBA0ACQCAIIAFqIQMgAywAACEEIARB/wFxIQMgBEF/RwRAIAUgAUECdGoh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IwZBEGokBiACIQECfCAAvUIgiKdB/////wdxIgNB/MOk/wNJBHwgA0GewZryA0kEfEQAAAAAAADwPwUgAEQAAAAAAAAAABByCwUgACAAoSADQf//v/8HSw0BGgJAAkACQAJAIAAgARBuQQNxDgMAAQIDCyABKwMAIAErAwgQcgwECyABKwMAIAErAwhBARBwmgwDCyABKwMAIAErAwgQcpoMAgsgASsDACABKwMIQQEQcAsLIQAgAiQGIAALywEBA38jBiECIwZBEGokBiACIQECQCAAvUIgiKdB/////wdxIgNB/MOk/wNJBEAgA0GAgMDyA08EQCAARAAAAAAAAAAAQQAQcCEACwUgA0H//7//B0sEQCAAIAChIQAMAgsCQAJAAkACQAJAIAAgARBuQQNxDgMAAQIDCyABKwMAIAErAwhBARBwIQAMBQsgASsDACABKwMIEHIhAAwECyABKwMAIAErAwhBARBwmiEADAMLIAErAwAgASsDCBBymiEACwsLIAIkBiAAC5sDAwJ/AX4CfCAAvSIDQj+IpyEBAnwCfwJAIANCIIinQf////8HcSICQarGmIQESwR8IANC////////////AINCgICAgICAgPj/AFYEQCAADwsgAETvOfr+Qi6GQGQEQCAARAAAAAAAAOB/og8FIABE0rx63SsjhsBjIABEUTAt1RBJh8BjcUUNAkQAAAAAAAAAACIADwsABSACQcLc2P4DSwRAIAJBscXC/wNLDQIgAUEBcyABawwDCyACQYCAwPEDSwR8QQAhASAABSAARAAAAAAAAPA/oA8LCwwCCyAARP6CK2VHFfc/oiABQQN0QYATaisDAKCqCyEBIAAgAbciBEQAAOD+Qi7mP6KhIgAgBER2PHk17znqPaIiBaELIQQgACAEIAQgBCAEoiIAIAAgACAAIABE0KS+cmk3Zj6iRPFr0sVBvbu+oKJELN4lr2pWET+gokSTvb4WbMFmv6CiRD5VVVVVVcU/oKKhIgCiRAAAAAAAAABAIAChoyAFoaBEAAAAAAAA8D+gIQAgAUUEQCAADwsgACABEGULnwMDAn8BfgV8IAC9IgNCIIinIQECfyADQgBTIgIgAUGAgMAASXIEfyADQv///////////wCDQgBRBEBEAAAAAAAA8L8gACAAoqMPCyACRQRAIABEAAAAAAAAUEOi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mgDjqR0AXmGRAAgb5gCFmWUAoBRfAI1AaACA2P8AJ3NNAAYGMQDKVhUAyahzAHviYABrjMAAQcMSC11A+yH5PwAAAAAtRHQ+AAAAgJhG+DwAAABgUcx4OwAAAICDG/A5AAAAQCAlejgAAACAIoLjNgAAAAAd82k1AAAAAAAA4D8AAAAAAADgvwAAAAAAAPA/AAAAAAAA+D8AQagTCwgG0M9D6/1MPgBBuxMLigZAA7jiP09nZ1MuL3N0Yl92b3JiaXMuYwBmLT5hbGxvYy5hbGxvY19idWZmZXJfbGVuZ3RoX2luX2J5dGVzID09IGYtPnRlbXBfb2Zmc2V0AHZvcmJpc19kZWNvZGVfaW5pdGlhbABmLT5ieXRlc19pbl9zZWcgPiAwAGdldDhfcGFja2V0X3JhdwBmLT5ieXRlc19pbl9zZWcgPT0gMABuZXh0X3NlZ21lbnQAdm9yYmlzX2RlY29kZV9wYWNrZXRfcmVzdAAhYy0+c3BhcnNlAGNvZGVib29rX2RlY29kZV9zY2FsYXJfcmF3ACFjLT5zcGFyc2UgfHwgeiA8IGMtPnNvcnRlZF9lbnRyaWVzAGNvZGVib29rX2RlY29kZV9kZWludGVybGVhdmVfcmVwZWF0AHogPCBjLT5zb3J0ZWRfZW50cmllcwBjb2RlYm9va19kZWNvZGVfc3RhcnQAKG4gJiAzKSA9PSAwAGltZGN0X3N0ZXAzX2l0ZXIwX2xvb3AAMABnZXRfd2luZG93AGYtPnRlbXBfb2Zmc2V0ID09IGYtPmFsbG9jLmFsbG9jX2J1ZmZlcl9sZW5ndGhfaW5fYnl0ZXMAc3RhcnRfZGVjb2RlcgB2b3JiaXNjLT5zb3J0ZWRfZW50cmllcyA9PSAwAGNvbXB1dGVfY29kZXdvcmRzAHogPj0gMCAmJiB6IDwgMzIAbGVuW2ldID49IDAgJiYgbGVuW2ldIDwgMzIAYXZhaWxhYmxlW3ldID09IDAAayA9PSBjLT5zb3J0ZWRfZW50cmllcwBjb21wdXRlX3NvcnRlZF9odWZmbWFuAGMtPnNvcnRlZF9jb2Rld29yZHNbeF0gPT0gY29kZQBsZW4gIT0gTk9fQ09ERQBpbmNsdWRlX2luX3NvcnQAcG93KChmbG9hdCkgcisxLCBkaW0pID4gZW50cmllcwBsb29rdXAxX3ZhbHVlcwAoaW50KSBmbG9vcihwb3coKGZsb2F0KSByLCBkaW0pKSA8PSBlbnRyaWVzAOoPBG5hbWUB4g9+AAVhYm9ydAENZW5sYXJnZU1lbW9yeQIOZ2V0VG90YWxNZW1vcnkDF2Fib3J0T25DYW5ub3RHcm93TWVtb3J5BA5fX19hc3NlcnRfZmFpbAULX19fc2V0RXJyTm8GBl9hYm9ydAcWX2Vtc2NyaXB0ZW5fbWVtY3B5X2JpZwgQX19ncm93V2FzbU1lbW9yeQkKc3RhY2tBbGxvYwoJc3RhY2tTYXZlCwxzdGFja1Jlc3RvcmUME2VzdGFibGlzaFN0YWNrU3BhY2UNCHNldFRocmV3DgtzZXRUZW1wUmV0MA8LZ2V0VGVtcFJldDAQEV9zdGJfdm9yYmlzX2Nsb3NlEQ5fdm9yYmlzX2RlaW5pdBILX3NldHVwX2ZyZWUTGl9zdGJfdm9yYmlzX2ZsdXNoX3B1c2hkYXRhFCFfc3RiX3ZvcmJpc19kZWNvZGVfZnJhbWVfcHVzaGRhdGEVBl9lcnJvchYgX3ZvcmJpc19zZWFyY2hfZm9yX3BhZ2VfcHVzaGRhdGEXGF9pc193aG9sZV9wYWNrZXRfcHJlc2VudBgVX3ZvcmJpc19kZWNvZGVfcGFja2V0GQxfZ2V0OF9wYWNrZXQaFF92b3JiaXNfZmluaXNoX2ZyYW1lGxlfc3RiX3ZvcmJpc19vcGVuX3B1c2hkYXRhHAxfdm9yYmlzX2luaXQdDl9zdGFydF9kZWNvZGVyHg1fdm9yYmlzX2FsbG9jHxtfc3RiX3ZvcmJpc19nZXRfZmlsZV9vZmZzZXQgE19tYXliZV9zdGFydF9wYWNrZXQhDV9mbHVzaF9wYWNrZXQiBV9nZXRuIwZfZ2V0MzIkE19zdGJfdm9yYmlzX2pzX29wZW4lFF9zdGJfdm9yYmlzX2pzX2Nsb3NlJhdfc3RiX3ZvcmJpc19qc19jaGFubmVscycaX3N0Yl92b3JiaXNfanNfc2FtcGxlX3JhdGUoFV9zdGJfdm9yYmlzX2pzX2RlY29kZSkNX2NyYzMyX3VwZGF0ZSoWX3ZvcmJpc19kZWNvZGVfaW5pdGlhbCsaX3ZvcmJpc19kZWNvZGVfcGFja2V0X3Jlc3QsCV9nZXRfYml0cy0FX2lsb2cuEF9nZXQ4X3BhY2tldF9yYXcvDV9uZXh0X3NlZ21lbnQwBV9nZXQ4MQtfc3RhcnRfcGFnZTIQX2NhcHR1cmVfcGF0dGVybjMdX3N0YXJ0X3BhZ2Vfbm9fY2FwdHVyZXBhdHRlcm40DV9wcmVwX2h1ZmZtYW41G19jb2RlYm9va19kZWNvZGVfc2NhbGFyX3JhdzYOX3ByZWRpY3RfcG9pbnQ3D19kZWNvZGVfcmVzaWR1ZTgJX2RvX2Zsb29yOQ1faW52ZXJzZV9tZGN0OgxfYml0X3JldmVyc2U7EV9tYWtlX2Jsb2NrX2FycmF5PBJfc2V0dXBfdGVtcF9tYWxsb2M9JF9jb2RlYm9va19kZWNvZGVfZGVpbnRlcmxlYXZlX3JlcGVhdD4PX3Jlc2lkdWVfZGVjb2RlPxVfY29kZWJvb2tfZGVjb2RlX3N0ZXBAEF9jb2RlYm9va19kZWNvZGVBFl9jb2RlYm9va19kZWNvZGVfc3RhcnRCCl9kcmF3X2xpbmVDF19pbWRjdF9zdGVwM19pdGVyMF9sb29wRBlfaW1kY3Rfc3RlcDNfaW5uZXJfcl9sb29wRRlfaW1kY3Rfc3RlcDNfaW5uZXJfc19sb29wRh9faW1kY3Rfc3RlcDNfaW5uZXJfc19sb29wX2xkNjU0RwhfaXRlcl81NEgLX2dldF93aW5kb3dJEF92b3JiaXNfdmFsaWRhdGVKDV9zdGFydF9wYWNrZXRLBV9za2lwTAtfY3JjMzJfaW5pdE0NX3NldHVwX21hbGxvY04QX3NldHVwX3RlbXBfZnJlZU8SX2NvbXB1dGVfY29kZXdvcmRzUBdfY29tcHV0ZV9zb3J0ZWRfaHVmZm1hblEcX2NvbXB1dGVfYWNjZWxlcmF0ZWRfaHVmZm1hblIPX2Zsb2F0MzJfdW5wYWNrUw9fbG9va3VwMV92YWx1ZXNUDl9wb2ludF9jb21wYXJlVQpfbmVpZ2hib3JzVg9faW5pdF9ibG9ja3NpemVXCl9hZGRfZW50cnlYEF9pbmNsdWRlX2luX3NvcnRZD191aW50MzJfY29tcGFyZVoYX2NvbXB1dGVfdHdpZGRsZV9mYWN0b3JzWw9fY29tcHV0ZV93aW5kb3dcE19jb21wdXRlX2JpdHJldmVyc2VdB19zcXVhcmVeB19tYWxsb2NfBV9mcmVlYAhfcmVhbGxvY2ESX3RyeV9yZWFsbG9jX2NodW5rYg5fZGlzcG9zZV9jaHVua2MRX19fZXJybm9fbG9jYXRpb25kB19tZW1jbXBlB19zY2FsYm5mBl9xc29ydGcFX3NpZnRoBF9zaHJpCF90cmlua2xlagRfc2hsawVfcG50emwIX2FfY3R6X2xtBl9jeWNsZW4LX19fcmVtX3BpbzJvEV9fX3JlbV9waW8yX2xhcmdlcAZfX19zaW5xBl9sZGV4cHIGX19fY29zcwRfY29zdARfc2ludQRfZXhwdgRfbG9ndwRfcG93eAtydW5Qb3N0U2V0c3kHX21lbWNweXoHX21lbXNldHsFX3Nicmt8C2R5bkNhbGxfaWlpfQJiMA=="), function(A4) {
        return A4.charCodeAt(0);
      });
      var $ = void 0 !== $ ? $ : {}, e = {};
      for (A in $) $.hasOwnProperty(A) && (e[A] = $[A]);
      $.arguments = [], $.thisProgram = "./this.program", $.quit = function(A4, I2) {
        throw I2;
      }, $.preRun = [], $.postRun = [];
      var t = false, k = false, N = false, r = false;
      t = "object" == typeof window, k = "function" == typeof importScripts, N = "object" == typeof process && "function" == typeof aaa && !t && !k, r = !t && !N && !k;
      var Y = "";
      function J(A4) {
        return $.locateFile ? $.locateFile(A4, Y) : Y + A4;
      }
      N ? (Y = "/", $.read = function A4(B2, E2) {
        var Q2;
        return I || (I = void 0), g || (g = void 0), B2 = g.normalize(B2), Q2 = I.readFileSync(B2), E2 ? Q2 : Q2.toString();
      }, $.readBinary = function A4(I2) {
        var g2 = $.read(I2, true);
        return g2.buffer || (g2 = new Uint8Array(g2)), _(g2.buffer), g2;
      }, process.argv.length > 1 && ($.thisProgram = process.argv[1].replace(/\\/g, "/")), $.arguments = process.argv.slice(2), process.on("uncaughtException", function(A4) {
        if (!(A4 instanceof II)) throw A4;
      }), process.on("unhandledRejection", function(A4, I2) {
        process.exit(1);
      }), $.quit = function(A4) {
        process.exit(A4);
      }, $.inspect = function() {
        return "[Emscripten Module object]";
      }) : r ? ("undefined" != typeof read && ($.read = function A4(I2) {
        return read(I2);
      }), $.readBinary = function A4(I2) {
        var g2;
        return "function" == typeof readbuffer ? new Uint8Array(readbuffer(I2)) : (_("object" == typeof (g2 = read(I2, "binary"))), g2);
      }, "undefined" != typeof scriptArgs ? $.arguments = scriptArgs : "undefined" != typeof arguments && ($.arguments = arguments), "function" == typeof quit && ($.quit = function(A4) {
        quit(A4);
      })) : (t || k) && (t ? document.currentScript && (Y = document.currentScript.src) : Y = self.location.href, Y = 0 !== Y.indexOf("blob:") ? Y.split("/").slice(0, -1).join("/") + "/" : "", $.read = function A4(I2) {
        var g2 = new XMLHttpRequest();
        return g2.open("GET", I2, false), g2.send(null), g2.responseText;
      }, k && ($.readBinary = function A4(I2) {
        var g2 = new XMLHttpRequest();
        return g2.open("GET", I2, false), g2.responseType = "arraybuffer", g2.send(null), new Uint8Array(g2.response);
      }), $.readAsync = function A4(I2, g2, B2) {
        var E2 = new XMLHttpRequest();
        E2.open("GET", I2, true), E2.responseType = "arraybuffer", E2.onload = function A8() {
          if (200 == E2.status || 0 == E2.status && E2.response) {
            g2(E2.response);
            return;
          }
          B2();
        }, E2.onerror = B2, E2.send(null);
      }, $.setWindowTitle = function(A4) {
        document.title = A4;
      });
      var f = $.print || ("undefined" != typeof console ? console.log.bind(console) : "undefined" != typeof print ? print : null), H = $.printErr || ("undefined" != typeof printErr ? printErr : "undefined" != typeof console && console.warn.bind(console) || f);
      for (A in e) e.hasOwnProperty(A) && ($[A] = e[A]);
      function L(A4) {
        var I2 = S;
        return S = S + A4 + 15 & -16, I2;
      }
      function d(A4, I2) {
        return I2 || (I2 = 16), A4 = Math.ceil(A4 / I2) * I2;
      }
      function K(A4) {
        K.shown || (K.shown = {}), K.shown[A4] || (K.shown[A4] = 1, H(A4));
      }
      e = void 0;
      var l = {
        "f64-rem": function(A4, I2) {
          return A4 % I2;
        },
        debugger: function() {
        }
      }, p = 0;
      function _(A4, I2) {
        A4 || IE("Assertion failed: " + I2);
      }
      function T(A4) {
        var I2 = $["_" + A4];
        return _(I2, "Cannot call unknown function " + A4 + ", make sure it is exported"), I2;
      }
      var v = {
        stackSave: function() {
          IA();
        },
        stackRestore: function() {
          A9();
        },
        arrayToC: function(A4) {
          var I2, g2, B2 = A5(A4.length);
          return I2 = A4, g2 = B2, E.set(I2, g2), B2;
        },
        stringToC: function(A4) {
          var I2 = 0;
          if (null != A4 && 0 !== A4) {
            var g2 = (A4.length << 2) + 1;
            I2 = A5(g2), Ai(A4, I2, g2);
          }
          return I2;
        }
      }, O = {
        string: v.stringToC,
        array: v.arrayToC
      };
      function j(A4, I2, g2, B2, E2) {
        var Q2 = T(A4), C = [], i = 0;
        if (B2) for (var h2 = 0; h2 < B2.length; h2++) {
          var o = O[g2[h2]];
          o ? (0 === i && (i = IA()), C[h2] = o(B2[h2])) : C[h2] = B2[h2];
        }
        var G, D = Q2.apply(null, C);
        return D = (G = D, "string" === I2 ? Ag(G) : "boolean" === I2 ? Boolean(G) : G), 0 !== i && A9(i), D;
      }
      function Ag(A4, I2) {
        if (0 === I2 || !A4) return "";
        for (var g2, B2, E2, C = 0, i = 0; C |= B2 = Q[A4 + i >> 0], (0 != B2 || I2) && (i++, !I2 || i != I2); ) ;
        I2 || (I2 = i);
        var h2 = "";
        if (C < 128) {
          for (; I2 > 0; ) E2 = String.fromCharCode.apply(String, Q.subarray(A4, A4 + Math.min(I2, 1024))), h2 = h2 ? h2 + E2 : E2, A4 += 1024, I2 -= 1024;
          return h2;
        }
        return g2 = A4, (function A8(I3, g3) {
          for (var B3 = g3; I3[B3]; ) ++B3;
          if (B3 - g3 > 16 && I3.subarray && AQ) return AQ.decode(I3.subarray(g3, B3));
          for (var E3, Q2, C2, i2, h3, G = ""; ; ) {
            if (!(E3 = I3[g3++])) return G;
            if (!(128 & E3)) {
              G += String.fromCharCode(E3);
              continue;
            }
            if (Q2 = 63 & I3[g3++], (224 & E3) == 192) {
              G += String.fromCharCode((31 & E3) << 6 | Q2);
              continue;
            }
            if (C2 = 63 & I3[g3++], (240 & E3) == 224 ? E3 = (15 & E3) << 12 | Q2 << 6 | C2 : (i2 = 63 & I3[g3++], (248 & E3) == 240 ? E3 = (7 & E3) << 18 | Q2 << 12 | C2 << 6 | i2 : (h3 = 63 & I3[g3++], E3 = (252 & E3) == 248 ? (3 & E3) << 24 | Q2 << 18 | C2 << 12 | i2 << 6 | h3 : (1 & E3) << 30 | Q2 << 24 | C2 << 18 | i2 << 12 | h3 << 6 | 63 & I3[g3++])), E3 < 65536) G += String.fromCharCode(E3);
            else {
              var D = E3 - 65536;
              G += String.fromCharCode(55296 | D >> 10, 56320 | 1023 & D);
            }
          }
        })(Q, g2);
      }
      var AQ = "undefined" != typeof TextDecoder ? new TextDecoder("utf8") : void 0;
      function AC(A4, I2, g2, B2) {
        if (!(B2 > 0)) return 0;
        for (var E2 = g2, Q2 = g2 + B2 - 1, C = 0; C < A4.length; ++C) {
          var i = A4.charCodeAt(C);
          if (i >= 55296 && i <= 57343 && (i = 65536 + ((1023 & i) << 10) | 1023 & A4.charCodeAt(++C)), i <= 127) {
            if (g2 >= Q2) break;
            I2[g2++] = i;
          } else if (i <= 2047) {
            if (g2 + 1 >= Q2) break;
            I2[g2++] = 192 | i >> 6, I2[g2++] = 128 | 63 & i;
          } else if (i <= 65535) {
            if (g2 + 2 >= Q2) break;
            I2[g2++] = 224 | i >> 12, I2[g2++] = 128 | i >> 6 & 63, I2[g2++] = 128 | 63 & i;
          } else if (i <= 2097151) {
            if (g2 + 3 >= Q2) break;
            I2[g2++] = 240 | i >> 18, I2[g2++] = 128 | i >> 12 & 63, I2[g2++] = 128 | i >> 6 & 63, I2[g2++] = 128 | 63 & i;
          } else if (i <= 67108863) {
            if (g2 + 4 >= Q2) break;
            I2[g2++] = 248 | i >> 24, I2[g2++] = 128 | i >> 18 & 63, I2[g2++] = 128 | i >> 12 & 63, I2[g2++] = 128 | i >> 6 & 63, I2[g2++] = 128 | 63 & i;
          } else {
            if (g2 + 5 >= Q2) break;
            I2[g2++] = 252 | i >> 30, I2[g2++] = 128 | i >> 24 & 63, I2[g2++] = 128 | i >> 18 & 63, I2[g2++] = 128 | i >> 12 & 63, I2[g2++] = 128 | i >> 6 & 63, I2[g2++] = 128 | 63 & i;
          }
        }
        return I2[g2] = 0, g2 - E2;
      }
      function Ai(A4, I2, g2) {
        return AC(A4, Q, I2, g2);
      }
      "undefined" != typeof TextDecoder && new TextDecoder("utf-16le");
      function An(A4, I2) {
        return A4 % I2 > 0 && (A4 += I2 - A4 % I2), A4;
      }
      function AU(A4) {
        $.buffer = B = A4;
      }
      function A$() {
        $.HEAP8 = E = new Int8Array(B), $.HEAP16 = new Int16Array(B), $.HEAP32 = h = new Int32Array(B), $.HEAPU8 = Q = new Uint8Array(B), $.HEAPU16 = new Uint16Array(B), $.HEAPU32 = new Uint32Array(B), $.HEAPF32 = new Float32Array(B), $.HEAPF64 = new Float64Array(B);
      }
      function Ae() {
        var A4 = $.usingWasm ? 65536 : 16777216, I2 = 2147483648 - A4;
        if (h[c >> 2] > I2) return false;
        var g2 = AN;
        for (AN = Math.max(AN, 16777216); AN < h[c >> 2]; ) AN = AN <= 536870912 ? An(2 * AN, A4) : Math.min(An((3 * AN + 2147483648) / 4, A4), I2);
        var B2 = $.reallocBuffer(AN);
        return B2 && B2.byteLength == AN ? (AU(B2), A$(), true) : (AN = g2, false);
      }
      a = S = s = w = y = c = 0, $.reallocBuffer || ($.reallocBuffer = function(A4) {
        try {
          if (ArrayBuffer.transfer) I2 = ArrayBuffer.transfer(B, A4);
          else {
            var I2, g2 = E;
            I2 = new ArrayBuffer(A4), new Int8Array(I2).set(g2);
          }
        } catch (Q2) {
          return false;
        }
        return !!Az(I2) && I2;
      });
      try {
        Function.prototype.call.bind(Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "byteLength").get)(/* @__PURE__ */ new ArrayBuffer(4));
      } catch (At) {
      }
      var Ak = $.TOTAL_STACK || 5242880, AN = $.TOTAL_MEMORY || 16777216;
      function Ar() {
        return AN;
      }
      function AY(A4) {
        for (; A4.length > 0; ) {
          var I2 = A4.shift();
          if ("function" == typeof I2) {
            I2();
            continue;
          }
          var g2 = I2.func;
          "number" == typeof g2 ? void 0 === I2.arg ? $.dynCall_v(g2) : $.dynCall_vi(g2, I2.arg) : g2(void 0 === I2.arg ? null : I2.arg);
        }
      }
      AN < Ak && H("TOTAL_MEMORY should be larger than TOTAL_STACK, was " + AN + "! (TOTAL_STACK=" + Ak + ")"), $.buffer ? B = $.buffer : ("object" == typeof WebAssembly && "function" == typeof WebAssembly.Memory ? ($.wasmMemory = new WebAssembly.Memory({ initial: AN / 65536 }), B = $.wasmMemory.buffer) : B = new ArrayBuffer(AN), $.buffer = B), A$();
      var AJ = [], Af = [], AH = [], AM = [], A0 = false;
      function Aq(A4) {
        AJ.unshift(A4);
      }
      function Ab(A4) {
        AM.unshift(A4);
      }
      var A6 = Math.floor, A7 = 0, A1 = null, AW = null;
      $.preloadedImages = {}, $.preloadedAudios = {};
      var AT = "data:application/octet-stream;base64,";
      function A2(A4) {
        return String.prototype.startsWith ? A4.startsWith(AT) : 0 === A4.indexOf(AT);
      }
      (function A4() {
        var I2 = "main.wast", g2 = "main.wasm", B2 = "main.temp.asm";
        A2(I2) || (I2 = J(I2)), A2(g2) || (g2 = J(g2)), A2(B2) || (B2 = J(B2));
        var E2 = {
          global: null,
          env: null,
          asm2wasm: l,
          parent: $
        }, Q2 = null;
        function i() {
          try {
            if ($.wasmBinary) return new Uint8Array($.wasmBinary);
            if ($.readBinary) return $.readBinary(g2);
            throw "both async and sync fetching of the wasm failed";
          } catch (A8) {
            IE(A8);
          }
        }
        $.asmPreload = $.asm;
        var h2 = $.reallocBuffer, o = function(A8) {
          A8 = An(A8, $.usingWasm ? 65536 : 16777216);
          var I3 = $.buffer.byteLength;
          if ($.usingWasm) try {
            if (-1 !== $.wasmMemory.grow((A8 - I3) / 65536)) return $.buffer = $.wasmMemory.buffer;
            return null;
          } catch (B3) {
            return null;
          }
        };
        $.reallocBuffer = function(A8) {
          return "asmjs" === G ? h2(A8) : o(A8);
        };
        var G = "";
        $.asm = function(A8, I3, B3) {
          if (!(I3 = I3).table) {
            var h3, o2 = $.wasmTableSize;
            void 0 === o2 && (o2 = 1024);
            var G2 = $.wasmMaxTableSize;
            "object" == typeof WebAssembly && "function" == typeof WebAssembly.Table ? void 0 !== G2 ? I3.table = new WebAssembly.Table({
              initial: o2,
              maximum: G2,
              element: "anyfunc"
            }) : I3.table = new WebAssembly.Table({
              initial: o2,
              element: "anyfunc"
            }) : I3.table = Array(o2), $.wasmTable = I3.table;
          }
          return I3.memoryBase || (I3.memoryBase = $.STATIC_BASE), I3.tableBase || (I3.tableBase = 0), h3 = (function A10(I4, B4, C) {
            if ("object" != typeof WebAssembly) return H("no native wasm support detected"), false;
            if (!($.wasmMemory instanceof WebAssembly.Memory)) return H("no native wasm Memory in use"), false;
            function h4(A11, I5) {
              if ((Q2 = A11.exports).memory) {
                var g3 = Q2.memory, B5 = $.buffer, E3;
                g3.byteLength < B5.byteLength && H("the new buffer in mergeMemory is smaller than the previous one. in native wasm, we should grow memory here"), E3 = new Int8Array(B5), new Int8Array(g3).set(E3), AU(g3), A$();
              }
              $.asm = Q2, $.usingWasm = true, (function A12(I6) {
                if (A7--, $.monitorRunDependencies && $.monitorRunDependencies(A7), 0 == A7 && (null !== A1 && (clearInterval(A1), A1 = null), AW)) {
                  var g4 = AW;
                  AW = null, g4();
                }
              })("wasm-instantiate");
            }
            B4.memory = $.wasmMemory, E2.global = {
              NaN: NaN,
              Infinity: Infinity
            }, E2["global.Math"] = Math, E2.env = B4;
            if (A7++, $.monitorRunDependencies && $.monitorRunDependencies(A7), $.instantiateWasm) try {
              return $.instantiateWasm(E2, h4);
            } catch (o3) {
              return H("Module.instantiateWasm callback failed with error: " + o3), false;
            }
            function G3(A11) {
              h4(A11.instance, A11.module);
            }
            function D(A11) {
              (!$.wasmBinary && (t || k) && "function" == typeof fetch ? fetch(g2, { credentials: "same-origin" }).then(function(A12) {
                if (!A12.ok) throw "failed to load wasm binary file at '" + g2 + "'";
                return A12.arrayBuffer();
              }).catch(function() {
                return i();
              }) : new Promise(function(A12, I5) {
                A12(i());
              })).then(function(A12) {
                return WebAssembly.instantiate(A12, E2);
              }).then(A11).catch(function(A12) {
                H("failed to asynchronously prepare wasm: " + A12), IE(A12);
              });
            }
            return $.wasmBinary || "function" != typeof WebAssembly.instantiateStreaming || A2(g2) || "function" != typeof fetch ? D(G3) : WebAssembly.instantiateStreaming(fetch(g2, { credentials: "same-origin" }), E2).then(G3).catch(function(A11) {
              H("wasm streaming compile failed: " + A11), H("falling back to ArrayBuffer instantiation"), D(G3);
            }), {};
          })(A8, I3, B3), _(h3, "no binaryen method succeeded."), h3;
        }, $.asm;
      })(), S = (a = 1024) + 4816, Af.push(), $.STATIC_BASE = a, $.STATIC_BUMP = 4816;
      var Av = S;
      S += 16, c = L(4), w = (s = d(S)) + Ak, y = d(w), h[c >> 2] = y, $.wasmTableSize = 4, $.wasmMaxTableSize = 4, $.asmGlobalArg = {}, $.asmLibraryArg = {
        abort: IE,
        assert: _,
        enlargeMemory: Ae,
        getTotalMemory: Ar,
        abortOnCannotGrowMemory: function A4() {
          IE("Cannot enlarge memory arrays. Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value " + AN + ", (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which allows increasing the size at runtime, or (3) if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ");
        },
        invoke_iii: function A4(I2, g2, B2) {
          var E2 = IA();
          try {
            return $.dynCall_iii(I2, g2, B2);
          } catch (Q2) {
            if (A9(E2), "number" != typeof Q2 && "longjmp" !== Q2) throw Q2;
            $.setThrew(1, 0);
          }
        },
        ___assert_fail: function A4(I2, g2, B2, E2) {
          IE("Assertion failed: " + Ag(I2) + ", at: " + [
            g2 ? Ag(g2) : "unknown filename",
            B2,
            E2 ? Ag(E2) : "unknown function"
          ]);
        },
        ___setErrNo: function A4(I2) {
          return $.___errno_location && (h[$.___errno_location() >> 2] = I2), I2;
        },
        _abort: function A4() {
          $.abort();
        },
        _emscripten_memcpy_big: function A4(I2, g2, B2) {
          return Q.set(Q.subarray(g2, g2 + B2), I2), I2;
        },
        _llvm_floor_f64: A6,
        DYNAMICTOP_PTR: c,
        tempDoublePtr: Av,
        ABORT: p,
        STACKTOP: s,
        STACK_MAX: w
      };
      var A3 = $.asm($.asmGlobalArg, $.asmLibraryArg, B);
      $.asm = A3, $.___errno_location = function() {
        return $.asm.___errno_location.apply(null, arguments);
      };
      var Az = $._emscripten_replace_memory = function() {
        return $.asm._emscripten_replace_memory.apply(null, arguments);
      };
      $._free = function() {
        return $.asm._free.apply(null, arguments);
      };
      $._malloc = function() {
        return $.asm._malloc.apply(null, arguments);
      };
      $._memcpy = function() {
        return $.asm._memcpy.apply(null, arguments);
      }, $._memset = function() {
        return $.asm._memset.apply(null, arguments);
      }, $._sbrk = function() {
        return $.asm._sbrk.apply(null, arguments);
      }, $._stb_vorbis_js_channels = function() {
        return $.asm._stb_vorbis_js_channels.apply(null, arguments);
      }, $._stb_vorbis_js_close = function() {
        return $.asm._stb_vorbis_js_close.apply(null, arguments);
      }, $._stb_vorbis_js_decode = function() {
        return $.asm._stb_vorbis_js_decode.apply(null, arguments);
      }, $._stb_vorbis_js_open = function() {
        return $.asm._stb_vorbis_js_open.apply(null, arguments);
      }, $._stb_vorbis_js_sample_rate = function() {
        return $.asm._stb_vorbis_js_sample_rate.apply(null, arguments);
      }, $.establishStackSpace = function() {
        return $.asm.establishStackSpace.apply(null, arguments);
      }, $.getTempRet0 = function() {
        return $.asm.getTempRet0.apply(null, arguments);
      }, $.runPostSets = function() {
        return $.asm.runPostSets.apply(null, arguments);
      }, $.setTempRet0 = function() {
        return $.asm.setTempRet0.apply(null, arguments);
      }, $.setThrew = function() {
        return $.asm.setThrew.apply(null, arguments);
      };
      var A5 = $.stackAlloc = function() {
        return $.asm.stackAlloc.apply(null, arguments);
      }, A9 = $.stackRestore = function() {
        return $.asm.stackRestore.apply(null, arguments);
      }, IA = $.stackSave = function() {
        return $.asm.stackSave.apply(null, arguments);
      };
      function II(A4) {
        this.name = "ExitStatus", this.message = "Program terminated with exit(" + A4 + ")", this.status = A4;
      }
      function Ig(A4) {
        if (A4 = A4 || $.arguments, !(A7 > 0)) (function A8() {
          if ($.preRun) for ("function" == typeof $.preRun && ($.preRun = [$.preRun]); $.preRun.length; ) Aq($.preRun.shift());
          AY(AJ);
        })(), !(A7 > 0) && ($.calledRun || ($.setStatus ? ($.setStatus("Running..."), setTimeout(function() {
          setTimeout(function() {
            $.setStatus("");
          }, 1), I2();
        }, 1)) : I2()));
        function I2() {
          !$.calledRun && ($.calledRun = true, p || (A0 || (A0 = true, AY(Af)), AY(AH), $.onRuntimeInitialized && $.onRuntimeInitialized(), (function A8() {
            if ($.postRun) for ("function" == typeof $.postRun && ($.postRun = [$.postRun]); $.postRun.length; ) Ab($.postRun.shift());
            AY(AM);
          })()));
        }
      }
      function IE(A4) {
        throw $.onAbort && $.onAbort(A4), void 0 !== A4 ? (f(A4), H(A4), A4 = JSON.stringify(A4)) : A4 = "", p = true, "abort(" + A4 + "). Build with -s ASSERTIONS=1 for more info.";
      }
      if ($.dynCall_iii = function() {
        return $.asm.dynCall_iii.apply(null, arguments);
      }, $.asm = A3, $.ccall = j, $.cwrap = function A4(I2, g2, B2, E2) {
        var Q2 = (B2 = B2 || []).every(function(A8) {
          return "number" === A8;
        });
        return "string" !== g2 && Q2 && !E2 ? T(I2) : function() {
          return j(I2, g2, B2, arguments, E2);
        };
      }, II.prototype = Error(), II.prototype.constructor = II, AW = function A4() {
        $.calledRun || Ig(), $.calledRun || (AW = A4);
      }, $.run = Ig, $.abort = IE, $.preInit) for ("function" == typeof $.preInit && ($.preInit = [$.preInit]); $.preInit.length > 0; ) $.preInit.pop()();
      $.noExitRuntime = true, Ig(), $.onRuntimeInitialized = () => {
        isReady = true, readySolver();
      }, stbvorbis.decode = function(A4) {
        return (function A8(I2) {
          if (!isReady) throw Error("SF3 decoder has not been initialized yet. Did you await synth.isReady?");
          var g2 = {};
          function B2(A10) {
            return new Int32Array($.HEAPU8.buffer, A10, 1)[0];
          }
          function E2(A10, I3) {
            var g3 = new ArrayBuffer(I3 * Float32Array.BYTES_PER_ELEMENT), B3 = new Float32Array(g3);
            return B3.set(new Float32Array($.HEAPU8.buffer, A10, I3)), B3;
          }
          g2.open = $.cwrap("stb_vorbis_js_open", "number", []), g2.close = $.cwrap("stb_vorbis_js_close", "void", ["number"]), g2.channels = $.cwrap("stb_vorbis_js_channels", "number", ["number"]), g2.sampleRate = $.cwrap("stb_vorbis_js_sample_rate", "number", ["number"]), g2.decode = $.cwrap("stb_vorbis_js_decode", "number", [
            "number",
            "number",
            "number",
            "number",
            "number"
          ]);
          var Q2, C, i, h2, o = g2.open(), G = (Q2 = I2, C = I2.byteLength, i = $._malloc(C), (h2 = new Uint8Array($.HEAPU8.buffer, i, C)).set(new Uint8Array(Q2, 0, C)), h2), D = $._malloc(4), a2 = $._malloc(4), S2 = g2.decode(o, G.byteOffset, G.byteLength, D, a2);
          if ($._free(G.byteOffset), S2 < 0) throw g2.close(o), $._free(D), Error("stbvorbis decode failed: " + S2);
          for (var F = g2.channels(o), R = Array(F), s2 = new Int32Array($.HEAPU32.buffer, B2(D), F), w2 = 0; w2 < F; w2++) R[w2] = E2(s2[w2], S2), $._free(s2[w2]);
          var y2 = g2.sampleRate(o);
          return g2.close(o), $._free(B2(D)), $._free(D), {
            data: R,
            sampleRate: y2,
            eof: true,
            error: null
          };
        })(A4);
      };
    })();
    stb = stbvorbis;
    KeyModifier = class {
      /**
      * The new override velocity. -1 means unchanged.
      */
      velocity = -1;
      /**
      * The MIDI patch this key uses. -1 on any property means unchanged.
      */
      patch = {
        bankLSB: -1,
        bankMSB: -1,
        isGMGSDrum: false,
        program: -1
      };
      /**
      * Linear gain override for the voice.
      */
      gain = 1;
    };
    DEFAULT_GLOBAL_SYSTEM_PARAMETERS = {
      effectsEnabled: true,
      eventsEnabled: true,
      voiceCap: 350,
      autoAllocateVoices: false,
      reverbGain: 1,
      reverbLock: false,
      chorusGain: 1,
      chorusLock: false,
      delayGain: 1,
      delayLock: false,
      insertionEffectLock: false,
      drumLock: false,
      blackMIDIMode: false,
      deviceID: -1,
      gain: 1,
      pan: 0,
      keyShift: 0,
      fineTune: 0,
      interpolationType: InterpolationTypes.hermite,
      nrpnParamLock: false,
      monophonicRetrigger: false
    };
    MIN_TIMECENT = -15e3;
    timecentLookupTable = new Float32Array(15e3 - MIN_TIMECENT + 1);
    for (let i = 0; i < timecentLookupTable.length; i++) {
      const timecents = MIN_TIMECENT + i;
      timecentLookupTable[i] = Math.pow(2, timecents / 1200);
    }
    MIN_ABS_CENT = -2e4;
    MAX_ABS_CENT = 16500;
    absoluteCentLookupTable = new Float32Array(MAX_ABS_CENT - MIN_ABS_CENT + 1);
    for (let i = 0; i < absoluteCentLookupTable.length; i++) {
      const absoluteCents = MIN_ABS_CENT + i;
      absoluteCentLookupTable[i] = 440 * Math.pow(2, (absoluteCents - 6900) / 1200);
    }
    MIN_CENTIBELS = -16600;
    CENTIBEL_LOOKUP_TABLE = new Float32Array(16e3 - MIN_CENTIBELS + 1);
    for (let i = 0; i < CENTIBEL_LOOKUP_TABLE.length; i++) {
      const centibels = MIN_CENTIBELS + i;
      CENTIBEL_LOOKUP_TABLE[i] = Math.pow(10, -centibels / 200);
    }
    GeneratorTypes = Object.freeze({
      invalid: -1,
      startAddrsOffset: 0,
      endAddrOffset: 1,
      startloopAddrsOffset: 2,
      endloopAddrsOffset: 3,
      startAddrsCoarseOffset: 4,
      modLfoToPitch: 5,
      vibLfoToPitch: 6,
      modEnvToPitch: 7,
      initialFilterFc: 8,
      initialFilterQ: 9,
      modLfoToFilterFc: 10,
      modEnvToFilterFc: 11,
      endAddrsCoarseOffset: 12,
      modLfoToVolume: 13,
      chorusEffectsSend: 15,
      reverbEffectsSend: 16,
      pan: 17,
      delayModLFO: 21,
      freqModLFO: 22,
      delayVibLFO: 23,
      freqVibLFO: 24,
      delayModEnv: 25,
      attackModEnv: 26,
      holdModEnv: 27,
      decayModEnv: 28,
      sustainModEnv: 29,
      releaseModEnv: 30,
      keyNumToModEnvHold: 31,
      keyNumToModEnvDecay: 32,
      delayVolEnv: 33,
      attackVolEnv: 34,
      holdVolEnv: 35,
      decayVolEnv: 36,
      sustainVolEnv: 37,
      releaseVolEnv: 38,
      keyNumToVolEnvHold: 39,
      keyNumToVolEnvDecay: 40,
      instrument: 41,
      keyRange: 43,
      velRange: 44,
      startloopAddrsCoarseOffset: 45,
      keyNum: 46,
      velocity: 47,
      initialAttenuation: 48,
      endloopAddrsCoarseOffset: 50,
      coarseTune: 51,
      fineTune: 52,
      sampleID: 53,
      sampleModes: 54,
      scaleTuning: 56,
      exclusiveClass: 57,
      overridingRootKey: 58,
      endOper: 60,
      amplitude: 61,
      vibLfoRate: 62,
      vibLfoAmplitudeDepth: 63,
      vibLfoToFilterFc: 64,
      modLfoRate: 65,
      modLfoAmplitudeDepth: 66
    });
    MAX_GENERATOR = Math.max(...Object.values(GeneratorTypes));
    GENERATORS_AMOUNT = MAX_GENERATOR + 1;
    GeneratorLimits = Object.freeze({
      [GeneratorTypes.invalid]: {
        min: 0,
        max: 0,
        def: 0,
        nrpn: 0
      },
      [GeneratorTypes.endOper]: {
        min: 0,
        max: 0,
        def: 0,
        nrpn: 0
      },
      [GeneratorTypes.instrument]: {
        min: 0,
        max: 0,
        def: 0,
        nrpn: 0
      },
      [GeneratorTypes.sampleID]: {
        min: 0,
        max: 0,
        def: 0,
        nrpn: 0
      },
      [GeneratorTypes.keyRange]: {
        min: 0,
        max: 0,
        def: 0,
        nrpn: 0
      },
      [GeneratorTypes.velRange]: {
        min: 0,
        max: 0,
        def: 0,
        nrpn: 0
      },
      [GeneratorTypes.startAddrsOffset]: {
        min: 0,
        max: 32768,
        def: 0,
        nrpn: 1
      },
      [GeneratorTypes.endAddrOffset]: {
        min: -32768,
        max: 32768,
        def: 0,
        nrpn: 1
      },
      [GeneratorTypes.startloopAddrsOffset]: {
        min: -32768,
        max: 32768,
        def: 0,
        nrpn: 1
      },
      [GeneratorTypes.endloopAddrsOffset]: {
        min: -32768,
        max: 32768,
        def: 0,
        nrpn: 1
      },
      [GeneratorTypes.startAddrsCoarseOffset]: {
        min: 0,
        max: 32768,
        def: 0,
        nrpn: 1
      },
      [GeneratorTypes.modLfoToPitch]: {
        min: -12e3,
        max: 12e3,
        def: 0,
        nrpn: 2
      },
      [GeneratorTypes.vibLfoToPitch]: {
        min: -12e3,
        max: 12e3,
        def: 0,
        nrpn: 2
      },
      [GeneratorTypes.modEnvToPitch]: {
        min: -12e3,
        max: 12e3,
        def: 0,
        nrpn: 2
      },
      [GeneratorTypes.initialFilterFc]: {
        min: 1500,
        max: 13500,
        def: 13500,
        nrpn: 2
      },
      [GeneratorTypes.initialFilterQ]: {
        min: 0,
        max: 960,
        def: 0,
        nrpn: 1
      },
      [GeneratorTypes.modLfoToFilterFc]: {
        min: -12e3,
        max: 12e3,
        def: 0,
        nrpn: 2
      },
      [GeneratorTypes.modEnvToFilterFc]: {
        min: -12e3,
        max: 12e3,
        def: 0,
        nrpn: 2
      },
      [GeneratorTypes.endAddrsCoarseOffset]: {
        min: -32768,
        max: 32768,
        def: 0,
        nrpn: 1
      },
      [GeneratorTypes.modLfoToVolume]: {
        min: -960,
        max: 960,
        def: 0,
        nrpn: 1
      },
      [GeneratorTypes.chorusEffectsSend]: {
        min: 0,
        max: 1e3,
        def: 0,
        nrpn: 1
      },
      [GeneratorTypes.reverbEffectsSend]: {
        min: 0,
        max: 1e3,
        def: 0,
        nrpn: 1
      },
      [GeneratorTypes.pan]: {
        min: -500,
        max: 500,
        def: 0,
        nrpn: 1
      },
      [GeneratorTypes.delayModLFO]: {
        min: -12e3,
        max: 5e3,
        def: -12e3,
        nrpn: 2
      },
      [GeneratorTypes.freqModLFO]: {
        min: -16e3,
        max: 4500,
        def: 0,
        nrpn: 4
      },
      [GeneratorTypes.delayVibLFO]: {
        min: -12e3,
        max: 5e3,
        def: -12e3,
        nrpn: 2
      },
      [GeneratorTypes.freqVibLFO]: {
        min: -16e3,
        max: 4500,
        def: 0,
        nrpn: 4
      },
      [GeneratorTypes.delayModEnv]: {
        min: -32768,
        max: 5e3,
        def: -32768,
        nrpn: 2
      },
      [GeneratorTypes.attackModEnv]: {
        min: -32768,
        max: 8e3,
        def: -32768,
        nrpn: 2
      },
      [GeneratorTypes.holdModEnv]: {
        min: -12e3,
        max: 5e3,
        def: -12e3,
        nrpn: 2
      },
      [GeneratorTypes.decayModEnv]: {
        min: -12e3,
        max: 8e3,
        def: -12e3,
        nrpn: 2
      },
      [GeneratorTypes.sustainModEnv]: {
        min: 0,
        max: 1e3,
        def: 0,
        nrpn: 1
      },
      [GeneratorTypes.releaseModEnv]: {
        min: -12e3,
        max: 8e3,
        def: -12e3,
        nrpn: 2
      },
      [GeneratorTypes.keyNumToModEnvHold]: {
        min: -1200,
        max: 1200,
        def: 0,
        nrpn: 1
      },
      [GeneratorTypes.keyNumToModEnvDecay]: {
        min: -1200,
        max: 1200,
        def: 0,
        nrpn: 1
      },
      [GeneratorTypes.delayVolEnv]: {
        min: -12e3,
        max: 5e3,
        def: -12e3,
        nrpn: 2
      },
      [GeneratorTypes.attackVolEnv]: {
        min: -12e3,
        max: 8e3,
        def: -12e3,
        nrpn: 2
      },
      [GeneratorTypes.holdVolEnv]: {
        min: -12e3,
        max: 5e3,
        def: -12e3,
        nrpn: 2
      },
      [GeneratorTypes.decayVolEnv]: {
        min: -12e3,
        max: 8e3,
        def: -12e3,
        nrpn: 2
      },
      [GeneratorTypes.sustainVolEnv]: {
        min: 0,
        max: 1440,
        def: 0,
        nrpn: 1
      },
      [GeneratorTypes.releaseVolEnv]: {
        min: -12e3,
        max: 8e3,
        def: -12e3,
        nrpn: 2
      },
      [GeneratorTypes.keyNumToVolEnvHold]: {
        min: -1200,
        max: 1200,
        def: 0,
        nrpn: 1
      },
      [GeneratorTypes.keyNumToVolEnvDecay]: {
        min: -1200,
        max: 1200,
        def: 0,
        nrpn: 1
      },
      [GeneratorTypes.startloopAddrsCoarseOffset]: {
        min: -32768,
        max: 32768,
        def: 0,
        nrpn: 1
      },
      [GeneratorTypes.keyNum]: {
        min: -1,
        max: 127,
        def: -1,
        nrpn: 1
      },
      [GeneratorTypes.velocity]: {
        min: -1,
        max: 127,
        def: -1,
        nrpn: 1
      },
      [GeneratorTypes.initialAttenuation]: {
        min: 0,
        max: 1440,
        def: 0,
        nrpn: 1
      },
      [GeneratorTypes.endloopAddrsCoarseOffset]: {
        min: -32768,
        max: 32768,
        def: 0,
        nrpn: 1
      },
      [GeneratorTypes.coarseTune]: {
        min: -120,
        max: 120,
        def: 0,
        nrpn: 1
      },
      [GeneratorTypes.fineTune]: {
        min: -12700,
        max: 12700,
        def: 0,
        nrpn: 1
      },
      [GeneratorTypes.scaleTuning]: {
        min: 0,
        max: 1200,
        def: 100,
        nrpn: 1
      },
      [GeneratorTypes.exclusiveClass]: {
        min: 0,
        max: 99999,
        def: 0,
        nrpn: 0
      },
      [GeneratorTypes.overridingRootKey]: {
        min: -1,
        max: 127,
        def: -1,
        nrpn: 0
      },
      [GeneratorTypes.sampleModes]: {
        min: 0,
        max: 3,
        def: 0,
        nrpn: 0
      },
      [GeneratorTypes.amplitude]: {
        min: -1e3,
        max: 1e3,
        def: 0,
        nrpn: 1
      },
      [GeneratorTypes.vibLfoRate]: {
        min: -1e3,
        max: 1e3,
        def: 0,
        nrpn: 1
      },
      [GeneratorTypes.vibLfoToFilterFc]: {
        min: -12e3,
        max: 12e3,
        def: 0,
        nrpn: 2
      },
      [GeneratorTypes.vibLfoAmplitudeDepth]: {
        min: 0,
        max: 1e3,
        def: 0,
        nrpn: 1
      },
      [GeneratorTypes.modLfoRate]: {
        min: -1e3,
        max: 1e3,
        def: 0,
        nrpn: 1
      },
      [GeneratorTypes.modLfoAmplitudeDepth]: {
        min: 0,
        max: 1e3,
        def: 0,
        nrpn: 1
      }
    });
    SampleTypes = {
      monoSample: 1,
      rightSample: 2,
      leftSample: 4,
      linkedSample: 8,
      romMonoSample: 32769,
      romRightSample: 32770,
      romLeftSample: 32772,
      romLinkedSample: 32776
    };
    ModulatorControllerSources = {
      noController: 0,
      noteOnVelocity: 2,
      noteOnKeyNum: 3,
      polyPressure: 10,
      channelPressure: 13,
      pitchWheel: 14,
      pitchWheelRange: 16,
      link: 127
    };
    ModulatorCurveTypes = {
      linear: 0,
      concave: 1,
      convex: 2,
      switch: 3
    };
    MODULATOR_RESOLUTION = 16384;
    MOD_CURVE_TYPES_AMOUNT = Object.keys(ModulatorCurveTypes).length;
    concave = new Float32Array(MODULATOR_RESOLUTION + 1);
    convex = new Float32Array(MODULATOR_RESOLUTION + 1);
    concave[0] = 0;
    concave[concave.length - 1] = 1;
    convex[0] = 0;
    convex[convex.length - 1] = 1;
    for (let i = 1; i < MODULATOR_RESOLUTION - 1; i++) {
      const x = -400 / 960 * Math.log(i / (concave.length - 1)) / Math.LN10;
      convex[i] = 1 - x;
      concave[concave.length - 1 - i] = x;
    }
    CONVEX_ATTACK = new Float32Array(1e3);
    for (let i = 0; i < CONVEX_ATTACK.length; i++) CONVEX_ATTACK[i] = getModulatorCurveValue(0, ModulatorCurveTypes.convex, i / 1e3);
    ModulatorSource = class ModulatorSource2 {
      /**
      * If this field is set to false, the controller should be mapped with a minimum value of 0 and a maximum value of 1. This is also
      * called Unipolar. Thus, it behaves similar to the Modulation Wheel controller of the MIDI specification.
      *
      * If this field is set to true, the controller should be mapped with a minimum value of -1 and a maximum value of 1. This is also
      * called Bipolar. Thus, it behaves similar to the Pitch Wheel controller of the MIDI specification.
      */
      isBipolar;
      /**
      * If this field is set true, the direction of the controller should be from the maximum value to the minimum value. So, for
      * example, if the controller source is Key Number, then a Key Number value of 0 corresponds to the maximum possible
      * controller output, and the Key Number value of 127 corresponds to the minimum possible controller input.
      */
      isNegative;
      /**
      * The index of the source.
      * It can point to one of the MIDI controllers or one of the predefined sources, depending on the 'isCC' flag.
      */
      index;
      /**
      * If this field is set to true, the MIDI Controller Palette is selected. The ‘index’ field value corresponds to one of the 128
      * MIDI Continuous Controller messages as defined in the MIDI specification.
      */
      isCC;
      /**
      * This field specifies how the minimum value approaches the maximum value.
      */
      curveType;
      /**
      * @internal
      * @param index
      * @param curveType
      * @param isCC
      * @param isBipolar
      * @param isNegative
      */
      constructor(index = ModulatorControllerSources.noController, curveType = ModulatorCurveTypes.linear, isCC = false, isBipolar = false, isNegative = false) {
        this.isBipolar = isBipolar;
        this.isNegative = isNegative;
        this.index = index;
        this.isCC = isCC;
        this.curveType = curveType;
      }
      get sourceName() {
        return this.isCC ? Object.keys(MIDIControllers).find((k) => MIDIControllers[k] === this.index) ?? this.index.toString() : Object.keys(ModulatorControllerSources).find((k) => ModulatorControllerSources[k] === this.index) ?? this.index.toString();
      }
      get curveTypeName() {
        return Object.keys(ModulatorCurveTypes).find((k) => ModulatorCurveTypes[k] === this.curveType) ?? this.curveType.toString();
      }
      static fromSourceEnum(sourceEnum) {
        const isBipolar = bitMaskToBool(sourceEnum, 9);
        const isNegative = bitMaskToBool(sourceEnum, 8);
        const isCC = bitMaskToBool(sourceEnum, 7);
        return new ModulatorSource2(sourceEnum & 127, sourceEnum >> 10 & 3, isCC, isBipolar, isNegative);
      }
      /**
      * Copies the modulator source.
      * @param source The source to copy from.
      * @returns the copied source.
      */
      static copyFrom(source) {
        return new ModulatorSource2(source.index, source.curveType, source.isCC, source.isBipolar, source.isNegative);
      }
      toString() {
        return `${this.sourceName} ${this.curveTypeName} ${this.isBipolar ? "bipolar" : "unipolar"} ${this.isNegative ? "negative" : "positive"}`;
      }
      toSourceEnum() {
        return this.curveType << 10 | toNumericBool(this.isBipolar) << 9 | toNumericBool(this.isNegative) << 8 | toNumericBool(this.isCC) << 7 | this.index;
      }
      isIdentical(source) {
        return this.index === source.index && this.isNegative === source.isNegative && this.isCC === source.isCC && this.isBipolar === source.isBipolar && this.curveType === source.curveType;
      }
      /**
      * Gets the current value from this source.
      * @param channel the MIDI channel to compute for.
      * @param pitchWheel the pitch wheel value, as channel determines if it's a per-note or a global value.
      * @param voice The voice to get the data for.
      */
      getValue(channel, pitchWheel, voice) {
        let rawValue;
        if (this.isCC) rawValue = channel.midiControllers[this.index];
        else switch (this.index) {
          default:
          case ModulatorControllerSources.noController:
            rawValue = 16383;
            break;
          case ModulatorControllerSources.noteOnVelocity:
            rawValue = voice.velocity << 7;
            break;
          case ModulatorControllerSources.noteOnKeyNum:
            rawValue = voice.targetKey << 7;
            break;
          case ModulatorControllerSources.polyPressure:
            rawValue = voice.pressure << 7;
            break;
          case ModulatorControllerSources.channelPressure:
            rawValue = channel.midiParameters.pressure << 7;
            break;
          case ModulatorControllerSources.pitchWheel:
            rawValue = pitchWheel;
            break;
          case ModulatorControllerSources.pitchWheelRange:
            rawValue = Math.floor(channel.midiParameters.pitchWheelRange * 128);
        }
        const transformType = (this.isBipolar ? 2 : 0) | (this.isNegative ? 1 : 0);
        return MODULATOR_TRANSFORMS[MODULATOR_RESOLUTION * (this.curveType * MOD_CURVE_TYPES_AMOUNT + transformType) + rawValue];
      }
    };
    MODULATOR_TRANSFORMS = new Float32Array(MODULATOR_RESOLUTION * 4 * MOD_CURVE_TYPES_AMOUNT);
    for (let curveType = 0; curveType < MOD_CURVE_TYPES_AMOUNT; curveType++) for (let transformType = 0; transformType < 4; transformType++) {
      const tableIndex = MODULATOR_RESOLUTION * (curveType * MOD_CURVE_TYPES_AMOUNT + transformType);
      for (let value = 0; value < MODULATOR_RESOLUTION; value++) MODULATOR_TRANSFORMS[tableIndex + value] = getModulatorCurveValue(transformType, curveType, value / MODULATOR_RESOLUTION);
    }
    DEFAULT_RESONANT_MOD_SOURCE = getModSourceEnum(ModulatorCurveTypes.linear, true, false, true, MIDIControllers.filterResonance);
    Modulator = class Modulator2 {
      /**
      * The generator destination of this modulator.
      */
      destination = GeneratorTypes.initialAttenuation;
      /**
      * The transform amount for this modulator.
      */
      transformAmount = 0;
      /**
      * The transform type for this modulator.
      */
      transformType = 0;
      /**
      * The primary source of this modulator.
      */
      primarySource;
      /**
      * The secondary source of this modulator.
      */
      secondarySource;
      /**
      * Creates a new SF2 Modulator
      */
      constructor(primarySource = new ModulatorSource(), secondarySource = new ModulatorSource(), destination = GeneratorTypes.invalid, amount = 0, transformType = 0) {
        this.primarySource = primarySource;
        this.secondarySource = secondarySource;
        this.destination = destination;
        this.transformAmount = amount;
        this.transformType = transformType;
      }
      get destinationName() {
        return Object.keys(GeneratorTypes).find((k) => GeneratorTypes[k] === this.destination);
      }
      /**
      * Checks if the pair of modulators is identical (in SF2 terms)
      * @param mod1 modulator 1
      * @param mod2 modulator 2
      * @param checkAmount if the amount should be checked too.
      * @returns if they are identical
      */
      static isIdentical(mod1, mod2, checkAmount = false) {
        return mod1.primarySource.isIdentical(mod2.primarySource) && mod1.secondarySource.isIdentical(mod2.secondarySource) && mod1.destination === mod2.destination && mod1.transformType === mod2.transformType && (!checkAmount || mod1.transformAmount === mod2.transformAmount);
      }
      /**
      * Copies a modulator.
      * @param mod The modulator to copy.
      * @returns The copied modulator.
      */
      static copyFrom(mod) {
        return new Modulator2(ModulatorSource.copyFrom(mod.primarySource), ModulatorSource.copyFrom(mod.secondarySource), mod.destination, mod.transformAmount, mod.transformType);
      }
      toString() {
        return `Source: ${this.primarySource.toString()}
Secondary source: ${this.secondarySource.toString()}
to: ${this.destinationName}
amount: ${this.transformAmount}` + (this.transformType === 2 ? "absolute value" : "");
      }
      write(modData, indexes) {
        writeWord(modData, this.primarySource.toSourceEnum());
        writeWord(modData, this.destination);
        writeWord(modData, this.transformAmount);
        writeWord(modData, this.secondarySource.toSourceEnum());
        writeWord(modData, this.transformType);
        if (!indexes) return;
        indexes.mod++;
      }
      /**
      * Sums transform and create a NEW modulator
      * @param modulator the modulator to sum with
      * @returns the new modulator
      */
      sumTransform(modulator) {
        const m = Modulator2.copyFrom(this);
        m.transformAmount += modulator.transformAmount;
        return m;
      }
    };
    DecodedModulator = class extends Modulator {
      /**
      * Reads an SF2 modulator
      * @param sourceEnum SF2 source enum
      * @param secondarySourceEnum SF2 secondary source enum
      * @param destination destination
      * @param amount amount
      * @param transformType transform type
      */
      constructor(sourceEnum, secondarySourceEnum, destination, amount, transformType) {
        super(ModulatorSource.fromSourceEnum(sourceEnum), ModulatorSource.fromSourceEnum(secondarySourceEnum), destination, amount, transformType);
        if (this.destination > MAX_GENERATOR) this.destination = GeneratorTypes.invalid;
      }
    };
    defaultSoundFont2Modulators = [
      new DecodedModulator(getModSourceEnum(ModulatorCurveTypes.concave, false, true, false, ModulatorControllerSources.noteOnVelocity), 0, GeneratorTypes.initialAttenuation, 960, 0),
      new DecodedModulator(129, 0, GeneratorTypes.vibLfoToPitch, 50, 0),
      new DecodedModulator(getModSourceEnum(ModulatorCurveTypes.concave, false, true, true, MIDIControllers.mainVolume), 0, GeneratorTypes.initialAttenuation, 960, 0),
      new DecodedModulator(13, 0, GeneratorTypes.vibLfoToPitch, 50, 0),
      new DecodedModulator(526, 16, GeneratorTypes.fineTune, 12700, 0),
      new DecodedModulator(650, 0, GeneratorTypes.pan, 500, 0),
      new DecodedModulator(getModSourceEnum(ModulatorCurveTypes.concave, false, true, true, MIDIControllers.expression), 0, GeneratorTypes.initialAttenuation, 960, 0),
      new DecodedModulator(219, 0, GeneratorTypes.reverbEffectsSend, 200, 0),
      new DecodedModulator(221, 0, GeneratorTypes.chorusEffectsSend, 200, 0)
    ];
    defaultSpessaSynthModulators = [
      new DecodedModulator(getModSourceEnum(ModulatorCurveTypes.convex, true, false, true, MIDIControllers.attackTime), 0, GeneratorTypes.attackVolEnv, 6e3, 0),
      new DecodedModulator(getModSourceEnum(ModulatorCurveTypes.linear, true, false, true, MIDIControllers.releaseTime), 0, GeneratorTypes.releaseVolEnv, 3600, 0),
      new DecodedModulator(getModSourceEnum(ModulatorCurveTypes.linear, true, false, true, MIDIControllers.decayTime), 0, GeneratorTypes.decayVolEnv, 3600, 0),
      new DecodedModulator(getModSourceEnum(ModulatorCurveTypes.linear, true, false, true, MIDIControllers.brightness), 0, GeneratorTypes.initialFilterFc, 9600, 0),
      new DecodedModulator(DEFAULT_RESONANT_MOD_SOURCE, 0, GeneratorTypes.initialFilterQ, 250, 0),
      new DecodedModulator(getModSourceEnum(ModulatorCurveTypes.switch, false, false, true, MIDIControllers.softPedal), 0, GeneratorTypes.initialAttenuation, 50, 0),
      new DecodedModulator(getModSourceEnum(ModulatorCurveTypes.switch, false, false, true, MIDIControllers.softPedal), 0, GeneratorTypes.initialFilterFc, -2400, 0),
      new DecodedModulator(getModSourceEnum(ModulatorCurveTypes.linear, true, false, true, MIDIControllers.balance), 0, GeneratorTypes.pan, 500, 0)
    ];
    SPESSASYNTH_DEFAULT_MODULATORS = [...defaultSoundFont2Modulators, ...defaultSpessaSynthModulators];
    Generator = class {
      /**
      * The generator's SF2 type.
      */
      type;
      /**
      * The generator's 16-bit value.
      */
      value = 0;
      /**
      * Constructs a new generator
      * @param type generator type
      * @param value generator value
      * @param validate if the limits should be validated and clamped.
      */
      constructor(type, value, validate = true) {
        this.type = type;
        if (value === void 0) throw new Error("No value provided.");
        this.value = Math.round(value);
        if (validate) {
          const lim = GeneratorLimits[type];
          if (lim !== void 0) this.value = Math.max(lim.min, Math.min(lim.max, this.value));
        }
      }
      write(genData) {
        writeWord(genData, this.type);
        writeWord(genData, this.value);
      }
      toString() {
        return `${Object.keys(GeneratorTypes).find((k) => GeneratorTypes[k] === this.type)}: ${this.value}`;
      }
    };
    BasicZone = class {
      /**
      * The zone's velocity range.
      * min -1 means that it is a default value
      */
      velRange = {
        min: -1,
        max: 127
      };
      /**
      * The zone's key range.
      * min -1 means that it is a default value.
      */
      keyRange = {
        min: -1,
        max: 127
      };
      /**
      * The zone's generators.
      */
      generators = [];
      /**
      * The zone's modulators.
      */
      modulators = [];
      get hasKeyRange() {
        return this.keyRange.min !== -1;
      }
      get hasVelRange() {
        return this.velRange.min !== -1;
      }
      /**
      * The current tuning in cents, taking in both coarse and fine generators.
      */
      get fineTuning() {
        const currentCoarse = this.getGenerator(GeneratorTypes.coarseTune, 0);
        const currentFine = this.getGenerator(GeneratorTypes.fineTune, 0);
        return currentCoarse * 100 + currentFine;
      }
      /**
      * The current tuning in cents, taking in both coarse and fine generators.
      */
      set fineTuning(tuningCents) {
        const coarse = Math.trunc(tuningCents / 100);
        const fine = tuningCents % 100;
        this.setGenerator(GeneratorTypes.coarseTune, coarse);
        this.setGenerator(GeneratorTypes.fineTune, fine);
      }
      /**
      * Adds to a given generator, or its default value.
      * @param type the generator type.
      * @param value the value to add.
      * @param validate if the value should be clamped to allowed limits.
      */
      addToGenerator(type, value, validate = true) {
        const genValue = this.getGenerator(type, GeneratorLimits[type].def);
        this.setGenerator(type, value + genValue, validate);
      }
      /**
      * Sets a generator to a given value if preset, otherwise adds a new one.
      * @param type the generator type.
      * @param value the value to set. Set to null to remove this generator (set as "unset").
      * @param validate if the value should be clamped to allowed limits.
      */
      setGenerator(type, value, validate = true) {
        switch (type) {
          case GeneratorTypes.sampleID:
            throw new Error("Use setSample()");
          case GeneratorTypes.instrument:
            throw new Error("Use setInstrument()");
          case GeneratorTypes.velRange:
          case GeneratorTypes.keyRange:
            throw new Error("Set the range manually");
        }
        if (value === null) {
          this.generators = this.generators.filter((g) => g.type !== type);
          return;
        }
        const index = this.generators.findIndex((g) => g.type === type);
        if (index === -1) this.addGenerators(new Generator(type, value, validate));
        else this.generators[index] = new Generator(type, value, validate);
      }
      /**
      * Adds generators to the zone.
      * @param generators the generators to add.
      */
      addGenerators(...generators) {
        for (const g of generators) switch (g.type) {
          default:
            this.generators.push(g);
            break;
          case GeneratorTypes.sampleID:
          case GeneratorTypes.instrument:
            break;
          case GeneratorTypes.velRange:
            this.velRange.min = g.value & 127;
            this.velRange.max = g.value >> 8 & 127;
            break;
          case GeneratorTypes.keyRange:
            this.keyRange.min = g.value & 127;
            this.keyRange.max = g.value >> 8 & 127;
        }
      }
      /**
      * Adds modulators to the zone.
      * @param modulators the modulators to add.
      */
      addModulators(...modulators) {
        this.modulators.push(...modulators);
      }
      /**
      * Gets a generator value.
      * @param generatorType the generator type.
      * @param notFoundValue if the generator is not found, this value is returned. A default value can be passed here, or null for example,
      * to check if the generator is set.
      */
      getGenerator(generatorType, notFoundValue) {
        return this.generators.find((g) => g.type === generatorType)?.value ?? notFoundValue;
      }
      copyFrom(zone) {
        this.generators = zone.generators.map((g) => new Generator(g.type, g.value, false));
        this.modulators = zone.modulators.map(Modulator.copyFrom.bind(Modulator));
        this.velRange = { ...zone.velRange };
        this.keyRange = { ...zone.keyRange };
      }
      /**
      * Filters the generators and prepends the range generators.
      */
      getWriteGenerators(bank) {
        const generators = this.generators.filter((g) => g.type !== GeneratorTypes.sampleID && g.type !== GeneratorTypes.instrument && g.type !== GeneratorTypes.keyRange && g.type !== GeneratorTypes.velRange);
        if (!bank) throw new Error("No bank provided! ");
        if (this.hasVelRange) generators.unshift(new Generator(GeneratorTypes.velRange, this.velRange.max << 8 | Math.max(this.velRange.min, 0), false));
        if (this.hasKeyRange) generators.unshift(new Generator(GeneratorTypes.keyRange, this.keyRange.max << 8 | Math.max(this.keyRange.min, 0), false));
        return generators;
      }
    };
    RESAMPLE_RATE = 48e3;
    BasicSample = class {
      /**
      * The sample's name.
      */
      name;
      /**
      * Sample rate in Hz.
      */
      sampleRate;
      /**
      * Original pitch of the sample as a MIDI note number.
      */
      originalKey;
      /**
      * Pitch correction, in cents. Can be negative.
      */
      pitchCorrection;
      /**
      * Linked sample, unused if mono.
      */
      linkedSample;
      /**
      * The type of the sample.
      */
      sampleType;
      /**
      * The sample's loop start index, inclusive.
      * In sample data points, relative to the start of the sample.
      *
      * Minimum allowed value is 0.
      */
      loopStart;
      /**
      * The sample's loop end index, exclusive.
      * In sample data points, relative to the start of the sample.
      *
      * Maximum allowed value is the sample data length.
      */
      loopEnd;
      /**
      * Sample's linked instruments (the instruments that use it)
      * note that duplicates are allowed since one instrument can use the same sample multiple times.
      */
      linkedTo = [];
      /**
      * Indicates if the data was overridden, so it cannot be copied back unchanged.
      */
      dataOverridden = true;
      /**
      * The compressed sample data if the sample has been compressed.
      */
      compressedData;
      /**
      * The sample's audio data.
      */
      audioData;
      /**
      * The basic representation of a sample.
      * @param sampleName The sample's name.
      * @param sampleRate The sample's rate in Hz.
      * @param originalKey The sample's pitch as a MIDI note number.
      * @param pitchCorrection The sample's pitch correction in cents.
      * @param sampleType The sample's type, an enum that can indicate SF3.
      * @param loopStart The sample's loop start relative to the sample start in sample points.
      * @param loopEnd The sample's loop end relative to the sample start in sample points. Inclusive.
      */
      constructor(sampleName, sampleRate, originalKey, pitchCorrection, sampleType, loopStart, loopEnd) {
        this.name = sampleName;
        this.sampleRate = sampleRate;
        this.originalKey = originalKey;
        this.pitchCorrection = pitchCorrection;
        this.loopStart = loopStart;
        this.loopEnd = loopEnd;
        this.sampleType = sampleType;
      }
      /**
      * Indicates if the sample is compressed using vorbis SF3.
      */
      get isCompressed() {
        return this.compressedData !== void 0;
      }
      /**
      * If the sample is linked to another sample.
      */
      get isLinked() {
        return this.sampleType === SampleTypes.rightSample || this.sampleType === SampleTypes.leftSample || this.sampleType === SampleTypes.linkedSample;
      }
      /**
      * The sample's use count
      */
      get useCount() {
        return this.linkedTo.length;
      }
      /**
      * Get raw data for writing the file, either a compressed bit stream or signed 16-bit little endian PCM data.
      * @param allowVorbis if vorbis file data is allowed.
      * @return either s16le or vorbis data.
      */
      getRawData(allowVorbis) {
        if (this.compressedData && allowVorbis && !this.dataOverridden) return this.compressedData;
        return this.encodeS16LE();
      }
      /**
      * Resamples the audio data to a given sample rate.
      */
      resampleData(newSampleRate) {
        let audioData = this.getAudioData();
        const ratio = newSampleRate / this.sampleRate;
        const resampled = new Float32Array(Math.floor(audioData.length * ratio));
        for (let i = 0; i < resampled.length; i++) resampled[i] = audioData[Math.floor(i * (1 / ratio))];
        audioData = resampled;
        this.sampleRate = newSampleRate;
        this.loopStart = Math.floor(this.loopStart * ratio);
        this.loopEnd = Math.floor(this.loopEnd * ratio);
        this.audioData = audioData;
      }
      /**
      * Compresses the audio data
      * @param encodeVorbis the compression function to use when compressing
      */
      async compressSample(encodeVorbis) {
        if (this.isCompressed) return;
        try {
          let audioData = this.getAudioData();
          if (this.sampleRate < 8e3 || this.sampleRate > 96e3) {
            this.resampleData(RESAMPLE_RATE);
            audioData = this.getAudioData();
          }
          const compressed = await encodeVorbis(audioData, this.sampleRate);
          this.setCompressedData(compressed);
        } catch (error) {
          SpessaLog.warn(`Failed to compress ${this.name}. Leaving as uncompressed!`, error);
          this.compressedData = void 0;
        }
      }
      /**
      * Sets the sample type and unlinks if needed.
      * @param type The type to set it to.
      */
      setSampleType(type) {
        this.sampleType = type;
        if (!this.isLinked) {
          if (this.linkedSample) {
            this.linkedSample.linkedSample = void 0;
            this.linkedSample.sampleType = type;
          }
          this.linkedSample = void 0;
        }
        if ((type & 32768) > 0) throw new Error("ROM samples are not supported.");
      }
      /**
      * Unlinks the sample from its stereo link if it has any.
      */
      unlinkSample() {
        this.setSampleType(SampleTypes.monoSample);
      }
      /**
      * Links a stereo sample.
      * @param sample the sample to link to.
      * @param type either left, right or linked.
      */
      setLinkedSample(sample, type) {
        if (sample.linkedSample) throw new Error(`${sample.name} is linked tp ${sample.linkedSample.name}. Unlink it first.`);
        this.linkedSample = sample;
        sample.linkedSample = this;
        switch (type) {
          case SampleTypes.leftSample:
            this.setSampleType(SampleTypes.leftSample);
            sample.setSampleType(SampleTypes.rightSample);
            break;
          case SampleTypes.rightSample:
            this.setSampleType(SampleTypes.rightSample);
            sample.setSampleType(SampleTypes.leftSample);
            break;
          case SampleTypes.linkedSample:
            this.setSampleType(SampleTypes.linkedSample);
            sample.setSampleType(SampleTypes.linkedSample);
            break;
          default:
            throw new Error("Invalid sample type: " + type);
        }
      }
      /**
      * Links the sample to a given instrument
      * @param instrument the instrument to link to
      */
      linkTo(instrument) {
        this.linkedTo.push(instrument);
      }
      /**
      * Unlinks the sample from a given instrument
      * @param instrument the instrument to unlink from
      */
      unlinkFrom(instrument) {
        const index = this.linkedTo.indexOf(instrument);
        if (index === -1) {
          SpessaLog.warn(`Cannot unlink ${instrument.name} from ${this.name}: not linked.`);
          return;
        }
        this.linkedTo.splice(index, 1);
      }
      /**
      * Get the float32 audio data.
      * Note that this either decodes the compressed data or passes the ready sampleData.
      * If neither are set then it will throw an error!
      * @returns the audio data
      */
      getAudioData() {
        if (this.audioData) return this.audioData;
        if (this.isCompressed) {
          this.audioData = this.decodeVorbis();
          return this.audioData;
        }
        throw new Error("Sample data is undefined for a BasicSample instance.");
      }
      /**
      * Replaces the audio data *in-place*.
      * @param audioData The new audio data as Float32.
      * @param sampleRate The new sample rate, in Hertz.
      */
      setAudioData(audioData, sampleRate) {
        this.audioData = audioData;
        this.sampleRate = sampleRate;
        this.dataOverridden = true;
        this.compressedData = void 0;
      }
      /**
      * Replaces the audio with a compressed data sample and flags the sample as compressed
      * @param data the new compressed data
      */
      setCompressedData(data) {
        this.audioData = void 0;
        this.compressedData = data;
        this.dataOverridden = false;
      }
      /**
      * Encodes s16le sample
      * @return the encoded data
      */
      encodeS16LE() {
        const data = this.getAudioData();
        const data16 = new Int16Array(data.length);
        const len = data.length;
        for (let i = 0; i < len; i++) {
          let sample = data[i] * 32768;
          if (sample > 32767) sample = 32767;
          else if (sample < -32768) sample = -32768;
          data16[i] = sample;
        }
        return new IndexedByteArray(data16.buffer);
      }
      /**
      * Decode binary vorbis into a float32 pcm
      */
      decodeVorbis() {
        if (this.audioData) return this.audioData;
        if (!this.compressedData) throw new Error("Compressed data is missing.");
        try {
          const decoded = stb.decode(this.compressedData).data[0];
          if (decoded === void 0) {
            SpessaLog.warn(`Error decoding sample ${this.name}: Vorbis decode returned undefined.`);
            return new Float32Array(0);
          }
          for (let i = 0; i < decoded.length; i++) decoded[i] = Math.max(-1, Math.min(decoded[i], 0.999969482421875));
          return decoded;
        } catch (error) {
          SpessaLog.warn(`Error decoding sample ${this.name}: ${error}`);
          return new Float32Array(this.loopEnd);
        }
      }
    };
    EmptySample = class extends BasicSample {
      /**
      * A simplified class for creating samples.
      */
      constructor() {
        super("", 44100, 60, 0, SampleTypes.monoSample, 0, 0);
      }
    };
    BasicInstrumentZone = class extends BasicZone {
      /**
      * The instrument this zone belongs to.
      */
      parentInstrument;
      /**
      * For tracking on the individual zone level, since multiple presets can refer to the same instrument.
      */
      useCount;
      /**
      * Creates a new instrument zone.
      * @param instrument The parent instrument.
      * @param sample The sample to use in this zone.
      */
      constructor(instrument, sample) {
        super();
        this.parentInstrument = instrument;
        this._sample = sample;
        sample.linkTo(this.parentInstrument);
        this.useCount = instrument.useCount;
      }
      /**
      * Zone's sample.
      */
      _sample;
      /**
      * Zone's sample.
      */
      get sample() {
        return this._sample;
      }
      /**
      * Sets a sample for this zone.
      * @param sample the sample to set.
      */
      set sample(sample) {
        if (this._sample) this._sample.unlinkFrom(this.parentInstrument);
        this._sample = sample;
        sample.linkTo(this.parentInstrument);
      }
      getWriteGenerators(bank) {
        const gens = super.getWriteGenerators(bank);
        const sampleID = bank.samples.indexOf(this.sample);
        if (sampleID === -1) throw new Error(`${this.sample.name} does not exist in ${bank.soundBankInfo.name}! Cannot write sampleID generator.`);
        gens.push(new Generator(GeneratorTypes.sampleID, sampleID, false));
        return gens;
      }
    };
    BasicPresetZone = class extends BasicZone {
      /**
      * The preset this zone belongs to.
      */
      parentPreset;
      /**
      * Creates a new preset zone.
      * @param preset the preset this zone belongs to.
      * @param instrument the instrument to use in this zone.
      */
      constructor(preset, instrument) {
        super();
        this.parentPreset = preset;
        this._instrument = instrument;
        this._instrument.linkTo(this.parentPreset);
      }
      /**
      * Zone's instrument.
      */
      _instrument;
      /**
      * Zone's instrument.
      */
      get instrument() {
        return this._instrument;
      }
      /**
      * Zone's instrument.
      */
      set instrument(instrument) {
        if (this._instrument) this._instrument.unlinkFrom(this.parentPreset);
        this._instrument = instrument;
        this._instrument.linkTo(this.parentPreset);
      }
      getWriteGenerators(bank) {
        const gens = super.getWriteGenerators(bank);
        if (!bank) throw new Error("Instrument ID cannot be determined without the sound bank itself.");
        const instrumentID = bank.instruments.indexOf(this.instrument);
        if (instrumentID === -1) throw new Error(`${this.instrument.name} does not exist in ${bank.soundBankInfo.name}! Cannot write instrument generator.`);
        gens.push(new Generator(GeneratorTypes.instrument, instrumentID, false));
        return gens;
      }
    };
    defaultGeneratorValues = new Int16Array(GENERATORS_AMOUNT);
    for (let i = 0; i < defaultGeneratorValues.length; i++) if (GeneratorLimits[i]) defaultGeneratorValues[i] = GeneratorLimits[i].def;
    BasicPreset = class BasicPreset2 {
      /**
      * The parent soundbank instance
      * Currently used for determining default modulators and XG status
      */
      parentSoundBank;
      /**
      * The preset's name
      */
      name = "";
      program = 0;
      bankMSB = 0;
      bankLSB = 0;
      isGMGSDrum = false;
      /**
      * The preset's zones
      */
      zones = [];
      /**
      * Preset's global zone
      */
      globalZone;
      /**
      * Unused metadata
      */
      library = 0;
      /**
      * Unused metadata
      */
      genre = 0;
      /**
      * Unused metadata
      */
      morphology = 0;
      /**
      * Creates a new preset representation.
      * @param parentSoundBank the sound bank this preset belongs to.
      * @param globalZone optional, a global zone to use.
      */
      constructor(parentSoundBank, globalZone = new BasicZone()) {
        this.parentSoundBank = parentSoundBank;
        this.globalZone = globalZone;
      }
      /**
      * Checks if this preset is a drum preset
      */
      get isDrum() {
        const xg = this.parentSoundBank.isXGBank;
        return this.isGMGSDrum || xg && BankSelectHacks.isXGDrum(this.bankMSB);
      }
      static isInRange(range, number) {
        return number >= range.min && number <= range.max;
      }
      static addUniqueModulators(main, adder) {
        for (const addedMod of adder) if (!main.some((mm) => Modulator.isIdentical(addedMod, mm))) main.push(addedMod);
      }
      static subtractRanges(r1, r2) {
        return {
          min: Math.max(r1.min, r2.min),
          max: Math.min(r1.max, r2.max)
        };
      }
      /**
      * Unlinks everything from this preset.
      */
      delete() {
        for (const z of this.zones) z.instrument?.unlinkFrom(this);
      }
      /**
      * Deletes an instrument zone from this preset.
      * @param index the zone's index to delete.
      */
      deleteZone(index) {
        this.zones[index]?.instrument?.unlinkFrom(this);
        this.zones.splice(index, 1);
      }
      /**
      * Creates a new preset zone and returns it.
      * @param instrument the instrument to use in the zone.
      */
      createZone(instrument) {
        const z = new BasicPresetZone(this, instrument);
        this.zones.push(z);
        return z;
      }
      /**
      * Preloads (loads and caches synthesis data) for a given key range.
      */
      preload(keyMin, keyMax) {
        for (let key = keyMin; key < keyMax + 1; key++) for (let velocity = 0; velocity < 128; velocity++) for (const synthesisData of this.getVoiceParameters(key, velocity)) synthesisData.sample.getAudioData();
      }
      /**
      * Checks if the bank and program numbers are the same for the given preset as this one.
      * @param preset The preset to check.
      */
      matches(preset) {
        return MIDIPatchTools.matches(this, preset);
      }
      /**
      * Returns the voice synthesis data for this preset.
      * @param midiNote the MIDI note number.
      * @param velocity the MIDI velocity.
      * @returns the returned sound data.
      */
      getVoiceParameters(midiNote, velocity) {
        const voiceParameters = new Array();
        for (const presetZone of this.zones) {
          if (!BasicPreset2.isInRange(presetZone.hasKeyRange ? presetZone.keyRange : this.globalZone.keyRange, midiNote) || !BasicPreset2.isInRange(presetZone.hasVelRange ? presetZone.velRange : this.globalZone.velRange, velocity)) continue;
          const instrument = presetZone.instrument;
          if (!instrument || instrument.zones.length === 0) continue;
          const presetGenerators = new Int16Array(GENERATORS_AMOUNT);
          for (const generator of this.globalZone.generators) presetGenerators[generator.type] = generator.value;
          for (const generator of presetZone.generators) presetGenerators[generator.type] = generator.value;
          const presetModulators = [...presetZone.modulators];
          BasicPreset2.addUniqueModulators(presetModulators, this.globalZone.modulators);
          for (const instZone of instrument.zones) {
            if (!BasicPreset2.isInRange(instZone.hasKeyRange ? instZone.keyRange : instrument.globalZone.keyRange, midiNote) || !BasicPreset2.isInRange(instZone.hasVelRange ? instZone.velRange : instrument.globalZone.velRange, velocity)) continue;
            const modulators = [...instZone.modulators];
            BasicPreset2.addUniqueModulators(modulators, instrument.globalZone.modulators);
            BasicPreset2.addUniqueModulators(modulators, this.parentSoundBank.defaultModulators);
            for (const presetMod of presetModulators) {
              const matchIndex = modulators.findIndex((m) => Modulator.isIdentical(presetMod, m));
              if (matchIndex === -1) modulators.push(presetMod);
              else modulators[matchIndex] = modulators[matchIndex].sumTransform(presetMod);
            }
            const generators = new Int16Array(defaultGeneratorValues);
            for (const generator of instrument.globalZone.generators) generators[generator.type] = generator.value;
            for (const generator of instZone.generators) generators[generator.type] = generator.value;
            for (let i = 0; i < generators.length; i++) generators[i] = Math.max(-32768, Math.min(32767, generators[i] + presetGenerators[i]));
            generators[GeneratorTypes.initialAttenuation] = Math.floor(generators[GeneratorTypes.initialAttenuation] * 0.4);
            voiceParameters.push({
              sample: instZone.sample,
              generators,
              modulators
            });
          }
        }
        return voiceParameters;
      }
      /**
      * BankMSB:bankLSB:program:isGMGSDrum
      */
      toMIDIString() {
        return MIDIPatchTools.toMIDIString(this);
      }
      toString() {
        return MIDIPatchTools.toFullMIDIString(this);
      }
      /**
      * Combines preset into an instrument, flattening the preset zones into instrument zones.
      * This is a really complex function that attempts to work around the DLS limitations of only having the instrument layer.
      * @returns The instrument containing the flattened zones. In theory, it should exactly the same as this preset.
      */
      toFlattenedInstrument() {
        const addUnique = (main, adder) => {
          main.push(...adder.filter((g) => !main.some((mg) => mg.type === g.type)));
        };
        const addUniqueMods = (main, adder) => {
          main.push(...adder.filter((m) => !main.some((mm) => Modulator.isIdentical(m, mm))));
        };
        const outputInstrument = new BasicInstrument();
        outputInstrument.name = this.name;
        const globalPresetGenerators = [];
        const globalPresetModulators = [];
        const globalPresetZone = this.globalZone;
        globalPresetGenerators.push(...globalPresetZone.generators);
        globalPresetModulators.push(...globalPresetZone.modulators);
        const globalPresetKeyRange = globalPresetZone.keyRange;
        const globalPresetVelRange = globalPresetZone.velRange;
        for (const presetZone of this.zones) {
          if (!presetZone.instrument) throw new Error("No instrument in a preset zone.");
          let presetZoneKeyRange = presetZone.keyRange;
          if (!presetZone.hasKeyRange) presetZoneKeyRange = globalPresetKeyRange;
          let presetZoneVelRange = presetZone.velRange;
          if (!presetZone.hasVelRange) presetZoneVelRange = globalPresetVelRange;
          const presetGenerators = presetZone.generators.map((g) => new Generator(g.type, g.value));
          addUnique(presetGenerators, globalPresetGenerators);
          const presetModulators = [...presetZone.modulators];
          addUniqueMods(presetModulators, globalPresetModulators);
          const instrument = presetZone.instrument;
          const iZones = instrument.zones;
          const globalInstGenerators = [];
          const globalInstModulators = [];
          const globalInstZone = instrument.globalZone;
          globalInstGenerators.push(...globalInstZone.generators);
          globalInstModulators.push(...globalInstZone.modulators);
          const globalInstKeyRange = globalInstZone.keyRange;
          const globalInstVelRange = globalInstZone.velRange;
          for (const instZone of iZones) {
            if (!instZone.sample) throw new Error("No sample in an instrument zone.");
            let instZoneKeyRange = instZone.keyRange;
            if (!instZone.hasKeyRange) instZoneKeyRange = globalInstKeyRange;
            let instZoneVelRange = instZone.velRange;
            if (!instZone.hasVelRange) instZoneVelRange = globalInstVelRange;
            instZoneKeyRange = BasicPreset2.subtractRanges(instZoneKeyRange, presetZoneKeyRange);
            instZoneVelRange = BasicPreset2.subtractRanges(instZoneVelRange, presetZoneVelRange);
            if (instZoneKeyRange.max < instZoneKeyRange.min || instZoneVelRange.max < instZoneVelRange.min) continue;
            const instGenerators = instZone.generators.map((g) => new Generator(g.type, g.value));
            addUnique(instGenerators, globalInstGenerators);
            const instModulators = [...instZone.modulators];
            addUniqueMods(instModulators, globalInstModulators);
            const finalModList = [...instModulators];
            for (const mod of presetModulators) {
              const identicalInstMod = finalModList.findIndex((m) => Modulator.isIdentical(mod, m));
              if (identicalInstMod === -1) finalModList.push(mod);
              else finalModList[identicalInstMod] = finalModList[identicalInstMod].sumTransform(mod);
            }
            let finalGenList = instGenerators.map((g) => new Generator(g.type, g.value));
            for (const gen of presetGenerators) {
              if (gen.type === GeneratorTypes.velRange || gen.type === GeneratorTypes.keyRange || gen.type === GeneratorTypes.instrument || gen.type === GeneratorTypes.endOper || gen.type === GeneratorTypes.sampleModes) continue;
              const identicalInstGen = instGenerators.findIndex((g) => g.type === gen.type);
              if (identicalInstGen === -1) {
                const newAmount = GeneratorLimits[gen.type].def + gen.value;
                finalGenList.push(new Generator(gen.type, newAmount));
              } else {
                const newAmount = finalGenList[identicalInstGen].value + gen.value;
                finalGenList[identicalInstGen] = new Generator(gen.type, newAmount);
              }
            }
            finalGenList = finalGenList.filter((g) => g.type !== GeneratorTypes.sampleID && g.type !== GeneratorTypes.keyRange && g.type !== GeneratorTypes.velRange && g.type !== GeneratorTypes.endOper && g.type !== GeneratorTypes.instrument && (!(g.type in GeneratorLimits) || g.value !== GeneratorLimits[g.type].def));
            const zone = outputInstrument.createZone(instZone.sample);
            zone.keyRange = instZoneKeyRange;
            zone.velRange = instZoneVelRange;
            if (zone.keyRange.min === 0 && zone.keyRange.max === 127) zone.keyRange.min = -1;
            if (zone.velRange.min === 0 && zone.velRange.max === 127) zone.velRange.min = -1;
            zone.addGenerators(...finalGenList);
            zone.addModulators(...finalModList);
          }
        }
        return outputInstrument;
      }
      /**
      * Writes the SF2 header
      * @param phdrData
      * @param index
      * @param writeLSB
      * @internal
      */
      write(phdrData, index, writeLSB) {
        SpessaLog.info(`%cWriting ${this.name}...`, ConsoleColors.info);
        writeBinaryStringIndexed(phdrData.pdta, this.name.slice(0, 20), 20);
        writeBinaryStringIndexed(phdrData.xdta, this.name.slice(20), 20);
        writeWord(phdrData.pdta, this.program);
        let wBank = this.bankMSB;
        if (writeLSB) {
          wBank = this.bankMSB & 127 | (this.bankLSB & 127) << 8;
          if (this.isGMGSDrum) wBank |= 128;
        } else if (this.isGMGSDrum) wBank = 128;
        else if (this.bankMSB === 0) wBank = this.bankLSB;
        writeWord(phdrData.pdta, wBank);
        phdrData.xdta.currentIndex += 4;
        writeWord(phdrData.pdta, index & 65535);
        writeWord(phdrData.xdta, index >> 16);
        writeDword(phdrData.pdta, this.library);
        writeDword(phdrData.pdta, this.genre);
        writeDword(phdrData.pdta, this.morphology);
        phdrData.xdta.currentIndex += 12;
      }
    };
    notGlobalizedTypes = /* @__PURE__ */ new Set([
      GeneratorTypes.velRange,
      GeneratorTypes.keyRange,
      GeneratorTypes.instrument,
      GeneratorTypes.sampleID,
      GeneratorTypes.exclusiveClass,
      GeneratorTypes.endOper,
      GeneratorTypes.sampleModes,
      GeneratorTypes.startloopAddrsOffset,
      GeneratorTypes.startloopAddrsCoarseOffset,
      GeneratorTypes.endloopAddrsOffset,
      GeneratorTypes.endloopAddrsCoarseOffset,
      GeneratorTypes.startAddrsOffset,
      GeneratorTypes.startAddrsCoarseOffset,
      GeneratorTypes.endAddrOffset,
      GeneratorTypes.endAddrsCoarseOffset,
      GeneratorTypes.initialAttenuation,
      GeneratorTypes.fineTune,
      GeneratorTypes.coarseTune,
      GeneratorTypes.keyNumToVolEnvHold,
      GeneratorTypes.keyNumToVolEnvDecay,
      GeneratorTypes.keyNumToModEnvHold,
      GeneratorTypes.keyNumToModEnvDecay
    ]);
    BasicInstrument = class {
      /**
      * The instrument's name
      */
      name = "";
      /**
      * The instrument's zones
      */
      zones = [];
      /**
      * Instrument's global zone
      */
      globalZone = new BasicZone();
      /**
      * Instrument's linked presets (the presets that use it)
      * note that duplicates are allowed since one preset can use the same instrument multiple times.
      */
      linkedTo = [];
      /**
      * How many presets is this instrument used by
      */
      get useCount() {
        return this.linkedTo.length;
      }
      /**
      * Creates a new instrument zone and returns it.
      * @param sample The sample to use in the zone.
      */
      createZone(sample) {
        const zone = new BasicInstrumentZone(this, sample);
        this.zones.push(zone);
        return zone;
      }
      /**
      * Links the instrument ta a given preset
      * @param preset the preset to link to
      */
      linkTo(preset) {
        this.linkedTo.push(preset);
        for (const z of this.zones) z.useCount++;
      }
      /**
      * Unlinks the instrument from a given preset
      * @param preset the preset to unlink from
      */
      unlinkFrom(preset) {
        const index = this.linkedTo.indexOf(preset);
        if (index === -1) {
          SpessaLog.warn(`Cannot unlink ${preset.name} from ${this.name}: not linked.`);
          return;
        }
        this.linkedTo.splice(index, 1);
        for (const z of this.zones) z.useCount--;
      }
      deleteUnusedZones() {
        this.zones = this.zones.filter((z) => {
          const stays = z.useCount > 0;
          if (!stays) z.sample.unlinkFrom(this);
          return stays;
        });
      }
      delete() {
        if (this.useCount > 0) throw new Error(`Cannot delete an instrument that is used by: ${this.linkedTo.map((p) => p.name).toString()}.`);
        for (const z of this.zones) z.sample.unlinkFrom(this);
      }
      /**
      * Deletes a given instrument zone if it has no uses
      * @param index the index of the zone to delete
      * @param force ignores the use count and deletes forcibly
      * @returns if the zone has been deleted
      */
      deleteZone(index, force = false) {
        const zone = this.zones[index];
        zone.useCount -= 1;
        if (zone.useCount < 1 || force) {
          zone.sample.unlinkFrom(this);
          this.zones.splice(index, 1);
          return true;
        }
        return false;
      }
      /**
      * Globalizes the instrument *in-place.*
      * This means trying to move as many generators and modulators
      * to the global zone as possible to reduce clutter and the count of parameters.
      */
      globalize() {
        const globalZone = this.globalZone;
        for (let checkedType = 0; checkedType < 58; checkedType++) {
          if (notGlobalizedTypes.has(checkedType)) continue;
          checkedType = checkedType;
          let occurrencesForValues = {};
          const defaultForChecked = GeneratorLimits[checkedType]?.def || 0;
          occurrencesForValues[defaultForChecked] = 0;
          for (const zone of this.zones) {
            const value = zone.getGenerator(checkedType, void 0);
            if (value === void 0) occurrencesForValues[defaultForChecked]++;
            else if (occurrencesForValues[value] === void 0) occurrencesForValues[value] = 1;
            else occurrencesForValues[value]++;
            let relativeCounterpart;
            switch (checkedType) {
              default:
                continue;
              case GeneratorTypes.decayVolEnv:
                relativeCounterpart = GeneratorTypes.keyNumToVolEnvDecay;
                break;
              case GeneratorTypes.holdVolEnv:
                relativeCounterpart = GeneratorTypes.keyNumToVolEnvHold;
                break;
              case GeneratorTypes.decayModEnv:
                relativeCounterpart = GeneratorTypes.keyNumToModEnvDecay;
                break;
              case GeneratorTypes.holdModEnv:
                relativeCounterpart = GeneratorTypes.keyNumToModEnvHold;
            }
            if (zone.getGenerator(relativeCounterpart, void 0) !== void 0) {
              occurrencesForValues = {};
              break;
            }
          }
          if (Object.keys(occurrencesForValues).length > 0) {
            let valueToGlobalize = ["0", 0];
            for (const [value, count] of Object.entries(occurrencesForValues)) if (count > valueToGlobalize[1]) valueToGlobalize = [value, count];
            const targetValue = Number.parseInt(valueToGlobalize[0]);
            if (targetValue !== defaultForChecked) globalZone.setGenerator(checkedType, targetValue, false);
            for (const z of this.zones) {
              const genValue = z.getGenerator(checkedType, void 0);
              if (genValue === void 0) {
                if (targetValue !== defaultForChecked) z.setGenerator(checkedType, defaultForChecked);
              } else if (genValue === targetValue) z.setGenerator(checkedType, null);
            }
          }
        }
        const modulators = this.zones.length === 0 ? [] : this.zones[0].modulators.map((m) => Modulator.copyFrom(m));
        for (const checkedModulator of modulators) {
          let existsForAllZones = true;
          for (const zone of this.zones) {
            if (!existsForAllZones) continue;
            if (!zone.modulators.find((m) => Modulator.isIdentical(m, checkedModulator))) existsForAllZones = false;
          }
          if (existsForAllZones) {
            globalZone.addModulators(Modulator.copyFrom(checkedModulator));
            for (const zone of this.zones) {
              const modulator = zone.modulators.find((m) => Modulator.isIdentical(m, checkedModulator));
              if (!modulator) continue;
              if (modulator.transformAmount === checkedModulator.transformAmount) zone.modulators.splice(zone.modulators.indexOf(modulator), 1);
            }
          }
        }
      }
      /**
      * @internal
      * @param instData
      * @param index
      */
      write(instData, index) {
        SpessaLog.info(`%cWriting ${this.name}...`, ConsoleColors.info);
        writeBinaryStringIndexed(instData.pdta, this.name.slice(0, 20), 20);
        writeBinaryStringIndexed(instData.xdta, this.name.slice(20), 20);
        writeWord(instData.pdta, index & 65535);
        writeWord(instData.xdta, index >>> 16);
      }
    };
    DEFAULT_SF2_WRITE_OPTIONS = {
      writeDefaultModulators: true,
      writeExtendedLimits: true,
      software: "SpessaSynth"
    };
    DEFAULT_SFE_WRITE_OPTIONS = {
      rf64: true,
      software: "SpessaSynth"
    };
    DLSVerifier = class {
      /**
      * @param chunk
      * @param expected
      * @throws error if the check doesn't pass
      */
      static verifyHeader(chunk, ...expected) {
        for (const expect of expected) if (chunk.header.toLowerCase() === expect.toLowerCase()) return;
        this.parsingError(`Invalid DLS chunk header! Expected "${expected.join(", or ")}" got "${chunk.header.toLowerCase()}"`);
      }
      /**
      * @param text {string}
      * @param expected {string}
      * @throws error if the check doesn't pass
      */
      static verifyText(text, ...expected) {
        for (const expect of expected) if (text.toLowerCase() === expect.toLowerCase()) return;
        this.parsingError(`FourCC error: Expected "${expected.join(", or ")}" got "${text.toLowerCase()}"`);
      }
      /**
      * @throws error if the check doesn't pass
      */
      static parsingError(error) {
        SpessaLog.groupEnd();
        throw new Error(`DLS parse error: ${error} The file may be corrupted.`);
      }
      static verifyAndReadList(chunk, ...type) {
        this.verifyHeader(chunk, "LIST");
        chunk.data.currentIndex = 0;
        this.verifyText(readBinaryStringIndexed(chunk.data, 4), ...type);
        const chunks = [];
        while (chunk.data.length > chunk.data.currentIndex) chunks.push(RIFFChunk.read(chunk.data));
        return chunks;
      }
    };
    DLSSources = {
      none: 0,
      modLfo: 1,
      velocity: 2,
      keyNum: 3,
      volEnv: 4,
      modEnv: 5,
      pitchWheel: 6,
      polyPressure: 7,
      channelPressure: 8,
      vibratoLfo: 9,
      modulationWheel: 129,
      volume: 135,
      pan: 138,
      expression: 139,
      chorus: 221,
      reverb: 219,
      pitchWheelRange: 256,
      fineTune: 257,
      coarseTune: 258
    };
    DLSDestinations = {
      none: 0,
      gain: 1,
      reserved: 2,
      pitch: 3,
      pan: 4,
      keyNum: 5,
      chorusSend: 128,
      reverbSend: 129,
      modLfoFreq: 260,
      modLfoDelay: 261,
      vibLfoFreq: 276,
      vibLfoDelay: 277,
      volEnvAttack: 518,
      volEnvDecay: 519,
      reservedEG1: 520,
      volEnvRelease: 521,
      volEnvSustain: 522,
      volEnvDelay: 523,
      volEnvHold: 524,
      modEnvAttack: 778,
      modEnvDecay: 779,
      reservedEG2: 780,
      modEnvRelease: 781,
      modEnvSustain: 782,
      modEnvDelay: 783,
      modEnvHold: 784,
      filterCutoff: 1280,
      filterQ: 1281
    };
    DLSLoopTypes = {
      forward: 0,
      loopAndRelease: 1
    };
    WSMP_SIZE = 20;
    WSMP_LOOP_SIZE = 16;
    WaveSample = class WaveSample2 extends DLSVerifier {
      /**
      * Specifies the gain to be applied to this sample in 32 bit relative gain units.
      * Each unit of gain represents 1/655360 dB.
      */
      gain = 0;
      /**
      * Specifies the MIDI note which will replay the sample at original pitch. This value ranges
      * from 0 to 127 (a value of 60 represents Middle C, as defined by the MIDI specification).
      */
      unityNote = 60;
      /**
      * Specifies the tuning offset from the usUnityNote in 16 bit relative pitch. (cents)
      */
      fineTune = 0;
      /**
      * Specifies the number (count) of <wavesample-loop> records that are contained in the
      * <wsmp-ck> chunk. The <wavesample-loop> records are stored immediately following the
      * cSampleLoops data field. One shot sounds will have the cSampleLoops field set to 0.
      * Looped sounds will have the cSampleLoops field set to 1. Values greater than 1 are not yet
      * defined at this time.
      */
      loops = new Array();
      /**
      * Specifies flag options for the digital audio sample.
      * Default to F_WSMP_NO_COMPRESSION,
      * according to all DLS files I have.
      */
      fulOptions = 2;
      static copyFrom(inputWaveSample) {
        const outputWaveSample = new WaveSample2();
        outputWaveSample.unityNote = inputWaveSample.unityNote;
        outputWaveSample.gain = inputWaveSample.gain;
        outputWaveSample.fineTune = inputWaveSample.fineTune;
        outputWaveSample.loops = inputWaveSample.loops.map((l) => {
          return { ...l };
        });
        outputWaveSample.fulOptions = inputWaveSample.fulOptions;
        return outputWaveSample;
      }
      static read(chunk) {
        this.verifyHeader(chunk, "wsmp");
        const waveSample = new WaveSample2();
        const cbSize = readLittleEndianIndexed(chunk.data, 4);
        if (cbSize !== WSMP_SIZE) SpessaLog.warn(`Wsmp cbSize mismatch: got ${cbSize}, expected ${WSMP_SIZE}.`);
        waveSample.unityNote = readLittleEndianIndexed(chunk.data, 2);
        waveSample.fineTune = signedInt16(chunk.data[chunk.data.currentIndex++], chunk.data[chunk.data.currentIndex++]);
        waveSample.gain = readLittleEndianIndexed(chunk.data, 4) | 0;
        waveSample.fulOptions = readLittleEndianIndexed(chunk.data, 4);
        if (readLittleEndianIndexed(chunk.data, 4) === 0) {
        } else {
          const cbSize2 = readLittleEndianIndexed(chunk.data, 4);
          if (cbSize2 !== WSMP_LOOP_SIZE) SpessaLog.warn(`CbSize for loop in wsmp mismatch. Expected ${WSMP_LOOP_SIZE}, got ${cbSize2}.`);
          const loopType = readLittleEndianIndexed(chunk.data, 4);
          const loopStart = readLittleEndianIndexed(chunk.data, 4);
          const loopLength = readLittleEndianIndexed(chunk.data, 4);
          waveSample.loops.push({
            loopStart,
            loopLength,
            loopType
          });
        }
        return waveSample;
      }
      static fromSFSample(sample) {
        const waveSample = new WaveSample2();
        waveSample.unityNote = sample.originalKey;
        waveSample.fineTune = sample.pitchCorrection;
        if (sample.loopEnd !== 0 || sample.loopStart !== 0) waveSample.loops.push({
          loopStart: sample.loopStart,
          loopLength: sample.loopEnd - sample.loopStart,
          loopType: DLSLoopTypes.forward
        });
        return waveSample;
      }
      static fromSFZone(zone) {
        const waveSample = new WaveSample2();
        waveSample.unityNote = zone.getGenerator(GeneratorTypes.overridingRootKey, zone.sample.originalKey);
        if (zone.getGenerator(GeneratorTypes.scaleTuning, 100) === 0 && zone.keyRange.max - zone.keyRange.min === 0) waveSample.unityNote = zone.keyRange.min;
        waveSample.fineTune = zone.fineTuning + zone.sample.pitchCorrection;
        waveSample.gain = -(zone.getGenerator(GeneratorTypes.initialAttenuation, 0) * 0.4) << 16;
        const loopingMode = zone.getGenerator(GeneratorTypes.sampleModes, 0);
        if (loopingMode !== 0) {
          const loopStart = zone.sample.loopStart + zone.getGenerator(GeneratorTypes.startloopAddrsOffset, 0) + zone.getGenerator(GeneratorTypes.startloopAddrsCoarseOffset, 0) * 32768;
          const loopEnd = zone.sample.loopEnd + zone.getGenerator(GeneratorTypes.endloopAddrsOffset, 0) + zone.getGenerator(GeneratorTypes.endloopAddrsCoarseOffset, 0) * 32768;
          let dlsLoopType;
          switch (loopingMode) {
            case 1:
            default:
              dlsLoopType = 0;
              break;
            case 3:
              dlsLoopType = 1;
          }
          waveSample.loops.push({
            loopType: dlsLoopType,
            loopStart,
            loopLength: loopEnd - loopStart
          });
        }
        return waveSample;
      }
      /**
      * Converts the wsmp data into an SF zone.
      */
      toSFZone(zone, sample) {
        let loopingMode = 0;
        const loop = this.loops[0];
        if (loop) loopingMode = loop.loopType === DLSLoopTypes.loopAndRelease ? 3 : 1;
        if (loopingMode !== 0) zone.setGenerator(GeneratorTypes.sampleModes, loopingMode);
        const wsmpAttenuationCorrected = -(this.gain >> 16) / 0.4;
        if (wsmpAttenuationCorrected !== 0) zone.setGenerator(GeneratorTypes.initialAttenuation, wsmpAttenuationCorrected);
        zone.fineTuning = this.fineTune - sample.pitchCorrection;
        if (this.unityNote !== sample.originalKey) zone.setGenerator(GeneratorTypes.overridingRootKey, this.unityNote);
        if (loop) {
          const diffStart = loop.loopStart - sample.loopStart;
          const diffEnd = loop.loopStart + loop.loopLength - sample.loopEnd;
          if (diffStart !== 0) {
            const fine = diffStart % 32768;
            zone.setGenerator(GeneratorTypes.startloopAddrsOffset, fine);
            const coarse = Math.trunc(diffStart / 32768);
            if (coarse !== 0) zone.setGenerator(GeneratorTypes.startloopAddrsCoarseOffset, coarse);
          }
          if (diffEnd !== 0) {
            const fine = diffEnd % 32768;
            zone.setGenerator(GeneratorTypes.endloopAddrsOffset, fine);
            const coarse = Math.trunc(diffEnd / 32768);
            if (coarse !== 0) zone.setGenerator(GeneratorTypes.endloopAddrsCoarseOffset, coarse);
          }
        }
      }
      write() {
        const wsmpData = new IndexedByteArray(WSMP_SIZE + this.loops.length * WSMP_LOOP_SIZE);
        writeDword(wsmpData, WSMP_SIZE);
        writeWord(wsmpData, this.unityNote);
        writeWord(wsmpData, this.fineTune);
        writeDword(wsmpData, this.gain);
        writeDword(wsmpData, this.fulOptions);
        writeDword(wsmpData, this.loops.length);
        for (const loop of this.loops) {
          writeDword(wsmpData, WSMP_LOOP_SIZE);
          writeDword(wsmpData, loop.loopType);
          writeDword(wsmpData, loop.loopStart);
          writeDword(wsmpData, loop.loopLength);
        }
        return RIFFChunk.write("wsmp", wsmpData);
      }
    };
    W_FORMAT_TAG = {
      PCM: 1,
      ALAW: 6
    };
    DLSSample = class extends BasicSample {
      wFormatTag;
      bytesPerSample;
      /**
      * Sample's raw data before decoding it, for faster writing
      */
      rawData;
      /**
      * @param name
      * @param rate
      * @param pitch
      * @param pitchCorrection
      * @param loopStart sample data points
      * @param loopEnd sample data points
      * @param dataChunk
      * @param wFormatTag
      * @param bytesPerSample
      */
      constructor(name, rate, pitch, pitchCorrection, loopStart, loopEnd, dataChunk, wFormatTag, bytesPerSample) {
        super(name, rate, pitch, pitchCorrection, SampleTypes.monoSample, loopStart, loopEnd);
        this.dataOverridden = false;
        this.rawData = dataChunk.data;
        this.wFormatTag = wFormatTag;
        this.bytesPerSample = bytesPerSample;
      }
      getAudioData() {
        if (!this.rawData) return new Float32Array(0);
        if (!this.audioData) {
          let sampleData;
          switch (this.wFormatTag) {
            default:
              SpessaLog.warn(`Failed to decode sample. Unknown wFormatTag: ${this.wFormatTag}`);
              sampleData = new Float32Array(this.rawData.length / this.bytesPerSample);
              break;
            case W_FORMAT_TAG.PCM:
              sampleData = readPCM(this.rawData, this.bytesPerSample);
              break;
            case W_FORMAT_TAG.ALAW:
              sampleData = readALAW(this.rawData, this.bytesPerSample);
              break;
          }
          this.setAudioData(sampleData, this.sampleRate);
        }
        return this.audioData ?? new Float32Array(0);
      }
      getRawData(allowVorbis) {
        if (this.dataOverridden || this.isCompressed) return super.getRawData(allowVorbis);
        if (this.wFormatTag === W_FORMAT_TAG.PCM && this.bytesPerSample === 2) return this.rawData;
        return this.encodeS16LE();
      }
    };
    DownloadableSoundsSample = class DownloadableSoundsSample2 extends DLSVerifier {
      waveSample = new WaveSample();
      wFormatTag;
      bytesPerSample;
      sampleRate;
      dataChunk;
      name = "Unnamed sample";
      constructor(wFormatTag, bytesPerSample, sampleRate, dataChunk) {
        super();
        this.wFormatTag = wFormatTag;
        this.bytesPerSample = bytesPerSample;
        this.sampleRate = sampleRate;
        this.dataChunk = dataChunk;
      }
      static read(waveChunk) {
        const chunks = this.verifyAndReadList(waveChunk, "wave");
        const fmtChunk = chunks.find((c) => c.header === "fmt ");
        if (!fmtChunk) throw new Error("No fmt chunk in the wave file!");
        const wFormatTag = readLittleEndianIndexed(fmtChunk.data, 2);
        const channelsAmount = readLittleEndianIndexed(fmtChunk.data, 2);
        if (channelsAmount !== 1) throw new Error(`Only mono samples are supported. Fmt reports ${channelsAmount} channels.`);
        const sampleRate = readLittleEndianIndexed(fmtChunk.data, 4);
        readLittleEndianIndexed(fmtChunk.data, 4);
        readLittleEndianIndexed(fmtChunk.data, 2);
        const bytesPerSample = readLittleEndianIndexed(fmtChunk.data, 2) / 8;
        const dataChunk = chunks.find((c) => c.header === "data");
        if (!dataChunk) throw new Error("No data chunk in the WAVE chunk!");
        const sample = new DownloadableSoundsSample2(wFormatTag, bytesPerSample, sampleRate, dataChunk);
        const waveInfo = RIFFChunk.findListType(chunks, "INFO");
        if (waveInfo) {
          let infoChunk = RIFFChunk.read(waveInfo.data);
          while (infoChunk.header !== "INAM" && waveInfo.data.currentIndex < waveInfo.data.length) infoChunk = RIFFChunk.read(waveInfo.data);
          if (infoChunk.header === "INAM") sample.name = readBinaryStringIndexed(infoChunk.data, infoChunk.size).trim();
        }
        const wsmpChunk = chunks.find((c) => c.header === "wsmp");
        if (wsmpChunk) sample.waveSample = WaveSample.read(wsmpChunk);
        return sample;
      }
      static fromSFSample(sample) {
        const raw = sample.getRawData(false);
        const dlsSample = new DownloadableSoundsSample2(1, 2, sample.sampleRate, new RIFFChunk("data", raw.length, new IndexedByteArray(raw.buffer)));
        dlsSample.name = sample.name;
        dlsSample.waveSample = WaveSample.fromSFSample(sample);
        return dlsSample;
      }
      toSFSample(soundBank) {
        let originalKey = this.waveSample.unityNote;
        let pitchCorrection = this.waveSample.fineTune;
        const samplePitchSemitones = Math.trunc(pitchCorrection / 100);
        originalKey += samplePitchSemitones;
        pitchCorrection -= samplePitchSemitones * 100;
        let loopStart = 0;
        let loopEnd = 0;
        const loop = this.waveSample.loops?.[0];
        if (loop) {
          loopStart = loop.loopStart;
          loopEnd = loop.loopStart + loop.loopLength;
        }
        const sample = new DLSSample(this.name, this.sampleRate, originalKey, pitchCorrection, loopStart, loopEnd, this.dataChunk, this.wFormatTag, this.bytesPerSample);
        soundBank.addSamples(sample);
      }
      write() {
        const fmt = this.writeFmt();
        const wsmp = this.waveSample.write();
        const data = RIFFChunk.getParts("data", [this.dataChunk.data]);
        const inam = RIFFChunk.write("INAM", getStringBytes(this.name, true));
        const info = RIFFChunk.write("INFO", inam, false, true);
        SpessaLog.info(`%cSaved %c${this.name}%c successfully!`, ConsoleColors.recognized, ConsoleColors.value, ConsoleColors.recognized);
        return RIFFChunk.getParts("wave", [
          fmt,
          wsmp,
          ...data,
          info
        ], false, true);
      }
      writeFmt() {
        const fmtData = new IndexedByteArray(18);
        writeWord(fmtData, this.wFormatTag);
        writeWord(fmtData, 1);
        writeDword(fmtData, this.sampleRate);
        writeDword(fmtData, this.sampleRate * 2);
        writeWord(fmtData, 2);
        writeWord(fmtData, this.bytesPerSample * 8);
        return RIFFChunk.write("fmt ", fmtData);
      }
    };
    ConnectionSource = class ConnectionSource2 {
      source;
      transform;
      bipolar;
      invert;
      constructor(source = DLSSources.none, transform = ModulatorCurveTypes.linear, bipolar = false, invert = false) {
        this.source = source;
        this.transform = transform;
        this.bipolar = bipolar;
        this.invert = invert;
      }
      get sourceName() {
        return Object.keys(DLSSources).find((k) => DLSSources[k] === this.source) ?? this.source.toString();
      }
      get transformName() {
        return Object.keys(ModulatorCurveTypes).find((k) => ModulatorCurveTypes[k] === this.transform) ?? this.transform.toString();
      }
      static copyFrom(inputSource) {
        return new ConnectionSource2(inputSource.source, inputSource.transform, inputSource.bipolar, inputSource.invert);
      }
      static fromSFSource(source) {
        let sourceEnum = void 0;
        if (source.isCC) switch (source.index) {
          case MIDIControllers.modulationWheel:
            sourceEnum = DLSSources.modulationWheel;
            break;
          case MIDIControllers.mainVolume:
            sourceEnum = DLSSources.volume;
            break;
          case MIDIControllers.pan:
            sourceEnum = DLSSources.pan;
            break;
          case MIDIControllers.expression:
            sourceEnum = DLSSources.expression;
            break;
          case MIDIControllers.chorusDepth:
            sourceEnum = DLSSources.chorus;
            break;
          case MIDIControllers.reverbDepth:
            sourceEnum = DLSSources.reverb;
            break;
        }
        else switch (source.index) {
          case ModulatorControllerSources.noController:
            sourceEnum = DLSSources.none;
            break;
          case ModulatorControllerSources.noteOnKeyNum:
            sourceEnum = DLSSources.keyNum;
            break;
          case ModulatorControllerSources.noteOnVelocity:
            sourceEnum = DLSSources.velocity;
            break;
          case ModulatorControllerSources.pitchWheel:
            sourceEnum = DLSSources.pitchWheel;
            break;
          case ModulatorControllerSources.pitchWheelRange:
            sourceEnum = DLSSources.pitchWheelRange;
            break;
          case ModulatorControllerSources.polyPressure:
            sourceEnum = DLSSources.polyPressure;
            break;
          case ModulatorControllerSources.channelPressure:
            sourceEnum = DLSSources.channelPressure;
        }
        if (sourceEnum === void 0) return;
        return new ConnectionSource2(sourceEnum, source.curveType, source.isBipolar, source.isNegative);
      }
      toString() {
        return `${this.sourceName} ${this.transformName} ${this.bipolar ? "bipolar" : "unipolar"} ${this.invert ? "inverted" : "positive"}`;
      }
      toTransformFlag() {
        return this.transform | (this.bipolar ? 1 : 0) << 4 | (this.invert ? 1 : 0) << 5;
      }
      toSFSource() {
        let sourceEnum;
        let isCC = false;
        switch (this.source) {
          default:
          case DLSSources.modLfo:
          case DLSSources.vibratoLfo:
          case DLSSources.coarseTune:
          case DLSSources.fineTune:
          case DLSSources.modEnv:
            return;
          case DLSSources.keyNum:
            sourceEnum = ModulatorControllerSources.noteOnKeyNum;
            break;
          case DLSSources.none:
            sourceEnum = ModulatorControllerSources.noController;
            break;
          case DLSSources.modulationWheel:
            sourceEnum = MIDIControllers.modulationWheel;
            isCC = true;
            break;
          case DLSSources.pan:
            sourceEnum = MIDIControllers.pan;
            isCC = true;
            break;
          case DLSSources.reverb:
            sourceEnum = MIDIControllers.reverbDepth;
            isCC = true;
            break;
          case DLSSources.chorus:
            sourceEnum = MIDIControllers.chorusDepth;
            isCC = true;
            break;
          case DLSSources.expression:
            sourceEnum = MIDIControllers.expression;
            isCC = true;
            break;
          case DLSSources.volume:
            sourceEnum = MIDIControllers.mainVolume;
            isCC = true;
            break;
          case DLSSources.velocity:
            sourceEnum = ModulatorControllerSources.noteOnVelocity;
            break;
          case DLSSources.polyPressure:
            sourceEnum = ModulatorControllerSources.polyPressure;
            break;
          case DLSSources.channelPressure:
            sourceEnum = ModulatorControllerSources.channelPressure;
            break;
          case DLSSources.pitchWheel:
            sourceEnum = ModulatorControllerSources.pitchWheel;
            break;
          case DLSSources.pitchWheelRange:
            sourceEnum = ModulatorControllerSources.pitchWheelRange;
            break;
        }
        if (sourceEnum === void 0) return;
        return new ModulatorSource(sourceEnum, this.transform, isCC, this.bipolar, this.invert);
      }
    };
    DEFAULT_DLS_REVERB = new DecodedModulator(219, 0, GeneratorTypes.reverbEffectsSend, 1e3, 0);
    DEFAULT_DLS_CHORUS = new DecodedModulator(221, 0, GeneratorTypes.chorusEffectsSend, 1e3, 0);
    new DecodedModulator(129, 0, GeneratorTypes.vibLfoToPitch, 0, 0);
    new DecodedModulator(13, 0, GeneratorTypes.vibLfoToPitch, 0, 0);
    invalidGeneratorTypes = /* @__PURE__ */ new Set([
      GeneratorTypes.sampleModes,
      GeneratorTypes.initialAttenuation,
      GeneratorTypes.keyRange,
      GeneratorTypes.velRange,
      GeneratorTypes.sampleID,
      GeneratorTypes.fineTune,
      GeneratorTypes.coarseTune,
      GeneratorTypes.startAddrsOffset,
      GeneratorTypes.startAddrsCoarseOffset,
      GeneratorTypes.endAddrOffset,
      GeneratorTypes.endAddrsCoarseOffset,
      GeneratorTypes.startloopAddrsOffset,
      GeneratorTypes.startloopAddrsCoarseOffset,
      GeneratorTypes.endloopAddrsOffset,
      GeneratorTypes.endloopAddrsCoarseOffset,
      GeneratorTypes.overridingRootKey,
      GeneratorTypes.exclusiveClass
    ]);
    ConnectionBlock = class ConnectionBlock2 {
      /**
      * Like SF2 modulator source.
      */
      source;
      /**
      * Like SF2 modulator secondary source.
      */
      control;
      /**
      * Like SF2 destination.
      */
      destination;
      /**
      * Like SF2 amount, but long (32-bit) instead of short.
      */
      scale;
      /**
      * Like SF2 source transforms.
      */
      transform;
      constructor(source = new ConnectionSource(), control = new ConnectionSource(), destination, transform, scale) {
        this.source = source;
        this.control = control;
        this.destination = destination;
        this.transform = transform;
        this.scale = scale;
      }
      get isStaticParameter() {
        return this.source.source === DLSSources.none && this.control.source === DLSSources.none;
      }
      get shortScale() {
        return this.scale >> 16;
      }
      get transformName() {
        return Object.keys(ModulatorCurveTypes).find((k) => ModulatorCurveTypes[k] === this.transform) ?? this.transform.toString();
      }
      get destinationName() {
        return Object.keys(DLSDestinations).find((k) => DLSDestinations[k] === this.destination) ?? this.destination.toString();
      }
      static read(artData) {
        const usSource = readLittleEndianIndexed(artData, 2);
        const usControl = readLittleEndianIndexed(artData, 2);
        const usDestination = readLittleEndianIndexed(artData, 2);
        const usTransform = readLittleEndianIndexed(artData, 2);
        const lScale = readLittleEndianIndexed(artData, 4) | 0;
        const transform = usTransform & 15;
        const control = new ConnectionSource(usControl, usTransform >> 4 & 15, bitMaskToBool(usTransform, 8), bitMaskToBool(usTransform, 9));
        return new ConnectionBlock2(new ConnectionSource(usSource, usTransform >> 10 & 15, bitMaskToBool(usTransform, 14), bitMaskToBool(usTransform, 15)), control, usDestination, transform, lScale);
      }
      static fromSFModulator(m, articulation) {
        const failed = (msg) => {
          SpessaLog.warn(`Failed converting SF modulator into DLS:
 ${m.toString()} 
(${msg})`);
        };
        if (m.transformType !== 0) {
          failed("Absolute transform type is not supported");
          return;
        }
        if (Modulator.isIdentical(m, DEFAULT_DLS_CHORUS, true) || Modulator.isIdentical(m, DEFAULT_DLS_REVERB, true)) return;
        let source = ConnectionSource.fromSFSource(m.primarySource);
        if (!source) {
          failed("Invalid primary source");
          return;
        }
        let control = ConnectionSource.fromSFSource(m.secondarySource);
        if (!control) {
          failed("Invalid secondary source");
          return;
        }
        const dlsDestination = ConnectionBlock2.fromSFDestination(m.destination, m.transformAmount);
        if (dlsDestination === void 0) {
          failed("Invalid destination");
          return;
        }
        let amount = m.transformAmount;
        let destination;
        if (typeof dlsDestination === "number") destination = dlsDestination;
        else {
          destination = dlsDestination.destination;
          amount = dlsDestination.amount;
          if (dlsDestination.source !== DLSSources.none) {
            if (control.source !== DLSSources.none && source.source !== DLSSources.none) {
              failed("Articulation generators with secondary source are not supported");
              return;
            }
            if (source.source !== DLSSources.none) control = source;
            source = new ConnectionSource(dlsDestination.source, ModulatorCurveTypes.linear, dlsDestination.isBipolar);
          }
        }
        const bloc = new ConnectionBlock2(source, control, destination, 0, amount << 16);
        articulation.connectionBlocks.push(bloc);
      }
      static copyFrom(inputBlock) {
        return new ConnectionBlock2(ConnectionSource.copyFrom(inputBlock.source), ConnectionSource.copyFrom(inputBlock.control), inputBlock.destination, inputBlock.transform, inputBlock.scale);
      }
      static fromSFGenerator(generator, articulation) {
        if (invalidGeneratorTypes.has(generator.type)) return;
        const failed = (msg) => {
          SpessaLog.warn(`Failed converting SF2 generator into DLS:
 ${generator.toString()} 
(${msg})`);
        };
        const dlsDestination = ConnectionBlock2.fromSFDestination(generator.type, generator.value);
        if (dlsDestination === void 0) {
          failed("Invalid type");
          return;
        }
        const source = new ConnectionSource();
        let destination;
        let amount = generator.value;
        if (typeof dlsDestination === "number") destination = dlsDestination;
        else {
          destination = dlsDestination.destination;
          amount = dlsDestination.amount;
          source.source = dlsDestination.source;
          source.bipolar = dlsDestination.isBipolar;
        }
        articulation.connectionBlocks.push(new ConnectionBlock2(source, new ConnectionSource(), destination, 0, amount << 16));
      }
      static fromSFDestination(dest, amount) {
        switch (dest) {
          default:
            return;
          case GeneratorTypes.initialAttenuation:
            return {
              destination: DLSDestinations.gain,
              amount: -amount,
              isBipolar: false,
              source: DLSSources.none
            };
          case GeneratorTypes.fineTune:
            return DLSDestinations.pitch;
          case GeneratorTypes.pan:
            return DLSDestinations.pan;
          case GeneratorTypes.keyNum:
            return DLSDestinations.keyNum;
          case GeneratorTypes.reverbEffectsSend:
            return DLSDestinations.reverbSend;
          case GeneratorTypes.chorusEffectsSend:
            return DLSDestinations.chorusSend;
          case GeneratorTypes.freqModLFO:
            return DLSDestinations.modLfoFreq;
          case GeneratorTypes.delayModLFO:
            return DLSDestinations.modLfoDelay;
          case GeneratorTypes.delayVibLFO:
            return DLSDestinations.vibLfoDelay;
          case GeneratorTypes.freqVibLFO:
            return DLSDestinations.vibLfoFreq;
          case GeneratorTypes.delayVolEnv:
            return DLSDestinations.volEnvDelay;
          case GeneratorTypes.attackVolEnv:
            return DLSDestinations.volEnvAttack;
          case GeneratorTypes.holdVolEnv:
            return DLSDestinations.volEnvHold;
          case GeneratorTypes.decayVolEnv:
            return DLSDestinations.volEnvDecay;
          case GeneratorTypes.sustainVolEnv:
            return {
              destination: DLSDestinations.volEnvSustain,
              amount: 1e3 - amount,
              isBipolar: false,
              source: DLSSources.none
            };
          case GeneratorTypes.releaseVolEnv:
            return DLSDestinations.volEnvRelease;
          case GeneratorTypes.delayModEnv:
            return DLSDestinations.modEnvDelay;
          case GeneratorTypes.attackModEnv:
            return DLSDestinations.modEnvAttack;
          case GeneratorTypes.holdModEnv:
            return DLSDestinations.modEnvHold;
          case GeneratorTypes.decayModEnv:
            return DLSDestinations.modEnvDecay;
          case GeneratorTypes.sustainModEnv:
            return {
              destination: DLSDestinations.modEnvSustain,
              amount: 1e3 - amount,
              isBipolar: false,
              source: DLSSources.none
            };
          case GeneratorTypes.releaseModEnv:
            return DLSDestinations.modEnvRelease;
          case GeneratorTypes.initialFilterFc:
            return DLSDestinations.filterCutoff;
          case GeneratorTypes.initialFilterQ:
            return DLSDestinations.filterQ;
          case GeneratorTypes.modEnvToFilterFc:
            return {
              source: DLSSources.modEnv,
              destination: DLSDestinations.filterCutoff,
              amount,
              isBipolar: false
            };
          case GeneratorTypes.modEnvToPitch:
            return {
              source: DLSSources.modEnv,
              destination: DLSDestinations.pitch,
              amount,
              isBipolar: false
            };
          case GeneratorTypes.modLfoToFilterFc:
            return {
              source: DLSSources.modLfo,
              destination: DLSDestinations.filterCutoff,
              amount,
              isBipolar: true
            };
          case GeneratorTypes.modLfoToVolume:
            return {
              source: DLSSources.modLfo,
              destination: DLSDestinations.gain,
              amount,
              isBipolar: true
            };
          case GeneratorTypes.modLfoToPitch:
            return {
              source: DLSSources.modLfo,
              destination: DLSDestinations.pitch,
              amount,
              isBipolar: true
            };
          case GeneratorTypes.vibLfoToPitch:
            return {
              source: DLSSources.vibratoLfo,
              destination: DLSDestinations.pitch,
              amount,
              isBipolar: true
            };
          case GeneratorTypes.keyNumToVolEnvHold:
            return {
              source: DLSSources.keyNum,
              destination: DLSDestinations.volEnvHold,
              amount,
              isBipolar: true
            };
          case GeneratorTypes.keyNumToVolEnvDecay:
            return {
              source: DLSSources.keyNum,
              destination: DLSDestinations.volEnvDecay,
              amount,
              isBipolar: true
            };
          case GeneratorTypes.keyNumToModEnvHold:
            return {
              source: DLSSources.keyNum,
              destination: DLSDestinations.modEnvHold,
              amount,
              isBipolar: true
            };
          case GeneratorTypes.keyNumToModEnvDecay:
            return {
              source: DLSSources.keyNum,
              destination: DLSDestinations.modEnvDecay,
              amount,
              isBipolar: true
            };
          case GeneratorTypes.scaleTuning:
            return {
              source: DLSSources.keyNum,
              destination: DLSDestinations.pitch,
              amount: amount * 128,
              isBipolar: false
            };
        }
      }
      toString() {
        return `Source: ${this.source.toString()},
Control: ${this.control.toString()},
Scale: ${this.scale} >> 16 = ${this.shortScale},
Output transform: ${this.transformName}
Destination: ${this.destinationName}`;
      }
      write() {
        const out = new IndexedByteArray(12);
        writeWord(out, this.source.source);
        writeWord(out, this.control.source);
        writeWord(out, this.destination);
        writeWord(out, this.transform | this.control.toTransformFlag() << 4 | this.source.toTransformFlag() << 10);
        writeDword(out, this.scale);
        return out;
      }
      toSFGenerator(zone) {
        const destination = this.destination;
        const value = this.shortScale;
        switch (destination) {
          default:
            SpessaLog.info(`%cFailed converting DLS articulator into SF generator: %c${this.toString()}%c
(invalid destination)`, ConsoleColors.warn, ConsoleColors.value, ConsoleColors.unrecognized);
            return;
          case DLSDestinations.pan:
            zone.setGenerator(GeneratorTypes.pan, value);
            break;
          case DLSDestinations.gain:
            zone.addToGenerator(GeneratorTypes.initialAttenuation, -value / 0.4);
            break;
          case DLSDestinations.filterCutoff:
            zone.setGenerator(GeneratorTypes.initialFilterFc, value);
            break;
          case DLSDestinations.filterQ:
            zone.setGenerator(GeneratorTypes.initialFilterQ, value);
            break;
          case DLSDestinations.modLfoFreq:
            zone.setGenerator(GeneratorTypes.freqModLFO, value);
            break;
          case DLSDestinations.modLfoDelay:
            zone.setGenerator(GeneratorTypes.delayModLFO, value);
            break;
          case DLSDestinations.vibLfoFreq:
            zone.setGenerator(GeneratorTypes.freqVibLFO, value);
            break;
          case DLSDestinations.vibLfoDelay:
            zone.setGenerator(GeneratorTypes.delayVibLFO, value);
            break;
          case DLSDestinations.volEnvDelay:
            zone.setGenerator(GeneratorTypes.delayVolEnv, value);
            break;
          case DLSDestinations.volEnvAttack:
            zone.setGenerator(GeneratorTypes.attackVolEnv, value);
            break;
          case DLSDestinations.volEnvHold:
            zone.setGenerator(GeneratorTypes.holdVolEnv, value);
            break;
          case DLSDestinations.volEnvDecay:
            zone.setGenerator(GeneratorTypes.decayVolEnv, value);
            break;
          case DLSDestinations.volEnvRelease:
            zone.setGenerator(GeneratorTypes.releaseVolEnv, value);
            break;
          case DLSDestinations.volEnvSustain:
            zone.setGenerator(GeneratorTypes.sustainVolEnv, 1e3 - value);
            break;
          case DLSDestinations.modEnvDelay:
            zone.setGenerator(GeneratorTypes.delayModEnv, value);
            break;
          case DLSDestinations.modEnvAttack:
            zone.setGenerator(GeneratorTypes.attackModEnv, value);
            break;
          case DLSDestinations.modEnvHold:
            zone.setGenerator(GeneratorTypes.holdModEnv, value);
            break;
          case DLSDestinations.modEnvDecay:
            zone.setGenerator(GeneratorTypes.decayModEnv, value);
            break;
          case DLSDestinations.modEnvRelease:
            zone.setGenerator(GeneratorTypes.releaseModEnv, value);
            break;
          case DLSDestinations.modEnvSustain:
            zone.setGenerator(GeneratorTypes.sustainModEnv, 1e3 - value);
            break;
          case DLSDestinations.reverbSend:
            zone.setGenerator(GeneratorTypes.reverbEffectsSend, value);
            break;
          case DLSDestinations.chorusSend:
            zone.setGenerator(GeneratorTypes.chorusEffectsSend, value);
            break;
          case DLSDestinations.pitch:
            zone.fineTuning += value;
            break;
        }
      }
      toSFModulator(zone) {
        let amount = this.shortScale;
        let modulatorDestination;
        let primarySource;
        let secondarySource = new ModulatorSource();
        const specialDestination = this.toCombinedSFDestination();
        if (specialDestination) {
          modulatorDestination = specialDestination;
          const controlSF = this.control.toSFSource();
          if (!controlSF) {
            this.failedConversion("Invalid control");
            return;
          }
          primarySource = controlSF;
        } else {
          const convertedDestination = this.toSFDestination();
          if (!convertedDestination) {
            this.failedConversion("Invalid destination");
            return;
          }
          if (typeof convertedDestination === "object") {
            amount = convertedDestination.newAmount;
            modulatorDestination = convertedDestination.gen;
          } else modulatorDestination = convertedDestination;
          const convertedPrimary = this.source.toSFSource();
          if (!convertedPrimary) {
            this.failedConversion("Invalid source");
            return;
          }
          primarySource = convertedPrimary;
          const convertedSecondary = this.control.toSFSource();
          if (!convertedSecondary) {
            this.failedConversion("Invalid control");
            return;
          }
          secondarySource = convertedSecondary;
        }
        if (this.transform !== ModulatorCurveTypes.linear && primarySource.curveType === ModulatorCurveTypes.linear) primarySource.curveType = this.transform;
        if (modulatorDestination === GeneratorTypes.initialAttenuation) {
          if (this.source.source === DLSSources.velocity || this.source.source === DLSSources.volume || this.source.source === DLSSources.expression) primarySource.isNegative = true;
          amount = Math.min(960, Math.max(0, amount));
        }
        const mod = new Modulator(primarySource, secondarySource, modulatorDestination, amount, 0);
        zone.addModulators(mod);
      }
      /**
      * Checks for an SF generator that consists of DLS source and destination (such as mod LFO and pitch)
      * @returns either a matching SF generator or nothing.
      */
      toCombinedSFDestination() {
        const source = this.source.source;
        const destination = this.destination;
        if (source === DLSSources.vibratoLfo && destination === DLSDestinations.pitch) return GeneratorTypes.vibLfoToPitch;
        else if (source === DLSSources.modLfo && destination === DLSDestinations.pitch) return GeneratorTypes.modLfoToPitch;
        else if (source === DLSSources.modLfo && destination === DLSDestinations.filterCutoff) return GeneratorTypes.modLfoToFilterFc;
        else if (source === DLSSources.modLfo && destination === DLSDestinations.gain) return GeneratorTypes.modLfoToVolume;
        else if (source === DLSSources.modEnv && destination === DLSDestinations.filterCutoff) return GeneratorTypes.modEnvToFilterFc;
        else if (source === DLSSources.modEnv && destination === DLSDestinations.pitch) return GeneratorTypes.modEnvToPitch;
        else return;
      }
      failedConversion(msg) {
        SpessaLog.info(`%cFailed converting DLS articulator into SF2:
 %c${this.toString()}%c
(${msg})`, ConsoleColors.warn, ConsoleColors.value, ConsoleColors.unrecognized);
      }
      /**
      * Converts DLS destination of this block to an SF2 one, also with the correct amount.
      * @private
      */
      toSFDestination() {
        const amount = this.shortScale;
        switch (this.destination) {
          default:
          case DLSDestinations.none:
            return;
          case DLSDestinations.pan:
            return GeneratorTypes.pan;
          case DLSDestinations.gain:
            return {
              gen: GeneratorTypes.initialAttenuation,
              newAmount: -amount
            };
          case DLSDestinations.pitch:
            return GeneratorTypes.fineTune;
          case DLSDestinations.keyNum:
            return GeneratorTypes.overridingRootKey;
          case DLSDestinations.volEnvDelay:
            return GeneratorTypes.delayVolEnv;
          case DLSDestinations.volEnvAttack:
            return GeneratorTypes.attackVolEnv;
          case DLSDestinations.volEnvHold:
            return GeneratorTypes.holdVolEnv;
          case DLSDestinations.volEnvDecay:
            return GeneratorTypes.decayVolEnv;
          case DLSDestinations.volEnvSustain:
            return {
              gen: GeneratorTypes.sustainVolEnv,
              newAmount: 1e3 - amount
            };
          case DLSDestinations.volEnvRelease:
            return GeneratorTypes.releaseVolEnv;
          case DLSDestinations.modEnvDelay:
            return GeneratorTypes.delayModEnv;
          case DLSDestinations.modEnvAttack:
            return GeneratorTypes.attackModEnv;
          case DLSDestinations.modEnvHold:
            return GeneratorTypes.holdModEnv;
          case DLSDestinations.modEnvDecay:
            return GeneratorTypes.decayModEnv;
          case DLSDestinations.modEnvSustain:
            return {
              gen: GeneratorTypes.sustainModEnv,
              newAmount: 1e3 - amount
            };
          case DLSDestinations.modEnvRelease:
            return GeneratorTypes.releaseModEnv;
          case DLSDestinations.filterCutoff:
            return GeneratorTypes.initialFilterFc;
          case DLSDestinations.filterQ:
            return GeneratorTypes.initialFilterQ;
          case DLSDestinations.chorusSend:
            return GeneratorTypes.chorusEffectsSend;
          case DLSDestinations.reverbSend:
            return GeneratorTypes.reverbEffectsSend;
          case DLSDestinations.modLfoFreq:
            return GeneratorTypes.freqModLFO;
          case DLSDestinations.modLfoDelay:
            return GeneratorTypes.delayModLFO;
          case DLSDestinations.vibLfoFreq:
            return GeneratorTypes.freqVibLFO;
          case DLSDestinations.vibLfoDelay:
            return GeneratorTypes.delayVibLFO;
        }
      }
    };
    DownloadableSoundsArticulation = class extends DLSVerifier {
      connectionBlocks = new Array();
      mode = "dls2";
      get length() {
        return this.connectionBlocks.length;
      }
      copyFrom(inputArticulation) {
        this.mode = inputArticulation.mode;
        for (const block of inputArticulation.connectionBlocks) this.connectionBlocks.push(ConnectionBlock.copyFrom(block));
      }
      fromSFZone(z) {
        this.mode = "dls2";
        const zone = new BasicZone();
        zone.copyFrom(z);
        for (const relativeGenerator of zone.generators) {
          let absoluteCounterpart;
          switch (relativeGenerator.type) {
            default:
              continue;
            case GeneratorTypes.keyNumToVolEnvDecay:
              absoluteCounterpart = GeneratorTypes.decayVolEnv;
              break;
            case GeneratorTypes.keyNumToVolEnvHold:
              absoluteCounterpart = GeneratorTypes.holdVolEnv;
              break;
            case GeneratorTypes.keyNumToModEnvDecay:
              absoluteCounterpart = GeneratorTypes.decayModEnv;
              break;
            case GeneratorTypes.keyNumToModEnvHold:
              absoluteCounterpart = GeneratorTypes.holdModEnv;
          }
          const absoluteValue = zone.getGenerator(absoluteCounterpart, void 0);
          const dlsRelative = relativeGenerator.value * -128;
          if (absoluteValue === void 0) continue;
          const newAbsolute = absoluteValue - 60 / 128 * dlsRelative;
          zone.setGenerator(relativeGenerator.type, dlsRelative, false);
          zone.setGenerator(absoluteCounterpart, newAbsolute, false);
        }
        for (const generator of zone.generators) ConnectionBlock.fromSFGenerator(generator, this);
        for (const modulator of zone.modulators) ConnectionBlock.fromSFModulator(modulator, this);
      }
      /**
      * Chunk list for the region/instrument (containing lar2 or lart)
      * @param chunks
      */
      read(chunks) {
        const lart = RIFFChunk.findListType(chunks, "lart");
        const lar2 = RIFFChunk.findListType(chunks, "lar2");
        if (lart) {
          this.mode = "dls1";
          while (lart.data.currentIndex < lart.data.length) {
            const chunk = RIFFChunk.read(lart.data);
            if (chunk.header !== "art1" && chunk.header !== "art2") continue;
            const artData = chunk.data;
            const cbSize = readLittleEndianIndexed(artData, 4);
            if (cbSize !== 8) SpessaLog.warn(`CbSize in articulation mismatch. Expected 8, got ${cbSize}`);
            const connectionsAmount = readLittleEndianIndexed(artData, 4);
            for (let i = 0; i < connectionsAmount; i++) this.connectionBlocks.push(ConnectionBlock.read(artData));
          }
        } else if (lar2) {
          this.mode = "dls2";
          while (lar2.data.currentIndex < lar2.data.length) {
            const chunk = RIFFChunk.read(lar2.data);
            if (chunk.header !== "art1" && chunk.header !== "art2") continue;
            const artData = chunk.data;
            const cbSize = readLittleEndianIndexed(artData, 4);
            if (cbSize !== 8) SpessaLog.warn(`CbSize in articulation mismatch. Expected 8, got ${cbSize}`);
            const connectionsAmount = readLittleEndianIndexed(artData, 4);
            for (let i = 0; i < connectionsAmount; i++) this.connectionBlocks.push(ConnectionBlock.read(artData));
          }
        }
      }
      /**
      * Note: this writes "lar2", not just "art2"
      */
      write() {
        const art2Data = new IndexedByteArray(8);
        writeDword(art2Data, 8);
        writeDword(art2Data, this.connectionBlocks.length);
        const out = this.connectionBlocks.map((a) => a.write());
        const art2 = RIFFChunk.getParts(this.mode === "dls2" ? "art2" : "art1", [art2Data, ...out]);
        return RIFFChunk.getParts(this.mode === "dls2" ? "lar2" : "lart", art2, true);
      }
      /**
      * Converts DLS articulation into an SF zone.
      * @param zone The zone to write to.
      */
      toSFZone(zone) {
        const applyKeyToCorrection = (value, keyToGen, realGen, dlsDestination) => {
          const keyToGenValue = value / -128;
          zone.setGenerator(keyToGen, keyToGenValue);
          if (keyToGenValue <= 120) {
            const correction = Math.round(60 / 128 * value);
            const realValueConnection = this.connectionBlocks.find((block) => block.isStaticParameter && block.destination === dlsDestination);
            if (realValueConnection) zone.setGenerator(realGen, correction + realValueConnection.shortScale);
          }
        };
        for (const connection of this.connectionBlocks) {
          const amount = connection.shortScale;
          const source = connection.source.source;
          const control = connection.control.source;
          const destination = connection.destination;
          if (connection.isStaticParameter) {
            connection.toSFGenerator(zone);
            continue;
          }
          if (control === DLSSources.none) if (source === DLSSources.keyNum) {
            if (destination === DLSDestinations.pitch) {
              zone.setGenerator(GeneratorTypes.scaleTuning, amount / 128);
              continue;
            }
            if (destination === DLSDestinations.modEnvHold || destination === DLSDestinations.modEnvDecay || destination === DLSDestinations.volEnvHold || destination === DLSDestinations.volEnvDecay) continue;
          } else {
            const specialGen = connection.toCombinedSFDestination();
            if (specialGen) {
              zone.setGenerator(specialGen, amount);
              continue;
            }
          }
          connection.toSFModulator(zone);
        }
        for (const connection of this.connectionBlocks) {
          if (connection.source.source !== DLSSources.keyNum) continue;
          const generatorAmount = connection.shortScale;
          switch (connection.destination) {
            default:
            case DLSDestinations.volEnvHold:
              applyKeyToCorrection(generatorAmount, GeneratorTypes.keyNumToVolEnvHold, GeneratorTypes.holdVolEnv, DLSDestinations.volEnvHold);
              break;
            case DLSDestinations.volEnvDecay:
              applyKeyToCorrection(generatorAmount, GeneratorTypes.keyNumToVolEnvDecay, GeneratorTypes.decayVolEnv, DLSDestinations.volEnvDecay);
              break;
            case DLSDestinations.modEnvHold:
              applyKeyToCorrection(generatorAmount, GeneratorTypes.keyNumToModEnvHold, GeneratorTypes.holdModEnv, DLSDestinations.modEnvHold);
              break;
            case DLSDestinations.modEnvDecay:
              applyKeyToCorrection(generatorAmount, GeneratorTypes.keyNumToModEnvDecay, GeneratorTypes.decayModEnv, DLSDestinations.modEnvDecay);
              break;
          }
        }
        if (this.mode === "dls1") {
          zone.setGenerator(GeneratorTypes.delayVibLFO, zone.getGenerator(GeneratorTypes.delayModLFO, null));
          zone.setGenerator(GeneratorTypes.freqVibLFO, zone.getGenerator(GeneratorTypes.freqModLFO, null));
          zone.setGenerator(GeneratorTypes.vibLfoToPitch, zone.getGenerator(GeneratorTypes.modLfoToPitch, null));
          zone.setGenerator(GeneratorTypes.modLfoToPitch, null);
          for (const mod of zone.modulators) if (mod.destination === GeneratorTypes.modLfoToPitch) mod.destination = GeneratorTypes.vibLfoToPitch;
        }
      }
    };
    WaveLink = class WaveLink2 {
      /**
      * Specifies the channel placement of the sample. This is used to place mono sounds within a
      * stereo pair or for multi-track placement. Each bit position within the ulChannel field specifies
      * a channel placement with bit 0 specifying a mono sample or the left channel of a stereo file.
      */
      channel = 1;
      /**
      * Specifies the 0 based index of the cue entry in the wave pool table.
      */
      tableIndex;
      /**
      * Specifies flag options for this wave link. All bits not defined must be set to 0.
      */
      fusOptions = 0;
      /**
      * Specifies a group number for samples which are phase locked. All waves in a set of wave
      * links with the same group are phase locked and follow the wave in the group with the
      * F_WAVELINK_PHASE_MASTER flag set. If a wave is not a member of a phase locked
      * group, this value should be set to 0.
      */
      phaseGroup = 0;
      constructor(tableIndex) {
        this.tableIndex = tableIndex;
      }
      static copyFrom(waveLink) {
        const wlnk = new WaveLink2(waveLink.tableIndex);
        wlnk.channel = waveLink.channel;
        wlnk.phaseGroup = waveLink.phaseGroup;
        wlnk.fusOptions = waveLink.fusOptions;
        return wlnk;
      }
      static read(chunk) {
        const fusOptions = readLittleEndianIndexed(chunk.data, 2);
        const phaseGroup = readLittleEndianIndexed(chunk.data, 2);
        const ulChannel = readLittleEndianIndexed(chunk.data, 4);
        const wlnk = new WaveLink2(readLittleEndianIndexed(chunk.data, 4));
        wlnk.channel = ulChannel;
        wlnk.fusOptions = fusOptions;
        wlnk.phaseGroup = phaseGroup;
        return wlnk;
      }
      static fromSFZone(samples, zone) {
        const index = samples.indexOf(zone.sample);
        if (index === -1) throw new Error(`Wave link error: Sample ${zone.sample.name} does not exist in the sample list.`);
        const waveLink = new WaveLink2(index);
        switch (zone.sample.sampleType) {
          default:
          case SampleTypes.leftSample:
          case SampleTypes.monoSample:
            waveLink.channel = Math.trunc(1);
            break;
          case SampleTypes.rightSample:
            waveLink.channel = 2;
        }
        return waveLink;
      }
      write() {
        const wlnkData = new IndexedByteArray(12);
        writeWord(wlnkData, this.fusOptions);
        writeWord(wlnkData, this.phaseGroup);
        writeDword(wlnkData, this.channel);
        writeDword(wlnkData, this.tableIndex);
        return RIFFChunk.write("wlnk", wlnkData);
      }
    };
    DownloadableSoundsRegion = class DownloadableSoundsRegion2 extends DLSVerifier {
      articulation = new DownloadableSoundsArticulation();
      /**
      * Specifies the key range for this region.
      */
      keyRange = {
        min: 0,
        max: 127
      };
      /**
      * Specifies the velocity range for this region.
      */
      velRange = {
        min: 0,
        max: 127
      };
      /**
      * Specifies the key group for a drum instrument. Key group values allow multiple regions
      * within a drum instrument to belong to the same "key group." If a synthesis engine is
      * instructed to play a note with a key group setting and any other notes are currently playing
      * with this same key group, then the synthesis engine should turn off all notes with the same
      * key group value as soon as possible.
      */
      keyGroup = 0;
      /**
      * Specifies flag options for the synthesis of this region.
      */
      fusOptions = 0;
      /**
      * Indicates the layer of this region for editing purposes. This field facilitates the
      * organization of overlapping regions into layers for display to the user of a DLS sound editor.
      * For example, if a piano sound and a string section are overlapped to create a piano/string pad,
      * all the regions of the piano might be labeled as layer 1, and all the regions of the string
      * section might be labeled as layer 2
      */
      usLayer = 0;
      waveSample;
      waveLink;
      constructor(waveLink, waveSample) {
        super();
        this.waveSample = waveSample;
        this.waveLink = waveLink;
      }
      static copyFrom(inputRegion) {
        const outputRegion = new DownloadableSoundsRegion2(WaveLink.copyFrom(inputRegion.waveLink), WaveSample.copyFrom(inputRegion.waveSample));
        outputRegion.keyGroup = inputRegion.keyGroup;
        outputRegion.keyRange = { ...inputRegion.keyRange };
        outputRegion.velRange = { ...inputRegion.velRange };
        outputRegion.usLayer = inputRegion.usLayer;
        outputRegion.fusOptions = inputRegion.fusOptions;
        outputRegion.articulation.copyFrom(inputRegion.articulation);
        return outputRegion;
      }
      static read(samples, chunk) {
        const regionChunks = this.verifyAndReadList(chunk, "rgn ", "rgn2");
        const waveSampleChunk = regionChunks.find((c) => c.header === "wsmp");
        let waveSample = waveSampleChunk ? WaveSample.read(waveSampleChunk) : void 0;
        const waveLinkChunk = regionChunks.find((c) => c.header === "wlnk");
        if (!waveLinkChunk) {
          SpessaLog.warn("Invalid DLS region: missing 'wlnk' chunk! Discarding...");
          return;
        }
        const waveLink = WaveLink.read(waveLinkChunk);
        const regionHeader = regionChunks.find((c) => c.header === "rgnh");
        if (!regionHeader) {
          SpessaLog.warn("Invalid DLS region: missing 'rgnh' chunk! Discarding...");
          return;
        }
        const sample = samples[waveLink.tableIndex];
        if (!sample) DownloadableSoundsRegion2.parsingError(`Invalid sample index: ${waveLink.tableIndex}. Samples available: ${samples.length}`);
        waveSample ??= sample.waveSample;
        const region = new DownloadableSoundsRegion2(waveLink, waveSample);
        const keyMin = readLittleEndianIndexed(regionHeader.data, 2);
        const keyMax = readLittleEndianIndexed(regionHeader.data, 2);
        let velMin = readLittleEndianIndexed(regionHeader.data, 2);
        let velMax = readLittleEndianIndexed(regionHeader.data, 2);
        if (velMin === 0 && velMax === 0) {
          velMax = 127;
          velMin = 0;
        }
        region.keyRange.max = keyMax;
        region.keyRange.min = keyMin;
        region.velRange.max = velMax;
        region.velRange.min = velMin;
        region.fusOptions = readLittleEndianIndexed(regionHeader.data, 2);
        region.keyGroup = readLittleEndianIndexed(regionHeader.data, 2);
        if (regionHeader.data.length - regionHeader.data.currentIndex >= 2) region.usLayer = readLittleEndianIndexed(regionHeader.data, 2);
        region.articulation.read(regionChunks);
        return region;
      }
      static fromSFZone(zone, samples) {
        const waveSample = WaveSample.fromSFZone(zone);
        const region = new DownloadableSoundsRegion2(WaveLink.fromSFZone(samples, zone), waveSample);
        region.keyRange.min = Math.max(zone.keyRange.min, 0);
        region.keyRange.max = zone.keyRange.max;
        region.velRange.min = Math.max(zone.velRange.min, 0);
        region.velRange.max = zone.velRange.max;
        region.keyGroup = zone.getGenerator(GeneratorTypes.exclusiveClass, 0);
        region.articulation.fromSFZone(zone);
        return region;
      }
      write() {
        const chunks = [
          this.writeHeader(),
          this.waveSample.write(),
          this.waveLink.write(),
          ...this.articulation.write()
        ];
        return RIFFChunk.getParts("rgn2", chunks, false, true);
      }
      toSFZone(instrument, samples) {
        const sample = samples[this.waveLink.tableIndex];
        if (!sample) DownloadableSoundsRegion2.parsingError(`Invalid sample index: ${this.waveLink.tableIndex}`);
        const zone = instrument.createZone(sample);
        zone.keyRange = this.keyRange;
        zone.velRange = this.velRange;
        if (this.keyRange.max === 127 && this.keyRange.min === 0) zone.keyRange.min = -1;
        if (this.velRange.max === 127 && this.velRange.min === 0) zone.velRange.min = -1;
        if (this.keyGroup !== 0) zone.setGenerator(GeneratorTypes.exclusiveClass, this.keyGroup);
        this.waveSample.toSFZone(zone, sample);
        this.articulation.toSFZone(zone);
        zone.generators = zone.generators.filter((g) => g.value !== GeneratorLimits[g.type].def);
        return zone;
      }
      writeHeader() {
        const rgnhData = new IndexedByteArray(14);
        writeWord(rgnhData, Math.max(this.keyRange.min, 0));
        writeWord(rgnhData, this.keyRange.max);
        writeWord(rgnhData, Math.max(this.velRange.min, 0));
        writeWord(rgnhData, this.velRange.max);
        writeWord(rgnhData, this.fusOptions);
        writeWord(rgnhData, this.keyGroup);
        writeWord(rgnhData, this.usLayer);
        return RIFFChunk.write("rgnh", rgnhData);
      }
    };
    DownloadableSoundsInstrument = class DownloadableSoundsInstrument2 extends DLSVerifier {
      articulation = new DownloadableSoundsArticulation();
      regions = new Array();
      name = "Unnamed";
      bankLSB = 0;
      bankMSB = 0;
      isGMGSDrum = false;
      program = 0;
      static copyFrom(inputInstrument) {
        const outputInstrument = new DownloadableSoundsInstrument2();
        outputInstrument.name = inputInstrument.name;
        outputInstrument.isGMGSDrum = inputInstrument.isGMGSDrum;
        outputInstrument.bankMSB = inputInstrument.bankMSB;
        outputInstrument.bankLSB = inputInstrument.bankLSB;
        outputInstrument.program = inputInstrument.program;
        outputInstrument.articulation.copyFrom(inputInstrument.articulation);
        for (const region of inputInstrument.regions) outputInstrument.regions.push(DownloadableSoundsRegion.copyFrom(region));
        return outputInstrument;
      }
      static read(samples, chunk) {
        const chunks = this.verifyAndReadList(chunk, "ins ");
        const instrumentHeader = chunks.find((c) => c.header === "insh");
        if (!instrumentHeader) {
          SpessaLog.groupEnd();
          throw new Error("No instrument header!");
        }
        let instrumentName = ``;
        const infoChunk = RIFFChunk.findListType(chunks, "INFO");
        if (infoChunk) {
          let info = RIFFChunk.read(infoChunk.data);
          while (info.header !== "INAM") info = RIFFChunk.read(infoChunk.data);
          instrumentName = readBinaryStringIndexed(info.data, info.data.length).trim();
        }
        if (instrumentName.length === 0) instrumentName = `Unnamed Instrument`;
        const instrument = new DownloadableSoundsInstrument2();
        instrument.name = instrumentName;
        const regions = readLittleEndianIndexed(instrumentHeader.data, 4);
        const ulBank = readLittleEndianIndexed(instrumentHeader.data, 4);
        instrument.program = readLittleEndianIndexed(instrumentHeader.data, 4) & 127;
        instrument.bankMSB = ulBank >>> 8 & 127;
        instrument.bankLSB = ulBank & 127;
        instrument.isGMGSDrum = ulBank >>> 31 > 0;
        SpessaLog.groupCollapsed(`%cParsing %c"${instrumentName}"%c...`, ConsoleColors.info, ConsoleColors.recognized, ConsoleColors.info);
        const regionListChunk = RIFFChunk.findListType(chunks, "lrgn");
        if (!regionListChunk) {
          SpessaLog.groupEnd();
          throw new Error("No region list!");
        }
        instrument.articulation.read(chunks);
        for (let i = 0; i < regions; i++) {
          const chunk2 = RIFFChunk.read(regionListChunk.data);
          this.verifyHeader(chunk2, "LIST");
          const type = readBinaryStringIndexed(chunk2.data, 4);
          if (type !== "rgn " && type !== "rgn2") {
            SpessaLog.groupEnd();
            this.parsingError(`Invalid DLS region! Expected "rgn " or "rgn2" got "${type}"`);
          }
          const region = DownloadableSoundsRegion.read(samples, chunk2);
          if (region) instrument.regions.push(region);
        }
        SpessaLog.groupEnd();
        return instrument;
      }
      static fromSFPreset(preset, samples) {
        const instrument = new DownloadableSoundsInstrument2();
        instrument.name = preset.name;
        instrument.bankLSB = preset.bankLSB;
        instrument.bankMSB = preset.bankMSB;
        instrument.program = preset.program;
        instrument.isGMGSDrum = preset.isGMGSDrum;
        SpessaLog.group(`%cConverting %c${preset.toString()}%c to DLS...`, ConsoleColors.info, ConsoleColors.value, ConsoleColors.info);
        const inst = preset.toFlattenedInstrument();
        for (const z of inst.zones) instrument.regions.push(DownloadableSoundsRegion.fromSFZone(z, samples));
        SpessaLog.groupEnd();
        return instrument;
      }
      write() {
        SpessaLog.groupCollapsed(`%cWriting %c${this.name}%c...`, ConsoleColors.info, ConsoleColors.recognized, ConsoleColors.info);
        const chunks = [this.writeHeader()];
        const regionChunks = this.regions.flatMap((r) => r.write());
        chunks.push(...RIFFChunk.getParts("lrgn", regionChunks, false, true));
        if (this.articulation.length > 0) chunks.push(...this.articulation.write());
        const inam = RIFFChunk.write("INAM", getStringBytes(this.name, true));
        chunks.push(RIFFChunk.write("INFO", inam, false, true));
        SpessaLog.groupEnd();
        return RIFFChunk.writeParts("ins ", chunks, false, true);
      }
      /**
      * Performs the full DLS to SF2 instrument conversion.
      */
      toSFPreset(soundBank) {
        const preset = new BasicPreset(soundBank);
        preset.name = this.name;
        preset.bankMSB = this.bankMSB;
        preset.bankLSB = this.bankLSB;
        preset.isGMGSDrum = this.isGMGSDrum;
        preset.program = this.program;
        const instrument = new BasicInstrument();
        instrument.name = this.name;
        preset.createZone(instrument);
        this.articulation.toSFZone(instrument.globalZone);
        for (const region of this.regions) region.toSFZone(instrument, soundBank.samples);
        instrument.globalize();
        if (!instrument.globalZone.modulators.some((m) => m.destination === GeneratorTypes.reverbEffectsSend)) instrument.globalZone.addModulators(Modulator.copyFrom(DEFAULT_DLS_REVERB));
        if (!instrument.globalZone.modulators.some((m) => m.destination === GeneratorTypes.chorusEffectsSend)) instrument.globalZone.addModulators(Modulator.copyFrom(DEFAULT_DLS_CHORUS));
        instrument.globalZone.generators = instrument.globalZone.generators.filter((g) => g.value !== GeneratorLimits[g.type].def);
        soundBank.addPresets(preset);
        soundBank.addInstruments(instrument);
      }
      writeHeader() {
        const inshData = new IndexedByteArray(12);
        writeDword(inshData, this.regions.length);
        let ulBank = (this.bankMSB & 127) << 8 | this.bankLSB & 127;
        if (this.isGMGSDrum) ulBank |= 1 << 31;
        writeDword(inshData, ulBank);
        writeDword(inshData, this.program & 127);
        return RIFFChunk.write("insh", inshData);
      }
    };
    DEFAULT_DLS_OPTIONS = { software: "SpessaSynth" };
    DownloadableSounds = class DownloadableSounds2 extends DLSVerifier {
      samples = new Array();
      instruments = new Array();
      soundBankInfo = {
        name: "Unnamed DLS sound bank",
        creationDate: /* @__PURE__ */ new Date(),
        software: "SpessaSynth",
        soundEngine: "DLS Level 2.2",
        product: "SpessaSynth DLS",
        version: {
          major: 2,
          minor: 4
        }
      };
      static read(buffer) {
        if (!buffer) throw new Error("No data provided!");
        const dataArray = new IndexedByteArray(buffer);
        SpessaLog.group("%cParsing DLS file...", ConsoleColors.info);
        const firstChunk = RIFFChunk.read(dataArray, false, false);
        this.verifyHeader(firstChunk, "RIFF");
        this.verifyText(readBinaryStringIndexed(dataArray, 4).toLowerCase(), "dls ");
        const chunks = [];
        while (dataArray.currentIndex < dataArray.length) chunks.push(RIFFChunk.read(dataArray));
        const dls = new DownloadableSounds2();
        const infoChunk = RIFFChunk.findListType(chunks, "INFO");
        if (infoChunk) while (infoChunk.data.currentIndex < infoChunk.data.length) {
          const infoPart = RIFFChunk.read(infoChunk.data);
          const headerTyped = infoPart.header;
          const text = readBinaryStringIndexed(infoPart.data, infoPart.size);
          switch (headerTyped) {
            case "INAM":
              dls.soundBankInfo.name = text;
              break;
            case "ICRD":
              dls.soundBankInfo.creationDate = parseDateString(text);
              break;
            case "ICMT":
              dls.soundBankInfo.comment = text;
              break;
            case "ISBJ":
              dls.soundBankInfo.subject = text;
              break;
            case "ICOP":
              dls.soundBankInfo.copyright = text;
              break;
            case "IENG":
              dls.soundBankInfo.engineer = text;
              break;
            case "IPRD":
              dls.soundBankInfo.product = text;
              break;
            case "ISFT":
              dls.soundBankInfo.software = text;
          }
        }
        this.printInfo(dls);
        const colhChunk = chunks.find((c) => c.header === "colh");
        if (!colhChunk) {
          this.parsingError("No colh chunk!");
          return 5;
        }
        const instrumentAmount = readLittleEndianIndexed(colhChunk.data, 4);
        SpessaLog.info(`%cInstruments amount: %c${instrumentAmount}`, ConsoleColors.info, ConsoleColors.recognized);
        const waveListChunk = RIFFChunk.findListType(chunks, "wvpl");
        if (!waveListChunk) {
          this.parsingError("No wvpl chunk!");
          return 5;
        }
        const waveList = this.verifyAndReadList(waveListChunk, "wvpl");
        for (const wave of waveList) dls.samples.push(DownloadableSoundsSample.read(wave));
        const instrumentListChunk = RIFFChunk.findListType(chunks, "lins");
        if (!instrumentListChunk) {
          this.parsingError("No lins chunk!");
          return 5;
        }
        const instruments = this.verifyAndReadList(instrumentListChunk, "lins");
        SpessaLog.groupCollapsed("%cLoading instruments...", ConsoleColors.info);
        if (instruments.length !== instrumentAmount) SpessaLog.warn(`Colh reported invalid amount of instruments. Detected ${instruments.length}, expected ${instrumentAmount}`);
        for (const ins of instruments) dls.instruments.push(DownloadableSoundsInstrument.read(dls.samples, ins));
        SpessaLog.groupEnd();
        const aliasingChunk = chunks.find((c) => c.header === "pgal");
        if (aliasingChunk) {
          SpessaLog.info("%cFound the instrument aliasing chunk!", ConsoleColors.recognized);
          const pgalData = aliasingChunk.data;
          if (pgalData[0] !== 0 || pgalData[1] !== 1 || pgalData[2] !== 2 || pgalData[3] !== 3) pgalData.currentIndex += 4;
          const drumInstrument = dls.instruments.find((i) => BankSelectHacks.isXGDrum(i.bankMSB) || i.isGMGSDrum);
          if (!drumInstrument) {
            SpessaLog.warn("MobileBAE aliasing chunk without a drum preset. Aborting!");
            return dls;
          }
          const drumAliases = pgalData.slice(pgalData.currentIndex, pgalData.currentIndex + 128);
          pgalData.currentIndex += 128;
          for (let keyNum = 0; keyNum < 128; keyNum++) {
            const alias = drumAliases[keyNum];
            if (alias === keyNum) continue;
            const region = drumInstrument.regions.find((r) => r.keyRange.max === alias && r.keyRange.min === alias);
            if (!region) {
              SpessaLog.warn(`Invalid drum alias ${keyNum} to ${alias}: region does not exist.`);
              continue;
            }
            const copied = DownloadableSoundsRegion.copyFrom(region);
            copied.keyRange.max = keyNum;
            copied.keyRange.min = keyNum;
            drumInstrument.regions.push(copied);
          }
          pgalData.currentIndex += 4;
          while (pgalData.currentIndex < pgalData.length) {
            const aliasBankNum = readLittleEndianIndexed(pgalData, 2);
            const aliasBankLSB = aliasBankNum & 127;
            const aliasBankMSB = aliasBankNum >> 7 & 127;
            const aliasProgram = pgalData[pgalData.currentIndex++];
            let nullByte = pgalData[pgalData.currentIndex++];
            if (nullByte !== 0) SpessaLog.warn(`Invalid alias byte. Expected 0, got ${nullByte}`);
            const inputBankNum = readLittleEndianIndexed(pgalData, 2);
            const inputBankLSB = inputBankNum & 127;
            const inputBankMSB = inputBankNum >> 7 & 127;
            const inputProgram = pgalData[pgalData.currentIndex++];
            nullByte = pgalData[pgalData.currentIndex++];
            if (nullByte !== 0) SpessaLog.warn(`Invalid alias header. Expected 0, got ${nullByte}`);
            const inputInstrument = dls.instruments.find((inst) => inst.bankLSB === inputBankLSB && inst.bankMSB === inputBankMSB && inst.program === inputProgram && !inst.isGMGSDrum);
            if (!inputInstrument) {
              SpessaLog.warn(`Invalid alias. Missing instrument: ${inputBankLSB}:${inputBankMSB}:${inputProgram}`);
              continue;
            }
            const alias = DownloadableSoundsInstrument.copyFrom(inputInstrument);
            alias.bankMSB = aliasBankMSB;
            alias.bankLSB = aliasBankLSB;
            alias.program = aliasProgram;
            dls.instruments.push(alias);
          }
        }
        SpessaLog.info(`%cParsing finished! %c"${dls.soundBankInfo.name || "UNNAMED"}"%c has %c${dls.instruments.length}%c instruments and %c${dls.samples.length}%c samples.`, ConsoleColors.info, ConsoleColors.recognized, ConsoleColors.info, ConsoleColors.recognized, ConsoleColors.info, ConsoleColors.recognized, ConsoleColors.info);
        SpessaLog.groupEnd();
        return dls;
      }
      /**
      * Performs a full conversion from BasicSoundBank to DownloadableSounds.
      * Includes an optional progress function for transforming the samples.
      */
      static fromSF(bank, progressFunc) {
        SpessaLog.groupCollapsed("%cSaving SF2 to DLS level 2...", ConsoleColors.info);
        const dls = new DownloadableSounds2();
        dls.soundBankInfo = { ...bank.soundBankInfo };
        for (let i = 0; i < bank.samples.length; i++) {
          const s = bank.samples[i];
          dls.samples.push(DownloadableSoundsSample.fromSFSample(s));
          progressFunc?.(i / bank.samples.length);
        }
        for (const p of bank.presets) dls.instruments.push(DownloadableSoundsInstrument.fromSFPreset(p, bank.samples));
        SpessaLog.info("%cConversion complete!", ConsoleColors.recognized);
        SpessaLog.groupEnd();
        return dls;
      }
      static printInfo(dls) {
        for (const [info, value] of Object.entries(dls.soundBankInfo)) if (typeof value === "object" && "major" in value) {
          const v = value;
          SpessaLog.info(`%c${info}: %c"${v.major}.${v.minor}"`, ConsoleColors.info, ConsoleColors.recognized);
        } else SpessaLog.info(`%c${info}: %c${value.toLocaleString()}`, ConsoleColors.info, ConsoleColors.recognized);
      }
      /**
      * Writes a DLS file.
      * @param writeOptions the options for writing the file.
      */
      write(writeOptions = DEFAULT_DLS_OPTIONS) {
        const options = fillWithDefaults(writeOptions, DEFAULT_DLS_OPTIONS);
        SpessaLog.groupCollapsed("%cSaving DLS...", ConsoleColors.info);
        const colhNum = new IndexedByteArray(4);
        writeDword(colhNum, this.instruments.length);
        const colh = RIFFChunk.write("colh", colhNum);
        SpessaLog.groupCollapsed("%cWriting instruments...", ConsoleColors.info);
        const lins = RIFFChunk.getParts("lins", this.instruments.map((i) => i.write()), false, true);
        SpessaLog.info("%cSuccess!", ConsoleColors.recognized);
        SpessaLog.groupEnd();
        SpessaLog.groupCollapsed("%cWriting WAVE samples...", ConsoleColors.info);
        let currentIndex = 0;
        const ptblOffsets = [];
        const samples = [];
        let written = 0;
        for (const s of this.samples) {
          const out2 = s.write();
          options.progressFunction?.(written / this.samples.length);
          SpessaLog.info(`%cWrote sample %c${written}. ${s.name}%c of %c${this.samples.length}.`, ConsoleColors.info, ConsoleColors.recognized, ConsoleColors.info, ConsoleColors.recognized);
          ptblOffsets.push(currentIndex);
          currentIndex += out2.reduce((sum, cur) => sum + cur.length, 0);
          samples.push(...out2);
          written++;
        }
        const wvpl = RIFFChunk.getParts("wvpl", samples, false, true);
        SpessaLog.info("%cSucceeded!", ConsoleColors.recognized);
        const ptblData = new IndexedByteArray(8 + 4 * ptblOffsets.length);
        writeDword(ptblData, 8);
        writeDword(ptblData, ptblOffsets.length);
        for (const offset of ptblOffsets) writeDword(ptblData, offset);
        const ptbl = RIFFChunk.write("ptbl", ptblData);
        this.soundBankInfo.software = options.software;
        const infos = [];
        const info = this.soundBankInfo;
        const writeDLSInfo = (type, data) => {
          if (!data) return;
          infos.push(...RIFFChunk.getParts(type, [getStringBytes(data, true)]));
        };
        writeDLSInfo("INAM", info.name);
        writeDLSInfo("ICMT", info.comment);
        writeDLSInfo("ICOP", info.copyright);
        writeDLSInfo("ICRD", toISODateString(info.creationDate));
        writeDLSInfo("IENG", info.engineer);
        writeDLSInfo("IPRD", info.product);
        writeDLSInfo("ISFT", options.software);
        writeDLSInfo("ISBJ", info.subject);
        SpessaLog.info("%cCombining everything...");
        const out = RIFFChunk.writeParts("RIFF", [
          getStringBytes("DLS "),
          colh,
          ...lins,
          ptbl,
          ...wvpl,
          ...RIFFChunk.getParts("INFO", infos, false, true)
        ]);
        SpessaLog.info("%cSaved successfully!", ConsoleColors.recognized);
        SpessaLog.groupEnd();
        return out.buffer;
      }
      /**
      * Performs a full conversion from DownloadableSounds to BasicSoundBank.
      */
      toSF() {
        SpessaLog.group("%cConverting DLS to SF2...", ConsoleColors.info);
        const soundBank = new BasicSoundBank("dls");
        soundBank.soundBankInfo.version.minor = 4;
        soundBank.soundBankInfo.version.major = 2;
        soundBank.soundBankInfo = { ...this.soundBankInfo };
        for (const sample of this.samples) sample.toSFSample(soundBank);
        for (const instrument of this.instruments) instrument.toSFPreset(soundBank);
        soundBank.flush();
        SpessaLog.info("%cConversion complete!", ConsoleColors.recognized);
        SpessaLog.groupEnd();
        return soundBank;
      }
    };
    BasicSoundBank = class BasicSoundBank2 {
      /**
      * Indicates if the SF3/SF2Pack decoder is ready.
      */
      static isSF3DecoderReady = stb.isInitialized;
      /**
      * The type of the sound bank that was loaded.
      * Either `sf2` for SoundFont2/SoundFont3 or `dls` for DownLoadable Sounds or `sfe` for SF-Enhanced.
      *
      * Please note that SF3 or SFOGG files are parsed as `sf2` files, but with compressed samples.
      * The type is still `sf2`.
      */
      type;
      /**
      * Sound bank's info.
      */
      soundBankInfo = {
        name: "Unnamed",
        creationDate: /* @__PURE__ */ new Date(),
        software: "SpessaSynth",
        soundEngine: "E-mu 10K2",
        version: {
          major: 2,
          minor: 4
        }
      };
      /**
      * The sound bank's presets.
      */
      presets = [];
      /**
      * The sound bank's samples.
      */
      samples = [];
      /**
      * The sound bank's instruments.
      */
      instruments = [];
      /**
      * Sound bank's default modulators.
      */
      defaultModulators = SPESSASYNTH_DEFAULT_MODULATORS.map(Modulator.copyFrom.bind(Modulator));
      /**
      * If the sound bank has custom default modulators (DMOD).
      */
      customDefaultModulators = false;
      constructor(type = "sf2") {
        this.type = type;
      }
      _isXGBank = false;
      /**
      * Checks for XG drum sets and considers if this sound bank is XG.
      */
      get isXGBank() {
        return this._isXGBank;
      }
      /**
      * Merges sound banks with the given order. Keep in mind that the info read is copied from the first one
      * @param soundBanks the sound banks to merge, the first overwrites the last
      */
      static mergeSoundBanks(...soundBanks) {
        const mainSf = soundBanks.shift();
        if (!mainSf) throw new Error("No sound banks provided!");
        const presets = mainSf.presets;
        while (soundBanks.length > 0) {
          const newPresets = soundBanks?.shift()?.presets;
          if (newPresets) {
            for (const newPreset of newPresets) if (!presets.some((existingPreset) => newPreset.matches(existingPreset))) presets.push(newPreset);
          }
        }
        const b = new BasicSoundBank2();
        b.addCompletePresets(presets);
        b.soundBankInfo = { ...mainSf.soundBankInfo };
        return b;
      }
      /**
      * Creates a simple sound bank with one saw wave preset.
      */
      static getSampleSoundBankFile() {
        const font = new BasicSoundBank2();
        const sampleData = new Float32Array(128);
        for (let i = 0; i < 128; i++) sampleData[i] = i / 128 * 2 - 1;
        const sample = new EmptySample();
        sample.name = "Saw";
        sample.originalKey = 65;
        sample.pitchCorrection = 20;
        sample.loopEnd = 128;
        sample.setAudioData(sampleData, 44100);
        font.addSamples(sample);
        const inst = new BasicInstrument();
        inst.name = "Saw Wave";
        inst.globalZone.addGenerators(new Generator(GeneratorTypes.initialAttenuation, 375), new Generator(GeneratorTypes.releaseVolEnv, -1e3), new Generator(GeneratorTypes.sampleModes, 1));
        inst.createZone(sample);
        inst.createZone(sample).setGenerator(GeneratorTypes.fineTune, -9);
        font.addInstruments(inst);
        const preset = new BasicPreset(font);
        preset.name = "Saw Wave";
        preset.createZone(inst);
        font.addPresets(preset);
        font.soundBankInfo.name = "SpessaSynth Sample Sound Bank";
        font.flush();
        return font.writeSF2();
      }
      /**
      * Copies a given sound bank.
      * @param bank The sound bank to copy.
      */
      static copyFrom(bank) {
        const copied = new BasicSoundBank2();
        for (const p of bank.presets) copied.clonePreset(p);
        copied.soundBankInfo = { ...bank.soundBankInfo };
        return copied;
      }
      /**
      * Adds complete presets along with their instruments and samples.
      * @param presets The presets to add.
      */
      addCompletePresets(presets) {
        this.addPresets(...presets);
        const instrumentList = [];
        for (const preset of presets) for (const zone of preset.zones) if (zone.instrument && !instrumentList.includes(zone.instrument)) instrumentList.push(zone.instrument);
        this.addInstruments(...instrumentList);
        const sampleList = [];
        for (const instrument of instrumentList) for (const zone of instrument.zones) if (zone.sample && !sampleList.includes(zone.sample)) sampleList.push(zone.sample);
        this.addSamples(...sampleList);
      }
      /**
      * Sets the sound bank's sample format _in place_.
      * @param options options for writing the file.
      */
      async setSampleFormat(options) {
        let writtenCount = 0;
        const format = options.format;
        const progressFunc = options.progressFunction;
        for (const s of this.samples) {
          switch (format) {
            default:
            case "pcm":
              s.setAudioData(s.getAudioData(), s.sampleRate);
              break;
            case "compressed": {
              const f = options.compressionFunction;
              if (!f) throw new Error(`No compression function supplied but '${format}' was requested.`);
              await s.compressSample(f);
            }
          }
          writtenCount++;
          progressFunc?.(writtenCount / this.samples.length);
          SpessaLog.info(`%cEncoded sample %c${writtenCount}. ${s.name}%c of %c${this.samples.length}%c. Compressed: %c${s.isCompressed}%c.`, ConsoleColors.info, ConsoleColors.recognized, ConsoleColors.info, ConsoleColors.recognized, ConsoleColors.info, s.isCompressed ? ConsoleColors.recognized : ConsoleColors.unrecognized, ConsoleColors.info);
        }
        switch (format) {
          default:
          case "pcm":
            this.soundBankInfo.version.major = 2;
            this.soundBankInfo.version.minor = 4;
            break;
          case "compressed":
            this.soundBankInfo.version.major = 3;
            this.soundBankInfo.version.minor = 0;
        }
      }
      /**
      * Write the sound bank as a .dls file. This may not be 100% accurate.
      * Note that samples are always written in the s16le PCM encoding.
      * @param options options for writing the file.
      * @returns the binary file.
      */
      writeDLS(options = DEFAULT_DLS_OPTIONS) {
        const pFunc = options.progressFunction;
        return DownloadableSounds.fromSF(this, pFunc ? (p) => pFunc(p / 2) : void 0).write({
          ...options,
          progressFunction: pFunc ? (p) => pFunc(0.5 + p / 2) : void 0
        });
      }
      /**
      * Writes the sound bank as an SF2 file.
      * @param writeOptions the options for writing.
      * @returns the binary file data.
      */
      writeSF2(writeOptions = DEFAULT_SF2_WRITE_OPTIONS) {
        return writeSF2Internal(this, writeOptions);
      }
      /**
      * Writes the sound bank as an [SFE 4](https://sfe-team-was-taken.github.io/SFE/) file.
      * This enables features such as bank LSB and RIFF64.
      * Note that spessasynth is currently the only software that can read these files.
      * @param writeOptions the options for writing.
      * @returns the binary file data.
      */
      writeSFE(writeOptions = DEFAULT_SFE_WRITE_OPTIONS) {
        return writeSFEInternal(this, writeOptions);
      }
      addPresets(...presets) {
        this.presets.push(...presets);
      }
      addInstruments(...instruments) {
        this.instruments.push(...instruments);
      }
      addSamples(...samples) {
        this.samples.push(...samples);
      }
      /**
      * Clones a sample into this bank.
      * @param sample The sample to copy.
      * @returns the copied sample, if a sample exists with that name, it is returned instead
      */
      cloneSample(sample) {
        const duplicate = this.samples.find((s) => s.name === sample.name);
        if (duplicate) return duplicate;
        const newSample = new BasicSample(sample.name, sample.sampleRate, sample.originalKey, sample.pitchCorrection, sample.sampleType, sample.loopStart, sample.loopEnd);
        if (sample.isCompressed) newSample.setCompressedData(sample.getRawData(true));
        else newSample.setAudioData(sample.getAudioData(), sample.sampleRate);
        this.addSamples(newSample);
        if (sample.linkedSample) {
          const clonedLinked = this.cloneSample(sample.linkedSample);
          if (!clonedLinked.linkedSample) newSample.setLinkedSample(clonedLinked, newSample.sampleType);
        }
        return newSample;
      }
      /**
      * Recursively clones an instrument into this sound bank, as well as its samples.
      * @returns the copied instrument, if an instrument exists with that name, it is returned instead.
      */
      cloneInstrument(instrument) {
        const duplicate = this.instruments.find((i) => i.name === instrument.name);
        if (duplicate) return duplicate;
        const newInstrument = new BasicInstrument();
        newInstrument.name = instrument.name;
        newInstrument.globalZone.copyFrom(instrument.globalZone);
        for (const zone of instrument.zones) newInstrument.createZone(this.cloneSample(zone.sample)).copyFrom(zone);
        this.addInstruments(newInstrument);
        return newInstrument;
      }
      /**
      * Recursively clones a preset into this sound bank, as well as its instruments and samples.
      * @returns the copied preset, if a preset exists with that name, it is returned instead.
      */
      clonePreset(preset) {
        const duplicate = this.presets.find((p) => p.name === preset.name);
        if (duplicate) return duplicate;
        const newPreset = new BasicPreset(this);
        newPreset.name = preset.name;
        newPreset.bankMSB = preset.bankMSB;
        newPreset.bankLSB = preset.bankLSB;
        newPreset.isGMGSDrum = preset.isGMGSDrum;
        newPreset.program = preset.program;
        newPreset.library = preset.library;
        newPreset.genre = preset.genre;
        newPreset.morphology = preset.morphology;
        newPreset.globalZone.copyFrom(preset.globalZone);
        for (const zone of preset.zones) newPreset.createZone(this.cloneInstrument(zone.instrument)).copyFrom(zone);
        this.addPresets(newPreset);
        return newPreset;
      }
      /**
      * Updates internal values.
      */
      flush() {
        this.presets.sort(MIDIPatchTools.compare.bind(MIDIPatchTools));
        this.parseInternal();
      }
      /**
      * Trims the sound bank _in-place_ to only contain samples in a given MIDI file.
      * @param presetData - A `Map`: `BasicPreset` -> `Set<"key-velocity">`.
      * Absent presets will be removed from the sound bank,
      * and samples that don't get activated in the remaining presets will be removed as well.
      */
      trim(presetData) {
        const trimInstrumentZones = (instrument, keyCombos) => {
          let trimmedIZones = 0;
          for (let iZoneIndex = 0; iZoneIndex < instrument.zones.length; iZoneIndex++) {
            const iZone = instrument.zones[iZoneIndex];
            const iKeyRange = iZone.keyRange;
            const iVelRange = iZone.velRange;
            let isIZoneUsed = false;
            for (const [key, velocities] of keyCombos) if (key >= iKeyRange.min && key <= iKeyRange.max && [...velocities].some((velocity) => velocity >= iVelRange.min && velocity <= iVelRange.max)) {
              isIZoneUsed = true;
              break;
            }
            if (!isIZoneUsed) {
              SpessaLog.info(`%c${iZone.sample.name}%c removed from %c${instrument.name}%c.`, ConsoleColors.recognized, ConsoleColors.info, ConsoleColors.recognized, ConsoleColors.info);
              if (instrument.deleteZone(iZoneIndex)) {
                trimmedIZones++;
                iZoneIndex--;
                SpessaLog.info(`%c${iZone.sample.name}%c deleted`, ConsoleColors.recognized, ConsoleColors.info);
              }
              if (iZone.sample.useCount < 1) this.deleteSample(iZone.sample);
            }
          }
          return trimmedIZones;
        };
        SpessaLog.groupCollapsed("%cTrimming sound bank...", ConsoleColors.info);
        SpessaLog.info("Combinations to trim for:", presetData);
        for (let presetIndex = 0; presetIndex < this.presets.length; presetIndex++) {
          const p = this.presets[presetIndex];
          const keyCombos = presetData.get(p);
          if (keyCombos === void 0) {
            SpessaLog.info(`%cDeleting preset %c${p.name}%c and its zones`, ConsoleColors.info, ConsoleColors.recognized, ConsoleColors.info);
            this.deletePreset(p);
            presetIndex--;
          } else {
            SpessaLog.groupCollapsed(`%cTrimming %c${p.name}`, ConsoleColors.info, ConsoleColors.recognized);
            SpessaLog.info(`Keys for ${p.name}:`, keyCombos);
            let trimmedZones = 0;
            for (let zoneIndex = 0; zoneIndex < p.zones.length; zoneIndex++) {
              const zone = p.zones[zoneIndex];
              const keyRange = zone.keyRange;
              const velRange = zone.velRange;
              let isZoneUsed = false;
              for (const [key, velocities] of keyCombos) if (key >= keyRange.min && key <= keyRange.max && [...velocities].some((velocity) => velocity >= velRange.min && velocity <= velRange.max)) {
                isZoneUsed = true;
                const trimmedIZones = trimInstrumentZones(zone.instrument, keyCombos);
                SpessaLog.info(`%cTrimmed off %c${trimmedIZones}%c instrument zones from %c${zone.instrument.name}`, ConsoleColors.info, ConsoleColors.recognized, ConsoleColors.info, ConsoleColors.recognized);
                break;
              }
              if (!isZoneUsed) {
                trimmedZones++;
                p.deleteZone(zoneIndex);
                if (zone.instrument.useCount < 1) this.deleteInstrument(zone.instrument);
                zoneIndex--;
              }
            }
            SpessaLog.info(`%cTrimmed off %c${trimmedZones}%c preset zones from %c${p.name}`, ConsoleColors.info, ConsoleColors.recognized, ConsoleColors.info, ConsoleColors.recognized);
            SpessaLog.groupEnd();
          }
        }
        this.removeUnusedElements();
        SpessaLog.info("%cSound bank modified!", ConsoleColors.recognized);
        SpessaLog.groupEnd();
      }
      removeUnusedElements() {
        this.instruments = this.instruments.filter((i) => {
          i.deleteUnusedZones();
          const deletable = i.useCount < 1;
          if (deletable) i.delete();
          return !deletable;
        });
        this.samples = this.samples.filter((s) => {
          const deletable = s.useCount < 1;
          if (deletable) s.unlinkSample();
          return !deletable;
        });
      }
      deleteInstrument(instrument) {
        instrument.delete();
        this.instruments.splice(this.instruments.indexOf(instrument), 1);
      }
      deletePreset(preset) {
        preset.delete();
        this.presets.splice(this.presets.indexOf(preset), 1);
      }
      deleteSample(sample) {
        sample.unlinkSample();
        this.samples.splice(this.samples.indexOf(sample), 1);
      }
      /**
      * Get the appropriate preset.
      */
      getPreset(patch, system) {
        return MIDIPatchTools.selectPatch(this.presets, patch, system);
      }
      destroySoundBank() {
        this.presets.length = 0;
        this.instruments.length = 0;
        this.samples.length = 0;
      }
      parsingError(error) {
        throw new Error(`SF parsing error: ${error} The file may be corrupted.`);
      }
      /**
      * Parses the bank after loading is done
      * @protected
      */
      parseInternal() {
        this._isXGBank = false;
        const allowedPrograms = /* @__PURE__ */ new Set([
          0,
          1,
          2,
          3,
          4,
          5,
          6,
          7,
          8,
          9,
          16,
          17,
          24,
          25,
          26,
          27,
          28,
          29,
          30,
          31,
          32,
          33,
          40,
          41,
          48,
          56,
          57,
          58,
          64,
          65,
          66,
          126,
          127
        ]);
        for (const preset of this.presets) if (BankSelectHacks.isXGDrum(preset.bankMSB)) {
          this._isXGBank = true;
          if (!allowedPrograms.has(preset.program)) {
            this._isXGBank = false;
            SpessaLog.info(`%cThis bank is not valid XG. Preset %c${preset.toString()}%c is not a valid XG drum. XG mode will use presets on bank 128.`, ConsoleColors.info, ConsoleColors.value, ConsoleColors.info);
            break;
          }
        }
      }
      printInfo() {
        for (const [info, value] of Object.entries(this.soundBankInfo)) if (typeof value === "object" && "major" in value) {
          const v = value;
          SpessaLog.info(`%c${info}: %c"${v.major}.${v.minor}"`, ConsoleColors.info, ConsoleColors.recognized);
        } else SpessaLog.info(`%c${info}: %c${value.toLocaleString()}`, ConsoleColors.info, ConsoleColors.recognized);
      }
    };
    VoiceModulator = class VoiceModulator2 extends Modulator {
      /**
      * Indicates if the given modulator is chorus or reverb effects modulator.
      * This is done to simulate BASSMIDI effects behavior:
      * - defaults to 1000 transform amount rather than 200
      * - values can be changed, but anything above 200 is 1000
      * (except for values above 1000, they are copied directly)
      * - all values below are multiplied by 5 (200 * 5 = 1000)
      * - still can be disabled if the soundfont has its own modulator curve
      * - this fixes the very low amount of reverb by default and doesn't break soundfonts
      */
      isEffectModulator;
      /**
      * The default resonant modulator does not affect the filter gain.
      * Neither XG nor GS responded to cc #74 in that way.
      */
      isDefaultResonantModulator;
      /**
      * If this is a modulation wheel modulator (for modulation depth range).
      */
      isModWheelModulator;
      constructor(s1, s2, destination, amount, transformType, isEffectModulator, isDefaultResonantModulator, isModWheelModulator) {
        super(s1, s2, destination, amount, transformType);
        this.isEffectModulator = isEffectModulator;
        this.isDefaultResonantModulator = isDefaultResonantModulator;
        this.isModWheelModulator = isModWheelModulator;
      }
      static fromData(s1, s2, destination, amount, transformType) {
        const s1Enum = s1.toSourceEnum();
        const s2Enum = s2.toSourceEnum();
        return new VoiceModulator2(s1, s2, destination, amount, transformType, (s1Enum === 219 || s1Enum === 221) && s2Enum === 0 && (destination === GeneratorTypes.reverbEffectsSend || destination === GeneratorTypes.chorusEffectsSend), s1Enum === DEFAULT_RESONANT_MOD_SOURCE && s2Enum === 0 && destination === GeneratorTypes.initialFilterQ, (s1.isCC && s1.index === MIDIControllers.modulationWheel || s2.isCC && s2.index === MIDIControllers.modulationWheel) && (destination === GeneratorTypes.modLfoToPitch || destination === GeneratorTypes.vibLfoToPitch));
      }
      static fromModulator(mod) {
        return this.fromData(mod.primarySource, mod.secondarySource, mod.destination, mod.transformAmount, mod.transformType);
      }
    };
    HALF_PI$1 = Math.PI / 2;
    MIN_PAN$1 = -500;
    MAX_PAN$1 = 500;
    PAN_RESOLUTION$1 = MAX_PAN$1 - MIN_PAN$1;
    panTableLeft = new Float32Array(PAN_RESOLUTION$1 + 1);
    panTableRight = new Float32Array(PAN_RESOLUTION$1 + 1);
    for (let pan = MIN_PAN$1; pan <= MAX_PAN$1; pan++) {
      const realPan = (pan - MIN_PAN$1) / PAN_RESOLUTION$1;
      const tableIndex = pan - MIN_PAN$1;
      panTableLeft[tableIndex] = Math.cos(HALF_PI$1 * realPan);
      panTableRight[tableIndex] = Math.sin(HALF_PI$1 * realPan);
    }
    AWE_NRPN_GENERATOR_MAPPINGS = [
      GeneratorTypes.delayModLFO,
      GeneratorTypes.freqModLFO,
      GeneratorTypes.delayVibLFO,
      GeneratorTypes.freqVibLFO,
      GeneratorTypes.delayModEnv,
      GeneratorTypes.attackModEnv,
      GeneratorTypes.holdModEnv,
      GeneratorTypes.decayModEnv,
      GeneratorTypes.sustainModEnv,
      GeneratorTypes.releaseModEnv,
      GeneratorTypes.delayVolEnv,
      GeneratorTypes.attackVolEnv,
      GeneratorTypes.holdVolEnv,
      GeneratorTypes.decayVolEnv,
      GeneratorTypes.sustainVolEnv,
      GeneratorTypes.releaseVolEnv,
      GeneratorTypes.fineTune,
      GeneratorTypes.modLfoToPitch,
      GeneratorTypes.vibLfoToPitch,
      GeneratorTypes.modEnvToPitch,
      GeneratorTypes.modLfoToVolume,
      GeneratorTypes.initialFilterFc,
      GeneratorTypes.initialFilterQ,
      GeneratorTypes.modLfoToFilterFc,
      GeneratorTypes.modEnvToFilterFc,
      GeneratorTypes.chorusEffectsSend,
      GeneratorTypes.reverbEffectsSend
    ];
    INITIAL_MODULATORS = [VoiceModulator.fromModulator(new DecodedModulator(getModSourceEnum(ModulatorCurveTypes.linear, true, false, true, MIDIControllers.vibratoRate), 0, GeneratorTypes.vibLfoRate, 1e3, 0))];
    EFFECT_MODULATOR_TRANSFORM_MULTIPLIER = 1e3 / 200;
    DEFAULT_CHANNEL_MIDI_PARAMETERS = {
      pitchWheel: 8192,
      pitchWheelRange: 2,
      pressure: 0,
      modulationDepth: 50,
      rxChannel: 0,
      polyMode: true,
      keyShift: 0,
      fineTune: 0,
      randomPan: false,
      assignMode: 2,
      efxAssign: false,
      cc1: 16,
      cc2: 17,
      drumMap: 0,
      velocitySenseDepth: 64,
      velocitySenseOffset: 64
    };
    DEFAULT_CHANNEL_SYSTEM_PARAMETERS = {
      presetLock: false,
      isMuted: false,
      gain: 1,
      pan: 0,
      keyShift: 0,
      fineTune: 0,
      interpolationType: null,
      nrpnParamLock: null,
      monophonicRetrigger: null
    };
    HALF_PI = Math.PI / 2;
    MIN_PAN = -64;
    MAX_PAN = 63;
    PAN_RESOLUTION = MAX_PAN - MIN_PAN;
    PAN_TABLE_LEFT = new Float32Array(PAN_RESOLUTION + 1);
    PAN_TABLE_RIGHT = new Float32Array(PAN_RESOLUTION + 1);
    for (let pan = MIN_PAN; pan <= MAX_PAN; pan++) {
      const realPan = (pan - MIN_PAN) / PAN_RESOLUTION;
      const tableIndex = pan - MIN_PAN;
      PAN_TABLE_LEFT[tableIndex] = Math.cos(HALF_PI * realPan);
      PAN_TABLE_RIGHT[tableIndex] = Math.sin(HALF_PI * realPan);
    }
    PI_2$1 = Math.PI * 2;
    DEPTH_MUL = 5;
    LFO_SMOOTH_FRAC = DEPTH_MUL * 0.5;
    PI_2 = Math.PI * 2;
    DEFAULT_GLOBAL_MIDI_PARAMETERS = {
      volume: 1,
      pan: 0,
      keyShift: 0,
      fineTune: 0,
      system: "gs"
    };
  }
});

// node_modules/spessasynth_lib/dist/index.js
function fillWithDefaults2(obj, defObj) {
  return {
    ...defObj,
    ...obj
  };
}
var DEFAULT_SYNTH_CONFIG, WORKLET_PROCESSOR_NAME, WorkletKeyModifierManagerWrapper, SoundBankManager, SynthEventHandler, ConsoleColors2, LibMIDIChannel, DEFAULT_SYNTH_METHOD_OPTIONS, SPESSASYNTH_LIB_HANDLER, BasicSynthesizer, WorkletSynthesizer, DEFAULT_BANK_WRITE_OPTIONS, DEFAULT_SF2_WRITE_OPTIONS2, DEFAULT_RMIDI_WRITE_OPTIONS, DEFAULT_DLS_WRITE_OPTIONS;
var init_dist2 = __esm({
  "node_modules/spessasynth_lib/dist/index.js"() {
    init_dist();
    DEFAULT_SYNTH_CONFIG = {
      eventsEnabled: true,
      oneOutput: false,
      audioNodeCreators: void 0
    };
    WORKLET_PROCESSOR_NAME = "spessasynth-worklet-processor";
    WorkletKeyModifierManagerWrapper = class {
      keyModifiers = [];
      synth;
      constructor(synth) {
        this.synth = synth;
      }
      /**
      * Modifies a single key.
      * @param channel The channel affected. Usually 0-15.
      * @param midiNote The MIDI note to change. 0-127.
      * @param options The key's modifiers.
      */
      addModifier(channel, midiNote, options) {
        const mod = new KeyModifier();
        mod.gain = options?.gain ?? 1;
        mod.velocity = options?.velocity ?? -1;
        mod.patch = fillWithDefaults2(options.patch ?? {}, {
          isGMGSDrum: false,
          bankLSB: -1,
          bankMSB: -1,
          program: -1
        });
        this.keyModifiers[channel] ??= [];
        this.keyModifiers[channel][midiNote] = mod;
        this.sendToWorklet("addMapping", {
          channel,
          midiNote,
          mapping: mod
        });
      }
      /**
      * Gets a key modifier.
      * @param channel The channel affected. Usually 0-15.
      * @param midiNote The MIDI note to change. 0-127.
      * @returns The key modifier if it exists.
      */
      getModifier(channel, midiNote) {
        return this.keyModifiers?.[channel]?.[midiNote];
      }
      /**
      * Deletes a key modifier.
      * @param channel The channel affected. Usually 0-15.
      * @param midiNote The MIDI note to change. 0-127.
      */
      deleteModifier(channel, midiNote) {
        this.sendToWorklet("deleteMapping", {
          channel,
          midiNote
        });
        if (this.keyModifiers[channel]?.[midiNote] === void 0) return;
        this.keyModifiers[channel][midiNote] = void 0;
      }
      /**
      * Clears ALL Modifiers
      */
      clearModifiers() {
        this.sendToWorklet("clearMappings", null);
        this.keyModifiers = [];
      }
      sendToWorklet(type, data) {
        const msg = {
          type,
          data
        };
        this.synth.post({
          type: "keyModifierManager",
          channelNumber: -1,
          data: msg
        });
      }
    };
    SoundBankManager = class {
      /**
      * All the sound banks, ordered from the most important to the least.
      */
      soundBankList;
      synth;
      /**
      * Creates a new instance of the sound bank manager.
      */
      constructor(synth) {
        this.soundBankList = [];
        this.synth = synth;
      }
      /**
      * The current sound bank priority order.
      * @returns The IDs of the sound banks in the current order.
      */
      get priorityOrder() {
        return this.soundBankList.map((s) => s.id);
      }
      /**
      * Rearranges the sound banks in a given order.
      * @param newList The order of sound banks, a list of identifiers, first overwrites second.
      */
      set priorityOrder(newList) {
        this.sendToWorklet("rearrangeSoundBanks", newList);
        this.soundBankList.sort((a, b) => newList.indexOf(a.id) - newList.indexOf(b.id));
      }
      /**
      * Adds a new sound bank buffer with a given ID.
      * @param soundBankBuffer The sound bank's buffer
      * @param id The sound bank's unique identifier.
      * @param bankOffset The sound bank's bank offset. Default is 0.
      */
      async addSoundBank(soundBankBuffer, id, bankOffset = 0) {
        this.sendToWorklet("addSoundBank", {
          soundBankBuffer,
          bankOffset,
          id
        }, [soundBankBuffer]);
        await this.awaitResponse();
        const found = this.soundBankList.find((s) => s.id === id);
        if (found === void 0) this.soundBankList.push({
          id,
          bankOffset
        });
        else found.bankOffset = bankOffset;
      }
      /**
      * Deletes a sound bank with the given ID.
      * @param id The sound bank to delete.
      */
      async deleteSoundBank(id) {
        if (this.soundBankList.length < 2) {
          SpessaLog.warn("1 sound bank left. Aborting!");
          return;
        }
        if (!this.soundBankList.some((s) => s.id === id)) {
          SpessaLog.warn(`No sound banks with id of "${id}" found. Aborting!`);
          return;
        }
        this.sendToWorklet("deleteSoundBank", id);
        this.soundBankList = this.soundBankList.filter((s) => s.id !== id);
        await this.awaitResponse();
      }
      async awaitResponse() {
        return new Promise((r) => this.synth.awaitWorkerResponse("soundBankManager", r));
      }
      sendToWorklet(type, data, transferable = []) {
        const msg = {
          type: "soundBankManager",
          channelNumber: -1,
          data: {
            type,
            data
          }
        };
        this.synth.post(msg, transferable);
      }
    };
    SynthEventHandler = class {
      /**
      * The time delay before an event is called.
      * Set to 0 to disable it.
      */
      timeDelay = 0;
      /**
      * The main list of events.
      * @private
      */
      events = {
        noteOff: /* @__PURE__ */ new Map(),
        noteOn: /* @__PURE__ */ new Map(),
        controllerChange: /* @__PURE__ */ new Map(),
        programChange: /* @__PURE__ */ new Map(),
        polyPressure: /* @__PURE__ */ new Map(),
        stopAll: /* @__PURE__ */ new Map(),
        channelAdded: /* @__PURE__ */ new Map(),
        presetListChange: /* @__PURE__ */ new Map(),
        reset: /* @__PURE__ */ new Map(),
        soundBankError: /* @__PURE__ */ new Map(),
        displayMessage: /* @__PURE__ */ new Map(),
        globalParamChange: /* @__PURE__ */ new Map(),
        channelParamChange: /* @__PURE__ */ new Map(),
        effectChange: /* @__PURE__ */ new Map()
      };
      /**
      * Adds a new event listener.
      * @param event The event to listen to.
      * @param id The unique identifier for the event. It can be used to overwrite existing callback with the same ID.
      * @param callback The callback for the event.
      */
      addEvent(event, id, callback) {
        this.events[event].set(id, callback);
      }
      /**
      * Removes an event listener
      * @param name The event to remove a listener from.
      * @param id The unique identifier for the event to remove.
      */
      removeEvent(name, id) {
        this.events[name].delete(id);
      }
      /**
      * Calls the given event.
      * INTERNAL USE ONLY!
      * @internal
      */
      callEventInternal(name, eventData) {
        const eventList = this.events[name];
        const callback = () => {
          for (const callback2 of eventList.values()) try {
            callback2(eventData);
          } catch (error) {
            console.error(`Error while executing an event callback for ${name}:`, error);
          }
        };
        if (this.timeDelay > 0) setTimeout(callback.bind(this), this.timeDelay * 1e3);
        else callback();
      }
    };
    ConsoleColors2 = SpessaSynthCoreUtils.ConsoleColors;
    LibMIDIChannel = class {
      /**
      * This channel number.
      * @private
      */
      channel;
      synth;
      _systemParameters = { ...DEFAULT_CHANNEL_SYSTEM_PARAMETERS };
      /**
      * @internal
      * @param channel
      * @param synth
      */
      constructor(channel, synth) {
        this.channel = channel;
        this.synth = synth;
      }
      _patch = {
        bankMSB: 0,
        bankLSB: 0,
        program: 0,
        isDrum: false,
        isGMGSDrum: false,
        name: ""
      };
      /**
      * The currently selected MIDI patch of the channel.
      * Note that the exact matching preset may not be available, but this represents exactly what MIDI asks for.
      */
      get patch() {
        return this._patch;
      }
      /**
      * @internal
      * @param patch
      */
      set patch(patch) {
        this._patch = patch;
      }
      _midiParameters = { ...DEFAULT_CHANNEL_MIDI_PARAMETERS };
      /**
      * The channel MIDI parameters of this channel.
      * These are only editable via MIDI messages.
      */
      get midiParameters() {
        return this._midiParameters;
      }
      /**
      * The channel system parameters of this channel.
      * These are only editable via the API.
      */
      get systemParameters() {
        return this._systemParameters;
      }
      _voiceCount = 0;
      /**
      * The channel's current voice count.
      */
      get voiceCount() {
        return this._voiceCount;
      }
      /**
      * @internal
      * @param value
      */
      set voiceCount(value) {
        this._voiceCount = value;
      }
      /**
      * Locks or unlocks a given Channel MIDI Parameter.
      * This prevents any changes to it until it's unlocked.
      * @param parameter The Channel MIDI Parameter to lock.
      * @param isLocked If the parameter should be locked.
      */
      lockMIDIParameter(parameter, isLocked) {
        this.synth.post({
          type: "lockChannelMIDIParameter",
          channelNumber: this.channel,
          data: {
            parameter,
            isLocked
          }
        });
      }
      /**
      * Sets a system parameter of the channel.
      * @param parameter The type of the parameter to set.
      * @param value The value to set for the parameter.
      */
      setSystemParameter(parameter, value) {
        this._systemParameters[parameter] = value;
        this.synth.post({
          type: "setChannelSystemParameter",
          channelNumber: this.channel,
          data: {
            parameter,
            value
          }
        });
      }
      /**
      * Causes the given midi channel to ignore controller messages for the given controller number.
      * @param controller 0-127 MIDI CC number.
      * @param isLocked True if locked, false if unlocked.
      */
      lockController(controller, isLocked) {
        this.synth.post({
          channelNumber: this.channel,
          type: "lockController",
          data: {
            controller,
            isLocked
          }
        });
      }
      /**
      * Toggles drums on a given channel.
      * @param isDrum If the channel should be drums.
      */
      setDrums(isDrum) {
        this.synth.post({
          channelNumber: this.channel,
          type: "setDrums",
          data: isDrum
        });
      }
      /**
      * @internal
      * @param parameter
      * @param value
      */
      setMIDIParameter(parameter, value) {
        this._midiParameters[parameter] = value;
      }
      /**
      * @internal
      */
      reset() {
        this._midiParameters = { ...DEFAULT_CHANNEL_MIDI_PARAMETERS };
      }
    };
    DEFAULT_SYNTH_METHOD_OPTIONS = { time: 0 };
    SPESSASYNTH_LIB_HANDLER = (event) => `SPESSASYNTH_LIB_HANDLE_${event}_${Math.random()}`;
    BasicSynthesizer = class {
      /**
      * Allows managing the sound bank list.
      */
      soundBankManager = new SoundBankManager(this);
      /**
      * Allows managing key modifications.
      */
      keyModifierManager = new WorkletKeyModifierManagerWrapper(this);
      /**
      * Allows setting up custom event listeners for the synthesizer.
      */
      eventHandler = new SynthEventHandler();
      /**
      * Synthesizer's parent AudioContext instance.
      */
      context;
      /**
      * Synth's current channel properties.
      */
      midiChannels = [];
      /**
      * The current preset list.
      */
      presetList = [];
      /**
      * INTERNAL USE ONLY!
      * @internal
      * All sequencer callbacks
      */
      sequencers = new Array();
      /**
      * Resolves when the synthesizer is ready.
      */
      isReady;
      /**
      * INTERNAL USE ONLY!
      * @internal
      */
      post;
      worklet;
      /**
      * The new channels will have their audio sent to the modulated output by this constant.
      * what does that mean?
      * e.g., if outputsAmount is 16, then channel's 16 audio data will be sent to channel 0
      */
      _outputCount = 16;
      _systemParameters = { ...DEFAULT_GLOBAL_SYSTEM_PARAMETERS };
      resolveMap = /* @__PURE__ */ new Map();
      renderingProgressTracker = /* @__PURE__ */ new Map();
      /**
      * Creates a new instance of a synthesizer.
      * @param worklet The AudioWorkletNode to use.
      * @param postFunction The internal post function.
      * @param config Optional configuration for the synthesizer.
      */
      constructor(worklet, postFunction, config) {
        SpessaLog.info("%cInitializing SpessaSynth synthesizer...", ConsoleColors2.info);
        this.context = worklet.context;
        this.worklet = worklet;
        this.post = postFunction;
        this.isReady = new Promise((resolve) => this.awaitWorkerResponse("sf3Decoder", resolve));
        this.worklet.port.onmessage = (e) => this.handleMessage(e.data);
        for (let i = 0; i < 16; i++) this.addNewChannelInternal(false);
        this.registerInternalEvent("channelAdded", () => {
          this.addNewChannelInternal(false);
        });
        this.registerInternalEvent("presetListChange", (e) => this.presetList = [...e]);
        this.registerInternalEvent("globalParamChange", (e) => this._midiParameters[e.parameter] = e.value);
        this.registerInternalEvent("channelParamChange", (e) => this.midiChannels[e.channel].setMIDIParameter(e.parameter, e.value));
        this.registerInternalEvent("programChange", (e) => this.midiChannels[e.channel].patch = { ...e });
        this.registerInternalEvent("reset", () => {
          for (const c of this.midiChannels) c.reset();
          this._midiParameters = { ...DEFAULT_GLOBAL_MIDI_PARAMETERS };
        });
      }
      _midiParameters = { ...DEFAULT_GLOBAL_MIDI_PARAMETERS };
      /**
      * The global MIDI parameters of the synthesizer.
      * These are only editable via MIDI messages.
      */
      get midiParameters() {
        return this._midiParameters;
      }
      /**
      * The current channel count of the synthesizer.
      */
      get channelCount() {
        return this.midiChannels.length;
      }
      /**
      * Current voice amount
      */
      _voiceCount = 0;
      /**
      * The current number of voices playing.
      */
      get voiceCount() {
        return this._voiceCount;
      }
      /**
      * The audioContext's current time.
      */
      get currentTime() {
        return this.context.currentTime;
      }
      /**
      * The global system parameters of the synthesizer.
      * These are only editable via the API.
      */
      get systemParameters() {
        return this._systemParameters;
      }
      /**
      * Connects from a given node.
      * @param destinationNode The node to connect to.
      */
      connect(destinationNode) {
        for (let i = 0; i < 17; i++) this.worklet.connect(destinationNode, i);
        return destinationNode;
      }
      /**
      * Disconnects from a given node.
      * @param destinationNode The node to disconnect from.
      */
      disconnect(destinationNode) {
        if (!destinationNode) {
          this.worklet.disconnect();
          return;
        }
        for (let i = 0; i < 17; i++) this.worklet.disconnect(destinationNode, i);
        return destinationNode;
      }
      /**
      * Sets the SpessaSynth's log level in the processor.
      * @param enableInfo Enable info (verbose)
      * @param enableWarning Enable warnings (unrecognized messages)
      * @param enableGroup Enable groups (to group a lot of logs)
      */
      setLogLevel(enableInfo, enableWarning, enableGroup) {
        this.post({
          channelNumber: -1,
          type: "setLogLevel",
          data: {
            enableInfo,
            enableWarning,
            enableGroup
          }
        });
      }
      /**
      * Locks or unlocks a given Global MIDI Parameter.
      * This prevents any changes to it until it's unlocked.
      * @param parameter The Global MIDI Parameter to lock.
      * @param isLocked If the parameter should be locked.
      */
      lockMIDIParameter(parameter, isLocked) {
        this.post({
          type: "lockGlobalMIDIParameter",
          data: {
            parameter,
            isLocked
          },
          channelNumber: -1
        });
      }
      /**
      * Sets a system parameter to a given value.
      * @param parameter The parameter to set.
      * @param value The value to set.
      */
      setSystemParameter(parameter, value) {
        this._systemParameters[parameter] = value;
        this.post({
          type: "setGlobalSystemParameter",
          channelNumber: -1,
          data: {
            parameter,
            value
          }
        });
      }
      /**
      * Gets a complete snapshot of the synthesizer, effects.
      */
      async getSnapshot() {
        return new Promise((resolve) => {
          this.awaitWorkerResponse("synthesizerSnapshot", (s) => {
            resolve(s);
          });
          this.post({
            type: "requestSynthesizerSnapshot",
            data: null,
            channelNumber: -1
          });
        });
      }
      /**
      * Adds a new channel to the synthesizer.
      */
      addNewChannel() {
        this.addNewChannelInternal(true);
      }
      /**
      * Connects a given channel output to the given audio node.
      * Note that this output is only meant for visualization and may be silent when Insertion Effect for this channel is enabled.
      * @param targetNode The node to connect to.
      * @param channelNumber The channel number to connect to, will be rolled over if value is greater than 15.
      * @returns The target node.
      */
      connectChannel(targetNode, channelNumber) {
        this.worklet.connect(targetNode, channelNumber % 16 + 1);
        return targetNode;
      }
      /**
      * Disconnects a given channel output to the given audio node.
      * @param targetNode The node to disconnect from.
      * @param channelNumber The channel number to connect to, will be rolled over if value is greater than 15.
      */
      disconnectChannel(targetNode, channelNumber) {
        this.worklet.disconnect(targetNode, channelNumber % 16 + 1);
      }
      /**
      * Connects the individual audio outputs to the given audio nodes.
      * Note that these outputs is only meant for visualization and may be silent when Insertion Effect for this channel is enabled.
      * @param audioNodes Exactly 16 outputs.
      */
      connectIndividualOutputs(audioNodes) {
        if (audioNodes.length !== this._outputCount) throw new Error(`input nodes amount differs from the system's outputs amount!
            Expected ${this._outputCount} got ${audioNodes.length}`);
        for (let channel = 0; channel < this._outputCount; channel++) this.connectChannel(audioNodes[channel], channel);
      }
      /**
      * Disconnects the individual audio outputs from the given audio nodes.
      * @param audioNodes Exactly 16 outputs.
      */
      disconnectIndividualOutputs(audioNodes) {
        if (audioNodes.length !== this._outputCount) throw new Error(`input nodes amount differs from the system's outputs amount!
            Expected ${this._outputCount} got ${audioNodes.length}`);
        for (let channel = 0; channel < this._outputCount; channel++) this.disconnectChannel(audioNodes[channel], channel);
      }
      /**
      * Sends a raw MIDI message to the synthesizer.
      * @param message the midi message, each number is a byte.
      * @param channelOffset the channel offset of the message.
      * @param eventOptions additional options for this command.
      */
      sendMessage(message, channelOffset = 0, eventOptions = DEFAULT_SYNTH_METHOD_OPTIONS) {
        this._sendInternal(message, channelOffset, eventOptions);
      }
      /**
      * Starts playing a note
      * @param channel Usually 0-15: the channel to play the note.
      * @param midiNote 0-127 the key number of the note.
      * @param velocity 0-127 the velocity of the note (generally controls loudness).
      * @param eventOptions Additional options for this command.
      */
      noteOn(channel, midiNote, velocity, eventOptions = DEFAULT_SYNTH_METHOD_OPTIONS) {
        const ch = channel % 16;
        const offset = channel - ch;
        midiNote %= 128;
        velocity %= 128;
        this.sendMessage([
          MIDIMessageTypes.noteOn | ch,
          midiNote,
          velocity
        ], offset, eventOptions);
      }
      /**
      * Stops playing a note.
      * @param channel Usually 0-15: the channel of the note.
      * @param midiNote {number} 0-127 the key number of the note.
      * @param eventOptions Additional options for this command.
      */
      noteOff(channel, midiNote, eventOptions = DEFAULT_SYNTH_METHOD_OPTIONS) {
        midiNote %= 128;
        const ch = channel % 16;
        const offset = channel - ch;
        this._sendInternal([MIDIMessageTypes.noteOff | ch, midiNote], offset, eventOptions);
      }
      /**
      * Stops all notes.
      * @param force If the notes should immediately be stopped, defaults to false.
      */
      stopAll(force = false) {
        this.post({
          channelNumber: -1,
          type: "stopAll",
          data: force ? 1 : 0
        });
      }
      /**
      * Changes the given controller
      * @param channel Usually 0-15: the channel to change the controller.
      * @param controller 0-127 the MIDI CC number.
      * @param value 0-127 the controller value.
      * @param eventOptions Additional options for this command.
      */
      controllerChange(channel, controller, value, eventOptions = DEFAULT_SYNTH_METHOD_OPTIONS) {
        if (controller > 127 || controller < 0) throw new Error(`Invalid controller number: ${controller}`);
        value = Math.floor(value) % 128;
        controller = Math.floor(controller) % 128;
        const ch = channel % 16;
        const offset = channel - ch;
        this._sendInternal([
          MIDIMessageTypes.controllerChange | ch,
          controller,
          value
        ], offset, eventOptions);
      }
      /**
      * Fully resets the synthesizer.
      */
      reset() {
        this.post({
          channelNumber: -1,
          type: "ccReset",
          data: null
        });
      }
      /**
      * Applies pressure to a given channel.
      * @param channel Usually 0-15: the channel to change the controller.
      * @param pressure 0-127: the pressure to apply.
      * @param eventOptions Additional options for this command.
      */
      channelPressure(channel, pressure, eventOptions = DEFAULT_SYNTH_METHOD_OPTIONS) {
        const ch = channel % 16;
        const offset = channel - ch;
        pressure %= 128;
        this.sendMessage([MIDIMessageTypes.channelPressure | ch, pressure], offset, eventOptions);
      }
      /**
      * Applies pressure to a given note.
      * @param channel Usually 0-15: the channel to change the controller.
      * @param midiNote 0-127: the MIDI note.
      * @param pressure 0-127: the pressure to apply.
      * @param eventOptions Additional options for this command.
      */
      polyPressure(channel, midiNote, pressure, eventOptions = DEFAULT_SYNTH_METHOD_OPTIONS) {
        const ch = channel % 16;
        const offset = channel - ch;
        midiNote %= 128;
        pressure %= 128;
        this.sendMessage([
          MIDIMessageTypes.polyPressure | ch,
          midiNote,
          pressure
        ], offset, eventOptions);
      }
      /**
      * Sets the pitch of the given channel.
      * @param channel Usually 0-15: the channel to change pitch.
      * @param value The bend of the MIDI pitch wheel message. 0 - 16384
      * @param eventOptions Additional options for this command.
      */
      pitchWheel(channel, value, eventOptions = DEFAULT_SYNTH_METHOD_OPTIONS) {
        const ch = channel % 16;
        const offset = channel - ch;
        this.sendMessage([
          MIDIMessageTypes.pitchWheel | ch,
          value & 127,
          value >> 7
        ], offset, eventOptions);
      }
      /**
      * Sets the channel's pitch wheel range, in semitones.
      * @param channel Usually 0-15: the channel to change.
      * @param range The bend range in semitones.
      * @param eventOptions Additional options for this command.
      */
      pitchWheelRange(channel, range, eventOptions = DEFAULT_SYNTH_METHOD_OPTIONS) {
        this.controllerChange(channel, MIDIControllers.registeredParameterMSB, 0, eventOptions);
        this.controllerChange(channel, MIDIControllers.registeredParameterLSB, 0, eventOptions);
        this.controllerChange(channel, MIDIControllers.dataEntryMSB, range);
        this.controllerChange(channel, MIDIControllers.registeredParameterMSB, 127, eventOptions);
        this.controllerChange(channel, MIDIControllers.registeredParameterLSB, 127, eventOptions);
        this.controllerChange(channel, MIDIControllers.dataEntryMSB, 0, eventOptions);
      }
      /**
      * Changes the program for a given channel
      * @param channel Usually 0-15: the channel to change.
      * @param programNumber 0-127 the MIDI patch number.
      * @param eventOptions Additional options for this command.
      */
      programChange(channel, programNumber, eventOptions = DEFAULT_SYNTH_METHOD_OPTIONS) {
        const ch = channel % 16;
        const offset = channel - ch;
        programNumber %= 128;
        this.sendMessage([MIDIMessageTypes.programChange | ch, programNumber], offset, eventOptions);
      }
      /**
      * Sends a MIDI Sysex message to the synthesizer.
      * @param messageData The message's data, excluding the F0 byte, but including the F7 at the end.
      * @param channelOffset Channel offset for the system exclusive message, defaults to zero.
      * @param eventOptions Additional options for this command.
      */
      systemExclusive(messageData, channelOffset = 0, eventOptions = DEFAULT_SYNTH_METHOD_OPTIONS) {
        this._sendInternal([MIDIMessageTypes.systemExclusive, ...Array.from(messageData)], channelOffset, eventOptions);
      }
      /**
      * Tune MIDI keys of a given program using the MIDI Tuning Standard.
      * @param program  0 - 127 the MIDI program number to use.
      * @param tunings The keys and their tunings.
      * TargetPitch of -1 sets the tuning for this key to be tuned regularly.
      */
      tuneKeys(program, tunings) {
        if (tunings.length > 127) throw new Error("Too many tunings. Maximum allowed is 127.");
        const systemExclusive = [
          127,
          16,
          8,
          2,
          program,
          tunings.length
        ];
        for (const tuning of tunings) {
          systemExclusive.push(tuning.sourceKey);
          if (tuning.targetPitch === -1) systemExclusive.push(127, 127, 127);
          else {
            const midiNote = Math.floor(tuning.targetPitch);
            const fraction = Math.floor((tuning.targetPitch - midiNote) / 61e-6);
            systemExclusive.push(midiNote, fraction >> 7 & 127, fraction & 127);
          }
        }
        systemExclusive.push(247);
        this.systemExclusive(systemExclusive);
      }
      /**
      * Yes please!
      */
      reverbateEverythingBecauseWhyNot() {
        for (let i = 0; i < this.midiChannels.length; i++) {
          this.controllerChange(i, MIDIControllers.reverbDepth, 127);
          this.midiChannels[i].lockController(MIDIControllers.reverbDepth, true);
        }
        return "That's the spirit!";
      }
      /**
      * INTERNAL USE ONLY!
      * @param type INTERNAL USE ONLY!
      * @param resolve INTERNAL USE ONLY!
      * @internal
      */
      awaitWorkerResponse(type, resolve) {
        this.resolveMap.set(type, resolve);
      }
      /**
      * INTERNAL USE ONLY!
      * @param callback the sequencer callback
      * @internal
      */
      assignNewSequencer(callback) {
        this.post({
          channelNumber: -1,
          type: "requestNewSequencer",
          data: null
        });
        this.sequencers.push(callback);
        return this.sequencers.length - 1;
      }
      assignProgressTracker(type, progressFunction) {
        if (this.renderingProgressTracker.get(type)) throw new Error("Something is already being rendered!");
        this.renderingProgressTracker.set(type, progressFunction);
      }
      revokeProgressTracker(type) {
        this.renderingProgressTracker.delete(type);
      }
      _sendInternal(message, channelOffset, eventOptions) {
        const options = fillWithDefaults2(eventOptions, DEFAULT_SYNTH_METHOD_OPTIONS);
        this.post({
          type: "midiMessage",
          channelNumber: -1,
          data: {
            messageData: new Uint8Array(message),
            channelOffset,
            options
          }
        });
      }
      /**
      * Handles the messages received from the worklet.
      */
      handleMessage(m) {
        switch (m.type) {
          case "eventCall":
            this.eventHandler.callEventInternal(m.data.type, m.data.data);
            break;
          case "sequencerReturn":
            this.sequencers[m.data.id]?.(m.data);
            break;
          case "voiceCountChange":
            for (let i = 0; i < m.data.length; i++) {
              this.midiChannels[i].voiceCount = m.data[i];
              this._voiceCount = m.data.reduce((s, v) => s + v, 0);
            }
            break;
          case "isFullyInitialized":
            this.workletResponds(m.data.type, m.data.data);
            break;
          case "soundBankError":
            SpessaLog.warn(m.data);
            this.eventHandler.callEventInternal("soundBankError", m.data);
            break;
          case "renderingProgress":
            this.renderingProgressTracker.get(m.data.type)?.(m.data.data);
        }
      }
      addNewChannelInternal(post) {
        this.midiChannels.push(new LibMIDIChannel(this.midiChannels.length, this));
        if (!post) return;
        this.post({
          channelNumber: 0,
          type: "addNewChannel",
          data: null
        });
      }
      workletResponds(type, data) {
        this.resolveMap.get(type)?.(data);
        this.resolveMap.delete(type);
      }
      registerInternalEvent(event, callback) {
        this.eventHandler.addEvent(event, SPESSASYNTH_LIB_HANDLER(event), callback);
      }
    };
    WorkletSynthesizer = class extends BasicSynthesizer {
      /**
      * Creates a new instance of an AudioWorklet-based synthesizer.
      * @param context The audio context.
      * @param config Optional configuration for the synthesizer.
      */
      constructor(context, config = DEFAULT_SYNTH_CONFIG) {
        const synthConfig = fillWithDefaults2(config, DEFAULT_SYNTH_CONFIG);
        let outputChannelCount = new Array(17).fill(2);
        let numberOfOutputs = 17;
        if (synthConfig.oneOutput) {
          outputChannelCount = [34];
          numberOfOutputs = 1;
        }
        let worklet;
        try {
          worklet = (synthConfig?.audioNodeCreators?.worklet ?? ((context2, name, options) => {
            return new AudioWorkletNode(context2, name, options);
          }))(context, WORKLET_PROCESSOR_NAME, {
            outputChannelCount,
            numberOfOutputs,
            processorOptions: {
              oneOutput: synthConfig.oneOutput,
              eventsEnabled: synthConfig.eventsEnabled
            }
          });
        } catch (error) {
          console.error(error);
          throw new Error("Could not create the AudioWorkletNode. Did you forget to addModule()?", { cause: error });
        }
        super(worklet, (data, transfer = []) => {
          worklet.port.postMessage(data, transfer);
        }, synthConfig);
      }
      /**
      * Starts an offline audio render.
      * @param config The configuration to use.
      * @remarks
      * Call this method immediately after you've set up the synthesizer.
      * Do NOT call any other methods after initializing before this one.
      * Chromium seems to ignore worklet messages for OfflineAudioContext.
      */
      async startOfflineRender(config) {
        this.post({
          type: "startOfflineRender",
          data: config,
          channelNumber: -1
        }, config.soundBankList.map((b) => b.soundBankBuffer));
        await new Promise((r) => this.awaitWorkerResponse("startOfflineRender", r));
      }
      /**
      * Destroys the synthesizer instance.
      */
      destroy() {
        this.post({
          channelNumber: 0,
          type: "destroyWorklet",
          data: null
        });
        this.worklet.disconnect();
        delete this.worklet;
      }
    };
    DEFAULT_BANK_WRITE_OPTIONS = {
      trim: true,
      bankID: "",
      writeEmbeddedSoundBank: true,
      sequencerID: 0
    };
    DEFAULT_SF2_WRITE_OPTIONS2 = {
      ...DEFAULT_BANK_WRITE_OPTIONS,
      writeDefaultModulators: true,
      writeExtendedLimits: true,
      compressionAction: "keep",
      compressionQuality: 1,
      software: "SpessaSynth"
    };
    DEFAULT_RMIDI_WRITE_OPTIONS = {
      ...DEFAULT_BANK_WRITE_OPTIONS,
      applySnapshot: false,
      bankOffset: 0,
      correctBankOffset: true,
      metadata: {},
      format: "sf2",
      ...DEFAULT_SF2_WRITE_OPTIONS2
    };
    DEFAULT_DLS_WRITE_OPTIONS = {
      ...DEFAULT_BANK_WRITE_OPTIONS,
      software: "SpessaSynth"
    };
  }
});

// suiko-midi-synth.src.js
var require_suiko_midi_synth_src = __commonJS({
  "suiko-midi-synth.src.js"() {
    init_dist2();
    var PROCESSOR_URL = "spessasynth_processor.min.js";
    var SOUNDFONT_URL = "SC-55.sf3";
    var synth = null;
    var ready = false;
    var ctx = null;
    var gainNode = null;
    var pending = [];
    var msgCount = 0;
    function status(s) {
      const el = document.querySelector("#overlay .status");
      if (el) el.textContent = s;
    }
    async function setup() {
      ctx = new AudioContext();
      await ctx.audioWorklet.addModule(PROCESSOR_URL);
      synth = new WorkletSynthesizer(ctx);
      gainNode = ctx.createGain();
      synth.connect(gainNode);
      gainNode.connect(ctx.destination);
      status("SC-55: downloading soundfont (9MB)\u2026");
      const sf = await (await fetch(SOUNDFONT_URL)).arrayBuffer();
      status("SC-55: loading soundfont\u2026");
      await synth.soundBankManager.addSoundBank(sf, "main");
      await synth.isReady;
      ready = true;
      for (const m of pending) {
        try {
          m.sysex ? synth.systemExclusive(m.data) : synth.sendMessage(m.data);
        } catch (e) {
        }
      }
      pending.length = 0;
      status("SC-55: ready \u2014 waiting for MIDI");
    }
    setup().catch((e) => {
      console.error(e);
      status("SC-55 error: " + e.message);
    });
    function resume() {
      if (ctx && ctx.state === "suspended") ctx.resume();
    }
    window.addEventListener("pointerdown", resume, true);
    window.addEventListener("keydown", resume, true);
    function dataBytesFor(status2) {
      if (status2 >= 128 && status2 <= 191) return 2;
      if (status2 >= 192 && status2 <= 223) return 1;
      if (status2 >= 224 && status2 <= 239) return 2;
      if (status2 === 242) return 2;
      if (status2 === 241 || status2 === 243) return 1;
      return 0;
    }
    var runningStatus = 0;
    var data = [];
    var expected = 0;
    var sysex = null;
    function dispatch(msg) {
      msgCount++;
      if (ready && synth) {
        try {
          synth.sendMessage(msg);
        } catch (e) {
        }
      } else {
        pending.push({ sysex: false, data: msg });
      }
    }
    function onByte(b) {
      b &= 255;
      if (b >= 248) {
        dispatch([b]);
        return;
      }
      if (b === 240) {
        sysex = [240];
        return;
      }
      if (b === 247) {
        if (sysex) {
          sysex.push(247);
          if (ready && synth) {
            try {
              synth.systemExclusive(sysex);
            } catch (e) {
            }
          } else {
            pending.push({ sysex: true, data: sysex });
          }
          sysex = null;
        }
        return;
      }
      if (sysex) {
        if (b >= 128) {
          sysex = null;
        } else {
          sysex.push(b);
          return;
        }
      }
      if (b >= 128) {
        runningStatus = b;
        data = [];
        expected = dataBytesFor(b);
        if (expected === 0) {
          dispatch([b]);
          runningStatus = b >= 240 ? 0 : b;
        }
        return;
      }
      if (runningStatus === 0) return;
      data.push(b);
      if (data.length >= expected) {
        dispatch([runningStatus, ...data]);
        data = [];
      }
    }
    window.SuikoMidi = {
      raw: onByte,
      open: function() {
        resume();
        console.log("[SuikoMidi] MIDI opened");
      },
      close: function() {
        console.log("[SuikoMidi] MIDI closed");
      },
      // exposed so suiko-audio.js's mute button can silence the SC-55 synth via gain
      // (not ctx.suspend(), which browsers can auto-resume on the next user gesture)
      getGain: function() {
        return gainNode;
      }
    };
    console.log("[SuikoMidi] SC-55 synth handler installed");
  }
});
export default require_suiko_midi_synth_src();
