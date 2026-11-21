import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 20, children, ...rest }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...rest}>
      {children}
    </svg>
  );
}

export const SearchIcon = (p: P) => (
  <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>
);
export const CartIcon = (p: P) => (
  <Svg {...p}><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6" /><circle cx="10" cy="20" r="1.2" /><circle cx="17" cy="20" r="1.2" /></Svg>
);
export const PinIcon = (p: P) => (
  <Svg {...p}><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.800 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></Svg>
);
export const HeartIcon = ({ filled, ...p }: P & { filled?: boolean }) => (
  <Svg {...p} fill={filled ? "currentColor" : "none"}><path d="M12 20s-7.500-4.600-7.500-10A4.300 4.300 0 0 1 12 7.300 4.300 4.300 0 0 1 19.500 10c0 5.400-7.500 10-7.500 10z" /></Svg>
);
export const UserIcon = (p: P) => (
  <Svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.600-6 8-6s8 2 8 6" /></Svg>
);
export const PlusIcon = (p: P) => (
  <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>
);
export const MinusIcon = (p: P) => (
  <Svg {...p}><path d="M5 12h14" /></Svg>
);
export const TrashIcon = (p: P) => (
  <Svg {...p}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></Svg>
);
export const XIcon = (p: P) => (
  <Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>
);
export const ChevronRight = (p: P) => (
  <Svg {...p}><path d="m9 6 6 6-6 6" /></Svg>
);
export const ChevronLeft = (p: P) => (
  <Svg {...p}><path d="m15 6-6 6 6 6" /></Svg>
);
export const ChevronDown = (p: P) => (
  <Svg {...p}><path d="m6 9 6 6 6-6" /></Svg>
);
export const CheckIcon = (p: P) => (
  <Svg {...p}><path d="m5 12.500 4.500 4.500L19 7.500" /></Svg>
);
export const ClockIcon = (p: P) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>
);
export const TagIcon = (p: P) => (
  <Svg {...p}><path d="M3 12V4h8l10 10-8 8L3 12z" /><circle cx="7.500" cy="8.500" r="1.200" /></Svg>
);
export const PhoneIcon = (p: P) => (
  <Svg {...p}><path d="M5 4h4l2 5-2.500 1.500a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" /></Svg>
);
export const NavIcon = (p: P) => (
  <Svg {...p}><path d="m3 11 18-8-8 18-2-8-8-2z" /></Svg>
);
export const BagIcon = (p: P) => (
  <Svg {...p}><path d="M5 8h14l-1 12H6L5 8z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></Svg>
);
export const ShieldIcon = (p: P) => (
  <Svg {...p}><path d="M12 3 5 6v6c0 4.500 3 7.500 7 9 4-1.500 7-4.500 7-9V6l-7-3z" /><path d="m9 12 2.200 2.200L15 10" /></Svg>
);
export const TruckIcon = (p: P) => (
  <Svg {...p}><path d="M2 6h11v10H2zM13 10h4l3 3v3h-7" /><circle cx="7" cy="18" r="1.800" /><circle cx="17" cy="18" r="1.800" /></Svg>
);
export const LeafIcon = (p: P) => (
  <Svg {...p}><path d="M5 19c0-9 5-14 15-14 0 10-5 15-14 15" /><path d="M5 19c3-5 6-7 10-9" /></Svg>
);
export const FilterIcon = (p: P) => (
  <Svg {...p}><path d="M4 6h16M7 12h10M10 18h4" /></Svg>
);

export function Logo({ light = false, size = 32 }: { light?: boolean; size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
        <rect width="64" height="64" rx="16" fill="#e23744" />
        <path d="M40 14c-7 0-13 5-14 12-1 4 0 7-2 9l-9 9a4 4 0 1 0 5 5l1 1a4 4 0 1 0 5-5l9-9c2-2 5-1 9-2 7-1 12-7 12-14 0-3-2-6-5-6-3 0-4 2-6 2s-3-2-5-2z" fill="#fff" transform="translate(-6 0) scale(.95)" />
      </svg>
      <span className={`text-xl font-extrabold tracking-tight ${light ? "text-white" : "text-ink"}`}>
        chicken<span className="text-brand">mart</span>
      </span>
    </span>
  );
}
