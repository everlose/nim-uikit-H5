import React, { useState } from 'react'
import { observer } from 'mobx-react-lite'
import { useTranslation } from '@/NEUIKit/common/hooks/useTranslate'
import { useStateContext } from '@/NEUIKit/common/hooks/useStateContext'
import { showToast } from '@/NEUIKit/common/utils/toast'
import type { V2NIMMessageForUI } from '@xkit-yx/im-store-v2/dist/types/src/types'
import { normalizeMergedForwardText, parseMergedForwardPayload } from './utils'
import MergedForwardModal from './modal'
import './index.less'

interface MergedForwardCardProps {
  msg: V2NIMMessageForUI
}

const MergedForwardCard: React.FC<MergedForwardCardProps> = observer(({ msg }) => {
  const { t } = useTranslation()
  const { store } = useStateContext()
  const [visible, setVisible] = useState(false)
  const [msgs, setMsgs] = useState<V2NIMMessageForUI[]>([])
  const payload = parseMergedForwardPayload(msg)
  const data = payload?.data
  const sessionName = data?.sessionName || data?.sessionId || ''
  const title = `${sessionName}${t('messageOfText')}`

  const openMergedForward = async () => {
    if (msgs.length) {
      setVisible(true)
      return
    }

    try {
      if (!data?.url) throw new Error('Merged forward url missing')
      const res = await fetch(data.url)
      if (!res.ok) throw new Error('Merged forward fetch failed')
      const text = await res.text()
      const list = store.msgStore.deserializeMergeMsgs(normalizeMergedForwardText(text)) as V2NIMMessageForUI[]
      if (!list.length) throw new Error('Merged forward deserialize failed')
      setMsgs(list)
      setVisible(true)
    } catch {
      showToast({
        message: t('getMergedForwardFailedText'),
        type: 'error',
        duration: 1000
      })
    }
  }

  return (
    <>
      <div className={`msg-bg ${msg.isSelf ? 'msg-bg-out' : 'msg-bg-in'} merged-forward-card`} onClick={openMergedForward}>
        <div className="merged-forward-card-content">
          <div className="merged-forward-title">
            <span className="merged-forward-title-session">{sessionName}</span>
            <span className="merged-forward-title-suffix">{t('messageOfText')}</span>
          </div>
          <div className="merged-forward-abstracts">
            {(data?.abstracts || []).map((item, index) => (
              <span key={index}>
                <span className="merged-forward-sender">{item.senderNick}: </span>
                <span>{item.content}</span>
                {index < (data?.abstracts || []).length - 1 && <br />}
              </span>
            ))}
          </div>
          <div className="merged-forward-footer">{t('chatHistoryText')}</div>
        </div>
      </div>
      <MergedForwardModal visible={visible} title={title} msgs={msgs} onClose={() => setVisible(false)} />
    </>
  )
})

export default MergedForwardCard
