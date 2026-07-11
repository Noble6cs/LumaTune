<template>
  <section :class="$style.container">
    <header :class="$style.header">
      <h2>{{ $t('list__name_all') }}</h2>
      <span>{{ sortedEntries.length }}</span>
    </header>
    <div v-if="sortedEntries.length" class="scroll" :class="$style.content">
      <div :class="$style.grid">
        <PlaylistCard
          v-for="entry in sortedEntries" :key="entry.id"
          :list-id="entry.id" :name="entry.name" :music-info="entry.coverMusic"
          :has-music="entry.list.length > 0" :favorite="entry.isFavorite"
          :active="playMusicInfo.listId == entry.id"
          @open="handleOpen(entry)" @play="handlePlay(entry)"
        />
      </div>
    </div>
    <div v-else :class="$style.empty">
      <p>{{ $t(isLoading ? 'list__loading' : 'no_item') }}</p>
    </div>
  </section>
</template>

<script>
import { computed, onBeforeUnmount, onMounted, ref } from '@common/utils/vueTools'
import { LIST_IDS } from '@common/constants'
import { getListMusics } from '@renderer/store/list/action'
import { defaultList, loveList, userLists } from '@renderer/store/list/state'
import { playMusicInfo } from '@renderer/store/player/state'
import { initRecentPlayListRecords, recentPlayListRecords } from '@renderer/store/player/recentPlay'
import { playList } from '@renderer/core/player'
import { useRouter } from '@common/utils/vueRouter'
import { useI18n } from '@renderer/plugins/i18n'
import PlaylistCard from './PlaylistCard.vue'

export default {
  name: 'AllMusic',
  components: {
    PlaylistCard,
  },
  setup() {
    const router = useRouter()
    const t = useI18n()
    const entries = ref([])
    const isLoading = ref(true)
    let refreshToken = 0

    const sortedEntries = computed(() => {
      const recentOrder = new Map(recentPlayListRecords.map((record, index) => [record.listId, index]))
      const recentMusic = new Map(recentPlayListRecords.map(record => [record.listId, record.musicId]))
      return entries.value.map(entry => {
        const musicId = recentMusic.get(entry.id)
        return {
          ...entry,
          coverMusic: entry.list.find(musicInfo => musicInfo.id == musicId) ?? entry.list[0] ?? null,
        }
      }).sort((a, b) => {
        const aOrder = recentOrder.get(a.id)
        const bOrder = recentOrder.get(b.id)
        if (aOrder == null && bOrder == null) return a.order - b.order
        if (aOrder == null) return 1
        if (bOrder == null) return -1
        return aOrder - bOrder
      })
    })

    const refresh = async() => {
      const token = ++refreshToken
      isLoading.value = true
      const listInfos = [
        { id: LIST_IDS.LOVE, name: t(loveList.name), isFavorite: true },
        { id: LIST_IDS.DEFAULT, name: t(defaultList.name) },
        ...userLists.map(list => ({ id: list.id, name: list.name })),
        ...(window.lx.isProd ? [] : [
          { id: '__demo_solar', name: 'Daily Mix', isDemo: true },
          { id: '__demo_glacier', name: 'Focus', isDemo: true },
          { id: '__demo_velvet', name: 'Night Drive', isDemo: true },
          { id: '__demo_aurora', name: 'Discovery', isDemo: true },
          { id: '__demo_bloom', name: 'Weekend', isDemo: true },
          { id: '__demo_tide', name: 'Energy', isDemo: true },
        ]),
      ]
      const lists = await Promise.all(listInfos.map(async({ id, isDemo }) => {
        if (isDemo) return []
        try {
          return await getListMusics(id)
        } catch {
          return []
        }
      }))
      if (token != refreshToken) return

      entries.value = listInfos.map((info, index) => ({
        ...info,
        list: lists[index],
        order: index,
      }))
      isLoading.value = false
    }

    const handleOpen = entry => {
      if (entry.isDemo) return
      void router.replace({
        path: '/list',
        query: { id: entry.id },
      })
    }

    const handlePlay = entry => {
      if (entry.isDemo || !entry.list.length) return
      playList(entry.id, 0)
    }

    const handleListUpdate = () => {
      void refresh()
    }

    onMounted(() => {
      void initRecentPlayListRecords()
      window.app_event.on('myListUpdate', handleListUpdate)
      void refresh()
    })

    onBeforeUnmount(() => {
      refreshToken++
      window.app_event.off('myListUpdate', handleListUpdate)
    })

    return {
      sortedEntries,
      isLoading,
      playMusicInfo,
      handleOpen,
      handlePlay,
    }
  },
}
</script>

<style lang="less" module>
.container {
  min-width: 0;
  height: 100%;
  flex: auto;
  display: flex;
  flex-flow: column nowrap;
}
.header {
  flex: none;
  height: 39px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 20px;
  border-bottom: var(--color-list-header-border-bottom);

  h2 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
  }
  span {
    color: var(--color-font-label);
    font-size: 12px;
  }
}
.content {
  min-height: 0;
  flex: auto;
  overflow-y: auto !important;
  padding: 18px 20px 28px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 24px 18px;
}
.empty {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;

  p {
    color: var(--color-font-label);
    font-size: 24px;
  }
}
@media (min-width: 1200px) {
  .grid {
    grid-template-columns: repeat(auto-fill, minmax(175px, 1fr));
  }
}
</style>
