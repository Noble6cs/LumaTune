<template>
  <article ref="cardRef" :class="[$style.card, { [$style.active]: active }]">
    <div
      :class="[$style.cover, { [$style.favorite]: favorite }]" role="button" tabindex="0"
      :aria-label="name" @click="$emit('open')" @keydown.enter.prevent="$emit('open')" @keydown.space.prevent="$emit('open')"
      @mouseenter="handleMouseEnter" @mouseleave="handleMouseLeave"
    >
      <canvas ref="canvasRef" width="1" height="1" />
      <span :class="$style.brand">
        <svg-icon v-if="favorite" name="love" />
        LX Music
      </span>
      <button
        :class="$style.playBtn" :aria-label="$t('list__play')" :disabled="!hasMusic"
        @click.stop="$emit('play')"
      >
        <svg-icon name="play-outline" />
      </button>
    </div>
    <div :class="$style.name" :title="name">{{ name }}</div>
  </article>
</template>

<script>
import { onBeforeUnmount, onMounted, ref, watch } from '@common/utils/vueTools'
import { getPicPath } from '@renderer/core/music'
import { createFluidCoverRenderer } from '@renderer/components/layout/PlayDetail/DyiStyleVisual.vue'

const FAVORITE_MIN_REVEAL = 1 / 3
const FAVORITE_EXPAND_DURATION = 1900
const FAVORITE_CONTRACT_DURATION = 1600
const FAVORITE_COLLAPSED_HOLD_DURATION = 1800
const getFavoriteExpandedHoldDuration = () => 30000 + Math.random() * 30000
const easeInOut = value => value * value * (3 - 2 * value)

const drawFavoriteCover = (canvas, animationTime, reveal) => {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const width = canvas.width
  const height = canvas.height
  const centerY = height / 2
  const time = animationTime / 1000
  const backgroundShift = Math.sin(time * 0.42) * 0.045

  const background = ctx.createLinearGradient(0, 0, width, height * 0.12)
  background.addColorStop(0, '#ff6546')
  background.addColorStop(0.38 + backgroundShift, '#ff3f8c')
  background.addColorStop(1, '#f3133f')
  ctx.fillStyle = background
  ctx.fillRect(0, 0, width, height)

  const layers = [
    { tip: 334, notch: 66, phase: 0.1, colors: ['#ff174d', '#f52a5a', '#ff427d'] },
    { tip: 244, notch: 118, phase: 1.15, colors: ['#ff315e', '#ff4c7b', '#ff5b91'] },
    { tip: 164, notch: 82, phase: 2.05, colors: ['#ff4e57', '#ff6a69', '#ff7784'] },
    { tip: 92, notch: 55, phase: 2.8, colors: ['#ff9c31', '#ff7040', '#ff5154'] },
  ]

  for (const [index, layer] of layers.entries()) {
    const layerStart = index * 0.045
    const staggeredReveal = easeInOut(Math.max(0, Math.min(1, (reveal - layerStart) / (1 - layerStart))))
    const layerReveal = Math.max(FAVORITE_MIN_REVEAL, staggeredReveal)
    const wave = Math.sin(time * 0.86 + layer.phase)
    const counterWave = Math.sin(time * 0.56 + layer.phase * 1.4)
    const tipX = 3 + (layer.tip + wave * 8) * layerReveal
    const notchX = 1.5 + (layer.notch + counterWave * 5) * layerReveal
    const middleOffset = Math.sin(time * 0.7 + layer.phase) * 3.5 * layerReveal
    const fill = ctx.createLinearGradient(0, 0, Math.max(tipX, 1), centerY)
    fill.addColorStop(0, layer.colors[0])
    fill.addColorStop(0.55, layer.colors[1])
    fill.addColorStop(1, layer.colors[2])

    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(tipX, centerY + middleOffset)
    ctx.lineTo(0, height)
    ctx.lineTo(notchX, centerY - middleOffset * 0.55)
    ctx.closePath()
    ctx.fillStyle = fill
    ctx.fill()
  }

  const sweepX = ((time * 52) % (width + 180)) - 90
  const sweep = ctx.createLinearGradient(sweepX - 70, 0, sweepX + 70, 0)
  sweep.addColorStop(0, 'rgba(255, 255, 255, 0)')
  sweep.addColorStop(0.5, 'rgba(255, 255, 255, 0.14)')
  sweep.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = sweep
  ctx.fillRect(0, 0, width, height)

  const shade = ctx.createLinearGradient(0, 0, 0, height)
  shade.addColorStop(0, 'rgba(255, 255, 255, 0.08)')
  shade.addColorStop(0.58, 'rgba(255, 255, 255, 0)')
  shade.addColorStop(1, 'rgba(112, 0, 38, 0.12)')
  ctx.fillStyle = shade
  ctx.fillRect(0, 0, width, height)
}

export default {
  name: 'AllMusicPlaylistCard',
  props: {
    listId: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    musicInfo: {
      type: Object,
      default: null,
    },
    hasMusic: Boolean,
    favorite: Boolean,
    active: Boolean,
  },
  emits: ['open', 'play'],
  setup(props) {
    const cardRef = ref(null)
    const canvasRef = ref(null)
    const isHovered = ref(false)
    const renderer = createFluidCoverRenderer(`${props.listId}-${props.name}`)

    let observer = null
    let loadToken = 0
    let isPicLoaded = false
    let isVisible = false
    let frameId = null
    let lastFrameTime = 0
    let lastDrawTime = 0
    let animationTime = 0
    let favoriteReveal = FAVORITE_MIN_REVEAL
    let favoritePhase = 'expanding'
    let favoritePhaseTime = 0
    let favoriteTransitionFrom = FAVORITE_MIN_REVEAL
    let favoriteExpandedHoldDuration = getFavoriteExpandedHoldDuration()
    let favoriteExpandAfterContract = false

    const startFavoriteTransition = phase => {
      favoritePhase = phase
      favoritePhaseTime = 0
      favoriteTransitionFrom = favoriteReveal
    }

    const updateFavoriteAnimation = elapsed => {
      favoritePhaseTime += elapsed
      if (favoritePhase == 'holding') {
        if (favoritePhaseTime >= favoriteExpandedHoldDuration) {
          favoriteExpandAfterContract = false
          startFavoriteTransition('contracting')
        }
        return
      }
      if (favoritePhase == 'collapsed') {
        if (favoritePhaseTime >= FAVORITE_COLLAPSED_HOLD_DURATION) startFavoriteTransition('expanding')
        return
      }

      const isExpanding = favoritePhase == 'expanding'
      const duration = isExpanding ? FAVORITE_EXPAND_DURATION : FAVORITE_CONTRACT_DURATION
      const target = isExpanding ? 1 : FAVORITE_MIN_REVEAL
      const progress = Math.min(1, favoritePhaseTime / duration)
      favoriteReveal = favoriteTransitionFrom + (target - favoriteTransitionFrom) * easeInOut(progress)
      if (progress < 1) return

      favoriteReveal = target
      favoritePhaseTime = 0
      if (isExpanding) {
        favoritePhase = 'holding'
        favoriteExpandedHoldDuration = getFavoriteExpandedHoldDuration()
      } else if (favoriteExpandAfterContract) {
        favoriteExpandAfterContract = false
        startFavoriteTransition('expanding')
      } else {
        favoritePhase = 'collapsed'
      }
    }

    const handleMouseEnter = () => {
      isHovered.value = true
      if (!props.favorite) return
      if (favoritePhase == 'holding') {
        favoriteExpandAfterContract = true
        startFavoriteTransition('contracting')
      } else if (favoritePhase == 'contracting' || favoritePhase == 'collapsed') {
        favoriteExpandAfterContract = false
        startFavoriteTransition('expanding')
      }
    }

    const handleMouseLeave = () => {
      isHovered.value = false
    }

    const drawCover = () => {
      const canvas = canvasRef.value
      if (!canvas) return
      if (canvas.width != 320 || canvas.height != 320) {
        canvas.width = 320
        canvas.height = 320
      }
      if (props.favorite) drawFavoriteCover(canvas, animationTime, favoriteReveal)
      else renderer.draw(canvas, animationTime)
    }

    const renderFrame = now => {
      if (!isVisible) return
      if (!lastFrameTime) lastFrameTime = now
      const elapsed = Math.min(now - lastFrameTime, 80)
      lastFrameTime = now
      if (props.favorite) {
        updateFavoriteAnimation(elapsed)
        animationTime += elapsed * 0.64
      } else {
        animationTime += elapsed * (isHovered.value ? 2.2 : 0.64)
      }
      const interval = props.favorite ? 72 : (isHovered.value ? 52 : 140)
      if (now - lastDrawTime >= interval) {
        drawCover()
        lastDrawTime = now
      }
      frameId = window.requestAnimationFrame(renderFrame)
    }

    const startAnimation = () => {
      if (frameId != null) return
      lastFrameTime = 0
      frameId = window.requestAnimationFrame(renderFrame)
    }

    const stopAnimation = () => {
      if (frameId != null) window.cancelAnimationFrame(frameId)
      frameId = null
    }

    const loadPic = async() => {
      if (props.favorite || !props.musicInfo) return
      const token = ++loadToken
      try {
        const url = await getPicPath({ musicInfo: props.musicInfo, listId: props.listId })
        if (token != loadToken) return
        await renderer.setPic(url || null)
        if (token == loadToken) {
          isPicLoaded = true
          drawCover()
        }
      } catch {}
    }

    const setVisible = visible => {
      isVisible = visible
      if (visible) {
        drawCover()
        startAnimation()
        if (!isPicLoaded) void loadPic()
      } else {
        loadToken++
        stopAnimation()
        if (canvasRef.value) {
          canvasRef.value.width = 1
          canvasRef.value.height = 1
        }
      }
    }

    watch(() => props.musicInfo?.id, () => {
      loadToken++
      isPicLoaded = false
      if (isVisible) void loadPic()
    })

    onMounted(() => {
      if (!('IntersectionObserver' in window)) {
        setVisible(true)
        return
      }
      observer = new IntersectionObserver(entries => {
        setVisible(entries.some(entry => entry.isIntersecting))
      }, { rootMargin: '240px' })
      observer.observe(cardRef.value)
    })

    onBeforeUnmount(() => {
      loadToken++
      stopAnimation()
      observer?.disconnect()
    })

    return {
      cardRef,
      canvasRef,
      isHovered,
      handleMouseEnter,
      handleMouseLeave,
    }
  },
}
</script>

<style lang="less" module>
.card {
  min-width: 0;
  color: var(--color-font);
}
.cover {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: 6px;
  background-color: var(--color-primary-background-hover);
  box-shadow: 0 2px 8px rgba(0, 0, 0, .14);
  cursor: pointer;

  canvas {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
  }
  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
}
.brand {
  position: absolute;
  top: 10px;
  right: 11px;
  color: rgba(255, 255, 255, .9);
  font-size: 11px;
  line-height: 1;
  text-shadow: 0 1px 4px rgba(0, 0, 0, .25);
  pointer-events: none;

  svg {
    width: 11px;
    height: 11px;
    margin-right: 3px;
    vertical-align: -1px;
  }
}
.favorite {
  background: #f3133f;
}
.playBtn {
  position: absolute;
  right: 10px;
  bottom: 10px;
  display: flex;
  width: 38px;
  height: 38px;
  padding: 9px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 50%;
  color: #fff;
  background: rgba(28, 28, 30, .66);
  box-shadow: 0 2px 8px rgba(0, 0, 0, .24);
  cursor: pointer;
  opacity: 0;
  transform: translateY(4px);
  transition: opacity .2s ease, transform .2s ease, background-color .2s ease;

  svg {
    width: 100%;
    height: 100%;
  }
  &:hover {
    background: rgba(28, 28, 30, .84);
  }
  &:disabled {
    cursor: default;
    background: rgba(28, 28, 30, .48);
  }
}
.cover:hover .playBtn, .cover:focus-within .playBtn, .playBtn:focus-visible {
  opacity: 1;
  transform: translateY(0);
}
.active .cover {
  box-shadow: 0 0 0 2px var(--color-primary), 0 2px 8px rgba(0, 0, 0, .14);
}
.name {
  margin-top: 9px;
  overflow: hidden;
  color: var(--color-font);
  font-size: 14px;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
