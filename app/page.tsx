"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Send, Plus, Menu, ChevronRight, Bot, User, Zap } from "lucide-react"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { ThemeToggle } from "@/components/theme-toggle"
import Link from "next/link"

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isLoading?: boolean
}

interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: Date
  updatedAt: Date
}

export default function SourceHoundPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversation, setActiveConversation] = useState<string | null>(null)
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Get current conversation
  const currentConversation = conversations.find(c => c.id === activeConversation)
  const messages = currentConversation?.messages || []

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
      // Call hybrid fact-check API (Perplexity + Gemini)
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
      
      // Create assistant message
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: formatFactCheckResponse(result),
        timestamp: new Date()
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

  // Format hybrid fact-check response for dashboard display
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

    // Source Intelligence Dashboard
    if (result.sources && result.sources.length > 0) {
      const totalSources = result.metrics?.uniqueSources || result.sources.length
      const engineSources = result.sources.filter((s: any) => s.engines?.length > 1).length
      
      response += `## 📚 Sources (${totalSources} unique)\n`
      if (engineSources > 0) {
        response += `*${engineSources} sources validated by both engines*\n\n`
      }
      
      // Top sources with engine attribution
      result.sources.slice(0, 8).forEach((source: any, index: number) => {
        const engineBadge = source.engines?.length > 1 ? ' 🔗' : 
          source.engine === 'perplexity' ? ' 🧠' : 
          source.engine === 'gemini' ? ' ✨' : ''
        
        response += `${index + 1}. [${source.title || source.publisher || 'Source'}](${source.url})${engineBadge}\n`
        if (source.snippet) {
          response += `   *"${source.snippet.slice(0, 120)}..."*\n`
        }
      })
      response += '\n'
    }

    // Processing Metrics Dashboard
    if (result.metrics) {
      response += `## ⚡ Analysis Metrics\n`
      response += `• **Processing Time:** ${Math.round(result.metrics.processingTime / 1000)}s\n`
      response += `• **Total Sources Found:** ${result.metrics.totalSources || 0}\n`
      response += `• **Unique Sources:** ${result.metrics.uniqueSources || 0}\n`
      if (result.factCheckReviews?.length > 0) {
        response += `• **Professional Reviews:** ${result.factCheckReviews.length}\n`
      }
      response += '\n'
    }

    // Detailed Analysis Section
    if (result.explanation) {
      response += `## 📖 Detailed Analysis\n`
      response += `${result.explanation}\n\n`
    }

    // Professional Fact-Check Reviews
    if (result.factCheckReviews && result.factCheckReviews.length > 0) {
      response += `## 🏛️ Professional Fact-Checkers\n`
      result.factCheckReviews.slice(0, 3).forEach((review: any, index: number) => {
        response += `${index + 1}. **${review.publisher}**: ${review.rating || 'Review'}\n`
        response += `   [${review.title}](${review.url})\n`
      })
    }

    return response
  }

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'block' : 'hidden'} md:block fixed inset-y-0 left-0 z-50 w-80 bg-muted/50 border-r backdrop-blur-md md:relative md:translate-x-0`}>
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between p-4 border-b">
                <h1 className="text-xl font-bold">SourceHound</h1>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSidebarOpen(false)}
                  className="md:hidden"
                >
                  ×
                </Button>
              </div>

              <div className="p-4">
                <Button
                  onClick={createNewConversation}
                  className="w-full justify-start"
                  variant="outline"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New Chat
                </Button>
              </div>

              <ScrollArea className="flex-1 px-2">
                <div className="space-y-1">
                  {conversations.map((conversation) => (
                    <Button
                      key={conversation.id}
                      variant={activeConversation === conversation.id ? "secondary" : "ghost"}
                      className="w-full justify-start text-left h-auto p-3"
                      onClick={() => {
                        setActiveConversation(conversation.id)
                        window.innerWidth < 768 && setSidebarOpen(false)
                      }}
                    >
                      <div className="flex-1 truncate">
                        <div className="font-medium truncate">{conversation.title}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {conversation.messages.length} messages
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </ScrollArea>
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
              onClick={() => setSidebarOpen(true)}
              className="md:hidden"
            >
              <Menu className="w-5 h-5" />
            </Button>
            <h2 className="font-semibold">
              {currentConversation?.title || "SourceHound"}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/enhanced" className="flex items-center gap-1">
                <Zap className="w-3 h-3" />
                Enhanced
              </Link>
            </Button>
            <ThemeToggle />
          </div>
        </header>

        {/* Messages */}
        <ScrollArea className="flex-1">
          <div className="max-w-4xl mx-auto px-4 py-8">
            {messages.length === 0 ? (
              <div className="text-center py-12">
                <Bot className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-2xl font-bold mb-2">Welcome to SourceHound</h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  I'm here to help you debunk claims, verify information, and find reliable sources. 
                  Ask me about any claim you'd like me to investigate.
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
            ) : (
              <div className="space-y-6">
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-4"
                  >
                    <Avatar className="w-8 h-8 mt-1">
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
                    <div className="flex-1">
                      <div className="font-medium text-sm mb-1">
                        {message.role === 'user' ? 'You' : 'SourceHound'}
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
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm]}
                            components={{
                              // Custom link rendering
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
                              // Enhanced headings
                              h2: ({ children }) => (
                                <h2 className="text-xl font-bold mt-6 mb-3 text-foreground">
                                  {children}
                                </h2>
                              ),
                              h3: ({ children }) => (
                                <h3 className="text-lg font-semibold mt-4 mb-2 text-foreground">
                                  {children}
                                </h3>
                              ),
                              // Enhanced list items
                              li: ({ children }) => (
                                <li className="mb-1 text-muted-foreground">
                                  {children}
                                </li>
                              ),
                              // Code and emphasis
                              strong: ({ children }) => (
                                <strong className="font-semibold text-foreground">
                                  {children}
                                </strong>
                              ),
                              em: ({ children }) => (
                                <em className="italic text-muted-foreground">
                                  {children}
                                </em>
                              )
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </ScrollArea>

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
      </main>
    </div>
  )
}