'use client'

import React from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { type UserPresence } from '@/hooks/use-collaboration'

interface TypingIndicatorProps {
  typingUsers: UserPresence[]
  className?: string
}

export function TypingIndicator({ typingUsers, className = '' }: TypingIndicatorProps) {
  if (typingUsers.length === 0) return null

  const getUserInitials = (user: UserPresence) => {
    return user.username
      .split(' ')
      .map(name => name[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const renderTypingText = () => {
    if (typingUsers.length === 1) {
      return `${typingUsers[0].username} is typing...`
    } else if (typingUsers.length === 2) {
      return `${typingUsers[0].username} and ${typingUsers[1].username} are typing...`
    } else {
      return `${typingUsers.length} people are typing...`
    }
  }

  return (
    <div className={`flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 border-l-4 border-blue-500 ${className}`}>
      {/* User Avatars */}
      <div className="flex -space-x-2">
        {typingUsers.slice(0, 3).map((user) => (
          <Avatar key={user.userId} className="h-8 w-8 border-2 border-white dark:border-gray-800">
            <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
              {getUserInitials(user)}
            </AvatarFallback>
          </Avatar>
        ))}
        {typingUsers.length > 3 && (
          <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 border-2 border-white dark:border-gray-800 flex items-center justify-center">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
              +{typingUsers.length - 3}
            </span>
          </div>
        )}
      </div>

      {/* Typing Text with Animation */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600 dark:text-gray-300">
          {renderTypingText()}
        </span>
        
        {/* Animated Dots */}
        <div className="flex space-x-1">
          <div 
            className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" 
            style={{ animationDelay: '0ms', animationDuration: '1.4s' }}
          />
          <div 
            className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" 
            style={{ animationDelay: '200ms', animationDuration: '1.4s' }}
          />
          <div 
            className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" 
            style={{ animationDelay: '400ms', animationDuration: '1.4s' }}
          />
        </div>
      </div>
    </div>
  )
}

export function InlineTypingIndicator({ typingUsers, className = '' }: TypingIndicatorProps) {
  if (typingUsers.length === 0) return null

  return (
    <div className={`flex items-center gap-2 text-sm text-gray-500 ${className}`}>
      <div className="flex -space-x-1">
        {typingUsers.slice(0, 2).map((user) => (
          <Avatar key={user.userId} className="h-6 w-6 border border-white dark:border-gray-800">
            <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
              {user.username[0]}
            </AvatarFallback>
          </Avatar>
        ))}
      </div>
      
      <div className="flex items-center gap-1">
        <span>
          {typingUsers.length === 1 
            ? `${typingUsers[0].username} is typing` 
            : `${typingUsers.length} people typing`
          }
        </span>
        <div className="flex space-x-0.5">
          <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  )
}

// Compact version for chat input area
export function CompactTypingIndicator({ typingUsers }: TypingIndicatorProps) {
  if (typingUsers.length === 0) return null

  return (
    <div className="flex items-center gap-2 px-4 py-2 text-xs text-gray-500">
      <div className="flex space-x-1">
        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span>
        {typingUsers.length === 1 
          ? `${typingUsers[0].username} is typing...`
          : `${typingUsers.length} people are typing...`
        }
      </span>
    </div>
  )
}