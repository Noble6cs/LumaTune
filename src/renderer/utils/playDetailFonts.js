export const fallbackPlayDetailFont = '"Microsoft YaHei", "PingFang SC", Arial, sans-serif'
export const artPlayDetailFont = '"STXingkai", "KaiTi", "Kaiti SC", "FZYaoti", SimSun, serif'

export const playDetailFontAliases = {
  normal: fallbackPlayDetailFont,
  serif: 'SimSun, "Songti SC", "STSong", serif',
  art: artPlayDetailFont,
}

export const presetPlayDetailFonts = [
  { id: playDetailFontAliases.normal, labelKey: 'setting__play_detail_font_common_yahei' },
  { id: 'SimHei, "Microsoft YaHei", sans-serif', labelKey: 'setting__play_detail_font_common_simhei' },
  { id: playDetailFontAliases.serif, labelKey: 'setting__play_detail_font_common_simsun' },
  { id: 'KaiTi, "Kaiti SC", STKaiti, serif', labelKey: 'setting__play_detail_font_common_kaiti' },
  { id: 'FangSong, STFangsong, serif', labelKey: 'setting__play_detail_font_common_fangsong' },
  { id: 'DengXian, "Microsoft YaHei", sans-serif', labelKey: 'setting__play_detail_font_common_dengxian' },
  { id: artPlayDetailFont, labelKey: 'setting__play_detail_font_art_xingkai' },
  { id: 'STXinwei, "KaiTi", serif', labelKey: 'setting__play_detail_font_art_xinwei' },
  { id: 'STCaiyun, "Microsoft YaHei", sans-serif', labelKey: 'setting__play_detail_font_art_caiyun' },
  { id: 'FZYaoti, YouYuan, "Microsoft YaHei", sans-serif', labelKey: 'setting__play_detail_font_art_yaoti' },
  { id: 'FZShuTi, KaiTi, serif', labelKey: 'setting__play_detail_font_art_shuti' },
  { id: 'YouYuan, "Microsoft YaHei", sans-serif', labelKey: 'setting__play_detail_font_art_youyuan' },
  { id: 'LiSu, SimHei, serif', labelKey: 'setting__play_detail_font_art_lisu' },
]

export const normalizePlayDetailFont = font => {
  if (!font) return fallbackPlayDetailFont
  return playDetailFontAliases[font] || font
}

export const createPlayDetailFontList = (t, systemFonts = []) => {
  const usedFonts = new Set()
  const list = presetPlayDetailFonts.map(font => {
    usedFonts.add(font.id)
    return {
      id: font.id,
      label: t(font.labelKey),
    }
  })

  for (const font of systemFonts) {
    if (usedFonts.has(font)) continue
    usedFonts.add(font)
    list.push({
      id: font,
      label: font.replace(/(^"|"$)/g, ''),
    })
  }

  return list
}
