import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { Resvg } from '@resvg/resvg-js';
import { Result, TaggedError } from 'better-result';
import satori, { type SatoriOptions } from 'satori';

import { fetchScoreSaberPlayer } from '../sources/scoresaber/provider';
import type { ScoreSaberReplayPlayer } from '../sources/source-types';
import { fetchReplayPreviewScore, type ReplayPreviewScore } from './replay-preview-data.server';

const previewSize = { width: 1200, height: 630 };

const previewTtlMs = 10 * 60 * 1000;
const previewCacheLimit = 64;
const backgroundCacheLimit = 16;
const fallbackTtlMs = 6 * 60 * 60 * 1000;
const fallbackCacheLimit = 256;

class PreviewError extends TaggedError('PreviewError')<{
  message: string;
  status: number;
  cause?: unknown;
}>() {}

interface CacheEntry<T> {
  expires: number;
  value: T;
}

function cacheGet<T>(cache: Map<string, CacheEntry<T>>, key: string) {
  const entry = cache.get(key);
  if (entry === undefined) return undefined;
  if (entry.expires < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  cache.delete(key);
  cache.set(key, entry);
  return entry.value;
}

function cacheSet<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T, limit: number, ttl: number) {
  cache.delete(key);
  cache.set(key, { expires: Date.now() + ttl, value });
  for (const oldest of cache.keys()) {
    if (cache.size <= limit) break;
    cache.delete(oldest);
  }
}

const previewCache = new Map<string, CacheEntry<ArrayBuffer>>();
const backgroundCache = new Map<string, CacheEntry<string>>();

let fontsPromise: Promise<SatoriOptions['fonts']> | null = null;

// public assets live next to cwd in dev and under .output in the nitro build;
// read from disk so renders never depend on fetching our own origin
const publicDirs = [join(process.cwd(), 'public'), join(process.cwd(), '.output', 'public')];

async function readPublicFile(path: string) {
  for (const dir of publicDirs) {
    try {
      return await readFile(join(dir, path));
    } catch {
      continue;
    }
  }
  return null;
}

async function loadFont(origin: string, file: string, weight: 400 | 600 | 900) {
  let data: Buffer | ArrayBuffer | null = await readPublicFile(join('fonts', file));
  if (data === null) {
    const response = await fetch(new URL(`/fonts/${file}`, origin), {
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`font ${file} failed (${String(response.status)})`);
    data = await response.arrayBuffer();
  }
  return { name: 'Geist', data, weight, style: 'normal' as const };
}

function loadFonts(origin: string) {
  if (fontsPromise === null) {
    fontsPromise = Promise.all([
      loadFont(origin, 'geist-regular.ttf', 400),
      loadFont(origin, 'geist-semibold.ttf', 600),
      loadFont(origin, 'geist-black.ttf', 900),
    ]);
    void fontsPromise.then(undefined, () => {
      fontsPromise = null;
    });
  }
  return fontsPromise;
}

// geist only covers latin; satori hands us any segment it can't shape and we
// pull a text-subsetted noto face from google fonts (or twemoji for emoji)
const fallbackFamilies: Record<string, string | string[]> = {
  'ja-JP': 'Noto Sans JP',
  'ko-KR': 'Noto Sans KR',
  'zh-CN': 'Noto Sans SC',
  'zh-TW': 'Noto Sans TC',
  'zh-HK': 'Noto Sans HK',
  'th-TH': 'Noto Sans Thai',
  'bn-IN': 'Noto Sans Bengali',
  'ar-AR': 'Noto Sans Arabic',
  'ta-IN': 'Noto Sans Tamil',
  'ml-IN': 'Noto Sans Malayalam',
  'he-IL': 'Noto Sans Hebrew',
  'te-IN': 'Noto Sans Telugu',
  devanagari: 'Noto Sans Devanagari',
  kannada: 'Noto Sans Kannada',
  symbol: ['Noto Sans Symbols', 'Noto Sans Symbols 2', 'Noto Sans Math', 'Noto Sans'],
  math: 'Noto Sans Math',
  unknown: 'Noto Sans',
};

const fallbackFontCache = new Map<string, CacheEntry<ArrayBuffer | null>>();
const emojiCache = new Map<string, CacheEntry<string | null>>();

async function fetchFallbackFont(family: string, text: string) {
  const key = `${family}:${text}`;
  const cached = cacheGet(fallbackFontCache, key);
  if (cached !== undefined) return cached;
  let data: ArrayBuffer | null = null;
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=${family.replaceAll(' ', '+')}&text=${encodeURIComponent(text)}`,
      { signal: AbortSignal.timeout(10_000) },
    );
    const src = css.ok ? /src: url\((.+?)\) format\('(?:opentype|truetype)'\)/.exec(await css.text())?.[1] : undefined;
    if (src !== undefined) {
      const font = await fetch(src, { signal: AbortSignal.timeout(10_000) });
      // google answers with an html error page when the family lacks the glyphs
      if (font.ok) {
        const raw = await font.arrayBuffer();
        const tag = raw.byteLength >= 4 ? new DataView(raw).getUint32(0) : 0;
        if (tag === 0x00010000 || tag === 0x4f54544f || tag === 0x74727565) data = raw;
      }
    }
  } catch {
    data = null;
  }
  cacheSet(fallbackFontCache, key, data, fallbackCacheLimit, fallbackTtlMs);
  return data;
}

function emojiFile(segment: string) {
  const codes: number[] = [];
  for (const char of segment) {
    const point = char.codePointAt(0);
    if (point !== undefined) codes.push(point);
  }
  const kept = codes.includes(0x200d) ? codes : codes.filter((point) => point !== 0xfe0f);
  return kept.map((point) => point.toString(16)).join('-');
}

async function loadFallbackAsset(code: string, segment: string): Promise<string | SatoriOptions['fonts']> {
  if (code === 'emoji') {
    const file = emojiFile(segment);
    const cached = cacheGet(emojiCache, file);
    if (cached !== undefined) return cached ?? '';
    const dataUrl = await fetchImageDataUrl(
      `https://cdn.jsdelivr.net/gh/jdecked/twemoji@16.0.1/assets/svg/${file}.svg`,
    );
    cacheSet(emojiCache, file, dataUrl, fallbackCacheLimit, fallbackTtlMs);
    return dataUrl ?? '';
  }
  const families = code.split('|').flatMap((part) => fallbackFamilies[part] ?? []);
  if (families.length === 0) return [];
  const loaded = await Promise.all(
    families.map(async (family) => {
      const data = await fetchFallbackFont(family, segment);
      // unique name per subset: satori dedupes by name and would drop later segments
      return data === null
        ? null
        : { name: `${family} ${segment}`, data, weight: 400 as const, style: 'normal' as const };
    }),
  );
  return loaded.filter((font) => font !== null);
}

async function publicImageDataUrl(path: string, type: string, origin: string) {
  const local = await readPublicFile(path);
  if (local !== null) return `data:${type};base64,${local.toString('base64')}`;
  return fetchImageDataUrl(`/${path}`, origin);
}

function sniffImageType(data: Buffer) {
  if (data.length > 4 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) {
    return 'image/png';
  }
  if (data.length > 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg';
  if (data.length > 3 && data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46) return 'image/gif';
  return null;
}

async function fetchImageDataUrl(url: string, origin?: string) {
  try {
    const target = new URL(url, origin);
    if (target.protocol !== 'https:' && target.origin !== origin) return null;
    const response = await fetch(target, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const data = Buffer.from(await response.arrayBuffer());
    const declared = response.headers.get('content-type')?.split(';')[0]?.trim();
    const type = sniffImageType(data) ?? declared ?? '';
    if (!type.startsWith('image/')) return null;
    return `data:${type};base64,${data.toString('base64')}`;
  } catch {
    return null;
  }
}

function flagFile(country: string) {
  if (!/^[A-Za-z]{2}$/.test(country)) return null;
  const upper = country.toUpperCase();
  const first = (0x1f1e6 + upper.charCodeAt(0) - 65).toString(16);
  const second = (0x1f1e6 + upper.charCodeAt(1) - 65).toString(16);
  return `twemoji/${first}-${second}.png`;
}

function blurredBackground(coverUrl: string, coverDataUrl: string) {
  const cached = cacheGet(backgroundCache, coverUrl);
  if (cached !== undefined) return cached;
  const svg =
    `<svg width="600" height="315" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">` +
    `<filter id="b" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="16"/></filter>` +
    `<rect width="600" height="315" fill="#05060a"/>` +
    `<image xlink:href="${coverDataUrl}" x="-40" y="-40" width="680" height="395" preserveAspectRatio="xMidYMid slice" filter="url(#b)"/>` +
    `</svg>`;
  const rendered = new Resvg(svg, { font: { loadSystemFonts: false } }).render().asPng();
  const dataUrl = `data:image/png;base64,${Buffer.from(rendered).toString('base64')}`;
  cacheSet(backgroundCache, coverUrl, dataUrl, backgroundCacheLimit, previewTtlMs);
  return dataUrl;
}

const difficultyLabels: Record<number, { label: string; color: string }> = {
  1: { label: 'Easy', color: '#3cb371' },
  3: { label: 'Normal', color: '#59b0f4' },
  5: { label: 'Hard', color: '#ff6347' },
  7: { label: 'Expert', color: '#bf2a42' },
  9: { label: 'Expert+', color: '#8f48db' },
};

const integerFormat = new Intl.NumberFormat('en-US');
const ppFormat = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function GlobeIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 0c2.5 2.35 3.7 5.62 3.7 10S14.5 19.65 12 22M12 2C9.5 4.35 8.3 7.62 8.3 12S9.5 19.65 12 22M2 12h20M4.6 6.5h14.8M4.6 17.5h14.8" />
    </svg>
  );
}

function StarIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M12 2.8l2.7 5.47 6.03.88-4.36 4.25 1.03 6-5.4-2.84-5.4 2.84 1.03-6-4.36-4.25 6.03-.88L12 2.8z" />
    </svg>
  );
}

function Divider() {
  return (
    <div
      style={{
        display: 'flex',
        height: 1,
        background:
          'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.22) 12%, rgba(255,255,255,0.22) 70%, rgba(255,255,255,0))',
      }}
    />
  );
}

function Chip({
  background,
  border,
  color,
  children,
}: {
  background: string;
  border: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '7px 18px',
        borderRadius: 999,
        border: `1.5px solid ${border}`,
        background,
        color,
        fontSize: 23,
        fontWeight: 600,
        lineHeight: 1,
      }}
    >
      {children}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div
        style={{
          display: 'flex',
          color: 'rgba(238,240,246,0.52)',
          fontSize: 19,
          fontWeight: 600,
          letterSpacing: 2.6,
          lineHeight: 1,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: 'flex',
          color,
          fontSize: 51,
          fontWeight: 900,
          lineHeight: 1,
          textShadow: '0 2px 12px rgba(0,0,0,0.45)',
        }}
      >
        {value}
      </div>
    </div>
  );
}

interface PreviewImages {
  background: string;
  cover: string | null;
  avatar: string | null;
  flag: string | null;
  logo: string | null;
}

function ReplayPreviewCard({
  data,
  player,
  images,
}: {
  data: ReplayPreviewScore;
  player: ScoreSaberReplayPlayer | null;
  images: PreviewImages;
}) {
  const { score, leaderboard } = data;
  const map = leaderboard.map;
  const difficulty = difficultyLabels[leaderboard.difficulty.difficulty] ?? {
    label: 'Unknown',
    color: '#5a6172',
  };
  const title = map.songSubName === '' ? map.songName : `${map.songName} ${map.songSubName}`;
  const misses = score.badCuts + score.missedNotes;
  const ranked = score.pp > 0 || leaderboard.realm.stars > 0;

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        width: '100%',
        height: '100%',
        background: '#05060a',
        fontFamily: 'Geist',
      }}
    >
      <img
        src={images.background}
        width={previewSize.width}
        height={previewSize.height}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'linear-gradient(100deg, rgba(5,6,10,0.93) 0%, rgba(5,6,10,0.74) 46%, rgba(8,9,14,0.55) 100%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'linear-gradient(0deg, rgba(3,4,7,0.82) 0%, rgba(3,4,7,0) 40%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          height: 6,
          background: 'linear-gradient(90deg, #ffde18 0%, rgba(255,222,24,0.35) 52%, rgba(255,222,24,0) 88%)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: 44,
          left: 64,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}
      >
        {images.logo === null ? null : <img src={images.logo} width={38} height={38} />}
        <div
          style={{
            display: 'flex',
            color: 'rgba(240,242,248,0.78)',
            fontSize: 27,
            fontWeight: 600,
          }}
        >
          ScoreSaber Replay
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          height: '100%',
          gap: 48,
          padding: '0 64px',
        }}
      >
        <div
          style={{
            position: 'relative',
            display: 'flex',
            width: 400,
            height: 400,
            flexShrink: 0,
          }}
        >
          {images.cover === null ? (
            <div
              style={{
                display: 'flex',
                width: 400,
                height: 400,
                borderRadius: 20,
                background: 'rgba(255,255,255,0.06)',
              }}
            />
          ) : (
            <img
              src={images.cover}
              width={400}
              height={400}
              style={{
                width: 400,
                height: 400,
                borderRadius: 20,
                objectFit: 'cover',
                boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
              }}
            />
          )}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: 400,
              height: 400,
              borderRadius: 20,
              border: '1px solid rgba(255,255,255,0.16)',
            }}
          />
        </div>

        <div style={{ display: 'flex', flex: 1, flexDirection: 'column', gap: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
            {images.avatar === null ? null : (
              <img
                src={images.avatar}
                width={88}
                height={88}
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: 999,
                  objectFit: 'cover',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.45), 0 0 0 2px rgba(255,255,255,0.22)',
                }}
              />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <div
                style={{
                  display: 'block',
                  maxWidth: 500,
                  color: '#f4f5f8',
                  fontSize: 43,
                  fontWeight: 600,
                  lineHeight: 1.1,
                  lineClamp: 1,
                  textShadow: '0 2px 12px rgba(0,0,0,0.5)',
                }}
              >
                {score.player.name}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 20,
                  color: 'rgba(238,240,246,0.6)',
                  fontSize: 25,
                  fontWeight: 600,
                }}
              >
                {player?.rank === undefined ? null : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <GlobeIcon size={24} color="rgba(238,240,246,0.55)" />
                    <span>{`#${integerFormat.format(player.rank)}`}</span>
                  </div>
                )}
                {player?.countryRank === undefined ? null : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {images.flag === null ? null : <img src={images.flag} width={27} height={27} />}
                    <span>{`#${integerFormat.format(player.countryRank)}`}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <Divider />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div
              style={{
                display: 'block',
                color: '#f4f5f8',
                fontSize: title.length > 42 ? 29 : title.length > 32 ? 33 : title.length > 26 ? 37 : 44,
                fontWeight: 600,
                lineHeight: 1.12,
                lineClamp: 1,
                textShadow: '0 2px 12px rgba(0,0,0,0.5)',
              }}
            >
              {title}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 25,
                fontWeight: 400,
              }}
            >
              <div
                style={{
                  display: 'block',
                  maxWidth: 330,
                  color: 'rgba(238,240,246,0.6)',
                  lineClamp: 1,
                }}
              >
                {map.songAuthorName}
              </div>
              <div
                style={{
                  display: 'flex',
                  flexShrink: 0,
                  color: 'rgba(238,240,246,0.38)',
                }}
              >
                {'· mapped by'}
              </div>
              <div
                style={{
                  display: 'block',
                  maxWidth: 280,
                  color: 'rgba(238,240,246,0.6)',
                  lineClamp: 1,
                }}
              >
                {map.levelAuthorName}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Chip background={difficulty.color} border="rgba(255,255,255,0.14)" color="#ffffff">
              <span>{difficulty.label}</span>
              {leaderboard.realm.stars > 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <StarIcon size={19} color="rgba(255,255,255,0.9)" />
                  <span>{leaderboard.realm.stars.toFixed(2)}</span>
                </div>
              ) : null}
            </Chip>
            {score.fullCombo ? (
              <Chip background="rgba(74,222,128,0.1)" border="rgba(74,222,128,0.55)" color="#4ade80">
                <span>FC</span>
              </Chip>
            ) : misses > 0 ? (
              <Chip background="rgba(248,113,113,0.1)" border="rgba(248,113,113,0.5)" color="#fda4af">
                <span>{`${integerFormat.format(misses)} ${misses === 1 ? 'MISS' : 'MISSES'}`}</span>
              </Chip>
            ) : null}
          </div>

          <Divider />

          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              width: '100%',
              paddingRight: 10,
              marginTop: 4,
            }}
          >
            <Stat label="ACCURACY" value={`${(score.accuracy * 100).toFixed(2)}%`} color="#ffd75e" />
            {ranked ? (
              <Stat label="PP" value={`${ppFormat.format(score.pp)}pp`} color="#b9a8ff" />
            ) : (
              <Stat label="SCORE" value={integerFormat.format(score.modifiedScore)} color="#f2f3f7" />
            )}
            <Stat label="RANK" value={`#${integerFormat.format(score.rank)}`} color="#f2f3f7" />
          </div>
        </div>
      </div>
    </div>
  );
}

async function fetchPreviewScore(scoreId: string) {
  const result = await fetchReplayPreviewScore(scoreId);
  if (result.isOk()) return result;
  return Result.err(
    new PreviewError({
      message: result.error.message,
      status: result.error.status === 404 ? 404 : 502,
      cause: result.error,
    }),
  );
}

export async function renderReplayPreview(scoreId: string, origin: string): Promise<Result<ArrayBuffer, PreviewError>> {
  const cached = cacheGet(previewCache, scoreId);
  if (cached !== undefined) return Result.ok(cached);

  const fontsPending = loadFonts(origin);
  const scoreResult = await fetchPreviewScore(scoreId);
  if (scoreResult.isErr()) return Result.err(scoreResult.error);
  const data = scoreResult.value;

  const flagPath = flagFile(data.score.player.country);
  const [playerResult, cover, avatar, flag, logo] = await Promise.all([
    fetchScoreSaberPlayer(data.score.player.id),
    fetchImageDataUrl(data.leaderboard.map.coverUrl),
    fetchImageDataUrl(data.score.player.avatar),
    flagPath === null ? Promise.resolve(null) : publicImageDataUrl(flagPath, 'image/png', origin),
    publicImageDataUrl('scoresaber.svg', 'image/svg+xml', origin),
  ]);

  return Result.gen(async function* () {
    const fonts = yield* Result.await(
      Result.tryPromise({
        try: () => fontsPending,
        catch: (cause) =>
          new PreviewError({
            message: 'preview fonts unavailable',
            status: 500,
            cause,
          }),
      }),
    );
    const rendered = yield* Result.await(
      Result.tryPromise({
        try: async () => {
          const background =
            cover === null
              ? `data:image/svg+xml;base64,${Buffer.from('<svg width="600" height="315" xmlns="http://www.w3.org/2000/svg"><rect width="600" height="315" fill="#05060a"/></svg>').toString('base64')}`
              : blurredBackground(data.leaderboard.map.coverUrl, cover);
          const images: PreviewImages = {
            background,
            cover,
            avatar,
            flag,
            logo,
          };
          const svg = await satori(
            <ReplayPreviewCard data={data} player={playerResult.isOk() ? playerResult.value : null} images={images} />,
            { ...previewSize, fonts, loadAdditionalAsset: loadFallbackAsset },
          );
          return Uint8Array.from(new Resvg(svg, { font: { loadSystemFonts: false } }).render().asPng()).buffer;
        },
        catch: (cause) =>
          new PreviewError({
            message: 'preview rendering failed',
            status: 500,
            cause,
          }),
      }),
    );
    cacheSet(previewCache, scoreId, rendered, previewCacheLimit, previewTtlMs);
    return Result.ok(rendered);
  });
}
