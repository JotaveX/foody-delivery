import { useState } from 'react'

interface ProductImageProps {
  src: string
  alt: string
  width: number
  height: number
  className?: string
}

/**
 * Lazy product photo with fixed dimensions (no layout shift while it loads). If it fails, a
 * placeholder of the same size takes its place. An empty alt marks the image as decorative.
 */
export function ProductImage({ src, alt, width, height, className = '' }: ProductImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  if (failedSrc === src) {
    return (
      <span
        {...(alt ? { role: 'img', 'aria-label': alt } : { 'aria-hidden': true })}
        className={`product-image product-image-placeholder ${className}`}
        style={{ width, height }}
      >
        <span aria-hidden="true">SEM FOTO</span>
      </span>
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
      className={`product-image ${className}`}
      onError={() => setFailedSrc(src)}
    />
  )
}
