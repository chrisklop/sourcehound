"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown, FileText, BookOpen, GraduationCap, Microscope, Coffee } from "lucide-react"

interface AnalysisModeDropdownProps {
  onModeChange: (mode: string) => void
  currentMode: string
  disabled?: boolean
}

export function AnalysisModeDropdown({ onModeChange, currentMode, disabled = false }: AnalysisModeDropdownProps) {
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

  const analysiseModes = [
    {
      id: "summary",
      icon: FileText,
      label: "Summary",
      description: "Concise overview with key conclusions",
      color: "blue"
    },
    {
      id: "detailed",
      icon: BookOpen,
      label: "Detailed Analysis",
      description: "Comprehensive examination of evidence",
      color: "green"
    },
    {
      id: "professional",
      icon: GraduationCap,
      label: "Professional Analysis",
      description: "Technical depth for professional readers",
      color: "purple"
    },
    {
      id: "scholarly",
      icon: Microscope,
      label: "Scholarly Deep Dive",
      description: "Academic-level analysis with methodology",
      color: "indigo"
    },
    {
      id: "dog-walk",
      icon: ({ className }: { className?: string }) => (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      label: "Dog Walk Mode",
      description: "Socratic questioning guides you to the truth",
      color: "emerald"
    },
    {
      id: "grandpa",
      icon: Coffee,
      label: "Engage Grandpa Mode",
      description: "Clear, accessible explanations for everyone",
      color: "orange"
    }
  ]

  const currentModeData = analysiseModes.find(mode => mode.id === currentMode) || analysiseModes[0]

  const getColorClasses = (color: string, isSelected: boolean = false) => {
    const baseClasses = {
      blue: isSelected 
        ? "from-blue-500/20 to-blue-600/20 border-blue-500/30 text-blue-400" 
        : "from-blue-500/20 to-blue-600/20 border-blue-500/30 text-blue-400",
      green: isSelected 
        ? "from-green-500/20 to-green-600/20 border-green-500/30 text-green-400" 
        : "from-green-500/20 to-green-600/20 border-green-500/30 text-green-400",
      purple: isSelected 
        ? "from-purple-500/20 to-purple-600/20 border-purple-500/30 text-purple-400" 
        : "from-purple-500/20 to-purple-600/20 border-purple-500/30 text-purple-400",
      indigo: isSelected 
        ? "from-indigo-500/20 to-indigo-600/20 border-indigo-500/30 text-indigo-400" 
        : "from-indigo-500/20 to-indigo-600/20 border-indigo-500/30 text-indigo-400",
      emerald: isSelected 
        ? "from-emerald-500/20 to-emerald-600/20 border-emerald-500/30 text-emerald-400" 
        : "from-emerald-500/20 to-emerald-600/20 border-emerald-500/30 text-emerald-400",
      orange: isSelected 
        ? "from-orange-500/20 to-orange-600/20 border-orange-500/30 text-orange-400" 
        : "from-orange-500/20 to-orange-600/20 border-orange-500/30 text-orange-400"
    }
    return baseClasses[color as keyof typeof baseClasses] || baseClasses.blue
  }

  const getTextColorClasses = (color: string, isHover: boolean = false) => {
    const textClasses = {
      blue: isHover ? "group-hover:text-blue-400" : "text-blue-400",
      green: isHover ? "group-hover:text-green-400" : "text-green-400",
      purple: isHover ? "group-hover:text-purple-400" : "text-purple-400",
      indigo: isHover ? "group-hover:text-indigo-400" : "text-indigo-400",
      emerald: isHover ? "group-hover:text-emerald-400" : "text-emerald-400",
      orange: isHover ? "group-hover:text-orange-400" : "text-orange-400"
    }
    return textClasses[color as keyof typeof textClasses] || textClasses.blue
  }

  const handleModeSelect = (modeId: string) => {
    onModeChange(modeId)
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <motion.button
        className={`flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors rounded-lg border ${
          disabled 
            ? "text-muted-foreground/50 bg-muted/20 border-border/30 cursor-not-allowed" 
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border-transparent hover:border-border/50"
        }`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        whileHover={disabled ? {} : { scale: 1.02 }}
        whileTap={disabled ? {} : { scale: 0.98 }}
        disabled={disabled}
      >
        <div className={`w-4 h-4 rounded border flex items-center justify-center bg-gradient-to-br ${getColorClasses(currentModeData.color)}`}>
          <currentModeData.icon className="h-3 w-3" />
        </div>
        <span className="hidden sm:inline">{currentModeData.label}</span>
        <ChevronDown 
          className={`h-3 w-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''} ${disabled ? 'opacity-50' : ''}`}
        />
      </motion.button>

      <AnimatePresence>
        {isOpen && !disabled && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute left-0 top-full mt-2 w-80 border shadow-2xl rounded-xl p-2 z-50 bg-background/95 backdrop-blur-xl"
          >
            {/* Header */}
            <div className="px-3 py-3 border-b border-border/20 mb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-gradient-to-r from-emerald-500 to-blue-500 animate-pulse" />
                  <h3 className="text-sm font-semibold text-foreground">Analysis Style</h3>
                  <span className="text-xs px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/30">
                    AI Powered
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Instantly rewrite this analysis in different styles using advanced AI
              </p>
            </div>

            {/* Menu Items */}
            <div className="space-y-1">
              {analysiseModes.map((mode, index) => (
                <motion.div
                  key={mode.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.15, delay: index * 0.03 }}
                >
                  <button
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors group text-left ${
                      currentMode === mode.id 
                        ? "bg-muted/50 border border-border/50" 
                        : "hover:bg-muted/30"
                    }`}
                    onClick={() => handleModeSelect(mode.id)}
                  >
                    <div className="flex-shrink-0">
                      <div className={`w-8 h-8 rounded-lg border flex items-center justify-center group-hover:scale-110 transition-transform bg-gradient-to-br ${getColorClasses(mode.color)}`}>
                        <mode.icon className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className={`text-sm font-medium text-foreground ${getTextColorClasses(mode.color, true)} transition-colors`}>
                          {mode.label}
                        </h4>
                        {currentMode === mode.id && (
                          <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {mode.description}
                      </p>
                    </div>
                  </button>
                </motion.div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-3 py-2 mt-3 border-t border-border/20">
              <p className="text-xs text-muted-foreground text-center">
                🤖 Click any style to instantly rewrite with AI • Switch anytime
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}