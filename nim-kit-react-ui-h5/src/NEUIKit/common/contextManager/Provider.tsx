import RootStore from '@xkit-yx/im-store-v2'
import { LocalOptions } from '@xkit-yx/im-store-v2/dist/types/src/types'
import { observer } from 'mobx-react'
import { reaction } from 'mobx'
import { NIM } from 'nim-web-sdk-ng/dist/esm/nim'
import sdkPkg from 'nim-web-sdk-ng/package.json'
import React, { createContext, FC, memo, ReactNode, useCallback, useEffect, useMemo, useRef } from 'react'

import zh from '../locales/zh'

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

export interface ContextProps {
  nim?: NIM
  store?: RootStore
  localOptions?: Partial<LocalOptions>
  t?: (str: keyof typeof zh) => string
  locale?: 'zh' | 'en' | string
}

export interface ProviderProps {
  children: ReactNode
  localOptions?: Partial<LocalOptions>
  nim: NIM
  singleton?: boolean
  locale?: 'zh' | 'en'
  localeConfig?: { [key in keyof typeof zh]?: string }
  renderImDisConnected?: () => JSX.Element
  renderImConnecting?: () => JSX.Element
}

export const Context = createContext<ContextProps>({})

// 模块级变量，确保跨越 StrictMode 多次挂载 / Provider 多次实例化时，
// 全局只有一个 RootStore 实例连接到同一个 NIM 实例
let _globalRootStore: RootStore | null = null

export const Provider: FC<ProviderProps> = memo(function Main({
  children,
  localOptions,
  nim,
  locale = 'zh',
  localeConfig = zh,
  singleton = false
}) {
  const localeMap = useMemo(
    () => ({
      zh
    }),
    []
  )

  const t = useCallback(
    (str: keyof typeof zh) => {
      return {
        ...(localeMap[locale] || zh),
        ...localeConfig
      }[str]
    },
    [locale, localeConfig, localeMap]
  )

  const finalLocalOptions = useMemo(() => {
    return { ...localOptions }
  }, [localOptions])

  // 使用模块级全局变量确保只创建一个 store 实例
  // useRef 在每个组件实例中独立，无法跨越 StrictMode/多次挂载
  if (!_globalRootStore) {
    if (singleton) {
      // @ts-ignore
      _globalRootStore = RootStore.getInstance(nim, finalLocalOptions, 'H5')
    } else {
      // @ts-ignore
      _globalRootStore = new RootStore(nim, finalLocalOptions, 'H5')
    }
  }
  const rootStore = _globalRootStore

  // @ts-ignore
  window.__xkit_store__ = {
    nim,
    store: rootStore,
    localOptions: finalLocalOptions,
    sdkVersion: sdkPkg.version
  }

  // 记录已订阅的好友 accountId 集合
  const subscribedAccountsRef = useRef<Set<string>>(new Set())

  // 订阅好友在线状态
  // 直接使用模块级 _globalRootStore，避免将深度嵌套对象放入 deps 数组
  useEffect(() => {
    const store = _globalRootStore
    if (!store) return

    /**
     * 批量订阅好友状态
     */
    const subscribeFriendsStatus = async (accountIds: string[]) => {
      if (accountIds.length === 0) return

      // 过滤出未订阅的账号
      const newAccountIds = accountIds.filter(id => !subscribedAccountsRef.current.has(id))
      if (newAccountIds.length === 0) return

      // 分批订阅
      const batches = chunk(newAccountIds, SUBSCRIPTION_BATCH_SIZE)
      for (const batch of batches) {
        try {
          await store.subscriptionStore.subscribeUserStatusActive(batch)
          // 记录已订阅的账号
          batch.forEach(id => subscribedAccountsRef.current.add(id))
        } catch (error) {
          console.error('[Provider] Subscribe user status failed:', error)
          // 订阅失败不阻塞应用，继续下一批
        }
      }
    }

    /**
     * 重新订阅所有好友状态（用于重连后）
     */
    const resubscribeAllFriends = () => {
      // 清空已订阅列表
      subscribedAccountsRef.current.clear()
      // 重新订阅
      const friends = store.uiStore.friends
      if (friends && friends.length > 0) {
        const accountIds = friends.map(f => f.accountId)
        subscribeFriendsStatus(accountIds)
      }
    }

    // 使用 MobX reaction 监听好友列表变化
    const disposeFriends = reaction(
      () => store.uiStore.friends,
      (friends) => {
        if (friends && friends.length > 0) {
          const accountIds = friends.map(f => f.accountId)
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
          console.log('[Provider] Reconnected, resubscribing user status...')
          resubscribeAllFriends()
        }
      }
    )

    return () => {
      disposeFriends()
      disposeLogin()
    }
  }, [])

  // We do NOT destroy rootStore on unmount because React StrictMode in development
  // double-mounts the component, which would invoke effect cleanup and remove all
  // NIM event listeners registered in the store constructor, breaking login status tracking.
  // Logout is handled by setting/index.tsx (calls V2NIMLoginService.logout without destroying store).

  return (
    <Context.Provider
      value={{
        store: rootStore,
        nim,
        localOptions: finalLocalOptions,
        locale,
        t
      }}
    >
      <App>{children}</App>
    </Context.Provider>
  )
})

type Props = {
  children: ReactNode
}

export const App: FC<Props> = observer(({ children }) => {
  // const { store } = useStateContext()

  // const render = () => {
  //   switch (store.connectStore.loginStatus) {
  //     case V2NIMConst.V2NIMLoginStatus.V2NIM_LOGIN_STATUS_UNLOGIN:
  //     case V2NIMConst.V2NIMLoginStatus.V2NIM_LOGIN_STATUS_LOGINED:
  //       return children
  //     case V2NIMConst.V2NIMLoginStatus.V2NIM_LOGIN_STATUS_LOGINING:
  //       return <span>Loading……</span>
  //     case V2NIMConst.V2NIMLoginStatus.V2NIM_LOGIN_STATUS_LOGOUT:
  //       return <span>当前网络不可用，请检查网络设置，刷新页面</span>
  //     default:
  //       return null
  //   }
  // }

  // return <>{render()}</>

  return <>{children}</>
})
