"use client"

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { 
  Search, 
  Download, 
  Share2, 
  Filter, 
  Calendar,
  MessageSquare,
  User,
  Bot,
  FileText,
  Trash2,
  Star,
  Archive,
  Copy,
  ExternalLink,
  MoreVertical
} from 'lucide-react'
import { cn } from '@/lib/utils'

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
  isStarred?: boolean
  isArchived?: boolean
  tags?: string[]
}

interface ConversationManagerProps {
  conversations: Conversation[]
  activeConversation: string | null
  onConversationSelect: (id: string) => void
  onConversationDelete: (id: string) => void
  onConversationStar: (id: string, starred: boolean) => void
  onConversationArchive: (id: string, archived: boolean) => void
  onExportConversation: (id: string, format: 'pdf' | 'txt' | 'json') => void
  onShareConversation: (id: string) => void
  className?: string
}

type FilterMode = 'all' | 'starred' | 'archived' | 'recent'
type SortMode = 'updated' | 'created' | 'title' | 'messages'

export function ConversationManager({
  conversations,
  activeConversation,
  onConversationSelect,
  onConversationDelete,
  onConversationStar,
  onConversationArchive,
  onExportConversation,
  onShareConversation,
  className
}: ConversationManagerProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterMode, setFilterMode] = useState<FilterMode>('all')
  const [sortMode, setSortMode] = useState<SortMode>('updated')
  const [selectedConversations, setSelectedConversations] = useState<string[]>([])
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [conversationToShare, setConversationToShare] = useState<string | null>(null)

  // Filter and search conversations
  const filteredConversations = useMemo(() => {
    let filtered = conversations.filter(conv => {
      // Apply filters
      if (filterMode === 'starred' && !conv.isStarred) return false
      if (filterMode === 'archived' && !conv.isArchived) return false
      if (filterMode === 'recent') {
        const dayAgo = new Date()
        dayAgo.setDate(dayAgo.getDate() - 1)
        if (conv.updatedAt < dayAgo) return false
      }

      // Apply search
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const titleMatch = conv.title.toLowerCase().includes(query)
        const contentMatch = conv.messages.some(msg => 
          msg.content.toLowerCase().includes(query)
        )
        if (!titleMatch && !contentMatch) return false
      }

      return true
    })

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortMode) {
        case 'updated':
          return b.updatedAt.getTime() - a.updatedAt.getTime()
        case 'created':
          return b.createdAt.getTime() - a.createdAt.getTime()
        case 'title':
          return a.title.localeCompare(b.title)
        case 'messages':
          return b.messages.length - a.messages.length
        default:
          return 0
      }
    })

    return filtered
  }, [conversations, searchQuery, filterMode, sortMode])

  // Generate conversation summary
  const getConversationSummary = (conversation: Conversation) => {
    const messageCount = conversation.messages.length
    const lastMessage = conversation.messages[conversation.messages.length - 1]
    const userMessages = conversation.messages.filter(m => m.role === 'user').length
    const aiMessages = conversation.messages.filter(m => m.role === 'assistant').length
    
    return {
      messageCount,
      userMessages,
      aiMessages,
      lastMessage: lastMessage?.content.slice(0, 100) + (lastMessage?.content.length > 100 ? '...' : ''),
      lastUpdated: conversation.updatedAt.toLocaleDateString()
    }
  }

  // Export conversation
  const handleExport = (conversationId: string, format: 'pdf' | 'txt' | 'json') => {
    const conversation = conversations.find(c => c.id === conversationId)
    if (!conversation) return

    if (format === 'json') {
      const data = JSON.stringify(conversation, null, 2)
      const blob = new Blob([data], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `conversation-${conversation.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`
      a.click()
      URL.revokeObjectURL(url)
    } else if (format === 'txt') {
      const text = `Conversation: ${conversation.title}\nCreated: ${conversation.createdAt.toLocaleString()}\n\n` +
        conversation.messages.map(msg => 
          `${msg.role === 'user' ? 'User' : 'SourceHound'} (${msg.timestamp.toLocaleString()}):\n${msg.content}\n\n`
        ).join('')
      
      const blob = new Blob([text], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `conversation-${conversation.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`
      a.click()
      URL.revokeObjectURL(url)
    }
    // PDF export would require additional library like jsPDF
    
    onExportConversation(conversationId, format)
  }

  // Share conversation
  const handleShare = (conversationId: string) => {
    setConversationToShare(conversationId)
    setShareDialogOpen(true)
  }

  const copyShareLink = () => {
    if (!conversationToShare) return
    const shareUrl = `${window.location.origin}/shared/${conversationToShare}`
    navigator.clipboard.writeText(shareUrl)
    // Would need to show toast notification
  }

  // Bulk operations
  const handleBulkDelete = () => {
    selectedConversations.forEach(id => onConversationDelete(id))
    setSelectedConversations([])
  }

  const handleBulkArchive = () => {
    selectedConversations.forEach(id => onConversationArchive(id, true))
    setSelectedConversations([])
  }

  const filterOptions = [
    { value: 'all', label: 'All', icon: MessageSquare, count: conversations.length },
    { value: 'starred', label: 'Starred', icon: Star, count: conversations.filter(c => c.isStarred).length },
    { value: 'archived', label: 'Archived', icon: Archive, count: conversations.filter(c => c.isArchived).length },
    { value: 'recent', label: 'Recent', icon: Calendar, count: conversations.filter(c => {
      const dayAgo = new Date()
      dayAgo.setDate(dayAgo.getDate() - 1)
      return c.updatedAt >= dayAgo
    }).length }
  ]

  return (
    <Card className={cn("h-full flex flex-col", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Conversations
            <Badge variant="secondary">{filteredConversations.length}</Badge>
          </CardTitle>
          
          {selectedConversations.length > 0 && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleBulkArchive}>
                <Archive className="w-4 h-4 mr-1" />
                Archive ({selectedConversations.length})
              </Button>
              <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                <Trash2 className="w-4 h-4 mr-1" />
                Delete ({selectedConversations.length})
              </Button>
            </div>
          )}
        </div>

        {/* Search and Filters */}
        <div className="space-y-3">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              {filterOptions.map((option) => (
                <Button
                  key={option.value}
                  variant={filterMode === option.value ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setFilterMode(option.value as FilterMode)}
                  className="h-8 px-3"
                  disabled={option.count === 0}
                >
                  <option.icon className="w-4 h-4 mr-1" />
                  {option.label}
                  {option.count > 0 && (
                    <Badge variant="outline" className="ml-1 h-4 px-1 text-xs">
                      {option.count}
                    </Badge>
                  )}
                </Button>
              ))}
            </div>

            {/* Sort Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="w-4 h-4 mr-1" />
                  Sort
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setSortMode('updated')}>
                  Recently Updated
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortMode('created')}>
                  Recently Created
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortMode('title')}>
                  Title (A-Z)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortMode('messages')}>
                  Most Messages
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-full">
          <div className="space-y-2 p-4">
            {filteredConversations.map((conversation) => {
              const summary = getConversationSummary(conversation)
              const isSelected = selectedConversations.includes(conversation.id)
              const isActive = activeConversation === conversation.id

              return (
                <Card 
                  key={conversation.id} 
                  className={cn(
                    "p-4 cursor-pointer transition-all hover:shadow-md",
                    isActive && "ring-2 ring-primary",
                    isSelected && "bg-muted/50",
                    conversation.isArchived && "opacity-70"
                  )}
                  onClick={() => onConversationSelect(conversation.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Title and badges */}
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-medium text-sm truncate">
                          {conversation.title}
                        </h3>
                        {conversation.isStarred && (
                          <Star className="w-4 h-4 text-yellow-500 fill-current" />
                        )}
                        {conversation.isArchived && (
                          <Badge variant="secondary" className="text-xs">
                            Archived
                          </Badge>
                        )}
                      </div>

                      {/* Metadata */}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                        <div className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          {summary.messageCount} messages
                        </div>
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {summary.userMessages}
                        </div>
                        <div className="flex items-center gap-1">
                          <Bot className="w-3 h-3" />
                          {summary.aiMessages}
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {summary.lastUpdated}
                        </div>
                      </div>

                      {/* Last message preview */}
                      {summary.lastMessage && (
                        <p className="text-xs text-muted-foreground truncate">
                          {summary.lastMessage}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          onConversationStar(conversation.id, !conversation.isStarred)
                        }}
                        className="h-8 w-8 p-0"
                      >
                        <Star className={cn(
                          "w-4 h-4",
                          conversation.isStarred ? "text-yellow-500 fill-current" : "text-muted-foreground"
                        )} />
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => e.stopPropagation()}
                            className="h-8 w-8 p-0"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={() => handleShare(conversation.id)}>
                            <Share2 className="w-4 h-4 mr-2" />
                            Share
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleExport(conversation.id, 'txt')}>
                            <Download className="w-4 h-4 mr-2" />
                            Export as TXT
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleExport(conversation.id, 'json')}>
                            <FileText className="w-4 h-4 mr-2" />
                            Export as JSON
                          </DropdownMenuItem>
                          <Separator />
                          <DropdownMenuItem 
                            onClick={() => onConversationArchive(conversation.id, !conversation.isArchived)}
                          >
                            <Archive className="w-4 h-4 mr-2" />
                            {conversation.isArchived ? 'Unarchive' : 'Archive'}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => onConversationDelete(conversation.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </Card>
              )
            })}

            {filteredConversations.length === 0 && (
              <div className="text-center py-8">
                <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No conversations found</h3>
                <p className="text-muted-foreground">
                  {searchQuery ? 'Try adjusting your search query' : 'Start a new conversation to get started'}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>

      {/* Share Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Conversation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Share this conversation with others by copying the link below.
            </p>
            <div className="flex items-center gap-2">
              <Input 
                value={conversationToShare ? `${window.location.origin}/shared/${conversationToShare}` : ''}
                readOnly
                className="flex-1"
              />
              <Button onClick={copyShareLink} size="sm">
                <Copy className="w-4 h-4 mr-1" />
                Copy
              </Button>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShareDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => {
                if (conversationToShare) {
                  onShareConversation(conversationToShare)
                }
                setShareDialogOpen(false)
              }}>
                <ExternalLink className="w-4 h-4 mr-1" />
                Share
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}