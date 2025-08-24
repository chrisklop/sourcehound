"use client"

import { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  ClipboardList, 
  Users,
  FileText,
  Link as LinkIcon,
  BarChart3,
  Beaker,
  Play,
  Menu,
  X
} from 'lucide-react'

interface NextraLayoutProps {
  children: React.ReactNode
  activeTab: string
  onTabChange: (tab: string) => void
  factCheckData: any
}

export function NextraLayout({ children, activeTab, onTabChange, factCheckData }: NextraLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      icon: ClipboardList,
      description: 'Executive summary and key findings'
    },
    {
      id: 'human-reviews',
      label: 'Human Reviews',
      icon: Users,
      description: 'Professional fact-checker analysis'
    },
    {
      id: 'analysis',
      label: 'AI Analysis',
      icon: Beaker,
      description: 'Detailed AI-powered analysis'
    },
    {
      id: 'sources',
      label: 'Sources',
      icon: LinkIcon,
      description: 'References and citations'
    },
    {
      id: 'videos',
      label: 'Videos',
      icon: Play,
      description: 'Video sources and evidence'
    },
    {
      id: 'statistics',
      label: 'Statistics',
      icon: BarChart3,
      description: 'Analysis metrics and data'
    }
  ]

  const handleMobileTabChange = (tab: string) => {
    onTabChange(tab)
    setIsMobileMenuOpen(false)
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
            <h2 className="text-lg font-semibold text-foreground">Fact-Check Report</h2>
          </div>
          
          {/* Mobile Verdict Badge */}
          {factCheckData?.verdict && (
            <div className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
              factCheckData.verdict.label === 'True' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
              factCheckData.verdict.label === 'False' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' :
              factCheckData.verdict.label === 'Mixed' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' :
              'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
            }`}>
              {factCheckData.verdict.label}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          
          {/* Drawer */}
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="absolute top-16 left-0 bottom-0 w-80 max-w-[80vw] bg-background border-r border-border shadow-xl"
          >
            <div className="p-6 space-y-6 h-full overflow-y-auto">
              {factCheckData?.normalizedQuery && (
                <div>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {factCheckData.normalizedQuery}
                  </p>
                </div>
              )}

              <nav className="space-y-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon
                  const isActive = activeTab === tab.id
                  
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleMobileTabChange(tab.id)}
                      className={`w-full text-left group flex items-start space-x-3 px-3 py-3 rounded-lg transition-colors ${
                        isActive 
                          ? 'bg-primary/10 text-primary border border-primary/20' 
                          : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                        isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                      }`} />
                      <div>
                        <div className={`font-medium ${
                          isActive ? 'text-primary' : 'text-foreground'
                        }`}>
                          {tab.label}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {tab.description}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </nav>

              {/* Mobile Verdict Details */}
              {factCheckData?.verdict && (
                <div className="p-4 bg-muted/30 rounded-lg border">
                  <div className="text-sm font-medium text-foreground mb-2">Final Verdict</div>
                  <div className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                    factCheckData.verdict.label === 'True' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
                    factCheckData.verdict.label === 'False' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' :
                    factCheckData.verdict.label === 'Mixed' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' :
                    'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
                  }`}>
                    {factCheckData.verdict.label}
                  </div>
                  {factCheckData.verdict.confidence && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {Math.round(factCheckData.verdict.confidence * 100)}% confidence
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Desktop Sidebar - Hidden on Mobile */}
      <div className="hidden lg:block w-80 border-r border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="sticky top-0 p-6">
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-foreground">Fact-Check Report</h2>
            {factCheckData?.normalizedQuery && (
              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                {factCheckData.normalizedQuery}
              </p>
            )}
          </div>

          <nav className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`w-full text-left group flex items-start space-x-3 px-3 py-3 rounded-lg transition-colors ${
                    isActive 
                      ? 'bg-primary/10 text-primary border border-primary/20' 
                      : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                    isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                  }`} />
                  <div>
                    <div className={`font-medium ${
                      isActive ? 'text-primary' : 'text-foreground'
                    }`}>
                      {tab.label}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {tab.description}
                    </div>
                  </div>
                </button>
              )
            })}
          </nav>

          {/* Verdict Badge in Sidebar */}
          {factCheckData?.verdict && (
            <div className="mt-8 p-4 bg-muted/30 rounded-lg border">
              <div className="text-sm font-medium text-foreground mb-2">Final Verdict</div>
              <div className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                factCheckData.verdict.label === 'True' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
                factCheckData.verdict.label === 'False' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' :
                factCheckData.verdict.label === 'Mixed' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' :
                'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
              }`}>
                {factCheckData.verdict.label}
              </div>
              {factCheckData.verdict.confidence && (
                <div className="text-xs text-muted-foreground mt-1">
                  {Math.round(factCheckData.verdict.confidence * 100)}% confidence
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 lg:pt-0 pt-16">
        <div className="max-w-4xl mx-auto p-4 lg:p-6">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        </div>
      </div>
    </div>
  )
}