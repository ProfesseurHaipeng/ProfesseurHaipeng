import type { SVGProps } from "react"

type IconProps = SVGProps<SVGSVGElement>

function Icon({ children, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {children}
    </svg>
  )
}

export function IconHome(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />
    </Icon>
  )
}

export function IconLeads(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M4 19a5 5 0 0 1 10 0" />
      <path d="M16 11a3 3 0 1 0 0-6" />
      <path d="M20 19a4.5 4.5 0 0 0-3.2-4.3" />
    </Icon>
  )
}

export function IconDesk(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 7h14a1 1 0 0 1 1 1v10H4V8a1 1 0 0 1 1-1z" />
      <path d="M4 12h16" />
      <path d="M9 12v6M15 12v6" />
    </Icon>
  )
}

export function IconInquiry(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 4h8l4 4v12H7z" />
      <path d="M15 4v4h4" />
      <path d="M10 13h6M10 17h4" />
    </Icon>
  )
}

export function IconFolder(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h6l2 2h8v10H4z" />
    </Icon>
  )
}

export function IconExternal(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 6H6a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-4" />
      <path d="M14 5h5v5" />
      <path d="M12 12 19 5" />
    </Icon>
  )
}

export function IconSettings(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3v2.2M4.8 6.8l1.6 1.6M17.6 15.6l1.6 1.6M3.5 12h2.2M18.3 12h2.2M4.8 17.2l1.6-1.6M17.6 8.4l1.6-1.6" />
    </Icon>
  )
}

export function IconSearch(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="6" />
      <path d="m16 16 4 4" />
    </Icon>
  )
}

export function IconClip(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M21 8.5 10.5 19a4.5 4.5 0 0 1-6.4-6.4L14.6 2.1a3 3 0 0 1 4.2 4.3L8.3 17" />
    </Icon>
  )
}

export function IconSend(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 12 20 4l-6 16-2.5-6.5z" />
    </Icon>
  )
}

export function IconArchive(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h16v12H4z" />
      <path d="M4 7 6 3h12l2 4" />
      <path d="M10 12h4" />
    </Icon>
  )
}

export function IconRefresh(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 12a8 8 0 1 1-2.3-5.7" />
      <path d="M20 4v5h-5" />
    </Icon>
  )
}

export function IconMore(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="6" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="18" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </Icon>
  )
}

export function IconChevron(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m8 10 4 4 4-4" />
    </Icon>
  )
}

export function IconBack(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M15 6 9 12l6 6" />
    </Icon>
  )
}

export function IconLock(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="6" y="11" width="12" height="9" rx="1.5" />
      <path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3" />
    </Icon>
  )
}
