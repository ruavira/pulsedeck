// Tiny stroke icons for the landing feature grid. Server-rendered inline SVG,
// currentColor so each card tints its own icon via text-* utilities.

function Icon({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {children}
    </svg>
  );
}

export function IconBars(props: { className?: string }) {
  return (
    <Icon {...props}>
      <path d="M4 19h16" />
      <path d="M7 19v-6" />
      <path d="M12 19V5" />
      <path d="M17 19v-9" />
    </Icon>
  );
}

export function IconTrophy(props: { className?: string }) {
  return (
    <Icon {...props}>
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />
      <path d="M8 5H5a3 3 0 0 0 3 4" />
      <path d="M16 5h3a3 3 0 0 1-3 4" />
      <path d="M12 13v4" />
      <path d="M8.5 20h7" />
    </Icon>
  );
}

export function IconQa(props: { className?: string }) {
  return (
    <Icon {...props}>
      <path d="M21 12a8 8 0 1 0-3.2 6.4L21 20l-.9-3.5A8 8 0 0 0 21 12Z" />
      <path d="M12 15V9" />
      <path d="m9.5 11.5 2.5-2.5 2.5 2.5" />
    </Icon>
  );
}

export function IconSlides(props: { className?: string }) {
  return (
    <Icon {...props}>
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="m10.5 8 4 2.5-4 2.5V8Z" />
      <path d="M12 17v3" />
      <path d="M8.5 20h7" />
    </Icon>
  );
}

export function IconSparkles(props: { className?: string }) {
  return (
    <Icon {...props}>
      <path d="M12 4l1.7 4.3L18 10l-4.3 1.7L12 16l-1.7-4.3L6 10l4.3-1.7L12 4Z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" />
      <path d="M5 16l.6 1.4L7 18l-1.4.6L5 20l-.6-1.4L3 18l1.4-.6L5 16Z" />
    </Icon>
  );
}

export function IconSwap(props: { className?: string }) {
  return (
    <Icon {...props}>
      <path d="M4 8h13" />
      <path d="m14 4 4 4-4 4" />
      <path d="M20 16H7" />
      <path d="m10 12-4 4 4 4" />
    </Icon>
  );
}

export function IconQr(props: { className?: string }) {
  return (
    <Icon {...props}>
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <path d="M14 14h3v3" />
      <path d="M20 14v6h-6" />
      <path d="M17 20v.01" />
    </Icon>
  );
}

export function IconCrowd(props: { className?: string }) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M15.6 14.3A4.6 4.6 0 0 1 21.5 18" />
    </Icon>
  );
}
