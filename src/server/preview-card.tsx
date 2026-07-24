export const previewSize = { width: 1200, height: 630 };

export interface PreviewImages {
  background: string;
  cover: string | null;
  avatar: string | null;
  flag: string | null;
  logo: string | null;
}

export function Divider() {
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

export function Stat({ label, value, color }: { label: string; value: string; color: string }) {
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
