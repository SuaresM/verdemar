import { useState } from 'react'
import { ImageOff } from 'lucide-react'

interface ImageSkeletonProps {
  src?: string
  alt: string
  className?: string
  aspectRatio?: string
}

export function ImageSkeleton({ src, alt, className = '', aspectRatio = 'aspect-square' }: ImageSkeletonProps) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  return (
    <div className={`relative overflow-hidden bg-gray-100 ${aspectRatio} ${className}`}>
      {!loaded && !error && (
        <div className="absolute inset-0 bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 animate-pulse" />
      )}
      {error || !src ? (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <ImageOff size={32} className="text-gray-300" />
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
        />
      )}
    </div>
  )
}
