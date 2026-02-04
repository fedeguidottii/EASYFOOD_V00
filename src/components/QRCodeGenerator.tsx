import { useEffect, useRef } from 'react'

interface QRCodeGeneratorProps {
  value: string
  size?: number
  className?: string
}

export default function QRCodeGenerator({ value, size = 256, className }: QRCodeGeneratorProps) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}`

  return (
    <img
      src={qrUrl}
      alt="QR Code"
      width={size}
      height={size}
      className={`rounded-lg ${className || ''}`}
    />
  )
}
