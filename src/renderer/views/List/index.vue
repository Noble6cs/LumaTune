<template>
  <div id="my-list" :class="$style.container" @click="handleContainerClick">
    <MyList ref="myList" :list-id="listId" @show-menu="handleMyListMenu" />
    <AllMusic v-if="listId == allMusicListId" />
    <MusicList v-else ref="musicList" :list-id="listId" @show-menu="$refs.myList.handleMenuClick()" />
  </div>
</template>

<script>
import { getListPrevSelectId } from '@renderer/utils/data'

import MyList from './MyList/index.vue'
import MusicList from './MusicList/index.vue'
import AllMusic from './AllMusic/index.vue'
import { LIST_IDS } from '@common/constants'

export default {
  name: 'List',
  components: {
    MyList,
    MusicList,
    AllMusic,
  },
  async beforeRouteEnter(to, from, next) {
    let id = to.query.id
    if (!id) {
      id = await getListPrevSelectId()
      next({
        path: to.path,
        query: { id },
      })
    } else next()
  },
  beforeRouteUpdate(to, from) {
    // console.log(to, from)
    if (to.query.updated) return
    let id = to.query.id
    if (id == null) return
    // if (!getList(id)) {
    //   id = defaultList.id
    // }
    this.listId = id
    const scrollIndex = to.query.scrollIndex
    const isAnimation = from.query.id == to.query.id
    this.$refs.musicList?.handleRestoreScroll(scrollIndex, isAnimation)

    return {
      path: '/list',
      query: { id, updated: true },
    }
  },
  beforeRouteLeave(to, from) {
    this.$refs.musicList?.saveListPosition()
  },
  data() {
    return {
      listId: null,
      allMusicListId: LIST_IDS.ALL,
    }
  },
  created() {
    this.listId = this.$route.query.id
  },
  methods: {
    handleMyListMenu() {
      this.$refs.musicList?.handleMenuClick()
    },
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.container {
  overflow: hidden;
  height: 100%;
  display: flex;
  position: relative;
}

</style>
