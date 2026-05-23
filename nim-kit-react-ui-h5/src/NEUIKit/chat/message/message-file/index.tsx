import React from 'react'
import { observer } from 'mobx-react-lite'
import { getFileType, parseFileSize } from '@xkit-yx/utils'
import Icon from '@/NEUIKit/common/components/Icon'
import { V2NIMConst } from 'nim-web-sdk-ng/dist/esm/nim'
import type { V2NIMMessageForUI } from '@xkit-yx/im-store-v2/dist/types/src/types'
import type { V2NIMMessageFileAttachment } from 'nim-web-sdk-ng/dist/esm/nim/src/V2NIMMessageService'
import './index.less'

interface MessageFileProps {
  msg: V2NIMMessageForUI
}

/**
 * 文件消息组件
 */
const MessageFile: React.FC<MessageFileProps> = observer(({ msg }) => {
  // 文件图标映射
  const fileIconMap: Record<string, string> = {
    pdf: 'icon-PPT',
    word: 'icon-Word',
    excel: 'icon-Excel',
    ppt: 'icon-PPT',
    zip: 'icon-RAR1',
    txt: 'icon-qita',
    img: 'icon-tupian2',
    audio: 'icon-yinle',
    video: 'icon-shipin'
  }

  // 获取文件信息
  const { name = '', url = '', ext = '', size = 0 } = (msg.attachment as V2NIMMessageFileAttachment) || {}

  // 文件图标类型
  const iconType = fileIconMap[getFileType(ext)] || 'icon-weizhiwenjian'

  // 处理文件名显示
  const index = name.lastIndexOf('.')
  const prefixName = index > -1 ? name.slice(0, index) : name
  // const suffixName = name.slice(Math.max(index - 5, 0))

  // 下载链接
  const downloadUrl = url + ((url as string).includes('?') ? '&' : '?') + `download=${name}`
  const uploadProgress = Math.max(0, Math.min(100, Number((msg as V2NIMMessageForUI & { uploadProgress?: number }).uploadProgress || 0)))
  const isUploading = msg.sendingState === V2NIMConst.V2NIMMessageSendingState.V2NIM_MESSAGE_SENDING_STATE_SENDING && uploadProgress < 100
  const progressStyle = {
    '--file-upload-progress': `${uploadProgress * 3.6}deg`
  } as React.CSSProperties

  return (
    <a className="msg-file-wrapper" target="_blank" rel="noopener noreferrer" href={downloadUrl} download={name}>
      <div className={!msg.isSelf ? 'msg-file msg-file-in' : 'msg-file msg-file-out'}>
        <div className={`msg-file-icon-wrapper ${isUploading ? 'msg-file-icon-wrapper-uploading' : ''}`} style={progressStyle}>
          <Icon type={iconType} size={32} iconClassName="msg-file-icon" />
          {isUploading && <div className="msg-file-upload-ring"></div>}
        </div>
        <div className="msg-file-content">
          <div className="msg-file-title">
            <div className="msg-file-title-prefix">{prefixName}</div>
            <div className="msg-file-title-suffix">{ext}</div>
          </div>
          <div className="msg-file-size">{parseFileSize(size)}</div>
        </div>
      </div>
    </a>
  )
})

export default MessageFile
