import { onMounted, onUnmounted, getCurrentInstance, type Ref } from 'vue'
import { useRouter } from 'vue-router'
import { t } from '../utils/i18n'
import { showModal } from '../utils/modal'
import { neUiKitRouterPath } from '../utils/uikitRouter'
import type RootStore from '@xkit-yx/im-store-v2'

/**
 * 监听群解散/被踢出事件，弹出异常提示并返回会话列表
 *
 * @param getTeamId - 返回当前群 ID 的函数，在事件触发时调用以获取最新 teamId
 * @param isDismissingRef - 标记是否正在主动解散群，为 true 时跳过解散弹窗
 */
export function useTeamNotification(getTeamId: () => string, isDismissingRef?: Ref<boolean>) {
  const { proxy } = getCurrentInstance()!
  const store = proxy?.$UIKitStore as RootStore
  const nim = proxy?.$NIM
  const router = useRouter()

  let _handleDismissed: ((data: any) => void) | null = null
  let _handleLeft: ((data: any) => void) | null = null

  const backToConversation = () => {
    store?.uiStore.unselectConversation?.()
    router.push(neUiKitRouterPath.conversation)
  }

  onMounted(() => {
    if (!nim) return

    _handleDismissed = (data: any) => {
      const teamId = getTeamId()
      if (teamId && data.teamId === teamId) {
        if (isDismissingRef?.value) return
        showModal({
          title: t('tipText'),
          content: t('onDismissTeamText'),
          cancelText: '',
          onConfirm: backToConversation
        })
      }
    }

    _handleLeft = (data: any) => {
      const teamId = getTeamId()
      if (teamId && data.teamId === teamId) {
        showModal({
          title: t('tipText'),
          content: t('onTeamKickedText'),
          cancelText: '',
          onConfirm: backToConversation
        })
      }
    }

    nim.V2NIMTeamService.on('onTeamDismissed', _handleDismissed)
    nim.V2NIMTeamService.on('onTeamLeft', _handleLeft)
  })

  onUnmounted(() => {
    if (!nim) return
    if (_handleDismissed) {
      nim.V2NIMTeamService.off('onTeamDismissed', _handleDismissed)
    }
    if (_handleLeft) {
      nim.V2NIMTeamService.off('onTeamLeft', _handleLeft)
    }
  })
}
