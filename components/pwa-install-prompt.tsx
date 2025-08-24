"use client"

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Download, X, Smartphone, Monitor, Zap, Wifi, WifiOff } from 'lucide-react'
import { usePWA } from '@/hooks/use-pwa'
import { cn } from '@/lib/utils'

interface PWAInstallPromptProps {
  className?: string
}

export function PWAInstallPrompt({ className }: PWAInstallPromptProps) {
  const { isInstallable, isOffline, install, showInstallPrompt, dismissInstallPrompt } = usePWA()
  const [isInstalling, setIsInstalling] = useState(false)

  const handleInstall = async () => {
    setIsInstalling(true)
    try {
      await install()
    } catch (error) {
      console.error('Install failed:', error)
    } finally {
      setIsInstalling(false)
    }
  }

  if (!isInstallable || !showInstallPrompt) {
    return null
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 100 }}
        className={cn("fixed bottom-4 left-4 right-4 z-50 md:left-auto md:w-96", className)}
      >
        <Card className="shadow-2xl border-primary/20 bg-background/95 backdrop-blur-lg">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <Download className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Install SourceHound</h3>
                  <p className="text-xs text-muted-foreground">Get the app experience</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={dismissInstallPrompt}
                className="h-6 w-6 p-0 -mr-2 -mt-1"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-3">
              {/* Benefits */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <Zap className="w-3 h-3 text-green-500" />
                  <span className="text-muted-foreground">Faster loading</span>
                </div>
                <div className="flex items-center gap-2">
                  {isOffline ? (
                    <WifiOff className="w-3 h-3 text-orange-500" />
                  ) : (
                    <Wifi className="w-3 h-3 text-blue-500" />
                  )}
                  <span className="text-muted-foreground">Offline ready</span>
                </div>
                <div className="flex items-center gap-2">
                  <Smartphone className="w-3 h-3 text-purple-500" />
                  <span className="text-muted-foreground">Mobile optimized</span>
                </div>
                <div className="flex items-center gap-2">
                  <Monitor className="w-3 h-3 text-indigo-500" />
                  <span className="text-muted-foreground">Desktop app</span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 pt-2">
                <Button
                  onClick={handleInstall}
                  disabled={isInstalling}
                  className="flex-1 h-8 text-xs"
                >
                  {isInstalling ? (
                    <>
                      <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                      Installing...
                    </>
                  ) : (
                    <>
                      <Download className="w-3 h-3 mr-1" />
                      Install App
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={dismissInstallPrompt}
                  className="h-8 px-3 text-xs"
                >
                  Not now
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  )
}

// Offline indicator component
export function OfflineIndicator() {
  const { isOffline } = usePWA()

  if (!isOffline) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: -50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -50 }}
      className="fixed top-16 left-1/2 transform -translate-x-1/2 z-50"
    >
      <Badge variant="secondary" className="bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400 px-3 py-1">
        <WifiOff className="w-3 h-3 mr-1" />
        You're offline
      </Badge>
    </motion.div>
  )
}

// PWA Status indicator for development
export function PWAStatus() {
  const { isInstalled, isInstallable, isOffline } = usePWA()

  // Only show in development
  if (process.env.NODE_ENV === 'production') return null

  return (
    <div className="fixed bottom-20 right-4 space-y-2 z-40">
      <div className="text-xs bg-background/90 backdrop-blur border rounded-lg p-2 min-w-[120px]">
        <div className="font-medium mb-1">PWA Status</div>
        <div className="space-y-1">
          <div className="flex justify-between">
            <span>Installed:</span>
            <Badge variant={isInstalled ? "default" : "outline"} className="h-4 px-1 text-xs">
              {isInstalled ? "Yes" : "No"}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span>Installable:</span>
            <Badge variant={isInstallable ? "default" : "outline"} className="h-4 px-1 text-xs">
              {isInstallable ? "Yes" : "No"}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span>Offline:</span>
            <Badge variant={isOffline ? "destructive" : "default"} className="h-4 px-1 text-xs">
              {isOffline ? "Yes" : "No"}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  )
}