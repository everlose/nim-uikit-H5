import React from 'react'
import { observer } from 'mobx-react-lite'
import Avatar, { AvatarProps } from '../Avatar'
import { useStateContext } from '../../hooks/useStateContext'
import { checkUserOnline } from '../../utils/userStatus'
import './index.less'

export interface AvatarWithStatusProps extends AvatarProps {
  /**
   * 是否显示在线状态圆点，默认 true
   */
  showStatus?: boolean
}

/**
 * 带在线状态圆点的头像组件
 * 在头像右下角展示用户的在线/离线状态
 */
const AvatarWithStatus: React.FC<AvatarWithStatusProps> = observer(({
  account,
  showStatus = true,
  ...avatarProps
}) => {
  const { store } = useStateContext()

  // 获取用户在线状态
  const userStatus = store.subscriptionStore.getUserStatus(account)
  const isOnline = checkUserOnline(userStatus)

  return (
    <div className="avatar-with-status">
      <Avatar account={account} {...avatarProps} />
      {showStatus && (
        <div 
          className={`status-dot ${isOnline ? 'online' : 'offline'}`}
        />
      )}
    </div>
  )
})

export default AvatarWithStatus