<template>
  <div ref="visualRef" :class="$style.visual" :style="textStyle">
    <canvas ref="canvasRef" :class="$style.canvas" />
    <div :class="$style.brand">LX Music</div>
    <div :class="$style.lyricStage">
      <div :class="$style.shadowLyric">{{ mainLyric }}</div>
      <div :class="$style.lyric">{{ mainLyric }}</div>
      <div :class="$style.subtitle">{{ subtitle }}</div>
    </div>
  </div>
</template>

<script>
import { computed, onBeforeUnmount, onMounted, ref, watch } from '@common/utils/vueTools'
import { isFullscreen } from '@renderer/store'
import { musicInfo, playMusicInfo } from '@renderer/store/player/state'
import { lyric } from '@renderer/store/player/lyric'
import { appSetting } from '@renderer/store/setting'
import { normalizePlayDetailFont } from '@renderer/utils/playDetailFonts'

const CANVAS_DPR_LIMIT = 1.25
const PALETTE_SAMPLE_SIZE = 56
const FLUID_FRAME_INTERVAL = 16
const FLUID_WIDTH = 224
const FLUID_HEIGHT = 126
const FLUID_PIXEL_COUNT = FLUID_WIDTH * FLUID_HEIGHT
const NOISE_LOOKUP_SIZE = 256
const NOISE_LOOKUP_MIN = -0.25
const NOISE_LOOKUP_RANGE = 0.5
const DEGREE_TO_RADIAN = Math.PI / 180
const LAYER_ROTATE_COS = Math.cos(-5 * DEGREE_TO_RADIAN)
const LAYER_ROTATE_SIN = Math.sin(-5 * DEGREE_TO_RADIAN)

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const clampColor = color => color.map(value => clamp(value, 0, 255))
const mixColor = (a, b, amount) => clampColor(a.map((value, index) => value + (b[index] - value) * amount))
const luminance = color => (color[0] * 0.299 + color[1] * 0.587 + color[2] * 0.114) / 255
const saturation = color => {
  const max = Math.max(color[0], color[1], color[2])
  const min = Math.min(color[0], color[1], color[2])
  return max ? (max - min) / max : 0
}
const colorDistance = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])
const saturateColor = (color, amount) => {
  const gray = luminance(color) * 255
  return clampColor(color.map(value => gray + (value - gray) * amount))
}
const hslToRgb = (hue, saturation, lightness) => {
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation
  const h = hue / 60
  const x = c * (1 - Math.abs(h % 2 - 1))
  const m = lightness - c / 2
  const [r, g, b] = h < 1
    ? [c, x, 0]
    : h < 2
      ? [x, c, 0]
      : h < 3
        ? [0, c, x]
        : h < 4
          ? [0, x, c]
          : h < 5
            ? [x, 0, c]
            : [c, 0, x]
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255]
}
const rgbToHsl = color => {
  const r = color[0] / 255
  const g = color[1] / 255
  const b = color[2] / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const light = (max + min) / 2
  if (max == min) return [0, 0, light]

  const delta = max - min
  const sat = light > 0.5 ? delta / (2 - max - min) : delta / (max + min)
  const hue = max == r
    ? ((g - b) / delta + (g < b ? 6 : 0)) * 60
    : max == g
      ? ((b - r) / delta + 2) * 60
      : ((r - g) / delta + 4) * 60
  return [hue, sat, light]
}
const shiftHue = (color, degree, satScale = 1, lightScale = 1) => {
  const [hue, sat, light] = rgbToHsl(color)
  return hslToRgb(
    (hue + degree + 360) % 360,
    clamp(sat * satScale, 0.22, 0.82),
    clamp(light * lightScale, 0.16, 0.66),
  )
}
const toRgb = color => `rgb(${Math.round(color[0])}, ${Math.round(color[1])}, ${Math.round(color[2])})`
const fract = value => value - Math.floor(value)
const smoothstep = (edge0, edge1, value) => {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}
const hash2 = (x, y) => ({
  x: fract(Math.sin(x * 2127.1 + y * 81.17) * 43758.5453),
  y: fract(Math.sin(x * 1269.5 + y * 283.37) * 43758.5453),
})
const gradientNoise = (x, y) => {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy
  const ux = fx * fx * (3 - 2 * fx)
  const uy = fy * fy * (3 - 2 * fy)
  const dotCorner = (ox, oy) => {
    const h = hash2(ix + ox, iy + oy)
    return ((-1 + 2 * h.x) * (fx - ox)) + ((-1 + 2 * h.y) * (fy - oy))
  }
  const a = dotCorner(0, 0)
  const b = dotCorner(1, 0)
  const c = dotCorner(0, 1)
  const d = dotCorner(1, 1)
  return 0.5 + 0.5 * ((a + (b - a) * ux) + ((c + (d - c) * ux) - (a + (b - a) * ux)) * uy)
}
const getSeedValue = seedSource => String(seedSource || 'LX Music')
  .split('')
  .reduce((sum, char) => ((sum * 31) + char.charCodeAt(0)) % 3600, 0)

const getMusicPic = info => {
  if (!info) return null
  if ('progress' in info) return info.metadata?.musicInfo?.meta?.picUrl ?? null
  return info.meta?.picUrl ?? info.pic ?? null
}

const getMusicName = info => {
  if (!info) return ''
  if ('progress' in info) return info.metadata?.musicInfo?.name ?? ''
  return info.name ?? ''
}

const getMusicSinger = info => {
  if (!info) return ''
  if ('progress' in info) return info.metadata?.musicInfo?.singer ?? ''
  return info.singer ?? ''
}

const buildFluidPalette = (baseColor, accentColor, companionColor) => {
  const base = luminance(baseColor) > 0.72
    ? mixColor(baseColor, [0, 0, 0], 0.34)
    : luminance(baseColor) < 0.12
      ? mixColor(baseColor, [255, 255, 255], 0.14)
      : baseColor
  let accent = saturation(accentColor) > saturation(base)
    ? accentColor
    : saturateColor(mixColor(accentColor, base, 0.18), 1.18)
  let companion = companionColor ?? shiftHue(base, 132, 1.12, 1.08)
  let fourth = mixColor(base, accent, 0.44)

  if (colorDistance(accent, base) < 48) accent = shiftHue(base, 34, 1.28, 1.16)
  if (colorDistance(companion, base) < 58 || colorDistance(companion, accent) < 52) {
    companion = shiftHue(base, 142, 1.18, 1.06)
  }
  if (colorDistance(fourth, accent) < 44 || colorDistance(fourth, companion) < 44) {
    fourth = shiftHue(base, -42, 1.18, 1.12)
  }

  const surface = mixColor(base, [0, 0, 0], luminance(base) > 0.48 ? 0.32 : 0.18)

  return {
    colors: [
      mixColor(surface, [0, 0, 0], 0.2),
      saturateColor(accent, 1.12),
      saturateColor(companion, 1.08),
      saturateColor(fourth, 1.04),
    ],
    background: mixColor(surface, [0, 0, 0], 0.28),
    text: luminance(surface) > 0.58 ? [24, 22, 24] : [246, 244, 241],
  }
}

const getFallbackPalette = seedSource => {
  const seedText = seedSource ?? `${musicInfo.id ?? ''}-${musicInfo.name ?? ''}-${musicInfo.singer ?? ''}`
  const hue = getSeedValue(seedText) % 360
  return buildFluidPalette(
    hslToRgb(hue, 0.36, 0.3),
    hslToRgb((hue + 24) % 360, 0.48, 0.44),
    hslToRgb((hue + 142) % 360, 0.4, 0.36),
  )
}

const extractPalette = async(src, fallbackSeed) => {
  if (!src) return getFallbackPalette(fallbackSeed)

  return new Promise(resolve => {
    const img = new Image()
    img.decoding = 'async'
    if (/^https?:\/\//i.test(src)) img.crossOrigin = 'anonymous'

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) {
          resolve(getFallbackPalette(fallbackSeed || src))
          return
        }

        canvas.width = PALETTE_SAMPLE_SIZE
        canvas.height = PALETTE_SAMPLE_SIZE
        ctx.drawImage(img, 0, 0, PALETTE_SAMPLE_SIZE, PALETTE_SAMPLE_SIZE)

        const data = ctx.getImageData(0, 0, PALETTE_SAMPLE_SIZE, PALETTE_SAMPLE_SIZE).data
        const buckets = new Map()
        let weightedTotal = [0, 0, 0]
        let totalWeight = 0

        for (let i = 0; i < data.length; i += 16) {
          if (data[i + 3] < 80) continue
          const color = [data[i], data[i + 1], data[i + 2]]
          const light = luminance(color)
          if (light < 0.035 || light > 0.95) continue

          const sat = saturation(color)
          const weight = 0.5 + sat * 1.2 + (1 - Math.abs(light - 0.48)) * 0.24
          weightedTotal = weightedTotal.map((value, index) => value + color[index] * weight)
          totalWeight += weight

          const key = color.map(value => Math.round(value / 30) * 30).join(',')
          const bucket = buckets.get(key) || { color: [0, 0, 0], count: 0, score: 0 }
          bucket.color = bucket.color.map((value, index) => value + color[index])
          bucket.count++
          bucket.score += weight + sat * 0.8
          buckets.set(key, bucket)
        }

        if (!totalWeight || !buckets.size) {
          resolve(getFallbackPalette(fallbackSeed || src))
          return
        }

        const base = weightedTotal.map(value => value / totalWeight)
        const colors = Array.from(buckets.values())
          .map(bucket => ({
            color: bucket.color.map(value => value / bucket.count),
            count: bucket.count,
            score: bucket.score,
          }))
          .sort((a, b) => b.score - a.score)
        const dominant = colors
          .slice()
          .sort((a, b) => (b.count + b.score * 0.28) - (a.count + a.score * 0.28))[0]?.color ?? base
        const accent = colors.find(item =>
          colorDistance(item.color, dominant) > 42 &&
          saturation(item.color) > Math.max(0.08, saturation(dominant) * 0.72),
        )?.color ?? colors[0]?.color ?? base
        const companion = colors.find(item =>
          colorDistance(item.color, dominant) > 58 &&
          colorDistance(item.color, accent) > 42,
        )?.color ?? mixColor(accent, base, 0.28)
        resolve(buildFluidPalette(dominant, accent, companion))
      } catch {
        resolve(getFallbackPalette(fallbackSeed || src))
      }
    }

    img.onerror = () => {
      resolve(getFallbackPalette(fallbackSeed || src))
    }
    img.src = src
  })
}

const createFluidGrid = () => {
  const centerX = new Float32Array(FLUID_PIXEL_COUNT)
  const centerY = new Float32Array(FLUID_PIXEL_COUNT)
  const shade = new Float32Array(FLUID_PIXEL_COUNT)
  const noiseIndex = new Uint16Array(FLUID_PIXEL_COUNT)
  const noiseBlend = new Float32Array(FLUID_PIXEL_COUNT)
  const dataIndex = new Uint32Array(FLUID_PIXEL_COUNT)

  let index = 0
  for (let y = 0; y < FLUID_HEIGHT; y++) {
    const uvY = y / (FLUID_HEIGHT - 1)
    for (let x = 0; x < FLUID_WIDTH; x++) {
      const tx = x / (FLUID_WIDTH - 1) - 0.5
      const ty = uvY - 0.5
      const noisePosition = clamp(
        (tx * ty - NOISE_LOOKUP_MIN) / NOISE_LOOKUP_RANGE * (NOISE_LOOKUP_SIZE - 1),
        0,
        NOISE_LOOKUP_SIZE - 1,
      )
      const lookupIndex = Math.min(NOISE_LOOKUP_SIZE - 2, Math.floor(noisePosition))

      centerX[index] = tx
      centerY[index] = ty
      shade[index] = 0.95 - uvY * 0.08
      noiseIndex[index] = lookupIndex
      noiseBlend[index] = noisePosition - lookupIndex
      dataIndex[index] = index * 4
      index++
    }
  }

  return {
    centerX,
    centerY,
    shade,
    noiseIndex,
    noiseBlend,
    dataIndex,
  }
}

const updateNoiseLookup = (lookup, time) => {
  const noiseTime = time * 0.0001
  for (let i = 0; i < NOISE_LOOKUP_SIZE; i++) {
    const product = NOISE_LOOKUP_MIN + (i / (NOISE_LOOKUP_SIZE - 1)) * NOISE_LOOKUP_RANGE
    lookup[i] = gradientNoise(noiseTime, product)
  }
}

const DEFAULT_FLUID_STYLE = {
  flowCos: 1,
  flowSin: 0,
  noiseRotation: 720,
  noisePhase: 180,
  speedScale: 1,
  warpFrequencyX: 5,
  warpFrequencyY: 7.5,
  warpAmountX: 1 / 25,
  warpAmountY: 1 / 12.5,
  layerCos: LAYER_ROTATE_COS,
  layerSin: LAYER_ROTATE_SIN,
  blendXStart: -0.3,
  blendXEnd: 0.2,
  blendYStart: 0.5,
  blendYEnd: -0.3,
  foldFrequency: 6,
  foldAmount: 0,
  crossFrequency: 4,
  tideFrequency: 5,
  tideAmount: 0,
  highlightStrength: 0,
  organicStrength: 0,
  organicScale: 4,
  organicPhase: 0,
}

const renderFluidShader = (targetCtx, fluid, width, height, palette, time, style = DEFAULT_FLUID_STYLE) => {
  const data = fluid.imageData.data
  const grid = fluid.grid
  const noiseLookup = fluid.noiseLookup
  const t = time * 0.001
  const speed = t * 0.75 * style.speedScale
  const [c1, c2, c3, c4] = palette.colors
  const organicTime = t * 0.18 * style.speedScale + style.organicPhase
  const organicCenters = style.organicStrength ? [
    [-0.3 + Math.sin(organicTime * 0.9) * 0.15, -0.24 + Math.cos(organicTime * 0.7) * 0.13],
    [0.31 + Math.cos(organicTime * 0.74) * 0.14, -0.2 + Math.sin(organicTime * 0.86) * 0.15],
    [-0.22 + Math.cos(organicTime * 0.68) * 0.16, 0.29 + Math.sin(organicTime * 0.78) * 0.13],
    [0.27 + Math.sin(organicTime * 0.82) * 0.15, 0.25 + Math.cos(organicTime * 0.64) * 0.16],
  ] : null
  updateNoiseLookup(noiseLookup, time)

  for (let i = 0; i < FLUID_PIXEL_COUNT; i++) {
    const lookupIndex = grid.noiseIndex[i]
    const lookupBlend = grid.noiseBlend[i]
    const noise = noiseLookup[lookupIndex] + (noiseLookup[lookupIndex + 1] - noiseLookup[lookupIndex]) * lookupBlend
    const angle = ((noise - 0.5) * style.noiseRotation + style.noisePhase) * DEGREE_TO_RADIAN
    const rotateCos = Math.cos(angle)
    const rotateSin = Math.sin(angle)
    const flowX = grid.centerX[i] * style.flowCos - grid.centerY[i] * style.flowSin
    const flowY = grid.centerX[i] * style.flowSin + grid.centerY[i] * style.flowCos
    let tx = flowX * rotateCos - flowY * rotateSin
    let ty = flowX * rotateSin + flowY * rotateCos

    tx += Math.sin(ty * style.warpFrequencyX + speed) * style.warpAmountX
    ty += Math.sin(tx * style.warpFrequencyY + speed) * style.warpAmountY

    const layerPosition = tx * style.layerCos - ty * style.layerSin
    const foldWave = Math.sin(layerPosition * style.foldFrequency + ty * style.crossFrequency + speed * 0.48 + noise * 2.4)
    const crossWave = Math.sin((tx + ty) * style.crossFrequency - speed * 0.31)
    let blendX = smoothstep(
      style.blendXStart,
      style.blendXEnd,
      layerPosition + foldWave * style.foldAmount + crossWave * style.foldAmount * 0.42,
    )
    let blendY = smoothstep(
      style.blendYStart,
      style.blendYEnd,
      ty + Math.sin(tx * style.tideFrequency - speed * 0.36) * style.tideAmount,
    )
    if (organicCenters) {
      const px = grid.centerX[i]
      const py = grid.centerY[i]
      const dx0 = px - organicCenters[0][0]
      const dy0 = py - organicCenters[0][1]
      const dx1 = px - organicCenters[1][0]
      const dy1 = py - organicCenters[1][1]
      const dx2 = px - organicCenters[2][0]
      const dy2 = py - organicCenters[2][1]
      const dx3 = px - organicCenters[3][0]
      const dy3 = py - organicCenters[3][1]
      const weight0 = 1 / (0.08 + (dx0 * dx0 + dy0 * dy0) * style.organicScale)
      const weight1 = 1 / (0.08 + (dx1 * dx1 + dy1 * dy1) * style.organicScale)
      const weight2 = 1 / (0.08 + (dx2 * dx2 + dy2 * dy2) * style.organicScale)
      const weight3 = 1 / (0.08 + (dx3 * dx3 + dy3 * dy3) * style.organicScale)
      const weightTotal = weight0 + weight1 + weight2 + weight3
      const organicX = (weight1 + weight3) / weightTotal
      const organicY = (weight2 + weight3) / weightTotal
      blendX += (organicX - blendX) * style.organicStrength
      blendY += (organicY - blendY) * style.organicStrength
    }
    const layer1R = c1[0] + (c2[0] - c1[0]) * blendX
    const layer1G = c1[1] + (c2[1] - c1[1]) * blendX
    const layer1B = c1[2] + (c2[2] - c1[2]) * blendX
    const layer2R = c3[0] + (c4[0] - c3[0]) * blendX
    const layer2G = c3[1] + (c4[1] - c3[1]) * blendX
    const layer2B = c3[2] + (c4[2] - c3[2]) * blendX
    const shade = grid.shade[i] * (1 + foldWave * style.highlightStrength)
    const index = grid.dataIndex[i]

    data[index] = clamp((layer1R + (layer2R - layer1R) * blendY) * shade, 0, 255)
    data[index + 1] = clamp((layer1G + (layer2G - layer1G) * blendY) * shade, 0, 255)
    data[index + 2] = clamp((layer1B + (layer2B - layer1B) * blendY) * shade, 0, 255)
    data[index + 3] = 255
  }

  fluid.ctx.putImageData(fluid.imageData, 0, 0)
  targetCtx.imageSmoothingEnabled = true
  targetCtx.drawImage(fluid.canvas, 0, 0, width, height)
}

let sharedCoverFluid = null
const getSharedCoverFluid = () => {
  if (sharedCoverFluid) return sharedCoverFluid
  sharedCoverFluid = {
    canvas: document.createElement('canvas'),
    ctx: null,
    imageData: null,
    grid: createFluidGrid(),
    noiseLookup: new Float32Array(NOISE_LOOKUP_SIZE),
  }
  sharedCoverFluid.canvas.width = FLUID_WIDTH
  sharedCoverFluid.canvas.height = FLUID_HEIGHT
  sharedCoverFluid.ctx = sharedCoverFluid.canvas.getContext('2d', { willReadFrequently: true })
  sharedCoverFluid.imageData = sharedCoverFluid.ctx.createImageData(FLUID_WIDTH, FLUID_HEIGHT)
  return sharedCoverFluid
}

const getFluidCoverStyle = seedSource => {
  const seed = String(seedSource || 'LX Music').split('').reduce((hash, char) => {
    return ((hash * 33) ^ char.charCodeAt(0)) >>> 0
  }, 5381)
  const random = salt => fract(Math.sin(seed * 0.0001 + salt * 91.73) * 43758.5453)
  const flowAngle = (random(1) * 2 - 1) * Math.PI
  const layerAngle = ((random(2) * 110) - 55) * DEGREE_TO_RADIAN

  const presets = [
    {
      noiseRotation: 440,
      speedScale: 0.78,
      warpFrequencyX: 4.2,
      warpFrequencyY: 7.8,
      warpAmountX: 0.032,
      warpAmountY: 0.058,
      blendXStart: -0.42,
      blendXEnd: 0.36,
      blendYStart: 0.56,
      blendYEnd: -0.42,
      foldFrequency: 7.8,
      foldAmount: 0.18,
      crossFrequency: 4.2,
      tideFrequency: 5.4,
      tideAmount: 0.055,
      highlightStrength: 0.22,
      organicStrength: 0.34,
      organicScale: 4.8,
    },
    {
      noiseRotation: 610,
      speedScale: 0.92,
      warpFrequencyX: 3.4,
      warpFrequencyY: 6.2,
      warpAmountX: 0.056,
      warpAmountY: 0.088,
      blendXStart: -0.5,
      blendXEnd: 0.3,
      blendYStart: 0.64,
      blendYEnd: -0.48,
      foldFrequency: 5.2,
      foldAmount: 0.145,
      crossFrequency: 3.2,
      tideFrequency: 4.1,
      tideAmount: 0.13,
      highlightStrength: 0.17,
      organicStrength: 0.46,
      organicScale: 3.8,
    },
    {
      noiseRotation: 820,
      speedScale: 1.08,
      warpFrequencyX: 5.8,
      warpFrequencyY: 9.4,
      warpAmountX: 0.072,
      warpAmountY: 0.108,
      blendXStart: -0.34,
      blendXEnd: 0.24,
      blendYStart: 0.58,
      blendYEnd: -0.36,
      foldFrequency: 6.4,
      foldAmount: 0.22,
      crossFrequency: 5.1,
      tideFrequency: 6.8,
      tideAmount: 0.105,
      highlightStrength: 0.24,
      organicStrength: 0.52,
      organicScale: 5.4,
    },
    {
      noiseRotation: 280,
      speedScale: 0.62,
      warpFrequencyX: 2.2,
      warpFrequencyY: 3.4,
      warpAmountX: 0.11,
      warpAmountY: 0.16,
      blendXStart: -0.48,
      blendXEnd: 0.38,
      blendYStart: 0.72,
      blendYEnd: -0.5,
      foldFrequency: 2.7,
      foldAmount: 0.3,
      crossFrequency: 2.1,
      tideFrequency: 2.2,
      tideAmount: 0.24,
      highlightStrength: 0.3,
      organicStrength: 0.28,
      organicScale: 3.2,
    },
    {
      noiseRotation: 360,
      speedScale: 0.68,
      warpFrequencyX: 2.8,
      warpFrequencyY: 4,
      warpAmountX: 0.14,
      warpAmountY: 0.18,
      blendXStart: -0.4,
      blendXEnd: 0.32,
      blendYStart: 0.68,
      blendYEnd: -0.44,
      foldFrequency: 3.6,
      foldAmount: 0.26,
      crossFrequency: 2.3,
      tideFrequency: 3,
      tideAmount: 0.2,
      highlightStrength: 0.25,
      organicStrength: 0.58,
      organicScale: 3.6,
    },
  ]
  const mode = seed % presets.length

  return {
    ...presets[mode],
    flowCos: Math.cos(flowAngle),
    flowSin: Math.sin(flowAngle),
    noisePhase: 120 + random(3) * 240,
    layerCos: Math.cos(layerAngle),
    layerSin: Math.sin(layerAngle),
    warpFrequencyX: presets[mode].warpFrequencyX + random(4) * 1.4,
    warpFrequencyY: presets[mode].warpFrequencyY + random(5) * 1.8,
    foldFrequency: presets[mode].foldFrequency + random(6) * 1.6,
    tideFrequency: presets[mode].tideFrequency + random(7) * 1.5,
    organicPhase: random(8) * Math.PI * 2,
  }
}

const brightenCoverPalette = palette => {
  const minLightness = [0.36, 0.46, 0.42, 0.48]
  return {
    ...palette,
    colors: palette.colors.map((color, index) => {
      const [hue, sat, light] = rgbToHsl(color)
      const nextSat = sat < 0.08 ? 0.12 : clamp(sat * 1.18 + 0.04, 0.28, 0.9)
      const nextLight = clamp(light * 1.12 + 0.06, minLightness[index], 0.7)
      return hslToRgb(hue, nextSat, nextLight)
    }),
  }
}

export const createFluidCoverRenderer = seedSource => {
  const fluid = getSharedCoverFluid()
  const style = getFluidCoverStyle(seedSource)

  let palette = brightenCoverPalette(getFallbackPalette(seedSource))
  const renderTime = getSeedValue(seedSource) * 1000

  return {
    setPic: async(src) => {
      palette = brightenCoverPalette(await extractPalette(src, seedSource))
    },
    draw: (canvas, timeOffset = 0) => {
      const ctx = canvas.getContext('2d', { alpha: false })
      if (!ctx) return
      renderFluidShader(ctx, fluid, canvas.width, canvas.height, palette, renderTime + timeOffset, style)
    },
  }
}

export default {
  name: 'DyiStyleVisual',
  setup() {
    const visualRef = ref(null)
    const canvasRef = ref(null)
    const palette = ref(getFallbackPalette())

    let canvasCtx = null
    let canvasWidth = 0
    let canvasHeight = 0
    let canvasDpr = 1
    let mounted = false
    let frameId = null
    let lastDrawTime = 0
    const fluid = {
      canvas: document.createElement('canvas'),
      ctx: null,
      imageData: null,
      grid: createFluidGrid(),
      noiseLookup: new Float32Array(NOISE_LOOKUP_SIZE),
    }
    fluid.canvas.width = FLUID_WIDTH
    fluid.canvas.height = FLUID_HEIGHT
    fluid.ctx = fluid.canvas.getContext('2d', { willReadFrequently: true })
    fluid.imageData = fluid.ctx.createImageData(FLUID_WIDTH, FLUID_HEIGHT)

    const coverPic = computed(() => musicInfo.pic ?? getMusicPic(playMusicInfo.musicInfo))
    const fallbackName = computed(() => musicInfo.name ?? getMusicName(playMusicInfo.musicInfo) ?? 'LX Music')
    const fallbackSinger = computed(() => musicInfo.singer ?? getMusicSinger(playMusicInfo.musicInfo) ?? '')
    const paletteSeed = computed(() => `${musicInfo.id ?? ''}-${fallbackName.value}-${fallbackSinger.value}`)
    const mainLyric = computed(() => {
      const text = typeof lyric?.text == 'string' ? lyric.text.trim() : ''
      return text || fallbackName.value || 'LX Music'
    })
    const subtitle = computed(() => {
      if (!fallbackName.value && !fallbackSinger.value) return 'LX Music'
      return `${fallbackName.value || 'LX Music'} - ${fallbackSinger.value || 'Unknown'}`
    })
    const lyricSize = computed(() => {
      const settingSize = clamp(Number(appSetting['playDetail.style.fontSize']) || 85, 40, 200)
      const fullscreenScale = isFullscreen.value ? 1 : 0.78
      return clamp(Math.round(settingSize * fullscreenScale), 40, 200)
    })
    const lyricFontFamily = computed(() => normalizePlayDetailFont(appSetting['playDetail.style.fontFamily']))
    const textStyle = computed(() => {
      const current = palette.value
      return {
        '--dyi-text': toRgb(current.text),
        '--dyi-lyric-size': `${lyricSize.value}px`,
        '--dyi-shadow-size': `${Math.round(lyricSize.value * 1.88)}px`,
        '--dyi-lyric-max-vw': isFullscreen.value ? '15vw' : '11.5vw',
        '--dyi-lyric-max-vh': isFullscreen.value ? '22vh' : '17vh',
        '--dyi-shadow-max-vw': isFullscreen.value ? '28vw' : '22vw',
        '--dyi-shadow-max-vh': isFullscreen.value ? '38vh' : '30vh',
        '--dyi-lyric-font': lyricFontFamily.value,
      }
    })

    const resizeCanvas = (force = false) => {
      const canvas = canvasRef.value
      const target = visualRef.value
      if (!canvas || !target) return false

      const rect = target.getBoundingClientRect()
      const nextWidth = Math.max(1, Math.round(rect.width))
      const nextHeight = Math.max(1, Math.round(rect.height))
      const nextDpr = Math.min(window.devicePixelRatio || 1, CANVAS_DPR_LIMIT)
      if (!force && nextWidth == canvasWidth && nextHeight == canvasHeight && nextDpr == canvasDpr) return false

      canvasWidth = nextWidth
      canvasHeight = nextHeight
      canvasDpr = nextDpr
      canvas.width = Math.round(canvasWidth * canvasDpr)
      canvas.height = Math.round(canvasHeight * canvasDpr)
      canvas.style.width = `${canvasWidth}px`
      canvas.style.height = `${canvasHeight}px`
      canvasCtx = canvas.getContext('2d', { alpha: false })
      return true
    }

    const drawBackground = (now = window.performance.now()) => {
      if (!canvasCtx || !canvasWidth || !canvasHeight) return

      const ctx = canvasCtx
      const current = palette.value
      const width = canvasWidth
      const height = canvasHeight

      ctx.setTransform(canvasDpr, 0, 0, canvasDpr, 0, 0)
      ctx.fillStyle = toRgb(current.background)
      ctx.fillRect(0, 0, width, height)
      renderFluidShader(ctx, fluid, width, height, current, now)
    }

    const drawNow = (forceResize = false) => {
      if (!mounted) return
      resizeCanvas(forceResize)
      drawBackground()
    }

    const renderFrame = now => {
      if (!mounted) return
      if (now - lastDrawTime >= FLUID_FRAME_INTERVAL) {
        resizeCanvas()
        drawBackground(now)
        lastDrawTime = now
      }
      frameId = window.requestAnimationFrame(renderFrame)
    }

    const setPaletteByPic = async pic => {
      const seed = paletteSeed.value
      const nextPalette = await extractPalette(pic, seed)
      if (pic !== coverPic.value) return
      palette.value = nextPalette
      drawNow(true)
    }

    const refreshPalette = () => {
      void setPaletteByPic(coverPic.value)
    }

    const handleResize = () => {
      if (resizeCanvas()) drawBackground()
    }

    watch(coverPic, pic => {
      void setPaletteByPic(pic)
    }, { immediate: true })

    watch(paletteSeed, () => {
      if (!coverPic.value) void setPaletteByPic(null)
    })

    onMounted(() => {
      mounted = true
      resizeCanvas()
      drawBackground()
      window.addEventListener('resize', handleResize)
      window.app_event.on('musicToggled', refreshPalette)
      window.app_event.on('picUpdated', refreshPalette)
      frameId = window.requestAnimationFrame(renderFrame)
      drawNow(true)
    })

    onBeforeUnmount(() => {
      mounted = false
      if (frameId) window.cancelAnimationFrame(frameId)
      frameId = null
      window.removeEventListener('resize', handleResize)
      window.app_event.off('musicToggled', refreshPalette)
      window.app_event.off('picUpdated', refreshPalette)
    })

    return {
      visualRef,
      canvasRef,
      mainLyric,
      subtitle,
      textStyle,
    }
  },
}
</script>

<style lang="less" module>
.visual {
  position: absolute;
  inset: 0;
  overflow: hidden;
  color: var(--dyi-text, rgb(242, 239, 244));
  background: #242231;
  pointer-events: none;
}

.canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.brand {
  position: absolute;
  left: 30px;
  top: 28px;
  z-index: 2;
  color: rgba(245, 250, 250, var(--pd-brand-opacity, .72));
  font-size: var(--pd-brand-size, 20px);
  line-height: 1;
  font-weight: 700;
  letter-spacing: 0;
  text-shadow: 0 2px 10px rgba(0, 0, 0, .24);
}

.lyricStage {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  flex-flow: column nowrap;
  align-items: center;
  justify-content: center;
  padding: 72px 10vw var(--pd-stage-bottom, 140px);
  text-align: center;
}

.shadowLyric {
  position: absolute;
  left: 50%;
  top: 49%;
  width: 76vw;
  transform: translate(-50%, -50%);
  color: rgba(255, 255, 255, .12);
  font-family: var(--dyi-lyric-font);
  font-size: min(var(--dyi-shadow-size), var(--dyi-shadow-max-vw), var(--dyi-shadow-max-vh));
  font-weight: 700;
  line-height: 1;
  opacity: .3;
  overflow-wrap: anywhere;
  text-shadow: 0 0 26px rgba(255, 255, 255, .18);
  transition: font-size .24s cubic-bezier(.22, .61, .36, 1);
}

.lyric {
  position: relative;
  z-index: 1;
  max-width: 1260px;
  color: rgba(255, 255, 255, .96);
  font-family: var(--dyi-lyric-font);
  font-size: min(var(--dyi-lyric-size), var(--dyi-lyric-max-vw), var(--dyi-lyric-max-vh));
  line-height: var(--pd-lyric-line-height, 1.24);
  font-weight: var(--pd-lyric-weight, 700);
  letter-spacing: 0;
  overflow-wrap: anywhere;
  text-shadow:
    0 3px 18px rgba(0, 0, 0, .36),
    0 0 34px rgba(255, 255, 255, .12);
  transition: font-size .24s cubic-bezier(.22, .61, .36, 1);
}

.subtitle {
  position: relative;
  z-index: 1;
  max-width: 720px;
  margin-top: 18px;
  color: rgba(255, 255, 255, .5);
  font-size: 15px;
  line-height: 1.4;
  opacity: var(--pd-subtitle-opacity, .72);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-shadow: 0 2px 10px rgba(0, 0, 0, .22);
}

@media screen and (max-width: 980px) {
  .subtitle {
    display: none;
  }
}

@media screen and (max-height: 650px) {
  .lyricStage {
    padding-bottom: 104px;
  }
}
</style>
