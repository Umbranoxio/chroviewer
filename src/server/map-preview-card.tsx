import type { ReactNode } from 'react';

import type { MapPreviewData } from './map-preview-data.server';
import { Divider, previewSize, Stat, type PreviewImages } from './preview-card';

const integerFormat = new Intl.NumberFormat('en-US');

function SmallChip({
  background,
  border,
  color,
  children,
}: {
  background: string;
  border: string;
  color: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        flexShrink: 0,
        padding: '7px 13px',
        borderRadius: 999,
        border: `1px solid ${border}`,
        background,
        color,
        fontSize: 18,
        fontWeight: 600,
        lineHeight: 1,
      }}
    >
      {children}
    </div>
  );
}

function compactNumber(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1)}K`;
  return integerFormat.format(value);
}

function tagLabel(tag: string) {
  return tag
    .split('-')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

export function MapPreviewCard({ data, images }: { data: MapPreviewData; images: PreviewImages }) {
  const { metadata, stats } = data;
  const version = data.versions[0];
  const title = metadata.songSubName === '' ? metadata.songName : `${metadata.songName} ${metadata.songSubName}`;
  const duration = `${String(Math.floor(metadata.duration / 60))}:${String(metadata.duration % 60).padStart(2, '0')}`;
  const votes = stats.upvotes + stats.downvotes;
  const mods = [
    version.diffs.some((difficulty) => difficulty.chroma) ? 'CHROMA' : null,
    version.diffs.some((difficulty) => difficulty.ne) ? 'NOODLE' : null,
    version.diffs.some((difficulty) => difficulty.me) ? 'MAPPING EXTENSIONS' : null,
    version.diffs.some((difficulty) => difficulty.cinema) ? 'CINEMA' : null,
    version.diffs.some((difficulty) => difficulty.vivify) ? 'VIVIFY' : null,
  ].filter((mod) => mod !== null);
  const modLabel = `${mods.slice(0, 2).join(' + ')}${mods.length > 2 ? ` +${String(mods.length - 2)}` : ''}`;

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
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      />
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'linear-gradient(100deg, rgba(5,6,10,0.94) 0%, rgba(5,6,10,0.78) 47%, rgba(12,7,13,0.6) 100%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'linear-gradient(0deg, rgba(3,4,7,0.84) 0%, rgba(3,4,7,0) 42%)',
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
          background: 'linear-gradient(90deg, #ff008f 0%, rgba(255,0,143,0.38) 52%, rgba(255,0,143,0) 88%)',
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
        <div style={{ display: 'flex', color: 'rgba(240,242,248,0.78)', fontSize: 27, fontWeight: 600 }}>
          BeatSaver Map
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
        <div style={{ position: 'relative', display: 'flex', width: 400, height: 400, flexShrink: 0 }}>
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

        <div
          style={{
            display: 'flex',
            flex: 1,
            height: 400,
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div
              style={{
                display: 'block',
                color: '#f4f5f8',
                fontSize: title.length > 42 ? 34 : title.length > 30 ? 39 : 47,
                fontWeight: 600,
                lineHeight: 1.08,
                lineClamp: 2,
                textShadow: '0 2px 12px rgba(0,0,0,0.5)',
              }}
            >
              {title}
            </div>
            <div
              style={{
                display: 'block',
                color: 'rgba(238,240,246,0.62)',
                fontSize: 27,
                fontWeight: 400,
                lineClamp: 1,
              }}
            >
              {metadata.songAuthorName}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 17, marginTop: 28 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div
                style={{
                  display: 'flex',
                  color: 'rgba(238,240,246,0.46)',
                  fontSize: 15,
                  fontWeight: 600,
                  letterSpacing: 2.3,
                }}
              >
                MAPPED BY
              </div>
              <div
                style={{
                  display: 'block',
                  color: 'rgba(244,245,248,0.88)',
                  fontSize: 24,
                  fontWeight: 600,
                  lineClamp: 1,
                }}
              >
                {metadata.levelAuthorName}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {data.tags.slice(0, mods.length > 0 ? 2 : 3).map((tag) => (
                <SmallChip
                  key={tag}
                  background="rgba(255,255,255,0.06)"
                  border="rgba(255,255,255,0.14)"
                  color="rgba(238,240,246,0.72)"
                >
                  {tagLabel(tag)}
                </SmallChip>
              ))}
              {mods.length > 0 ? (
                <SmallChip background="rgba(255,0,143,0.1)" border="rgba(255,0,143,0.42)" color="#ff74be">
                  {modLabel}
                </SmallChip>
              ) : null}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 'auto' }}>
            <Divider />
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                width: '100%',
                paddingRight: 10,
              }}
            >
              <Stat
                label={votes > 0 ? `RATING / ${compactNumber(votes)} VOTES` : 'RATING'}
                value={`${(stats.score * 100).toFixed(1)}%`}
                color="#ff74be"
              />
              <Stat label="LENGTH" value={duration} color="#f2f3f7" />
              <Stat label="BPM" value={String(metadata.bpm)} color="#f2f3f7" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
