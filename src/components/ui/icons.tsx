import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

export function InstagramIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" {...props}>
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.4" cy="6.6" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function TelegramIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M21.6 3.4 2.9 10.6c-1 .4-1 1.8.1 2.1l4.6 1.4 1.8 5.6c.3 1 1.6 1.2 2.2.4l2.5-3 4.8 3.5c.8.6 2 .1 2.2-.9l2.6-14.6c.2-1.1-.9-2-2.1-1.7ZM9.7 13.6l8.7-5.9c.3-.2.6.2.4.5l-6.9 6.9-.3 3-1.9-4.5Z" />
    </svg>
  );
}

export function ArrowUpRightIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true" {...props}>
      <path d="M6 18 18 6M9 6h9v9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CherryIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" {...props}>
      <path d="M17 6c1.2-2.6 3.8-4 6.5-4" stroke="#3e7d33" strokeWidth="2" strokeLinecap="round" />
      <path d="M14 12c.6-3.4 2.3-5.2 3-6M22 11c-.5-2.2-1.5-3.8-2-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12.5" cy="19.5" r="7.5" fill="currentColor" />
      <circle cx="22" cy="16.5" r="5.5" fill="currentColor" opacity="0.82" />
      <ellipse cx="10" cy="16.8" rx="2.5" ry="1.6" fill="white" opacity="0.5" transform="rotate(-24 10 16.8)" />
    </svg>
  );
}

export function PaperClipIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 48" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true" {...props}>
      <path d="M7 14v22a5 5 0 0 0 10 0V10a8 8 0 0 0-16 0v24" opacity="0.9" />
    </svg>
  );
}

export function SafetyPinIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" {...props}>
      <path d="M8 16 36 6c3-1 6 1 6 4s-2 5-5 5L10 19a4 4 0 0 1-2-7.7" />
      <circle cx="8" cy="15" r="3.4" />
    </svg>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" {...props}>
      <circle cx="24" cy="24" r="22" fill="currentColor" opacity="0.92" />
      <path
        d="M20 16.6v14.8c0 1.2 1.3 1.93 2.32 1.27l11.4-7.4a1.5 1.5 0 0 0 0-2.54l-11.4-7.4A1.5 1.5 0 0 0 20 16.6Z"
        fill="#4a0d14"
      />
    </svg>
  );
}

export function ChatIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" {...props}>
      <path
        d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.5 0-3-.4-4.2-1.1L3 20l1.1-5.3A8.5 8.5 0 1 1 21 11.5Z"
        strokeLinejoin="round"
      />
      <path d="M8.2 10.4h7.6M8.2 13.4h4.6" strokeLinecap="round" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true" {...props}>
      <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
    </svg>
  );
}

export function WhatsAppIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.3-.6.8-.8 1-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.4-3c-.3-.4 0-.6.1-.8l.5-.5c.1-.2.1-.4 0-.6l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.3.3-1 1-1 2.3s1 2.6 1.1 2.8c.1.2 1.9 2.9 4.5 4 .6.3 1.1.4 1.5.5.6.2 1.2.2 1.6.1.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.6-.3Z" />
    </svg>
  );
}

export function ViberIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" {...props}>
      <path
        d="M12 2.5c5.5 0 9.5 2.4 9.5 8.6 0 5.3-2.8 7.9-6.8 8.5l-3.1 3.1v-3.1c-4.3-.5-9.1-2.6-9.1-8.5C2.5 4.9 6.5 2.5 12 2.5Z"
        strokeLinejoin="round"
      />
      <path
        d="M9.1 7.3c.3-.1.6 0 .8.3l1 1.4c.2.3.2.6-.1.9l-.6.5c.5 1 1.4 1.9 2.4 2.4l.5-.6c.3-.3.6-.3.9-.1l1.4 1c.3.2.4.5.3.8-.3.9-1.2 1.5-2.1 1.3-2.8-.7-5-2.9-5.7-5.7-.2-.9.4-1.8 1.2-2.2Z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}

export function JuiceDrop(props: IconProps) {
  return (
    <svg viewBox="0 0 20 28" fill="none" aria-hidden="true" {...props}>
      <path
        d="M10 1C10 8 19 14 19 20a9 9 0 1 1-18 0C1 14 10 8 10 1Z"
        fill="currentColor"
      />
      <ellipse cx="7" cy="19" rx="2.4" ry="3.2" fill="white" opacity="0.35" />
    </svg>
  );
}
