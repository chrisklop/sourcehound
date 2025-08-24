"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown, Info, Heart, FileText, Target, Zap, Coffee } from "lucide-react"
import Link from "next/link"

export function AboutDropdown() {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const menuItems = [
    {
      href: "/our-mission",
      icon: Target,
      label: "Our Mission",
      description: "Fighting misinformation with AI + human intelligence"
    },
    {
      href: "/the-process", 
      icon: Zap,
      label: "The Process",
      description: "How we verify claims in minutes, not hours"
    },
    {
      href: "/privacy-policy",
      icon: FileText,
      label: "Privacy Policy", 
      description: "Transparency in our data practices"
    },
    {
      href: "https://buymeacoffee.com/genuverity",
      icon: Coffee,
      label: "Buy me a coffee",
      description: "Support independent fact-checking",
      external: true
    }
  ]

  return (
    <div className="relative" ref={dropdownRef}>
      <motion.button
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted/50 border border-transparent hover:border-border/50"
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <Info className="h-4 w-4" />
        <span className="hidden sm:inline">About</span>
        <ChevronDown 
          className={`h-3 w-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 top-full mt-2 w-80 border shadow-2xl rounded-xl p-2 z-50 bg-background/95 backdrop-blur-xl"
          >
            {/* Header */}
            <div className="px-3 py-2 border-b border-border/20 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-gradient-to-r from-blue-500 to-green-500 animate-pulse" />
                <h3 className="text-sm font-semibold text-foreground">About GenuVerity</h3>
                <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/30">
                  Beta
                </span>
              </div>
            </div>

            {/* Menu Items */}
            <div className="space-y-1">
              {menuItems.map((item, index) => (
                <motion.div
                  key={item.href}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.15, delay: index * 0.03 }}
                >
                  {item.external ? (
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors group"
                      onClick={() => setIsOpen(false)}
                    >
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <item.icon className="h-4 w-4 text-orange-400" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <h4 className="text-sm font-medium text-foreground group-hover:text-orange-400 transition-colors">
                            {item.label}
                          </h4>
                          <svg className="w-3 h-3 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                    </a>
                  ) : (
                    <Link
                      href={item.href}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors group"
                      onClick={() => setIsOpen(false)}
                    >
                      <div className="flex-shrink-0">
                        <div className={`w-8 h-8 rounded-lg border flex items-center justify-center group-hover:scale-110 transition-transform ${
                          item.label === "Our Mission" 
                            ? "bg-gradient-to-br from-blue-500/20 to-green-500/20 border-blue-500/30" 
                            : item.label === "The Process"
                            ? "bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-purple-500/30"
                            : "bg-gradient-to-br from-gray-500/20 to-slate-500/20 border-gray-500/30"
                        }`}>
                          <item.icon className={`h-4 w-4 ${
                            item.label === "Our Mission" 
                              ? "text-blue-400" 
                              : item.label === "The Process"
                              ? "text-purple-400"
                              : "text-gray-400"
                          }`} />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className={`text-sm font-medium group-hover:transition-colors ${
                          item.label === "Our Mission" 
                            ? "text-foreground group-hover:text-blue-400" 
                            : item.label === "The Process"
                            ? "text-foreground group-hover:text-purple-400"
                            : "text-foreground group-hover:text-gray-400"
                        }`}>
                          {item.label}
                        </h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                    </Link>
                  )}
                </motion.div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-3 py-2 mt-3 border-t border-border/20">
              <p className="text-xs text-muted-foreground text-center">
                Independent fact-checking • Made with{" "}
                <Heart className="h-3 w-3 inline text-red-400" /> by Chris, Claude, and v0
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}