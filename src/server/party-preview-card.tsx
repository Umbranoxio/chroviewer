import { previewSize, type PreviewImages } from './preview-card';

export function PartyPreviewCard({ playerName, images }: { playerName: string | null; images: PreviewImages }) {
  const title = playerName === null ? 'Join this watch party' : `Join ${playerName}'s watch party`;

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
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
          display: 'flex',
          background: 'linear-gradient(105deg, rgba(5,6,10,0.97) 0%, rgba(10,8,18,0.9) 48%, rgba(28,12,40,0.72) 100%)',
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
          background: 'linear-gradient(90deg, #ffde18 0%, #ff3d9a 48%, rgba(255,61,154,0) 90%)',
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
          ScoreSaber Watch
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          height: '100%',
          gap: 62,
          padding: '82px 72px 36px',
        }}
      >
        <div
          style={{
            position: 'relative',
            display: 'flex',
            width: 310,
            height: 310,
            flexShrink: 0,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 999,
            background: 'rgba(255,255,255,0.06)',
          }}
        >
          {images.avatar === null ? (
            images.logo === null ? null : (
              <img src={images.logo} width={132} height={132} />
            )
          ) : (
            <img
              src={images.avatar}
              width={310}
              height={310}
              style={{ width: 310, height: 310, borderRadius: 999, objectFit: 'cover' }}
            />
          )}
          <div
            style={{
              position: 'absolute',
              right: 17,
              bottom: 23,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 56,
              height: 56,
              borderRadius: 999,
              border: '5px solid #090a0f',
              background: '#4ade80',
            }}
          />
        </div>

        <div style={{ display: 'flex', flex: 1, flexDirection: 'column', gap: 24 }}>
          <div
            style={{
              display: 'flex',
              color: '#ffcf40',
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: 3.2,
            }}
          >
            LIVE WATCH PARTY
          </div>
          <div
            style={{
              display: 'block',
              maxWidth: 690,
              color: '#f6f7fa',
              fontSize: title.length > 46 ? 48 : title.length > 36 ? 56 : 64,
              fontWeight: 900,
              lineHeight: 1.04,
              lineClamp: 2,
            }}
          >
            {title}
          </div>
        </div>
      </div>
    </div>
  );
}
