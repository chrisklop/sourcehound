"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

interface ShareButtonProps {
  slug?: string
  query: string
  verdict?: {
    label: string
    summary: string
  }
}

export function ShareButton({ slug, query, verdict }: ShareButtonProps) {
  const [copied, setCopied] = useState(false)
  const [showOptions, setShowOptions] = useState(false)

  const getShareUrl = () => {
    if (slug) {
      return `${window.location.origin}/${slug}`
    }
    return window.location.href
  }

  const getShareText = () => {
    if (verdict) {
      return `Fact-Check: ${verdict.label} - ${query}\n\n${verdict.summary}`
    }
    return `Fact-Check: ${query}`
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(getShareUrl())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      setShowOptions(false)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  const handleTwitterShare = () => {
    const url = getShareUrl()
    const text = getShareText()
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`
    window.open(twitterUrl, "_blank", "width=550,height=420")
    setShowOptions(false)
  }

  const handleFacebookShare = () => {
    const url = getShareUrl()
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
    window.open(facebookUrl, "_blank", "width=580,height=296")
    setShowOptions(false)
  }

  const handleLinkedInShare = () => {
    const url = getShareUrl()
    const text = getShareText()
    const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}&summary=${encodeURIComponent(text)}`
    window.open(linkedinUrl, "_blank", "width=520,height=570")
    setShowOptions(false)
  }

  return (
    <div className="relative no-print">
      <Button
        onClick={() => setShowOptions(!showOptions)}
        variant="outline"
        size="sm"
        className="text-xs bg-transparent"
      >
        <svg className="mr-1 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
          />
        </svg>
        Share
      </Button>

      {showOptions && (
        <div className="absolute right-0 top-full mt-2 w-48 rounded-md border border-gray-200 bg-white shadow-lg z-10">
          <div className="py-1">
            <button
              onClick={handleCopyLink}
              className="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              <svg className="mr-3 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              {copied ? "Copied!" : "Copy Link"}
            </button>

            <button
              onClick={handleTwitterShare}
              className="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              <svg className="mr-3 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              Share on X
            </button>

            <button
              onClick={handleFacebookShare}
              className="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              <svg className="mr-3 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              Share on Facebook
            </button>

            <button
              onClick={handleLinkedInShare}
              className="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              <svg className="mr-3 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
              Share on LinkedIn
            </button>
          </div>
        </div>
      )}

      {showOptions && <div className="fixed inset-0 z-0" onClick={() => setShowOptions(false)} />}
    </div>
  )
}
