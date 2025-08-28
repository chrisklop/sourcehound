import { useState, useEffect, useCallback, useRef } from 'react'

export interface CollaborationMessage {
  type: 'join' | 'leave' | 'message' | 'typing' | 'presence' | 'sync' | 'error'
  conversationId: string
  userId: string
  username?: string
  data?: any
  timestamp: number
}

export interface UserPresence {
  userId: string
  username: string
  lastSeen: number
  isTyping: boolean
  cursor?: number
}

export interface CollaborationState {
  isConnected: boolean
  isConnecting: boolean
  participants: UserPresence[]
  messages: CollaborationMessage[]
  error: string | null
}

export interface UseCollaborationOptions {
  conversationId: string
  userId: string
  username: string
  autoConnect?: boolean
  maxRetries?: number
  retryDelay?: number
}

export function useCollaboration(options: UseCollaborationOptions) {
  const {
    conversationId,
    userId,
    username,
    autoConnect = true,
    maxRetries = 3,
    retryDelay = 5000
  } = options

  const [state, setState] = useState<CollaborationState>({
    isConnected: false,
    isConnecting: false,
    participants: [],
    messages: [],
    error: null
  })

  const wsRef = useRef<WebSocket | null>(null)
  const retryCountRef = useRef(0)
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Connect to WebSocket
  const connect = useCallback(async () => {
    if (state.isConnected || state.isConnecting) return

    setState(prev => ({ ...prev, isConnecting: true, error: null }))

    try {
      // Create WebSocket connection
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = window.location.host
      const wsUrl = `${protocol}//${host}/api/collaboration/ws?conversationId=${encodeURIComponent(conversationId)}&userId=${encodeURIComponent(userId)}&username=${encodeURIComponent(username)}`
      
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('WebSocket connected for collaboration')
        setState(prev => ({
          ...prev,
          isConnected: true,
          isConnecting: false,
          error: null
        }))
        retryCountRef.current = 0
      }

      ws.onmessage = (event) => {
        try {
          const message: CollaborationMessage = JSON.parse(event.data)
          handleMessage(message)
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      }

      ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason)
        setState(prev => ({
          ...prev,
          isConnected: false,
          isConnecting: false
        }))
        wsRef.current = null

        // Auto-retry connection if not intentionally closed
        if (event.code !== 1000 && retryCountRef.current < maxRetries) {
          retryCountRef.current++
          retryTimeoutRef.current = setTimeout(() => {
            console.log(`Retrying WebSocket connection (attempt ${retryCountRef.current}/${maxRetries})`)
            connect()
          }, retryDelay)
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        setState(prev => ({
          ...prev,
          error: 'Connection error',
          isConnecting: false
        }))
      }

    } catch (error) {
      console.error('Error creating WebSocket connection:', error)
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: 'Failed to connect'
      }))
    }
  }, [conversationId, userId, username, maxRetries, retryDelay])

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnected')
      wsRef.current = null
    }
    
    setState(prev => ({
      ...prev,
      isConnected: false,
      isConnecting: false,
      participants: [],
      messages: []
    }))
    
    retryCountRef.current = 0
  }, [])

  // Handle incoming messages
  const handleMessage = useCallback((message: CollaborationMessage) => {
    setState(prev => {
      switch (message.type) {
        case 'sync':
          // Initial sync with current state
          return {
            ...prev,
            participants: message.data?.participants || [],
            messages: [...prev.messages, ...(message.data?.recentMessages || [])]
          }

        case 'presence':
          // Update participant list
          return {
            ...prev,
            participants: message.data?.participants || prev.participants
          }

        case 'typing':
          // Update typing indicator
          const updatedParticipants = prev.participants.map(p =>
            p.userId === message.userId
              ? { ...p, isTyping: message.data?.isTyping || false }
              : p
          )
          return {
            ...prev,
            participants: updatedParticipants
          }

        case 'message':
          // Add new message
          return {
            ...prev,
            messages: [...prev.messages, message].slice(-100) // Keep last 100 messages
          }

        case 'error':
          return {
            ...prev,
            error: message.data?.message || 'Unknown error'
          }

        default:
          console.warn('Unknown collaboration message type:', message.type)
          return prev
      }
    })
  }, [])

  // Send message
  const sendMessage = useCallback((type: string, data?: any) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('Cannot send message: WebSocket not connected')
      return false
    }

    const message: CollaborationMessage = {
      type: type as any,
      conversationId,
      userId,
      username,
      data,
      timestamp: Date.now()
    }

    try {
      wsRef.current.send(JSON.stringify(message))
      return true
    } catch (error) {
      console.error('Error sending WebSocket message:', error)
      return false
    }
  }, [conversationId, userId, username])

  // Send chat message
  const sendChatMessage = useCallback((content: string, messageType: string = 'user') => {
    return sendMessage('message', {
      content,
      messageType,
      timestamp: Date.now()
    })
  }, [sendMessage])

  // Send typing indicator
  const sendTypingIndicator = useCallback((isTyping: boolean) => {
    // Clear existing typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = null
    }

    sendMessage('typing', { isTyping })

    // Auto-stop typing after 3 seconds
    if (isTyping) {
      typingTimeoutRef.current = setTimeout(() => {
        sendMessage('typing', { isTyping: false })
      }, 3000)
    }
  }, [sendMessage])

  // Request sync
  const requestSync = useCallback(() => {
    return sendMessage('sync')
  }, [sendMessage])

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect && conversationId && userId) {
      connect()
    }

    return () => {
      disconnect()
    }
  }, [autoConnect, conversationId, userId, connect, disconnect])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
  }, [])

  return {
    // State
    isConnected: state.isConnected,
    isConnecting: state.isConnecting,
    participants: state.participants,
    messages: state.messages,
    error: state.error,
    participantCount: state.participants.length,
    
    // Actions
    connect,
    disconnect,
    sendMessage,
    sendChatMessage,
    sendTypingIndicator,
    requestSync,
    
    // Computed values
    otherParticipants: state.participants.filter(p => p.userId !== userId),
    typingUsers: state.participants.filter(p => p.isTyping && p.userId !== userId),
    isAlone: state.participants.length <= 1
  }
}