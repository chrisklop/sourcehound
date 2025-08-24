"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import Image from "next/image"

interface GVMarkProps {
  className?: string
  size?: "sm" | "md" | "lg"
  clickable?: boolean
}

export function GVMark({ className = "", size = "md", clickable = true }: GVMarkProps) {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
  }

  const logoContent = (
    <motion.div
      className={`${sizeClasses[size]} ${className} ${clickable ? "cursor-pointer hover:scale-105 transition-transform" : ""}`}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <Image
        src="/GVlogo.png"
        alt="GenuVerity Logo"
        width={48}
        height={48}
        className="w-full h-full object-contain"
        priority
      />
    </motion.div>
  )

  if (clickable) {
    return (
      <Link href="/" className="inline-block">
        {logoContent}
      </Link>
    )
  }

  return logoContent
}
