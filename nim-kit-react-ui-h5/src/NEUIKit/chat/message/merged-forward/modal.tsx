import React from 'react'
import { observer } from 'mobx-react-lite'
import FullScreenModal from '@/NEUIKit/common/components/FullScreenModal'
import { useTranslation } from '@/NEUIKit/common/hooks/useTranslate'
import MessageItem from '../message-item'
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

  return (
    <FullScreenModal visible={visible} title={t('chatHistoryText')} onBack={onClose} backAriaLabel={t('cancelText')} contentClassName="merged-forward-viewer-content">
      <div aria-label={title}>
        {msgs.map((msg, index) => (
          <MessageItem key={msg.messageClientId || `${msg.createTime}-${index}`} msg={msg} index={index} broadcastNewAudioSrc="" readonly />
        ))}
      </div>
    </FullScreenModal>
  )
})

export default MergedForwardModal
