import React, { useMemo } from 'react'
import { observer } from 'mobx-react-lite'
import FullScreenModal from '@/NEUIKit/common/components/FullScreenModal'
import { useTranslation } from '@/NEUIKit/common/hooks/useTranslate'
import { caculateTimeago } from '@/NEUIKit/common/utils/date'
import MessageItem from '../message-item'
import { V2NIMConst } from 'nim-web-sdk-ng/dist/esm/nim'
import type { V2NIMMessageForUI } from '@xkit-yx/im-store-v2/dist/types/src/types'
import './index.less'

interface MergedForwardModalProps {
  visible: boolean
  title: string
  msgs: V2NIMMessageForUI[]
  onClose: () => void
}

const MergedForwardModal: React.FC<MergedForwardModalProps> = observer(({ visible, title, msgs, onClose }) => {
  const { t } = useTranslation()

  const finalMsgs = useMemo(() => {
    return msgs.reduce((result: any[], item, index) => {
      if (index === 0 || item.createTime - msgs[index - 1].createTime > 5 * 60 * 1000) {
        result.push({
          ...item,
          messageClientId: 'time-' + item.createTime,
          messageType: V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_CUSTOM,
          sendingState: V2NIMConst.V2NIMMessageSendingState.V2NIM_MESSAGE_SENDING_STATE_SUCCEEDED,
          timeValue: caculateTimeago(item.createTime),
          renderKey: `${item.createTime + 1}`
        })
      }
      result.push({ ...item, renderKey: `${item.createTime}` })
      return result
    }, [])
  }, [msgs])

  return (
    <FullScreenModal visible={visible} title={t('chatHistoryText')} onBack={onClose} backAriaLabel={t('cancelText')} contentClassName="merged-forward-viewer-content">
      <div aria-label={title}>
        {finalMsgs.map((msg, index) => (
          <MessageItem key={msg.messageClientId || `${msg.createTime}-${index}`} msg={msg} index={index} broadcastNewAudioSrc="" readonly />
        ))}
      </div>
    </FullScreenModal>
  )
})

export default MergedForwardModal
