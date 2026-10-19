import type { ReactNode, SVGProps } from 'react'

/**
 * YouTube's icon set.
 *
 * Hand-authored SVG rather than an icon webfont so that the installed PWA
 * renders identically with no network access. Paths follow YouTube's Material
 * style: 24x24 viewBox, currentColor, 1.6-1.7px optical stroke weight.
 */

export interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number
}

function Icon({ size = 24, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  )
}

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

/* ------------------------------------------------------------------ chrome */

export const MenuIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 6H4M20 12H4M20 18H4" style={stroke} />
  </Icon>
)

export const SearchIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20.87 20.17l-5.59-5.59A6.98 6.98 0 0 0 17 10c0-3.87-3.13-7-7-7S3 6.13 3 10s3.13 7 7 7c1.75 0 3.36-.65 4.59-1.71l5.58 5.58.7-.7ZM10 16c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6Z" />
  </Icon>
)

export const MicIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 15a3.2 3.2 0 0 0 3.2-3.2V6.2a3.2 3.2 0 1 0-6.4 0v5.6A3.2 3.2 0 0 0 12 15Z" />
    <path d="M5.2 11.2v.5a6.8 6.8 0 0 0 6.05 6.77V21h1.5v-2.53A6.8 6.8 0 0 0 18.8 11.7v-.5h-1.5v.5a5.3 5.3 0 1 1-10.6 0v-.5H5.2Z" />
  </Icon>
)

export const CreateIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M13.4 3.5H6.6a3.1 3.1 0 0 0-3.1 3.1v10.8a3.1 3.1 0 0 0 3.1 3.1h10.8a3.1 3.1 0 0 0 3.1-3.1V10.6h-1.7v6.8a1.4 1.4 0 0 1-1.4 1.4H6.6a1.4 1.4 0 0 1-1.4-1.4V6.6a1.4 1.4 0 0 1 1.4-1.4h6.8V3.5Z" />
    <path d="M18.9 2.4h-1.7v3.2h-3.2v1.7h3.2v3.2h1.7V7.3h3.2V5.6h-3.2V2.4Z" />
  </Icon>
)

export const BellIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 20.5h4a2 2 0 0 1-4 0Z" />
    <path d="M12 2.5A6.5 6.5 0 0 0 5.5 9v3.6L4 15.5v1.2h16v-1.2l-1.5-2.9V9A6.5 6.5 0 0 0 12 2.5Zm0 1.8A4.7 4.7 0 0 1 16.7 9v3.9l1.2 2.3H6.1l1.2-2.3V9A4.7 4.7 0 0 1 12 4.3Z" />
  </Icon>
)

/* ----------------------------------------------------------------- sidebar */

export const HomeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4.3 4 10.9V20h5.6v-5.6h4.8V20H20v-9.1L12 4.3Zm0 2.4 6.3 5.2v6.3h-2.6v-5.6H8.3v5.6H5.7v-6.3L12 6.7Z" />
  </Icon>
)

export const HomeFilledIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4.3 4 10.9V20h5.6v-5.6h4.8V20H20v-9.1L12 4.3Z" />
  </Icon>
)

export const ShortsIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4.6" y="3.6" width="14.8" height="16.8" rx="4.4" style={stroke} />
    <path d="M10.4 8.7v6.6l5.6-3.3-5.6-3.3Z" />
  </Icon>
)

export const ShortsFilledIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 3.6h6a4.4 4.4 0 0 1 4.4 4.4v8a4.4 4.4 0 0 1-4.4 4.4H9a4.4 4.4 0 0 1-4.4-4.4V8A4.4 4.4 0 0 1 9 3.6Zm1.4 5.1v6.6l5.6-3.3-5.6-3.3Z" />
  </Icon>
)

export const SubscriptionsIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="2.8" y="3.5" width="13.4" height="10.4" rx="2.2" style={stroke} />
    <rect
      x="7.6"
      y="8.1"
      width="13.6" height="12.4"
      rx="2.2"
      fill="var(--yt-bg)"
      stroke="currentColor"
      strokeWidth="1.7"
    />
    <path d="M12.7 11.9v5l4.3-2.5-4.3-2.5Z" />
  </Icon>
)

export const SubscriptionsFilledIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.6 3.5h9.8a2.2 2.2 0 0 1 2.2 2.2v.8H5.8a2.6 2.6 0 0 0-2.6 2.6v6.6a2.2 2.2 0 0 1-.4-1.3V5.7a2.2 2.2 0 0 1 2.2-2.2Z" />
    <path d="M9.8 8.1h9.2a2.2 2.2 0 0 1 2.2 2.2v8a2.2 2.2 0 0 1-2.2 2.2H9.8a2.2 2.2 0 0 1-2.2-2.2v-8a2.2 2.2 0 0 1 2.2-2.2Zm2.9 3.8v5l4.3-2.5-4.3-2.5Z" />
  </Icon>
)

export const LibraryIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="4.8" width="12.6" height="10.2" rx="2.2" style={stroke} />
    <path d="M18.6 7.6v8a3 3 0 0 1-3 3H7.6" style={stroke} />
    <path d="M7.2 8.1v3.6l3.4-1.8-3.4-1.8Z" />
  </Icon>
)

export const LibraryFilledIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5.2 4.8h8.2a2.2 2.2 0 0 1 2.2 2.2v.2H7a2.4 2.4 0 0 0-2.4 2.4v6H4.6a1.6 1.6 0 0 1-1.6-1.6V6.4a1.6 1.6 0 0 1 1.6-1.6h.6Z" />
    <path d="M7 7.2h8.6a2.4 2.4 0 0 1 2.4 2.4v6.4a2.4 2.4 0 0 1-2.4 2.4H7a2.4 2.4 0 0 1-2.4-2.4V9.6A2.4 2.4 0 0 1 7 7.2Zm1.4 1.5v3.8l3.6-1.9-3.6-1.9Z" />
    <path d="M5.8 18.4h10.4a2.4 2.4 0 0 1-2.2 1.4H6.6a2.4 2.4 0 0 1-.8-.14Z" />
  </Icon>
)

export const HistoryIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4.5a7.5 7.5 0 1 1-7.42 8.6h1.83A5.7 5.7 0 1 0 7.62 8.1L9.7 10.2H3.7V4.2l2.2 2.2A7.47 7.47 0 0 1 12 4.5Z" />
    <path d="M11.2 8.1h1.6v4.5l3.6 2.1-.8 1.4-4.4-2.6V8.1Z" />
  </Icon>
)

export const ClockIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Zm0 1.8a6.7 6.7 0 1 1 0 13.4 6.7 6.7 0 0 1 0-13.4Z" />
    <path d="M11.1 7.6h1.8v4.9l3.9 2.3-.9 1.5-4.8-2.8V7.6Z" />
  </Icon>
)

export const PlaySquareIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="4.5" width="18" height="15" rx="3.2" style={stroke} />
    <path d="M10.2 8.7v6.6l5.6-3.3-5.6-3.3Z" />
  </Icon>
)

export const PlaySquareFilledIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6.2 4.5h11.6A3.2 3.2 0 0 1 21 7.7v8.6a3.2 3.2 0 0 1-3.2 3.2H6.2A3.2 3.2 0 0 1 3 16.3V7.7a3.2 3.2 0 0 1 3.2-3.2Zm4 4.2v6.6l5.6-3.3-5.6-3.3Z" />
  </Icon>
)

export const PersonIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4a4.2 4.2 0 1 1 0 8.4A4.2 4.2 0 0 1 12 4Zm0 1.8a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8Z" />
    <path d="M12 13.8c3.9 0 7 2.3 7 5.2v1H5v-1c0-2.9 3.1-5.2 7-5.2Zm0 1.8c-2.6 0-4.7 1.3-5.1 2.6h10.2c-.4-1.3-2.5-2.6-5.1-2.6Z" />
  </Icon>
)

export const TrendingIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M16.4 6h5.6v5.6h-1.9V9.2l-6.3 6.3-4-4-6 6-1.4-1.4 7.4-7.4 4 4 4.9-4.9h-2.3V6Z" />
  </Icon>
)

export const MusicIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6Z" />
  </Icon>
)

export const GamingIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M21.58 16.09l-1.09-7.66A3.99 3.99 0 0 0 16.53 5H7.47a3.99 3.99 0 0 0-3.96 3.43l-1.09 7.66A2.98 2.98 0 0 0 5.38 19.6c.7 0 1.36-.25 1.89-.7L9.6 17h4.8l2.33 1.9c.53.45 1.19.7 1.89.7a2.98 2.98 0 0 0 2.96-3.51ZM9.5 13H8v1.5H6.5V13H5v-1.5h1.5V10H8v1.5h1.5V13Zm6.5 1.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Zm2-2.5a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Z" />
  </Icon>
)

export const NewsIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Zm-5 14H7v-2h7v2Zm3-4H7v-2h10v2Zm0-4H7V7h10v2Z" />
  </Icon>
)

/* ---------------------------------------------------------------- actions */

export const LikeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M1 21h4V9H1v12Zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59A1.99 1.99 0 0 0 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73V10ZM16 18H9V9.83L13.34 5.5 12.5 10H19v1.6L16 18Z" />
  </Icon>
)

export const LikeFilledIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M1 21h4V9H1v12Zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59A1.99 1.99 0 0 0 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73V10Z" />
  </Icon>
)

export const DislikeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M23 3h-4v12h4V3ZM1 14c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.58-6.59c.37-.36.59-.86.59-1.41V5c0-1.1-.9-2-2-2H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2ZM8 6h7v8.17L10.66 18.5 11.5 14H5v-1.6L8 6Z" />
  </Icon>
)

export const DislikeFilledIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M23 3h-4v12h4V3ZM1 14c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.58-6.59c.37-.36.59-.86.59-1.41V5c0-1.1-.9-2-2-2H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2Z" />
  </Icon>
)

export const ShareIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14.4 8.4V4.9L22 12l-7.6 7.1v-3.5c-5.2 0-8.8 1.7-11.3 5.3.9-5.1 4.1-11.9 11.3-12.5Z" />
  </Icon>
)

export const DownloadIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M11 4h2v8.6l3-3 1.4 1.4L12 16.4l-5.4-5.4L8 9.6l3 3V4Z" />
    <path d="M5 18.2h14V20H5v-1.8Z" />
  </Icon>
)

export const SaveIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 5.5h11v1.8H4V5.5Zm0 4h11v1.8H4V9.5Zm0 4h6.5v1.8H4v-1.8Z" />
    <path d="M17.3 12.4h1.8v2.4h2.4v1.8h-2.4v2.4h-1.8v-2.4h-2.4v-1.8h2.4v-2.4Z" />
  </Icon>
)

export const MoreVerticalIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="5.4" r="1.85" />
    <circle cx="12" cy="12" r="1.85" />
    <circle cx="12" cy="18.6" r="1.85" />
  </Icon>
)

export const SettingsIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a7.03 7.03 0 0 0-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.48.48 0 0 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58ZM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2Z" />
  </Icon>
)

export const HelpIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8Z" />
    <path d="M12.6 17h-1.7v-1.7h1.7V17Zm.1-3.5h-1.7c0-2.2 2.4-2.4 2.4-4.1 0-.9-.7-1.5-1.6-1.5-.9 0-1.5.5-1.8 1.3l-1.5-.4c.5-1.4 1.7-2.2 3.3-2.2 1.9 0 3.2 1.1 3.2 2.8 0 2.2-2.3 2.5-2.3 4.1Z" />
  </Icon>
)

export const FeedbackIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2Zm0 14H5.17L4 17.17V4h16v12Z" />
    <path d="M6 7h12v1.7H6V7Zm0 3.3h12v1.7H6v-1.7Zm0 3.3h8V15H6v-1.4Z" />
  </Icon>
)

/* -------------------------------------------------------------- navigation */

export const ChevronDownIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 15.4 5.6 9 7 7.6l5 5 5-5L18.4 9 12 15.4Z" />
  </Icon>
)

export const ChevronUpIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 8.6 18.4 15 17 16.4l-5-5-5 5L5.6 15 12 8.6Z" />
  </Icon>
)

export const ChevronRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 18.4 7.6 17l5-5-5-5L9 5.6 15.4 12 9 18.4Z" />
  </Icon>
)

export const BackIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20v-2Z" />
  </Icon>
)

export const CloseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M18.3 5.71 12 12.01l-6.3-6.3-1.41 1.41 6.3 6.3-6.3 6.3 1.41 1.41 6.3-6.3 6.3 6.3 1.41-1.41-6.3-6.3 6.3-6.3-1.41-1.41Z" />
  </Icon>
)

/* -------------------------------------------------------------- playback   */

export const PlayIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 5.5v13l11-6.5-11-6.5Z" />
  </Icon>
)

export const PauseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6.4 5h4.2v14H6.4V5Zm7 0h4.2v14h-4.2V5Z" />
  </Icon>
)

export const VolumeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 9v6h4l5 4.5V4.5L7 9H3Z" />
    <path d="M16.4 12a4.5 4.5 0 0 0-2.6-4v8a4.5 4.5 0 0 0 2.6-4Z" />
    <path d="M13.8 3.6v1.9a7 7 0 0 1 0 13v1.9a8.9 8.9 0 0 0 0-16.8Z" />
  </Icon>
)

export const VolumeMuteIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 9v6h4l5 4.5V4.5L7 9H3Z" />
    <path d="M16.2 9.4 14.8 8l-2.4 2.4L10 8 8.6 9.4 11 11.8 8.6 14.2 10 15.6l2.4-2.4 2.4 2.4 1.4-1.4-2.4-2.4 2.4-2.4Z" />
  </Icon>
)

export const FullscreenIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 14H5v5h5v-2H7v-3Zm-2-4h2V7h3V5H5v5Zm12 7h-3v2h5v-5h-2v3ZM14 5v2h3v3h2V5h-5Z" />
  </Icon>
)

export const FullscreenExitIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 16h3v3h2v-5H5v2Zm3-8H5v2h5V5H8v3Zm6 11h2v-3h3v-2h-5v5Zm2-11V5h-2v5h5V8h-3Z" />
  </Icon>
)

export const CastIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M21 3H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2Z" />
    <path d="M1 18v3h3a3 3 0 0 0-3-3Zm0-4v2a5 5 0 0 1 5 5h2a7 7 0 0 0-7-7Zm0-4v2a9 9 0 0 1 9 9h2A11 11 0 0 0 1 10Z" />
  </Icon>
)

export const CaptionsIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="6" width="18" height="12" rx="2" style={stroke} />
    <path d="M11.2 10.4c-.3-.35-.75-.55-1.25-.55-.95 0-1.6.75-1.6 1.95s.65 1.95 1.6 1.95c.5 0 .95-.2 1.25-.55v1.3c-.4.25-.85.4-1.35.4-1.65 0-2.85-1.25-2.85-3.1s1.2-3.1 2.85-3.1c.5 0 .95.15 1.35.4v1.3Zm6.35 0c-.3-.35-.75-.55-1.25-.55-.95 0-1.6.75-1.6 1.95s.65 1.95 1.6 1.95c.5 0 .95-.2 1.25-.55v1.3c-.4.25-.85.4-1.35.4-1.65 0-2.85-1.25-2.85-3.1s1.2-3.1 2.85-3.1c.5 0 .95.15 1.35.4v1.3Z" />
  </Icon>
)

export const AutoplayIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" />
    <path d="M10.2 8.4v7.2l6-3.6-6-3.6Z" />
  </Icon>
)

export const ShuffleIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10.59 9.17 5.41 4 4 5.41l5.17 5.17 1.42-1.41ZM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5Zm.33 9.41-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13Z" />
  </Icon>
)

export const RepeatIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7Zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4Z" />
  </Icon>
)

/* --------------------------------------------------------------- misc      */

export const CheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17Z" />
  </Icon>
)

export const PlusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z" />
  </Icon>
)

export const FilterIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 6h18v2H3V6Zm3 5h12v2H6v-2Zm3 5h6v2H9v-2Z" />
  </Icon>
)

export const SunIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6.76 4.84 4.96 3.05 3.55 4.46l1.79 1.79 1.42-1.41ZM4 10.5H1v2h3v-2Zm9-9.95h-2V3.5h2V.55Zm7.45 3.91-1.41-1.41-1.79 1.79 1.41 1.41 1.79-1.79Zm-3.21 13.7 1.79 1.8 1.41-1.41-1.8-1.79-1.4 1.4ZM20 10.5v2h3v-2h-3Zm-8-5a6 6 0 1 0 0 12 6 6 0 0 0 0-12Zm-1 16.95h2V19.5h-2v2.95Zm-7.45-3.91 1.41 1.41 1.79-1.8-1.41-1.41-1.79 1.8Z" />
  </Icon>
)

export const MoonIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1Z" />
  </Icon>
)

export const ExternalLinkIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 3h7v7h-2V6.41L10.41 15 9 13.59 17.59 5H14V3Z" />
    <path d="M5 5h5v2H7v10h10v-3h2v5H5V5Z" />
  </Icon>
)

export const AlertIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 2 1 21h22L12 2Zm0 3.6L19.5 19h-15L12 5.6ZM11 10h2v5h-2v-5Zm0 6h2v2h-2v-2Z" />
  </Icon>
)

export const SpinnerIcon = ({ size = 24, className, ...rest }: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    aria-hidden="true"
    focusable="false"
    className={className}
    {...rest}
  >
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
    <path
      d="M12 3a9 9 0 0 1 9 9"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
    />
  </svg>
)

/* --------------------------------------------------------------- branding  */

/**
 * The YouTube logo, generated from YouTube's own asset.
 *
 * The hand-drawn version that used to live here had two faults: the play mark was
 * 29x20 (aspect 1.45) where the real one is 152.4x109 (1.398), so the box was
 * visibly too wide, and the wordmark was set in Roboto rather than the real
 * letterforms. Geometry now comes from the official SVG, via
 * scripts/generate-youtube-logo.mjs, so it cannot drift again.
 */
export { YouTubeLogo } from './YouTubeLogo'
