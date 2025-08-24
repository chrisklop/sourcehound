"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <Button variant="ghost" size="sm" className="h-9 w-9 rounded-xl" disabled>
        <div className="h-4 w-4" />
        <span className="sr-only">Toggle theme</span>
      </Button>
    )
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="h-9 w-9 rounded-xl hover:bg-muted/50 transition-all duration-200 hover:scale-105"
    >
      {theme === "dark" ? <Sun className="h-4 w-4 text-emerald-500" /> : <Moon className="h-4 w-4 text-emerald-600" />}
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
