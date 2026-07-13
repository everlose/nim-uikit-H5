import { useEffect, type MutableRefObject } from 'react'
import { useNavigate } from '@/utils/router'
import { useTranslation } from './useTranslate'
import { useStateContext } from './useStateContext'
import { showModal } from '../utils/modal'
import { neUiKitRouterPath } from '../utils/uikitRouter'

/**
 * 监听群解散/被踢出事件，弹出异常提示并返回会话列表
 * @param teamId - 当前群 ID，只有匹配的事件才会触发弹窗
 * @param isDismissingRef - 标记是否正在主动解散群，为 true 时跳过解散弹窗
 */
export function useTeamNotification(teamId: string, isDismissingRef?: MutableRefObject<boolean>) {
  const { t } = useTranslation()
  const { store, nim } = useStateContext()
  const navigate = useNavigate()

  useEffect(() => {
    if (!teamId) return

    const backToConversation = () => {
      store.uiStore.unselectConversation()
      navigate(neUiKitRouterPath.conversation)
    }

    const handleTeamDismissed = (data: any) => {
      if (data.teamId === teamId) {
        if (isDismissingRef?.current) return
        showModal({
          title: t('tipText'),
          content: t('onDismissTeamText'),
          cancelText: '',
          onConfirm: backToConversation
        })
      }
    }

    const handleTeamLeft = (data: any) => {
      if (data.teamId === teamId) {
        showModal({
          title: t('tipText'),
          content: t('onTeamKickedText'),
          cancelText: '',
          onConfirm: backToConversation
        })
      }
    }

    nim.V2NIMTeamService.on('onTeamDismissed', handleTeamDismissed)
    nim.V2NIMTeamService.on('onTeamLeft', handleTeamLeft)

    return () => {
      nim.V2NIMTeamService.off('onTeamDismissed', handleTeamDismissed)
      nim.V2NIMTeamService.off('onTeamLeft', handleTeamLeft)
    }
  }, [teamId])
}
