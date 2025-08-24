"use client"

import { useState, useEffect, useRef, useMemo } from 'react'
import { VariableSizeList as List } from 'react-window'
import { motion } from "framer-motion"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Bot, User, BookOpen, Layers3 } from "lucide-react"
import { cn } from "@/lib/utils"

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isLoading?: boolean
  sources?: any[]
  factCheckData?: any
}

interface VirtualizedMessageListProps {
  messages: Message[]
  onViewSources?: (sources: any[]) => void
  onViewAnalysis?: (data: any) => void
  className?: string
}

interface MessageItemProps {
  index: number
  style: React.CSSProperties
  data: {
    messages: Message[]
    onViewSources?: (sources: any[]) => void
    onViewAnalysis?: (data: any) => void
  }
}

const ITEM_HEIGHT = 200 // Estimated height per message
const OVERSCAN_COUNT = 5 // Number of items to render outside visible area

function MessageItem({ index, style, data }: MessageItemProps) {
  const { messages, onViewSources, onViewAnalysis } = data
  const message = messages[index]
  
  if (!message) return null

  return (
    <div style={style} className="px-4 py-3">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex gap-4"
      >
        <Avatar className="w-8 h-8 mt-1 flex-shrink-0">
          {message.role === 'user' ? (
            <AvatarFallback>
              <User className="w-4 h-4" />
            </AvatarFallback>
          ) : (
            <AvatarFallback>
              <Bot className="w-4 h-4" />
            </AvatarFallback>
          )}
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm mb-1">
            {message.role === 'user' ? 'You' : 'SourceHound'}
            <span className="text-xs text-muted-foreground ml-2">
              {message.timestamp.toLocaleTimeString()}
            </span>
          </div>
          
          <div className="prose prose-sm dark:prose-invert max-w-none">
            {message.isLoading ? (
              <div className="flex items-center gap-2">
                <div className="animate-pulse">Analyzing claim...</div>
                <div className="flex space-x-1">
                  <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                  <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                  <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                </div>
              </div>
            ) : (
              <>
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  components={{
                    a: ({ href, children }) => (
                      <a 
                        href={href} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 dark:text-blue-400 underline"
                      >
                        {children}
                      </a>
                    ),
                    h2: ({ children }) => (
                      <h2 className="text-lg font-bold mt-4 mb-2 text-foreground">
                        {children}
                      </h2>
                    ),
                    strong: ({ children }) => (
                      <strong className="font-semibold text-foreground">
                        {children}
                      </strong>
                    ),
                    // Truncate very long content to improve performance
                    p: ({ children }) => (
                      <p className="line-clamp-10">
                        {children}
                      </p>
                    )
                  }}
                >
                  {message.content.length > 2000 
                    ? message.content.slice(0, 2000) + '\n\n*[Content truncated for performance]*'
                    : message.content
                  }
                </ReactMarkdown>
                
                {/* Quick action buttons for assistant messages */}
                {message.role === 'assistant' && (message.sources || message.factCheckData) && (
                  <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border/50">
                    {message.sources && message.sources.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onViewSources?.(message.sources!)}
                        className="h-7 text-xs"
                      >
                        <BookOpen className="w-3 h-3 mr-1" />
                        Sources ({message.sources.length})
                      </Button>
                    )}
                    {message.factCheckData && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onViewAnalysis?.(message.factCheckData)}
                        className="h-7 text-xs"
                      >
                        <Layers3 className="w-3 h-3 mr-1" />
                        Analysis
                      </Button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export function VirtualizedMessageList({ 
  messages, 
  onViewSources, 
  onViewAnalysis, 
  className 
}: VirtualizedMessageListProps) {
  const [containerHeight, setContainerHeight] = useState(600)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<List>(null)

  // Calculate dynamic item heights based on content
  const itemHeights = useMemo(() => {
    return messages.map(message => {
      // Estimate height based on content length
      const baseHeight = 100 // Avatar + header + padding
      const contentLines = Math.ceil(message.content.length / 100) // ~100 chars per line
      const contentHeight = Math.min(contentLines * 20, 400) // Max 400px for content
      const actionButtonsHeight = (message.role === 'assistant' && (message.sources || message.factCheckData)) ? 35 : 0
      
      return baseHeight + contentHeight + actionButtonsHeight
    })
  }, [messages])

  // Update container height on resize
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight)
      }
    }

    updateHeight()
    window.addEventListener('resize', updateHeight)
    return () => window.removeEventListener('resize', updateHeight)
  }, [])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (listRef.current && messages.length > 0) {
      listRef.current.scrollToItem(messages.length - 1, 'end')
    }
  }, [messages.length])

  // Custom height function for variable height items
  const getItemSize = (index: number) => {
    return itemHeights[index] || ITEM_HEIGHT
  }

  const itemData = {
    messages,
    onViewSources,
    onViewAnalysis
  }

  if (messages.length === 0) {
    return (
      <div className={cn("flex items-center justify-center h-full", className)}>
        <div className="text-center py-12">
          <Bot className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">No messages yet</h3>
          <p className="text-muted-foreground">Start a conversation to see messages here</p>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className={cn("h-full w-full", className)}>
      <List
        ref={listRef}
        height={containerHeight}
        width="100%"
        itemCount={messages.length}
        itemSize={getItemSize}
        itemData={itemData}
        overscanCount={OVERSCAN_COUNT}
        className="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40"
      >
        {MessageItem}
      </List>
    </div>
  )
}

// Hook for lazy loading message content
export function useLazyMessages(messages: Message[], batchSize: number = 50) {
  const [displayCount, setDisplayCount] = useState(Math.min(batchSize, messages.length))
  const [isLoading, setIsLoading] = useState(false)

  const displayedMessages = useMemo(() => {
    return messages.slice(0, displayCount)
  }, [messages, displayCount])

  const hasMore = displayCount < messages.length

  const loadMore = async () => {
    if (isLoading || !hasMore) return

    setIsLoading(true)
    
    // Simulate loading delay for better UX
    await new Promise(resolve => setTimeout(resolve, 300))
    
    setDisplayCount(prev => Math.min(prev + batchSize, messages.length))
    setIsLoading(false)
  }

  // Reset display count when messages change significantly
  useEffect(() => {
    if (messages.length < displayCount) {
      setDisplayCount(Math.min(batchSize, messages.length))
    }
  }, [messages.length, displayCount, batchSize])

  return {
    displayedMessages,
    hasMore,
    isLoading,
    loadMore,
    displayCount,
    totalCount: messages.length
  }
}