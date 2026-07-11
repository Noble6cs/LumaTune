<template lang="pug">
transition(name="play-detail-float" @after-enter="handleAfterEnter" @after-leave="handleAfterLeave")
  div(v-if="isShowPlayerDetail" :class="[$style.container, { fullscreen: isFullscreen }]" @contextmenu="handleContextMenu")
    DyiStyleVisual(:class="$style.visual")
    ControlBtnsLeftHeader(v-if="appSetting['common.controlBtnPosition'] == 'left'")
    ControlBtnsRightHeader(v-else)
    div(v-if="isShowPlayComment" :class="[$style.main, $style.showComment]")
      div.left(:class="$style.left")
        //- div(:class="$style.info")
        div(:class="$style.info")
          img(v-if="musicInfo.pic" :class="$style.img" :src="musicInfo.pic")
          div.description(:class="['scroll', $style.description]")
            p {{ $t('player__music_name') }}{{ musicInfo.name }}
            p {{ $t('player__music_singer') }}{{ musicInfo.singer }}
            p(v-if="musicInfo.album") {{ $t('player__music_album') }}{{ musicInfo.album }}

      transition(enter-active-class="animated fadeIn" leave-active-class="animated fadeOut")
        LyricPlayer(v-if="visibled")
      music-comment(v-if="visibled" :class="$style.comment" :show="isShowPlayComment" :music-info="playMusicInfo.musicInfo" @close="hideComment")
    transition(enter-active-class="animated fadeIn" leave-active-class="animated fadeOut")
      div(v-if="visibled" :class="[$style.playBarHotArea, { [$style.showPlayBar]: isPlayBarVisible || isShowPlayComment }]" @mouseenter="showPlayBar" @mouseleave="hidePlayBar")
        play-bar(:class="$style.playBar")
    transition(enter-active-class="animated-slow fadeIn" leave-active-class="animated-slow fadeOut")
      common-audio-visualizer(v-if="appSetting['player.audioVisualization'] && visibled")
</template>


<script>
import { onBeforeUnmount, onMounted, ref, watch } from '@common/utils/vueTools'
import { isFullscreen } from '@renderer/store'
import {
  isShowPlayerDetail,
  isShowPlayComment,
  musicInfo,
  playMusicInfo,
} from '@renderer/store/player/state'
import {
  setShowPlayerDetail,
  setShowPlayComment,
  setShowPlayLrcSelectContentLrc,
} from '@renderer/store/player/action'
import LyricPlayer from './LyricPlayer.vue'
import PlayBar from './PlayBar.vue'
import MusicComment from './components/MusicComment/index.vue'
import ControlBtnsLeftHeader from './ControlBtnsLeftHeader.vue'
import ControlBtnsRightHeader from './ControlBtnsRightHeader.vue'
import DyiStyleVisual from './DyiStyleVisual.vue'
import { registerAutoHideMounse, unregisterAutoHideMounse } from './autoHideMounse'
import { appSetting } from '@renderer/store/setting'
import { playNext, playPrev, togglePlay } from '@renderer/core/player'

const DOUBLE_ARROW_INTERVAL = 420

const isEditableTarget = target => {
  if (!(target instanceof HTMLElement)) return false
  return ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable
}

export default {
  name: 'CorePlayDetail',
  components: {
    ControlBtnsLeftHeader,
    ControlBtnsRightHeader,
    LyricPlayer,
    PlayBar,
    MusicComment,
    DyiStyleVisual,
  },
  setup() {
    const visibled = ref(false)
    const isPlayBarVisible = ref(false)

    let clickTime = 0
    let lastArrowKey = ''
    let lastArrowTime = 0

    const handlePlaybackKeyDown = event => {
      if (!document.hasFocus() || event.repeat || event.ctrlKey || event.altKey || event.metaKey || isEditableTarget(event.target)) return

      if (event.code == 'Space') {
        event.preventDefault()
        event.stopPropagation()
        event.lx_handled = true
        togglePlay()
        return
      }
      if (event.key != 'ArrowLeft' && event.key != 'ArrowRight') return

      event.preventDefault()
      event.stopPropagation()
      event.lx_handled = true
      const now = window.performance.now()
      if (lastArrowKey == event.key && now - lastArrowTime <= DOUBLE_ARROW_INTERVAL) {
        lastArrowKey = ''
        lastArrowTime = 0
        if (event.key == 'ArrowLeft') void playPrev()
        else void playNext()
        return
      }
      lastArrowKey = event.key
      lastArrowTime = now
    }

    const resetArrowSequence = () => {
      lastArrowKey = ''
      lastArrowTime = 0
    }

    const hide = () => {
      setShowPlayerDetail(false)
    }
    const handleContextMenu = () => {
      if (window.performance.now() - clickTime > 400) {
        clickTime = window.performance.now()
        return
      }
      clickTime = 0
      hide()
    }

    const hideComment = () => {
      setShowPlayComment(false)
    }

    const handleAfterEnter = () => {
      if (isFullscreen.value) registerAutoHideMounse()

      isPlayBarVisible.value = false
      visibled.value = true
    }

    const handleAfterLeave = () => {
      setShowPlayLrcSelectContentLrc(false)
      hideComment(false)
      visibled.value = false

      unregisterAutoHideMounse()
      resetArrowSequence()
    }

    onMounted(() => {
      window.addEventListener('keydown', handlePlaybackKeyDown, true)
      window.addEventListener('blur', resetArrowSequence)
    })

    onBeforeUnmount(() => {
      window.removeEventListener('keydown', handlePlaybackKeyDown, true)
      window.removeEventListener('blur', resetArrowSequence)
    })

    watch(isFullscreen, isFullscreen => {
      (isFullscreen ? registerAutoHideMounse : unregisterAutoHideMounse)()
    })

    watch(isShowPlayComment, visible => {
      isPlayBarVisible.value = visible
    })

    const showPlayBar = () => {
      isPlayBarVisible.value = true
    }
    const hidePlayBar = () => {
      if (isShowPlayComment.value) return
      isPlayBarVisible.value = false
    }


    return {
      appSetting,
      playMusicInfo,
      isShowPlayerDetail,
      isShowPlayComment,
      musicInfo,
      hide,
      handleContextMenu,
      hideComment,
      handleAfterEnter,
      handleAfterLeave,
      visibled,
      isPlayBarVisible,
      showPlayBar,
      hidePlayBar,
      isFullscreen,
    }
  },
}
</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

@control-btn-width: @height-toolbar * .26;

.container {
  position: absolute;
  display: flex;
  flex-flow: column nowrap;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  background:
    radial-gradient(circle at 50% 28%, rgba(35, 211, 240, .14), transparent 45%),
    linear-gradient(180deg, #041819 0%, #102b2e 48%, #071315 100%);
  z-index: 10;
  // -webkit-app-region: drag;
  overflow: hidden;
  border-radius: @radius-border;
  color: var(--color-font);
  // border-left: 12px solid var(--color-primary-alpha-900);
  -webkit-app-region: no-drag;
  contain: layout paint;

  box-sizing: border-box;

  * {
    box-sizing: border-box;
  }
}
.visual {
  position: absolute;
  inset: 0;
  z-index: 0;
}

.main {
  flex: auto;
  min-height: 0;
  overflow: hidden;
  display: flex;
  margin: 0 30px;
  position: relative;
  z-index: 1;

  &.showComment {
    :global {
      .left {
        flex-basis: 18%;
        .description p {
          font-size: 12px;
        }
      }
      .right {
        flex-basis: 30%;
        .lyricSelectContent {
          font-size: 14px;
        }
      }
      .comment {
        opacity: 1;
        transform: scaleX(1);
      }
    }
  }
}
.left {
  flex: 0 0 40%;
  display: flex;
  flex-flow: column nowrap;
  align-items: center;
  padding: 13px;
  overflow: hidden;
  transition: flex-basis @transition-normal;
}

.info {
  display: flex;
  flex-flow: column nowrap;
  justify-content: flex-start;
  max-width: 300px;
  min-height: 0;
}
.img {
  max-width: 100%;
  max-height: 80%;
  min-width: 100%;
  box-shadow: 0 0 6px var(--color-primary-alpha-500);
  border-radius: 6px;
  opacity: .8;
}
.description {
  max-width: 300px;
  margin-top: 15px;
  padding-bottom: 15px;
  min-height: 0;
  p {
    line-height: 1.5;
    font-size: 14px;
    overflow-wrap: break-word;
  }
}


.comment {
  position: absolute;
  right: 0;
  top: 0;
  width: 50%;
  height: 100%;
  opacity: 1;
  margin-left: 10px;
  transform: scaleX(0);
}

.playBarHotArea {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 150px;
  z-index: 4;
  display: flex;
  align-items: flex-end;
  -webkit-app-region: no-drag;
  pointer-events: auto;
}
.showPlayBar {
  .playBar {
    opacity: 1;
    transform: translate3d(0, -24px, 0) scale(1);
  }
}
.playBar {
  position: relative;
  width: min(66.666vw, 980px);
  height: 72px;
  margin: 0 auto;
  flex: none;
  color: rgba(255, 255, 255, .92);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, .07), rgba(255, 255, 255, 0) 42%),
    rgba(8, 12, 18, .08);
  backdrop-filter: blur(12px) saturate(1.12);
  border: 1px solid rgba(255, 255, 255, .16);
  border-radius: 14px;
  box-shadow:
    0 14px 38px rgba(0, 0, 0, .22),
    inset 0 1px 0 rgba(255, 255, 255, .22),
    inset 0 -1px 0 rgba(255, 255, 255, .04);
  opacity: 0;
  overflow: hidden;
  transform: translate3d(0, 132%, 0) scale(.972);
  transform-origin: center bottom;
  will-change: transform, opacity;
  transition:
    opacity .28s ease-out,
    transform .46s cubic-bezier(.16, 1, .3, 1);

  &::before,
  &::after {
    position: absolute;
    inset: 0;
    content: '';
    border-radius: inherit;
    pointer-events: none;
  }

  &::before {
    padding: 1px;
    background:
      linear-gradient(112deg, rgba(255, 255, 255, .44), rgba(255, 255, 255, .08) 32%, rgba(255, 255, 255, .02) 58%, rgba(255, 255, 255, .28)),
      linear-gradient(90deg, rgba(255, 255, 255, .04), rgba(255, 255, 255, .2), rgba(255, 255, 255, .04));
    -webkit-mask:
      linear-gradient(#000 0 0) content-box,
      linear-gradient(#000 0 0);
    -webkit-mask-composite: xor;
    opacity: .68;
  }

  &::after {
    background:
      radial-gradient(ellipse at 18% 0, rgba(255, 255, 255, .16), transparent 34%),
      radial-gradient(ellipse at 82% 100%, rgba(255, 255, 255, .08), transparent 38%),
      linear-gradient(180deg, rgba(255, 255, 255, .035), rgba(255, 255, 255, 0));
    opacity: .62;
  }
}

:global {
  .play-detail-float-enter-active {
    transition:
      opacity .46s ease-out,
      transform .46s cubic-bezier(.16, 1, .3, 1);
    transform-origin: center bottom;
    will-change: transform, opacity;
  }

  .play-detail-float-leave-active {
    transition:
      opacity .28s ease-in,
      transform .28s cubic-bezier(.7, 0, .84, 0);
    transform-origin: center bottom;
    will-change: transform, opacity;
  }

  .play-detail-float-enter-from {
    opacity: 0;
    transform: translate3d(0, 100%, 0) scale(.985);
  }

  .play-detail-float-enter-to {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
  }

  .play-detail-float-leave-from {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
  }

  .play-detail-float-leave-to {
    opacity: 0;
    transform: translate3d(0, 100%, 0) scale(.985);
  }
}


</style>
