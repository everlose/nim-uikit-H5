import React from 'react'
import { observer } from 'mobx-react-lite'
import { useStateContext } from '@/NEUIKit/common/hooks/useStateContext'
import Avatar from '@/NEUIKit/common/components/Avatar'
import { useTranslation } from '@/NEUIKit/common/hooks/useTranslate'
import './index.less'

export interface UserCardProps {
  /**
   * 用户账号
   */
  account?: string
  /**
   * 用户昵称
   */
  nick?: string
  /**
   * 点击事件
   */
  onClick?: () => void
}

/**
 * 用户信息卡片组件
 */
const UserCard: React.FC<UserCardProps> = observer(({ account = '', nick = '', onClick }) => {
  const { t } = useTranslation()
  const { store } = useStateContext()

  // 直接从 MobX store 中读取 alias，observer 会自动响应 store 变化（如多端修改备注名）
  const alias = account && store?.friendStore ? store.friendStore.friends.get(account)?.alias || '' : ''

  return (
    <div className="user-card-wrapper" onClick={onClick}>
      <div className="user-card-avatar">{account && <Avatar size={70} account={account} />}</div>
      <div className="user-card-info">
        {alias ? (
          <>
            <div className="user-card-main">{alias}</div>
            <div className="user-card-deputy">
              {t('name')}:{nick || account}
            </div>
          </>
        ) : (
          <div className="user-card-main">{nick || account}</div>
        )}
        <div className="user-card-deputy">
          {t('accountText')}:{account}
        </div>
      </div>
    </div>
  )
})

export default UserCard
