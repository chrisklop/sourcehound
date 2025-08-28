'use client'

import React, { useState, useEffect } from 'react'
import { Users, Eye, MessageSquare, Wifi, WifiOff, AlertCircle, UserPlus } from 'lucide-react'
import { useCollaboration, type UserPresence } from '@/hooks/use-collaboration'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

interface CollaborationPanelProps {
  conversationId: string
  isEnabled: boolean
  onToggle: (enabled: boolean) => void
  onParticipantsChange?: (count: number) => void
}

export function CollaborationPanel({
  conversationId,
  isEnabled,
  onToggle,
  onParticipantsChange
}: CollaborationPanelProps) {
  const [userId, setUserId] = useState('')
  const [username, setUsername] = useState('')
  const [showJoinForm, setShowJoinForm] = useState(false)

  // Generate user ID if not set
  useEffect(() => {
    if (!userId) {
      const storedUserId = localStorage.getItem('collaboration_user_id')
      if (storedUserId) {
        setUserId(storedUserId)
      } else {
        const newUserId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        setUserId(newUserId)
        localStorage.setItem('collaboration_user_id', newUserId)
      }
    }

    if (!username) {
      const storedUsername = localStorage.getItem('collaboration_username')
      if (storedUsername) {
        setUsername(storedUsername)
      } else {
        setUsername(`User ${userId.slice(-4)}`)
      }
    }
  }, [userId, username])

  const collaboration = useCollaboration({
    conversationId,
    userId,
    username,
    autoConnect: isEnabled && !!userId && !!username,
    maxRetries: 3,
    retryDelay: 3000
  })

  // Update parent with participant count changes
  useEffect(() => {
    if (onParticipantsChange) {
      onParticipantsChange(collaboration.participantCount)
    }
  }, [collaboration.participantCount, onParticipantsChange])

  // Show toast notifications for connection changes
  useEffect(() => {
    if (collaboration.isConnected && isEnabled) {
      toast.success('Connected to collaboration session')
    } else if (collaboration.error) {
      toast.error(`Collaboration error: ${collaboration.error}`)
    }
  }, [collaboration.isConnected, collaboration.error, isEnabled])

  const handleToggleCollaboration = async () => {
    if (!isEnabled) {
      // Check if we need username
      if (!username.trim()) {
        setShowJoinForm(true)
        return
      }
      
      // Create or join session
      try {
        const response = await fetch('/api/collaboration', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create_session',
            conversationId,
            userId,
            username: username.trim(),
            maxParticipants: 10
          })
        })

        const result = await response.json()
        
        if (result.success) {
          onToggle(true)
          toast.success('Collaboration session created')
        } else {
          toast.error('Failed to create collaboration session')
        }
      } catch (error) {
        console.error('Error creating collaboration session:', error)
        toast.error('Failed to create collaboration session')
      }
    } else {
      onToggle(false)
      collaboration.disconnect()
      toast.info('Left collaboration session')
    }
  }

  const handleJoinWithUsername = () => {
    if (!username.trim()) {
      toast.error('Please enter a username')
      return
    }

    localStorage.setItem('collaboration_username', username.trim())
    setShowJoinForm(false)
    onToggle(true)
  }

  const getUserInitials = (user: UserPresence) => {
    return user.username
      .split(' ')
      .map(name => name[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const getConnectionStatus = () => {
    if (!isEnabled) return { icon: WifiOff, text: 'Offline', color: 'text-gray-500' }
    if (collaboration.isConnecting) return { icon: Wifi, text: 'Connecting...', color: 'text-yellow-500' }
    if (collaboration.isConnected) return { icon: Wifi, text: 'Connected', color: 'text-green-500' }
    if (collaboration.error) return { icon: AlertCircle, text: 'Error', color: 'text-red-500' }
    return { icon: WifiOff, text: 'Disconnected', color: 'text-gray-500' }
  }

  const status = getConnectionStatus()

  if (showJoinForm) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Join Collaboration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium mb-2">
              Your Name
            </label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your name"
              maxLength={50}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleJoinWithUsername} className="flex-1">
              Join Session
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowJoinForm(false)}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Collaboration
          </div>
          <Button
            onClick={handleToggleCollaboration}
            variant={isEnabled ? "destructive" : "default"}
            size="sm"
            disabled={collaboration.isConnecting}
          >
            {isEnabled ? 'Leave' : 'Start'}
          </Button>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Connection Status */}
        <div className="flex items-center gap-2">
          <status.icon className={`h-4 w-4 ${status.color}`} />
          <span className={`text-sm ${status.color}`}>{status.text}</span>
          {collaboration.participantCount > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {collaboration.participantCount} online
            </Badge>
          )}
        </div>

        {/* Error Message */}
        {collaboration.error && (
          <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-2 rounded">
            <AlertCircle className="h-4 w-4" />
            {collaboration.error}
          </div>
        )}

        {/* Participants List */}
        {isEnabled && collaboration.participants.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Participants</h4>
            <div className="space-y-2">
              {collaboration.participants.map((participant) => (
                <div
                  key={participant.userId}
                  className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 dark:bg-gray-800"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">
                      {getUserInitials(participant)}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">
                        {participant.username}
                        {participant.userId === userId && (
                          <span className="text-xs text-gray-500 ml-1">(You)</span>
                        )}
                      </span>
                      {participant.isTyping && (
                        <div className="flex items-center gap-1">
                          <div className="flex space-x-1">
                            <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {participant.userId === userId
                        ? 'Online'
                        : `Last seen ${new Date(participant.lastSeen).toLocaleTimeString()}`
                      }
                    </div>
                  </div>

                  {participant.userId !== userId && (
                    <div className="flex items-center gap-1" title="Viewing conversation">
                      <Eye className="h-4 w-4 text-green-500" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Typing Indicators */}
        {collaboration.typingUsers.length > 0 && (
          <div className="text-sm text-gray-600 italic">
            {collaboration.typingUsers.length === 1
              ? `${collaboration.typingUsers[0].username} is typing...`
              : collaboration.typingUsers.length === 2
              ? `${collaboration.typingUsers[0].username} and ${collaboration.typingUsers[1].username} are typing...`
              : `${collaboration.typingUsers.length} people are typing...`
            }
          </div>
        )}

        {/* Collaboration Info */}
        {isEnabled && collaboration.isAlone && (
          <div className="text-sm text-gray-500 text-center p-4 border border-dashed border-gray-300 rounded">
            Share this conversation to collaborate with others in real-time!
          </div>
        )}

        {/* Recent Activity */}
        {collaboration.messages.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Recent Activity</h4>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {collaboration.messages.slice(-5).map((msg, idx) => (
                <div key={idx} className="text-xs text-gray-600 flex items-center gap-2">
                  <MessageSquare className="h-3 w-3" />
                  <span>
                    {msg.username} {msg.type === 'message' ? 'sent a message' : msg.type}
                  </span>
                  <span className="ml-auto">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}