'use client'

import React from 'react'
import { Eye, Users, Wifi } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { type UserPresence } from '@/hooks/use-collaboration'

interface UserPresenceProps {
  participants: UserPresence[]
  currentUserId: string
  isConnected: boolean
  className?: string
  showCount?: boolean
  maxVisible?: number
}

export function UserPresence({ 
  participants, 
  currentUserId, 
  isConnected, 
  className = '',
  showCount = true,
  maxVisible = 5
}: UserPresenceProps) {
  const otherParticipants = participants.filter(p => p.userId !== currentUserId)
  
  if (!isConnected && otherParticipants.length === 0) {
    return null
  }

  const getUserInitials = (user: UserPresence) => {
    return user.username
      .split(' ')
      .map(name => name[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const visibleParticipants = otherParticipants.slice(0, maxVisible)
  const hiddenCount = Math.max(0, otherParticipants.length - maxVisible)

  return (
    <TooltipProvider>
      <div className={`flex items-center gap-2 ${className}`}>
        {/* Connection Status */}
        <div className="flex items-center gap-1">
          <Wifi className={`h-4 w-4 ${isConnected ? 'text-green-500' : 'text-gray-400'}`} />
          {showCount && (
            <span className="text-sm text-gray-600">
              {otherParticipants.length === 0 
                ? 'Solo' 
                : `${otherParticipants.length + 1} viewing`
              }
            </span>
          )}
        </div>

        {/* Participant Avatars */}
        {otherParticipants.length > 0 && (
          <div className="flex -space-x-2">
            {visibleParticipants.map((participant) => (
              <Tooltip key={participant.userId}>
                <TooltipTrigger asChild>
                  <div className="relative">
                    <Avatar className="h-8 w-8 border-2 border-white dark:border-gray-800 cursor-pointer hover:z-10 transition-transform hover:scale-110">
                      <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
                        {getUserInitials(participant)}
                      </AvatarFallback>
                    </Avatar>
                    
                    {/* Online Indicator */}
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full" />
                    
                    {/* Typing Indicator */}
                    {participant.isTyping && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 border border-white dark:border-gray-800 rounded-full animate-pulse" />
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-center">
                    <div className="font-medium">{participant.username}</div>
                    <div className="text-xs text-gray-500">
                      {participant.isTyping ? 'Typing...' : 'Online'}
                    </div>
                    <div className="text-xs text-gray-400">
                      Last seen: {new Date(participant.lastSeen).toLocaleTimeString()}
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            ))}
            
            {/* Hidden Count */}
            {hiddenCount > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 border-2 border-white dark:border-gray-800 flex items-center justify-center cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                      +{hiddenCount}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div>
                    <div className="font-medium">{hiddenCount} more viewer{hiddenCount !== 1 ? 's' : ''}</div>
                    {otherParticipants.slice(maxVisible).map((p) => (
                      <div key={p.userId} className="text-xs text-gray-500">
                        {p.username}
                      </div>
                    ))}
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}

// Compact version for headers
export function CompactUserPresence({ 
  participants, 
  currentUserId, 
  isConnected 
}: Omit<UserPresenceProps, 'className' | 'showCount' | 'maxVisible'>) {
  const otherParticipants = participants.filter(p => p.userId !== currentUserId)
  
  if (!isConnected) return null

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant={otherParticipants.length > 0 ? "default" : "secondary"} 
            className="cursor-pointer"
          >
            <Eye className="h-3 w-3 mr-1" />
            {otherParticipants.length + 1}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div>
            <div className="font-medium mb-1">Viewers</div>
            <div className="text-xs space-y-1">
              <div className="text-green-600">You (viewing)</div>
              {otherParticipants.map((p) => (
                <div key={p.userId} className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  {p.username}
                  {p.isTyping && <span className="text-blue-500">(typing)</span>}
                </div>
              ))}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// Floating presence indicator for minimal UI
export function FloatingUserPresence({ 
  participants, 
  currentUserId, 
  isConnected,
  className = '' 
}: UserPresenceProps) {
  const otherParticipants = participants.filter(p => p.userId !== currentUserId)
  
  if (!isConnected || otherParticipants.length === 0) return null

  return (
    <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
      <div className="bg-white dark:bg-gray-800 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 p-2">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-gray-600 dark:text-gray-300" />
          <div className="flex -space-x-1">
            {otherParticipants.slice(0, 3).map((participant) => (
              <Avatar key={participant.userId} className="h-6 w-6 border border-white dark:border-gray-800">
                <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
                  {participant.username[0]}
                </AvatarFallback>
              </Avatar>
            ))}
            {otherParticipants.length > 3 && (
              <div className="h-6 w-6 rounded-full bg-gray-200 dark:bg-gray-700 border border-white dark:border-gray-800 flex items-center justify-center">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                  +{otherParticipants.length - 3}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}