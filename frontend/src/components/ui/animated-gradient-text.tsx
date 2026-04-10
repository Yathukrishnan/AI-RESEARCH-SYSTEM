import { type ComponentPropsWithoutRef } from "react"
import { cn } from "@/lib/utils"

export interface AnimatedGradientTextProps extends ComponentPropsWithoutRef<"span"> {
  speed?: number
  colorFrom?: string
  colorTo?: string
}

export function AnimatedGradientText({
  children,
  className,
  speed = 1,
  colorFrom = "#e8a020",
  colorTo = "#fbbf24",
  ...props
}: AnimatedGradientTextProps) {
  return (
    <span
      style={{
        backgroundSize: `${speed * 300}% 100%`,
        backgroundImage: `linear-gradient(to right, ${colorFrom}, ${colorTo}, ${colorFrom})`,
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        animation: `gradient-shift ${8 / speed}s linear infinite`,
      }}
      className={cn("inline", className)}
      {...props}
    >
      {children}
    </span>
  )
}
