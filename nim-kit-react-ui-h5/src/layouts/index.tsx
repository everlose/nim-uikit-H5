import { useNavigate, useLocation } from '@/utils/router'
import V2NIM from 'nim-web-sdk-ng'
import React, { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOutlet } from 'react-router-dom'
import { LocalOptions } from '@xkit-yx/im-store-v2/dist/types/src/types'
import { Provider } from '@/NEUIKit/common/contextManager/Provider'
import { toast } from '@/NEUIKit/common/utils/toast'
import { NIM_APP_KEY, NIM_DEBUG_LEVEL, NIM_LBS_URLS, NIM_LINK_URL } from '@/config'
import zh from '../NEUIKit/common/locales/zh'
import en from '@/NEUIKit/common/locales/en'
import TabBar from './tabBar'
import './base.less'
import './global.less'
import './index.less'
import { V2NIMError } from 'nim-web-sdk-ng/dist/esm/types'
import { defaultLocalOptions } from '@/NEUIKit/common/utils/init'

type TransitionDirection = 'forward' | 'back' | 'none'

const PAGE_TRANSITION_DURATION = 260

const routeDepthMap: Record<string, number> = {
  '/': 0,
  '/login': 0,
  '/conversation': 0,
  '/contacts': 0,
  '/my': 0,

  '/chat': 1,
  '/conversation/search': 1,
  '/contacts/teamlist': 1,
  '/contacts/blacklist': 1,
  '/contacts/validlist': 1,
  '/user/my-detail': 1,
  '/user/setting': 1,
  '/user/collection': 1,
  '/user/aboutNetease': 1,
  '/friend/friend-card': 1,
  '/friend/add': 1,
  '/team/create': 1,

  '/chat/message-read-info': 2,
  '/chat/pin-list': 2,
  '/p2p-setting': 2,
  '/friend/edit': 2,
  '/user/my-detail-edit': 2,
  '/team/setting': 2,
  '/team/add': 2,
  '/team/member': 2,
  '/team/info-edit': 2,

  '/team/info/avatar-edit': 3,
  '/team/info/introduce-edit': 3,
  '/team/info/nick-edit': 3
}

const getRouteDepth = (pathname: string) => {
  const normalizedPath = pathname === '/' ? '/' : pathname.replace(/\/$/, '')
  return routeDepthMap[normalizedPath] ?? 1
}

const getTransitionDirection = (fromPath: string, toPath: string): TransitionDirection => {
  const fromDepth = getRouteDepth(fromPath)
  const toDepth = getRouteDepth(toPath)

  if (toDepth > fromDepth) return 'forward'
  if (toDepth < fromDepth) return 'back'
  return 'none'
}

const PageTransition: React.FC<{ children: ReactNode; pathname: string }> = ({ children, pathname }) => {
  const previousPathRef = useRef(pathname)
  const displayChildrenRef = useRef(children)
  const [displayChildren, setDisplayChildren] = useState(children)
  const [previousChildren, setPreviousChildren] = useState<ReactNode>(null)
  const [direction, setDirection] = useState<TransitionDirection>('none')
  const animationTimerRef = useRef<number>()

  useEffect(() => {
    const previousPath = previousPathRef.current

    if (previousPath === pathname) {
      displayChildrenRef.current = children
      setDisplayChildren(children)
      return
    }

    const nextDirection = getTransitionDirection(previousPath, pathname)

    window.clearTimeout(animationTimerRef.current)
    setPreviousChildren(displayChildrenRef.current)
    setDisplayChildren(children)
    displayChildrenRef.current = children
    setDirection(nextDirection)
    previousPathRef.current = pathname

    animationTimerRef.current = window.setTimeout(() => {
      setPreviousChildren(null)
      setDirection('none')
    }, PAGE_TRANSITION_DURATION)
  }, [children, pathname])

  useEffect(() => {
    return () => {
      window.clearTimeout(animationTimerRef.current)
    }
  }, [])

  return (
    <div className={`page-transition-wrapper page-transition-${direction}`}>
      {previousChildren && direction !== 'none' && <div className="page-transition-page page-transition-page-previous">{previousChildren}</div>}
      <div className="page-transition-page page-transition-page-current">{displayChildren}</div>
    </div>
  )
}

const Layout: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const outlet = useOutlet()
  const [language, setLanguage] = useState<'zh' | 'en'>('zh')
  // 使用 useRef 确保即使在 StrictMode 下也只执行一次
  const isInitializedRef = React.useRef(false)
  const isLoggingInRef = React.useRef(false)

  // 使用 useRef 确保 getInstance 只执行一次（即使在 StrictMode 下组件重新挂载）
  const nimInstanceRef = React.useRef<ReturnType<typeof V2NIM.getInstance> | null>(null)
  
  if (!nimInstanceRef.current) {
    const enableV2CloudConversation = localStorage.getItem('enableV2CloudConversation') === 'on'
    nimInstanceRef.current = V2NIM.getInstance(
      {
        appkey: NIM_APP_KEY,
        debugLevel: NIM_DEBUG_LEVEL,
        apiVersion: 'v2', // 写死, 固定 v2
        enableV2CloudConversation: enableV2CloudConversation
      },
      {
        V2NIMLoginServiceConfig: {
          lbsUrls: NIM_LBS_URLS,
          linkUrl: NIM_LINK_URL
        }
      }
    )
  }
  
  const nimInstance = nimInstanceRef.current
  const canShowBottomNav = ['/', '/conversation', '/contacts', '/my'].includes(location.pathname)

  // 避免每次渲染都创建新对象, 配置对象只创建一次
  const languageMap = useMemo(() => ({ zh, en }), [])

  // 初始化 UIKit 并登录 NIM
  const initIMUiKit = useCallback(async (opts: string) => {
    let account = ''
    let token = ''
    try {
      const options = JSON.parse(opts)
      account = options.account
      token = options.token
    } catch (err) {
      console.log('LoginInfo JSON parse error', err)
      // 登录信息无效，清除并跳转到登录页
      localStorage.removeItem('__yx_im_options__h5')
      navigate('/login')
      return
    }
    if (!account) {
      // 登录信息无效，清除并跳转到登录页
      localStorage.removeItem('__yx_im_options__h5')
      navigate('/login')
      return
    }

    try {
      await nimInstance.V2NIMLoginService.login(account, token, {
        // 强制模式默认设置为 false, 逻辑: 当自动登录时, 若多端登录遇到冲突, 不会挤掉其他端, 本次登录会 code: 417 失败
        forceMode: false,
        // 演示为静态登录模式-固定账号密码
        authType: 0
      })
      // IM 登录成功后跳转到会话页面
      navigate('/conversation')
      // this.showUiKit = true
    } catch (err) {
      const error = err as V2NIMError
      console.error('NIM Login failed!', error.toString())
      // 302 账号密码不可用, 需要重新输入, 417 多端登录冲突, 需要重新强制登录
      if (error.code === 302 || error.code === 417) {
        toast.error(`NIM Login failed: ${error.message}`)
        navigate('/login')
        return
      }

      toast.error(`NIM Login failed: ${error.code},${error.message}}`)
    }
  }, [nimInstance, navigate])

  // 初始化检查 - 只执行一次（即使在 StrictMode 下）
  useEffect(() => {
    // 使用 ref 防止在 StrictMode 下重复执行
    if (isInitializedRef.current || isLoggingInRef.current) {
      return
    }

    // 标记正在初始化
    isInitializedRef.current = true

    setLanguage(localStorage.getItem('switchToEnglishFlag') === 'en' ? 'en' : 'zh')
    const loginInfo = localStorage.getItem('__yx_im_options__h5')
    if (!loginInfo) {
      // 未登录，跳转到登录页
      navigate('/login')
      return
    }

    // 标记正在登录
    isLoggingInRef.current = true

    try {
      // 重新初始化 IM
      initIMUiKit(loginInfo).finally(() => {
        isLoggingInRef.current = false
      })
    } catch (err) {
      console.log('LoginInfo JSON parse error', err)
      // 登录信息无效，清除并跳转到登录页
      localStorage.removeItem('__yx_im_options__h5')
      navigate('/login')
      isLoggingInRef.current = false
    }
  }, [initIMUiKit])

  // 本地默认行为参数
  const localOptions: Partial<LocalOptions> = useMemo(() => {
    return {
      ...defaultLocalOptions
    }
  }, [])

  return (
    <div className="layout-container">
      <Provider
        localeConfig={languageMap[language]}
        localOptions={localOptions}
        locale={language}
        // @ts-expect-error
        nim={nimInstance}
        singleton={true}
      >
        <div className="main-content">
          <PageTransition pathname={location.pathname}>
            {canShowBottomNav ? (
              <div className="tab-page-shell">
                <div className="tab-page-content">{outlet}</div>
                <TabBar />
              </div>
            ) : (
              outlet
            )}
          </PageTransition>
        </div>
      </Provider>
    </div>
  )
}

export default Layout
