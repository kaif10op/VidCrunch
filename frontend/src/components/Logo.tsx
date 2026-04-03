import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
}

export function Logo({ className, iconOnly = false }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="relative flex h-8 w-8 items-center justify-center shrink-0">
        <svg viewBox="0 0 40 40" fill="none" className="h-full w-full">
          {/* Interlocking mesh/crunch geometry */}
          <path d="M20 0L37.32 10V30L20 40L2.68 30V10L20 0Z" fill="url(#vc-grad-base)" className="opacity-80"/>
          <path d="M20 6L32.12 13V27L20 34L7.88 27V13L20 6Z" fill="url(#vc-grad-inner)"/>
          <path d="M14 28V12L28 20L14 28Z" fill="white" className="drop-shadow-lg"/>
          
          <defs>
            <linearGradient id="vc-grad-base" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="hsl(263, 70%, 58%)" />
              <stop offset="100%" stopColor="hsl(234, 89%, 64%)" />
            </linearGradient>
            <linearGradient id="vc-grad-inner" x1="40" y1="0" x2="0" y2="40" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="hsl(263, 70%, 50%)" />
              <stop offset="100%" stopColor="hsl(234, 89%, 50%)" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      {!iconOnly && (
        <span className="text-lg font-extrabold tracking-tight text-foreground">
          Vid<span className="text-primary">Crunch</span>
        </span>
      )}
    </div>
  );
}
