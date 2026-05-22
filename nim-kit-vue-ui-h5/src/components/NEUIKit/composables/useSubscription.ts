import { reaction } from 'mobx'
import type RootStore from '@xkit-yx/im-store-v2'

// 批量订阅常量
const SUBSCRIPTION_BATCH_SIZE = 150

/**
 * 将数组按指定大小分批
 */
function chunk<T>(array: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size))
  }
  return result
}

/**
 * 设置好友在线状态订阅
 * 在登录成功后调用，返回清理函数
 *
 * @param store RootStore 实例
 * @returns dispose 函数，用于清理订阅监听
 */
export function setupFriendSubscription(store: RootStore): () => void {
  // 记录已订阅的好友 accountId 集合
  const subscribedAccounts = new Set<string>()

  /**
   * 批量订阅好友状态
   */
  const subscribeFriendsStatus = async (accountIds: string[]) => {
    if (accountIds.length === 0) return

    // 过滤出未订阅的账号
    const newAccountIds = accountIds.filter((id) => !subscribedAccounts.has(id))
    if (newAccountIds.length === 0) return

    // 分批订阅
    const batches = chunk(newAccountIds, SUBSCRIPTION_BATCH_SIZE)
    for (const batch of batches) {
      try {
        await store.subscriptionStore.subscribeUserStatusActive(batch)
        // 记录已订阅的账号
        batch.forEach((id) => subscribedAccounts.add(id))
      } catch (error) {
        console.error('[useSubscription] Subscribe user status failed:', error)
        // 订阅失败不阻塞应用，继续下一批
      }
    }
  }

  /**
   * 重新订阅所有好友状态（用于重连后）
   */
  const resubscribeAllFriends = () => {
    // 清空已订阅列表
    subscribedAccounts.clear()
    // 重新订阅
    const friends = store.uiStore.friends
    if (friends && friends.length > 0) {
      const accountIds = friends.map((f) => f.accountId)
      subscribeFriendsStatus(accountIds)
    }
  }

  // 使用 MobX reaction 监听好友列表变化
  const disposeFriends = reaction(
    () => store.uiStore.friends,
    (friends) => {
      if (friends && friends.length > 0) {
        const accountIds = friends.map((f) => f.accountId)
        subscribeFriendsStatus(accountIds)
      }
    },
    { fireImmediately: true } // 立即执行一次
  )

  // 监听登录状态变化，重连后重新订阅
  const disposeLogin = reaction(
    () => store.connectStore.loginStatus,
    (status, prevStatus) => {
      // 从非登录状态变为登录状态时，重新订阅
      // prevStatus !== 1 确保不是首次登录（首次登录由 disposeFriends 处理）
      if (status === 1 && prevStatus !== undefined && prevStatus !== 1) {
        console.log('[useSubscription] Reconnected, resubscribing user status...')
        resubscribeAllFriends()
      }
    }
  )

  // 返回清理函数
  return () => {
    disposeFriends()
    disposeLogin()
  }
}
