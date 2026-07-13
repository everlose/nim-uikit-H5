import React, { useState, useEffect, useRef } from 'react'
import { observer } from 'mobx-react-lite'
import { useNavigate } from '@/utils/router'
import { useStateContext } from '../../hooks/useStateContext'
import { getAvatarBackgroundColor } from '../../utils'
import './index.less'

export interface AvatarProps {
  /**
   * 用户账号
   */
  account: string
  /**
   * 群组ID
   */
  teamId?: string
  /**
   * 头像URL
   */
  avatar?: string
  /**
   * 头像大小
   */
  size?: number | string
  /**
   * 是否点击跳转到用户名片
   */
  gotoUserCard?: boolean
  /**
   * 字体大小
   */
  fontSize?: number | string
  /**
   * 是否重定向
   */
  isRedirect?: boolean
  /**
   * 长按事件处理函数
   */
  onLongpress?: () => void
  /**
   * 点击事件处理函数
   */
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void
  /**
   * 自定义类名
   */
  className?: string
  /**
   * 自定义样式
   */
  style?: React.CSSProperties
  /**
   * 消息内携带的昵称，用于头像文字兜底
   */
  nickFromMsg?: string
}

const Avatar: React.FC<AvatarProps> = ({
  account,
  teamId = '',
  avatar = '',
  size = 42,
  gotoUserCard = false,
  fontSize = '',
  isRedirect = false,
  onLongpress,
  onClick,
  className = '',
  style = {},
  nickFromMsg = ''
}) => {
  const navigate = useNavigate()
  const { store, nim } = useStateContext()
  // 直接得到 user
  const user = store.userStore.users.get(account)
  const avatarSize = typeof size === 'number' ? size : parseInt(size) || 42
  const thumbSize = avatarSize * 2
  const avatarUrl =
    avatar || user?.avatar
      ? // @ts-ignore
        nim.cloudStorage.getThumbUrl(avatar || user?.avatar, {
          width: thumbSize,
          height: thumbSize
        })
      : ''
  const [isLongPress, setIsLongPress] = useState<boolean>(false)
  const fontSizeValue = fontSize ? (typeof fontSize === 'number' ? fontSize : parseInt(fontSize)) : Math.floor(avatarSize / 3)

  const touchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const touchStartPointRef = useRef<{ x: number; y: number } | null>(null)

  // 主动拉取用户信息，确保头像和昵称正确展示
  useEffect(() => {
    if (account) {
      store.userStore.getUserActive(account)
    }
  }, [account])

  // 销毁组件时需要销毁定时器
  useEffect(() => {
    return () => {
      if (touchTimeoutRef.current) {
        clearTimeout(touchTimeoutRef.current)
      }
    }
  }, [])

  // 获取用户称谓（昵称或账号的前两个字符）
  const getAppellation = () => {
    if (!store?.uiStore) return account.slice(0, 2)

    const appellation = store.uiStore.getAppellation({
      account,
      teamId: '',
      ignoreAlias: false,
      nickFromMsg
    })

    return appellation ? appellation.slice(0, 2) : (nickFromMsg || account).slice(0, 2)
  }

  // 获取头像背景颜色
  const color = getAvatarBackgroundColor(account)

  // 处理头像点击
  const handleAvatarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (onClick) {
      onClick(e)
      return
    }

    if (gotoUserCard && !isLongPress) {
      // 仅在锚点模式下移除 URL 中的 anchorMessageClientId，防止返回后仍锚点到标记消息
      const hashQuery = window.location.hash.split('?')[1] || ''
      const params = new URLSearchParams(hashQuery)
      if (params.get('anchorMessageClientId')) {
        const convId = params.get('conversationId')
        if (convId) {
          window.history.replaceState(window.history.state, '', `#/chat?conversationId=${convId}`)
        }
      }
      if (account === store.userStore.myUserInfo.accountId) {
        // 跳转到我的详情页
        navigate('/user/my-detail')
      } else {
        // 跳转到好友名片页
        navigate(`/friend/friend-card?accountId=${account}`)
      }
    }
  }

  const clearLongpressTimer = () => {
    if (touchTimeoutRef.current) {
      clearTimeout(touchTimeoutRef.current)
      touchTimeoutRef.current = null
    }
  }

  const startLongpressTimer = (x: number, y: number) => {
    clearLongpressTimer()
    touchStartPointRef.current = { x, y }
    touchTimeoutRef.current = setTimeout(() => {
      setIsLongPress(true)
      onLongpress?.()
    }, 500) // 长按阈值为500ms
  }

  const cancelLongpressOnMove = (x: number, y: number) => {
    const startPoint = touchStartPointRef.current
    if (!startPoint) return
    if (Math.abs(x - startPoint.x) > 8 || Math.abs(y - startPoint.y) > 8) {
      clearLongpressTimer()
    }
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    startLongpressTimer(event.clientX, event.clientY)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    cancelLongpressOnMove(event.clientX, event.clientY)
  }

  const handlePointerEnd = () => {
    clearLongpressTimer()
    setTimeout(() => {
      setIsLongPress(false)
    }, 200)
  }

  return (
    <div
      className={`avatar ${className}`}
      style={{
        width: `${avatarSize}px`,
        height: `${avatarSize}px`,
        ...style
      }}
      onClick={handleAvatarClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onPointerLeave={handlePointerEnd}
    >
      {/* 使用遮罩层避免android长按头像会出现保存图片的弹窗 */}
      <div className="img-mask"></div>

      {avatarUrl ? (
        <img className="avatar-img" src={avatarUrl} alt="avatar" />
      ) : (
        <div className="avatar-name-wrapper" style={{ backgroundColor: color }}>
          <div className="avatar-name-text" style={{ fontSize: `${fontSizeValue}px` }}>
            {getAppellation()}
          </div>
        </div>
      )}
    </div>
  )
}

export default observer(Avatar)
