import { shallowReactive } from '@common/utils/vueTools'
import { throttle } from '@common/utils'
import { getRecentPlayListRecords, saveRecentPlayListRecords } from '@renderer/utils/ipc'

const MAX_HISTORY_LENGTH = 5000

interface RecentPlayListRecord {
  listId: string
  musicId: string
}

export const recentPlayListRecords = shallowReactive<RecentPlayListRecord[]>([])

let initPromise: Promise<void> | null = null
let isInited = false

const saveHistory = throttle(() => {
  saveRecentPlayListRecords(recentPlayListRecords.map(record => ({ ...record })))
}, 500)

export const initRecentPlayListRecords = async() => {
  if (isInited) return
  if (!initPromise) {
    initPromise = getRecentPlayListRecords().then((records) => {
      if (Array.isArray(records)) {
        recentPlayListRecords.push(...records.filter(record =>
          record != null && typeof record.listId == 'string' && typeof record.musicId == 'string',
        ).slice(0, MAX_HISTORY_LENGTH))
      }
      isInited = true
    }).finally(() => {
      initPromise = null
    })
  }
  await initPromise
}

export const recordRecentPlayList = async(listId: string, musicId: string) => {
  await initRecentPlayListRecords()
  const index = recentPlayListRecords.findIndex(record => record.listId == listId)
  if (index > -1) recentPlayListRecords.splice(index, 1)
  recentPlayListRecords.unshift({ listId, musicId })
  if (recentPlayListRecords.length > MAX_HISTORY_LENGTH) recentPlayListRecords.splice(MAX_HISTORY_LENGTH)
  saveHistory()
}
