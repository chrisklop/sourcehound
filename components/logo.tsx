import Link from "next/link"
import Image from "next/image"

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`flex items-center gap-2 hover:opacity-80 transition-opacity ${className}`}>
      <div className="relative w-8 h-8 flex items-center justify-center">
        <Image
          src="/GVlogo.png"
          alt="GenuVerity Logo"
          width={32}
          height={32}
          className="w-full h-full object-contain"
          priority
        />
      </div>
      <span className="text-xl font-semibold text-gray-900 dark:text-gray-100">GenuVerity</span>
    </Link>
  )
}
