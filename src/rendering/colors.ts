export type RGB = { r: number; g: number; b: number }
export type HSV = { h: number; s: number; v: number }

export function hexToRgb(hex: string): RGB {
  const value = Number.parseInt(hex.slice(1), 16)
  return { r: value >> 16 & 255, g: value >> 8 & 255, b: value & 255 }
}

export function rgbToHex({ r, g, b }: RGB): string {
  return '#' + [r, g, b].map(channel => Math.round(Math.max(0, Math.min(255, channel))).toString(16).padStart(2, '0')).join('')
}

export function rgbToHsv({ r, g, b }: RGB): HSV {
  const channels = [r / 255, g / 255, b / 255]
  const max = Math.max(...channels), min = Math.min(...channels), delta = max - min
  let h = 0
  if (delta) {
    if (max === channels[0]) h = ((channels[1] - channels[2]) / delta) % 6
    else if (max === channels[1]) h = (channels[2] - channels[0]) / delta + 2
    else h = (channels[0] - channels[1]) / delta + 4
  }
  return { h: (h * 60 + 360) % 360, s: max ? delta / max : 0, v: max }
}

export function hsvToRgb({ h, s, v }: HSV): RGB {
  const hue = ((h % 360) + 360) % 360 / 60
  const chroma = v * s, x = chroma * (1 - Math.abs(hue % 2 - 1)), m = v - chroma
  const channels = hue < 1 ? [chroma, x, 0] : hue < 2 ? [x, chroma, 0] : hue < 3 ? [0, chroma, x] : hue < 4 ? [0, x, chroma] : hue < 5 ? [x, 0, chroma] : [chroma, 0, x]
  return { r: Math.round((channels[0] + m) * 255), g: Math.round((channels[1] + m) * 255), b: Math.round((channels[2] + m) * 255) }
}
