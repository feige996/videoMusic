import type { VideoMetadata } from '@/components/types'

/**
 * 检测是否是存储容量超出错误
 * @param error 错误对象
 * @returns 是否是存储容量超出错误
 */
export function isQuotaExceededError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'QuotaExceededError' ||
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      error.message.includes('quota') ||
      error.message.includes('storage'))
  )
}

/**
 * 清理存储实例中最旧的缓存数据
 * 当存储空间不足时，删除最早添加的记录
 * @param storage 本地存储实例
 * @param deletePercentage 要删除的数据比例，默认为20%
 * @param minDeleteItems 最少删除的项目数，默认为1
 */
export async function cleanupOldestCache(
  storage: LocalForage,
  deletePercentage = 0.2,
  minDeleteItems = 1,
): Promise<void> {
  try {
    // 获取所有缓存项的键
    const keys = await storage.keys()
    if (keys.length === 0) return

    // 获取所有缓存项及其时间戳
    const cacheItems: Array<{ key: string; timestamp: number }> = []
    for (const key of keys) {
      if (typeof key === 'string') {
        // 获取存储项并安全地检查timestamp属性
        const item = await storage.getItem<{ timestamp: number }>(key)
        if (
          item &&
          typeof item === 'object' &&
          'timestamp' in item &&
          typeof item.timestamp === 'number'
        ) {
          cacheItems.push({ key, timestamp: item.timestamp as number })
        }
      }
    }

    // 按时间戳排序，删除最旧的数据
    cacheItems.sort((a, b) => a.timestamp - b.timestamp)
    const itemsToDelete = Math.max(minDeleteItems, Math.ceil(cacheItems.length * deletePercentage))

    for (let i = 0; i < itemsToDelete && i < cacheItems.length; i++) {
      const item = cacheItems[i]
      if (item && item.key) {
        await storage.removeItem(item.key)
        console.log('删除最旧的缓存数据:', item.key)
      }
    }
  } catch (error) {
    console.error('清理旧缓存失败:', error)
  }
}

/**
 * 安全地设置存储项，包含容量超出处理
 * @param storage 本地存储实例
 * @param key 存储键
 * @param value 存储值
 * @returns 是否设置成功
 */
export async function setItemWithQuotaHandling<T>(
  storage: LocalForage,
  key: string,
  value: T,
): Promise<boolean> {
  try {
    await storage.setItem(key, value)
    return true
  } catch (error) {
    // 检查是否是存储容量超出错误
    if (isQuotaExceededError(error)) {
      console.log('存储空间不足，正在清理旧数据...')

      // 清理最旧的数据并重试
      try {
        await cleanupOldestCache(storage)
        // 清理后再次尝试保存
        await storage.setItem(key, value)
        console.log('清理旧数据后保存成功')
        return true
      } catch (retryError) {
        console.error('清理旧数据后保存仍失败:', retryError)
        return false
      }
    }
    console.warn('保存缓存失败:', error)
    return false
  }
}
