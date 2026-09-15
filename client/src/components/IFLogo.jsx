/**
 * Logo oficial do Instituto Federal — grade de módulos
 * (círculo vermelho + quadrados verdes arredondados).
 *
 * Uso: <IFLogo size={48} />
 */
export function IFLogo({ size = 48 }) {
  const height = size;
  const width = size * (34 / 46);

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 34 46"
      style={{ flexShrink: 0 }}
      aria-label="Instituto Federal"
    >
      <circle cx="5" cy="5" r="5.5" fill="var(--if-red)" />
      <rect x="12" y="0" width="10" height="10" rx="1" fill="var(--if-green)" />
      <rect x="24" y="0" width="10" height="10" rx="1" fill="var(--if-green)" />
      <rect x="0" y="12" width="10" height="10" rx="1" fill="var(--if-green)" />
      <rect x="12" y="12" width="10" height="10" rx="1" fill="var(--if-green)" />
      <rect x="0" y="24" width="10" height="10" rx="1" fill="var(--if-green)" />
      <rect x="12" y="24" width="10" height="10" rx="1" fill="var(--if-green)" />
      <rect x="24" y="24" width="10" height="10" rx="1" fill="var(--if-green)" />
      <rect x="0" y="36" width="10" height="10" rx="1" fill="var(--if-green)" />
      <rect x="12" y="36" width="10" height="10" rx="1" fill="var(--if-green)" />
    </svg>
  );
}
