"use client"

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  FileText, 
  Users, 
  Microscope, 
  BookOpen, 
  BarChart3, 
  Play,
  ChevronRight 
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ResultsTabsProps {
  factCheckData: any
  children: React.ReactNode
  activeTab?: string
  onTabChange?: (tab: string) => void
  className?: string
}

export function ResultsTabs({ 
  factCheckData, 
  children, 
  activeTab = 'overview', 
  onTabChange,
  className 
}: ResultsTabsProps) {
  const [currentTab, setCurrentTab] = useState(activeTab)

  const handleTabClick = (tabId: string) => {
    setCurrentTab(tabId)
    onTabChange?.(tabId)
  }

  // Define available tabs based on data
  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      icon: FileText,
      description: 'Executive summary',
      count: null,
      available: true
    },
    {
      id: 'human-reviews',
      label: 'Human Reviews',
      icon: Users,
      description: 'Professional fact-checkers',
      count: factCheckData?.factCheckReviews?.length || 0,
      available: (factCheckData?.factCheckReviews?.length || 0) > 0
    },
    {
      id: 'analysis',
      label: 'AI Analysis',
      icon: Microscope,
      description: 'Detailed investigation',
      count: null,
      available: !!factCheckData?.explanation
    },
    {
      id: 'sources',
      label: 'Sources',
      icon: BookOpen,
      description: 'References & citations',
      count: factCheckData?.sources?.length || 0,
      available: (factCheckData?.sources?.length || 0) > 0
    },
    {
      id: 'statistics',
      label: 'Statistics',
      icon: BarChart3,
      description: 'Analysis metrics',
      count: null,
      available: true
    },
    {
      id: 'videos',
      label: 'Videos',
      icon: Play,
      description: 'Video sources',
      count: factCheckData?.sources?.filter((s: any) => 
        s.url?.includes('youtube.com') || s.url?.includes('vimeo.com')
      )?.length || 0,
      available: (factCheckData?.sources?.filter((s: any) => 
        s.url?.includes('youtube.com') || s.url?.includes('vimeo.com')
      )?.length || 0) > 0
    }
  ].filter(tab => tab.available)

  return (
    <div className={cn("space-y-6", className)}>
      {/* Modern Tab Navigation */}
      <Card className="shadow-sm">
        <CardContent className="p-1">
          <div className="flex flex-wrap gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = currentTab === tab.id
              
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group relative overflow-hidden",
                    "hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {/* Active indicator */}
                  {isActive && (
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-primary/5" />
                  )}
                  
                  <div className="relative flex items-center gap-3">
                    <Icon className={cn(
                      "w-4 h-4 transition-colors",
                      isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                    )} />
                    
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {tab.label}
                      </span>
                      
                      {tab.count !== null && tab.count > 0 && (
                        <Badge 
                          variant={isActive ? "secondary" : "outline"} 
                          className={cn(
                            "h-5 px-1.5 text-xs font-bold",
                            isActive 
                              ? "bg-primary-foreground/20 text-primary-foreground" 
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {tab.count}
                        </Badge>
                      )}
                    </div>
                    
                    {/* Hover arrow */}
                    <ChevronRight className={cn(
                      "w-3 h-3 transition-all duration-200 opacity-0 group-hover:opacity-100 translate-x-[-4px] group-hover:translate-x-0",
                      isActive ? "text-primary-foreground" : "text-muted-foreground"
                    )} />
                  </div>
                </button>
              )
            })}
          </div>
          
          {/* Tab Descriptions */}
          <div className="mt-3 px-2">
            {tabs.find(t => t.id === currentTab) && (
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <div className="w-1 h-1 bg-primary rounded-full" />
                {tabs.find(t => t.id === currentTab)?.description}
                {tabs.find(t => t.id === currentTab)?.count && (
                  <span>• {tabs.find(t => t.id === currentTab)?.count} items</span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {children}
      </div>
    </div>
  )
}