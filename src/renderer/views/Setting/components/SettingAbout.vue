<template lang="pug">
dt#about {{ $t('setting__about') }}
dd
  .p.small
    strong 修改版说明：
    | 本软件是在&nbsp;
    span.hover.underline(:aria-label="$t('setting__click_open')" @click="openUrl('https://github.com/lyswhut/lx-music-desktop')") LX Music（洛雪音乐助手）
    | &nbsp;开源项目基础上修改的非官方版本，不代表原项目官方立场。
  .p.small
    | 播放器背景算法参考了&nbsp;
    span.hover.underline(:aria-label="$t('setting__click_open')" @click="openUrl('https://github.com/jayfunc/BetterLyrics')") jayfunc/BetterLyrics
    | ，感谢两个项目的作者及贡献者。
  br
  .p.small
    | 本软件完全免费，代码已开源。开源地址：
    span.hover.underline(:aria-label="$t('setting__click_open')" @click="openUrl('https://github.com/Noble6cs/LumaTune#readme')") https://github.com/Noble6cs/LumaTune
  .p.small
    | 最新版下载地址：
    span.hover.underline(:aria-label="$t('setting__click_open')" @click="openUrl('https://github.com/Noble6cs/LumaTune/releases')") GitHub Releases
  .p.small
    | 软件的常见问题可转至：
    span.hover.underline(:aria-label="$t('setting__click_open')" @click="openUrl('https://lyswhut.github.io/lx-music-doc/desktop/faq')") 桌面版常见问题
  .p.small
    strong 本软件没有客服
    | ，但我们整理了一些常见的使用问题。
    strong 仔细、仔细、仔细
    | 地阅读常见问题后，
  .p.small
    | 仍有问题可到&nbsp;GitHub&nbsp;
    span.hover.underline(:aria-label="$t('setting__click_open')" @click="openUrl('https://github.com/Noble6cs/LumaTune/issues?q=is%3Aissue+')") 提交&nbsp;Issue
    | 。
  br
  .p.small 由于软件开发的初衷仅是为了对新技术的学习与研究，因此软件直至停止维护都将会一直保持纯净。
  .p.small
    | 上游 LX Music 项目的原始发布地址
    strong 只有&nbsp;GitHub
    | 。本修改版不是 LX Music 官方发布版本，请注意区分。
  .p.small
    strong 本项目没有微信公众号之类的所谓「官方账号」，谨防被骗！

  .p.small
    | 你已签署本软件的
    base-btn(min @click="handleShowPact") 许可协议
    | ，协议的在线版本在
    strong.hover.underline(:aria-label="$t('setting__click_open')" @click="openUrl('https://github.com/Noble6cs/LumaTune#readme')") 这里
    | 。
  br

  .p.small
    | By:&nbsp;
    strong 落雪无痕
</template>

<script>
// import { ref, onBeforeUnmount } from '@common/utils/vueTools'
import { isShowPact } from '@renderer/store'
import { openUrl, clipboardWriteText } from '@common/utils/electron'

export default {
  name: 'SettingAbout',
  setup() {
    const handleShowPact = () => {
      isShowPact.value = true
    }
    return {
      openUrl,
      clipboardWriteText,
      handleShowPact,
    }
  },
}
</script>
