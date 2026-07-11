<template lang="pug">
dt#play_detail {{ $t('setting__play_detail') }}
dd
  .gap-top
    base-checkbox(id="setting_play_detail_font_zoom_enable" :model-value="appSetting['playDetail.isZoomActiveLrc']" :label="$t('setting__play_detail_font_zoom')" @update:model-value="updateSetting({'playDetail.isZoomActiveLrc': $event})")
  .gap-top
    base-checkbox(id="setting_play_detail_lyric_delayScroll" :model-value="appSetting['playDetail.isDelayScroll']" :label="$t('setting__play_detail_lyric_delay_scroll')" @update:model-value="updateSetting({ 'playDetail.isDelayScroll': $event })")
  .gap-top
    base-checkbox(id="setting_play_detail_lyric_progress_enable" :model-value="appSetting['playDetail.isShowLyricProgressSetting']" :label="$t('setting__play_detail_lyric_progress')" @update:model-value="updateSetting({'playDetail.isShowLyricProgressSetting': $event})")

dd
  h3#play_detail_font_size {{ $t('setting__play_detail_font_size_current', { size: appSetting['playDetail.style.fontSize'] }) }}
  .font-size-row
    base-input.font-size-input(type="number" :model-value="fontSizeInput" :trim="false" @update:model-value="fontSizeInput = $event" @change="commitFontSize" @submit="commitFontSize")
    base-btn.btn(min @click="changeFontSize(-5)") -
    base-btn.btn(min @click="changeFontSize(5)") +
    base-btn.btn(min @click="commitFontSize(fontSizeInput)") {{ $t('btn_confirm') }}
    base-btn.btn(min @click="resetFontSize") {{ $t('setting__play_detail_font_size_reset') }}

dd
  h3#play_detail_font_family {{ $t('setting__play_detail_font_family') }}
  div
    base-selection.gap-left(:list="fontList" :model-value="currentFontFamily" item-key="id" item-name="label" @update:model-value="setFontFamily")

dd
  h3#play_detail_align {{ $t('setting__play_detail_align') }}
  div
    base-checkbox.gap-left(id="setting_play_detail_align_left" :model-value="appSetting['playDetail.style.align']" need value="left" :label="$t('setting__play_detail_align_left')" @update:model-value="updateSetting({ 'playDetail.style.align': $event })")
    base-checkbox.gap-left(id="setting_play_detail_align_center" :model-value="appSetting['playDetail.style.align']" need value="center" :label="$t('setting__play_detail_align_center')" @update:model-value="updateSetting({ 'playDetail.style.align': $event })")
    base-checkbox.gap-left(id="setting_play_detail_align_right" :model-value="appSetting['playDetail.style.align']" need value="right" :label="$t('setting__play_detail_align_right')" @update:model-value="updateSetting({ 'playDetail.style.align': $event })")

</template>

<script>
// import { ref, onBeforeUnmount } from '@common/utils/vueTools'
import { ref, computed, watch } from '@common/utils/vueTools'
import { appSetting, setPlayDetailLyricFont, updateSetting } from '@renderer/store/setting'
import { getSystemFonts } from '@renderer/utils/ipc'
import { useI18n } from '@renderer/plugins/i18n'
import { createPlayDetailFontList, normalizePlayDetailFont } from '@renderer/utils/playDetailFonts'

const FONT_SIZE_MIN = 40
const FONT_SIZE_MAX = 200
const FONT_SIZE_DEFAULT = 85

const normalizeFontSize = size => {
  const value = Number.parseInt(size, 10)
  if (Number.isNaN(value)) return FONT_SIZE_DEFAULT
  return Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, value))
}

export default {
  name: 'SettingPlayDetail',
  setup() {
    const t = useI18n()
    const systemFontList = ref([])
    const fontSizeInput = ref(String(appSetting['playDetail.style.fontSize'] || FONT_SIZE_DEFAULT))
    const fontList = computed(() => createPlayDetailFontList(t, systemFontList.value))
    const currentFontFamily = computed(() => normalizePlayDetailFont(appSetting['playDetail.style.fontFamily']))

    void getSystemFonts().then(fonts => {
      systemFontList.value = fonts
    })

    watch(() => appSetting['playDetail.style.fontSize'], size => {
      fontSizeInput.value = String(size || FONT_SIZE_DEFAULT)
    })

    const commitFontSize = size => {
      const nextSize = normalizeFontSize(size)
      fontSizeInput.value = String(nextSize)
      setPlayDetailLyricFont(nextSize)
    }
    const changeFontSize = step => {
      commitFontSize(appSetting['playDetail.style.fontSize'] + step)
    }
    const resetFontSize = () => {
      commitFontSize(FONT_SIZE_DEFAULT)
    }
    const setFontFamily = font => {
      updateSetting({ 'playDetail.style.fontFamily': font })
    }

    return {
      appSetting,
      updateSetting,
      fontSizeInput,
      commitFontSize,
      changeFontSize,
      resetFontSize,
      fontList,
      currentFontFamily,
      setFontFamily,
    }
  },
}
</script>

<style lang="less" scoped>
.font-size-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.font-size-input {
  width: 72px;
}

</style>
