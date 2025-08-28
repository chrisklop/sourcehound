"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Send, 
  Plus, 
  Menu, 
  Bot, 
  User, 
  Layers3,
  MessageSquare,
  BookOpen,
  Settings,
  Maximize2,
  Minimize2
} from "lucide-react"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { ThemeToggle } from "@/components/theme-toggle"
import { ConversationManager } from "@/components/conversation-manager"
import { CanvasSourceBrowser } from "@/components/canvas-source-browser"
import { InteractiveCharts } from "@/components/interactive-charts"
import { EnhancedSourceCard, enhanceSource } from "@/components/enhanced-source-card"
import { PWAInstallPrompt, OfflineIndicator, PWAStatus } from "@/components/pwa-install-prompt"
import { VirtualizedMessageList } from "@/components/virtualized-message-list"
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

interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: Date
  updatedAt: Date
  isStarred?: boolean
  isArchived?: boolean
  tags?: string[]
}

type ViewMode = 'chat' | 'analysis' | 'sources' | 'manage'

export default function EnhancedSourceHoundPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversation, setActiveConversation] = useState<string | null>(null)
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('chat')
  const [sourceBrowserExpanded, setSourceBrowserExpanded] = useState(false)
  const [lastAnalysisData, setLastAnalysisData] = useState<any>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Get current conversation
  const currentConversation = conversations.find(c => c.id === activeConversation)
  const messages = currentConversation?.messages || []

  // Extract sources from recent messages
  const allSources = messages
    .filter(m => m.sources && m.sources.length > 0)
    .flatMap(m => m.sources)
    .map(enhanceSource)
    .slice(0, 50) // Limit for performance

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'inherit'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [input])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load conversations from IP-based session on mount
  useEffect(() => {
    const loadSession = async () => {
      try {
        const response = await fetch('/api/sessions')
        const data = await response.json()
        
        if (data.success && data.conversations) {
          const parsed = data.conversations.map((c: any) => ({
            ...c,
            createdAt: new Date(c.createdAt),
            updatedAt: new Date(c.updatedAt),
            messages: c.messages.map((m: any) => ({
              ...m,
              timestamp: new Date(m.timestamp)
            }))
          }))
          setConversations(parsed)
        }
      } catch (error) {
        console.error('Failed to load session:', error)
        // Fallback to localStorage for development
        const stored = localStorage.getItem('sourcehound-conversations')
        if (stored) {
          const parsed = JSON.parse(stored)
          setConversations(parsed.map((c: any) => ({
            ...c,
            createdAt: new Date(c.createdAt),
            updatedAt: new Date(c.updatedAt),
            messages: c.messages.map((m: any) => ({
              ...m,
              timestamp: new Date(m.timestamp)
            }))
          })))
        }
      }
    }
    
    loadSession()
  }, [])

  // Save conversations to IP-based session
  const saveConversations = async (convs: Conversation[]) => {
    setConversations(convs)
    
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversations: convs
        }),
      })
      
      if (!response.ok) {
        throw new Error('Failed to save session')
      }
    } catch (error) {
      console.error('Failed to save session:', error)
      // Fallback to localStorage
      localStorage.setItem('sourcehound-conversations', JSON.stringify(convs))
    }
  }

  // Create new conversation
  const createNewConversation = async () => {
    const newConv: Conversation = {
      id: Date.now().toString(),
      title: "New Chat",
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date()
    }
    const updated = [newConv, ...conversations]
    await saveConversations(updated)
    setActiveConversation(newConv.id)
    setSidebarOpen(false)
    setViewMode('chat')
  }

  // Send message
  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    }

    let targetConversation = currentConversation
    
    // Create new conversation if none exists
    if (!targetConversation) {
      const newConv: Conversation = {
        id: Date.now().toString(),
        title: input.trim().slice(0, 50) + (input.trim().length > 50 ? '...' : ''),
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date()
      }
      targetConversation = newConv
      setActiveConversation(newConv.id)
    }

    // Add user message
    const updatedMessages = [...targetConversation.messages, userMessage]
    
    // Add loading message
    const loadingMessage: Message = {
      id: 'loading',
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true
    }

    const conversationWithLoading = {
      ...targetConversation,
      messages: [...updatedMessages, loadingMessage],
      updatedAt: new Date()
    }

    const updatedConversations = conversations.map(c => 
      c.id === targetConversation!.id ? conversationWithLoading : c
    )
    
    if (!conversations.find(c => c.id === targetConversation!.id)) {
      updatedConversations.unshift(conversationWithLoading)
    }

    await saveConversations(updatedConversations)
    setInput("")
    setIsLoading(true)

    try {
      // Call hybrid fact-check API
      const response = await fetch('/api/fact-check-hybrid', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: userMessage.content,
          sessionId: targetConversation.id
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to get response')
      }

      const result = await response.json()
      setLastAnalysisData(result) // Store for analysis view
      
      // Create assistant message
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: formatFactCheckResponse(result),
        timestamp: new Date(),
        sources: result.sources || [],
        factCheckData: result
      }

      // Update conversation with assistant response
      const finalMessages = [...updatedMessages, assistantMessage]
      const finalConversation = {
        ...targetConversation,
        messages: finalMessages,
        updatedAt: new Date()
      }

      const finalConversations = updatedConversations.map(c => 
        c.id === targetConversation!.id ? finalConversation : c
      )

      await saveConversations(finalConversations)
    } catch (error) {
      console.error('Error:', error)
      
      // Add error message
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I apologize, but I encountered an error while processing your request. Please try again.",
        timestamp: new Date()
      }

      const errorMessages = [...updatedMessages, errorMessage]
      const errorConversation = {
        ...targetConversation,
        messages: errorMessages,
        updatedAt: new Date()
      }

      const errorConversations = updatedConversations.map(c => 
        c.id === targetConversation!.id ? errorConversation : c
      )

      await saveConversations(errorConversations)
    } finally {
      setIsLoading(false)
    }
  }

  // Format fact-check response (same as original)
  const formatFactCheckResponse = (result: any) => {
    if (!result) {
      return "I couldn't find enough information to provide a comprehensive analysis."
    }

    let response = ""

    // Dashboard Header with Dual-Engine Status
    response += `🔍 **SourceHound Hybrid Analysis**\n`
    if (result.metrics?.engineStatus) {
      const perplexityStatus = result.metrics.engineStatus.perplexity === 'success' ? '✅ Perplexity' : '❌ Perplexity'
      const geminiStatus = result.metrics.engineStatus.gemini === 'success' ? '✅ Gemini' : '❌ Gemini'
      response += `*Engines: ${perplexityStatus} • ${geminiStatus}*\n\n`
    }
    
    // Verdict Section with Agreement Status
    if (result.verdict) {
      const agreementIcon = result.verdict.engineAgreement ? '🤝' : '⚖️'
      const confidencePercent = Math.round((result.verdict.confidence || 0) * 100)
      
      response += `## ${agreementIcon} Verdict: **${result.verdict.label}**\n`
      response += `**Confidence:** ${confidencePercent}%\n`
      response += `**Analysis:** ${result.verdict.summary}\n\n`
      
      // Show individual engine verdicts if they disagree
      if (!result.verdict.engineAgreement) {
        if (result.verdict.perplexityVerdict && result.verdict.geminiVerdict) {
          response += `*Engine Comparison:*\n`
          response += `• Perplexity: ${result.verdict.perplexityVerdict}\n`
          response += `• Gemini: ${result.verdict.geminiVerdict}\n\n`
        }
      }
    }

    // Key Findings Dashboard
    if (result.keyFindings && result.keyFindings.length > 0) {
      response += `## 📋 Key Findings\n`
      result.keyFindings.slice(0, 6).forEach((finding: string, index: number) => {
        response += `${index + 1}. ${finding}\n`
      })
      response += '\n'
    }

    return response
  }

  // Conversation management handlers
  const handleConversationSelect = (id: string) => {
    setActiveConversation(id)
    setViewMode('chat')
  }

  const handleConversationDelete = async (id: string) => {
    const updated = conversations.filter(c => c.id !== id)
    await saveConversations(updated)
    if (activeConversation === id) {
      setActiveConversation(null)
    }
  }

  const handleConversationStar = async (id: string, starred: boolean) => {
    const updated = conversations.map(c => 
      c.id === id ? { ...c, isStarred: starred } : c
    )
    await saveConversations(updated)
  }

  const handleConversationArchive = async (id: string, archived: boolean) => {
    const updated = conversations.map(c => 
      c.id === id ? { ...c, isArchived: archived } : c
    )
    await saveConversations(updated)
  }

  const handleExportConversation = (id: string, format: 'pdf' | 'txt' | 'json') => {
    // Export logic handled in ConversationManager component
  }

  const handleShareConversation = (id: string) => {
    // Share logic handled in ConversationManager component
  }

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const renderChatView = () => (
    <div className="flex-1 flex flex-col">
      {/* Messages */}
      {messages.length === 0 ? (
        <ScrollArea className="flex-1">
          <div className="max-w-4xl mx-auto px-4 py-8 text-center">
            <Bot className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-2xl font-bold mb-2">Welcome to SourceHound Enhanced</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              I'm here to help you debunk claims, verify information, and find reliable sources with 
              advanced visualization and analysis tools.
            </p>
            <div className="grid md:grid-cols-2 gap-4 max-w-2xl mx-auto">
              <Button
                variant="outline"
                className="p-4 h-auto text-left"
                onClick={() => setInput("Is climate change caused by human activities?")}
              >
                <div>
                  <div className="font-medium">Climate Change</div>
                  <div className="text-sm text-muted-foreground">
                    Investigate claims about global warming
                  </div>
                </div>
              </Button>
              <Button
                variant="outline"
                className="p-4 h-auto text-left"
                onClick={() => setInput("Are vaccines safe and effective?")}
              >
                <div>
                  <div className="font-medium">Vaccine Safety</div>
                  <div className="text-sm text-muted-foreground">
                    Verify medical claims with sources
                  </div>
                </div>
              </Button>
            </div>
          </div>
        </ScrollArea>
      ) : (
        <VirtualizedMessageList
          messages={messages}
          onViewSources={(sources) => {
            // Update last analysis data and switch to sources view
            setViewMode('sources')
          }}
          onViewAnalysis={(data) => {
            setLastAnalysisData(data)
            setViewMode('analysis')
          }}
          className="flex-1"
        />
      )}

      {/* Input */}
      <div className="border-t bg-background/80 backdrop-blur-md p-4">
        <div className="max-w-4xl mx-auto">
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Ask me to verify a claim or find sources..."
              className="min-h-[24px] max-h-[200px] resize-none pr-12"
              rows={1}
            />
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              size="icon"
              className="absolute right-2 top-2 w-8 h-8"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-background">
      {/* Enhanced Sidebar */}
      <aside className={cn(
        "flex flex-col transition-all duration-300",
        sidebarOpen ? "w-80" : "w-0"
      )}>
        <div className={cn(
          "h-full bg-muted/50 border-r backdrop-blur-md",
          sidebarOpen ? "opacity-100" : "opacity-0"
        )}>
          <div className="flex h-full flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
              <h1 className="text-xl font-bold">SourceHound</h1>
              <Badge variant="secondary" className="text-xs">Enhanced</Badge>
            </div>

            <div className="p-4 flex-shrink-0">
              <Button
                onClick={createNewConversation}
                className="w-full justify-start"
                variant="outline"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Chat
              </Button>
            </div>

            {/* View Mode Tabs */}
            <div className="px-4 pb-2 flex-shrink-0">
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)} className="w-full">
                <TabsList className="grid grid-cols-4 w-full h-8 p-0">
                  <TabsTrigger value="chat" className="text-xs px-1">
                    <MessageSquare className="w-3 h-3" />
                  </TabsTrigger>
                  <TabsTrigger value="analysis" className="text-xs px-1">
                    <Layers3 className="w-3 h-3" />
                  </TabsTrigger>
                  <TabsTrigger value="sources" className="text-xs px-1">
                    <BookOpen className="w-3 h-3" />
                  </TabsTrigger>
                  <TabsTrigger value="manage" className="text-xs px-1">
                    <Settings className="w-3 h-3" />
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="flex-1 overflow-y-auto px-2">
              <div className="space-y-1 py-2">
                {conversations.filter(c => !c.isArchived).map((conversation) => (
                  <Button
                    key={conversation.id}
                    variant={activeConversation === conversation.id ? "secondary" : "ghost"}
                    className="w-full justify-start text-left h-auto p-3"
                    onClick={() => handleConversationSelect(conversation.id)}
                  >
                    <div className="flex-1 truncate">
                      <div className="flex items-center gap-2">
                        <div className="font-medium truncate text-sm">{conversation.title}</div>
                        {conversation.isStarred && (
                          <Badge variant="secondary" className="h-4 px-1 text-xs">★</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {conversation.messages.length} messages
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between p-4 border-b bg-background/80 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="h-8 w-8"
            >
              <Menu className="w-5 h-5" />
            </Button>
            <h2 className="font-semibold">
              {viewMode === 'chat' && (currentConversation?.title || "SourceHound Enhanced")}
              {viewMode === 'analysis' && "Analysis Dashboard"}
              {viewMode === 'sources' && "Source Browser"}
              {viewMode === 'manage' && "Conversation Manager"}
            </h2>
          </div>
          <ThemeToggle />
        </header>

        {/* Content based on view mode */}
        <div className="flex-1 overflow-hidden">
          {viewMode === 'chat' && renderChatView()}
          
          {viewMode === 'analysis' && (
            <div className="p-6 h-full overflow-auto">
              {lastAnalysisData ? (
                <InteractiveCharts 
                  data={{ 
                    sources: (lastAnalysisData.sources || []).map((s: any) => ({
                      type: s.sourceType || 'general',
                      credibilityScore: s.credibilityScore || 75,
                      publishedDate: s.publishedDate,
                      url: s.url,
                      title: s.title
                    })),
                    factCheckData: lastAnalysisData
                  }}
                />
              ) : (
                <div className="text-center py-12">
                  <Layers3 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No Analysis Data</h3>
                  <p className="text-muted-foreground">
                    Start a fact-checking conversation to see detailed analysis
                  </p>
                </div>
              )}
            </div>
          )}
          
          {viewMode === 'sources' && (
            <div className="h-full overflow-hidden">
              {allSources.length > 0 ? (
                <div className="h-full p-6">
                  <CanvasSourceBrowser
                    sources={allSources}
                    isExpanded={sourceBrowserExpanded}
                    onExpand={setSourceBrowserExpanded}
                    className="h-full"
                  />
                </div>
              ) : (
                <div className="text-center py-12">
                  <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No Sources Found</h3>
                  <p className="text-muted-foreground">
                    Sources from your fact-checking conversations will appear here
                  </p>
                </div>
              )}
            </div>
          )}
          
          {viewMode === 'manage' && (
            <div className="p-6 h-full">
              <ConversationManager
                conversations={conversations}
                activeConversation={activeConversation}
                onConversationSelect={handleConversationSelect}
                onConversationDelete={handleConversationDelete}
                onConversationStar={handleConversationStar}
                onConversationArchive={handleConversationArchive}
                onExportConversation={handleExportConversation}
                onShareConversation={handleShareConversation}
              />
            </div>
          )}
        </div>
      </main>
      
      {/* PWA Components */}
      <PWAInstallPrompt />
      <OfflineIndicator />
      <PWAStatus />
    </div>
  )
}