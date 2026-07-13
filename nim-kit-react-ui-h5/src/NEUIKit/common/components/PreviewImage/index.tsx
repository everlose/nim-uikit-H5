import React, { useEffect } from 'react'
import './index.less'

export interface PreviewImageProps {
  /**
   * 是否可见
   */
  visible: boolean
  /**
   * 图片URL
   */
  imageUrl: string
  /**
   * 关闭回调
   */
  onClose?: () => void
}

const CloseIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
    <circle cx="14" cy="14" r="14" fill="#4C4C4C"/>
    <line x1="9" y1="9" x2="18.5" y2="18.5" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
    <line x1="19" y1="9" x2="9.5" y2="18.5" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
  </svg>
)

const DownloadIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
    <circle cx="14" cy="14" r="14" fill="#4C4C4C"/>
    <path d="M14.5,6 C15.0523,6 15.5,6.4477 15.5,7 V10 H13.5 V7 C13.5,6.4477 13.9477,6 14.5,6 Z M13.5,10 H10 C8.8954,10 8,10.8954 8,12 V20 C8,21.1046 8.8954,22 10,22 H19 C20.1046,22 21,21.1046 21,20 V12 C21,10.8954 20.1046,10 19,10 H15.5 V16.0858 L17.2929,14.2929 C17.6834,13.9024 18.3166,13.9024 18.7071,14.2929 C19.0976,14.6834 19.0976,15.3166 18.7071,15.7071 L15.2071,19.2071 C14.8166,19.5976 14.1834,19.5976 13.7929,19.2071 L10.2929,15.7071 C9.9024,15.3166 9.9024,14.6834 10.2929,14.2929 C10.6834,13.9024 11.3166,13.9024 11.7071,14.2929 L13.5,16.0858 V10 Z" fill="#fff" fillRule="evenodd"/>
  </svg>
)

/**
 * 图片预览组件
 */
const PreviewImage: React.FC<PreviewImageProps> = ({ visible, imageUrl, onClose }) => {
  // 当组件可见时，禁止背景滚动
  useEffect(() => {
    if (visible) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    // 组件卸载时恢复滚动
    return () => {
      document.body.style.overflow = ''
    }
  }, [visible])

  const handleClose = () => {
    onClose?.()
  }

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation()
    fetch(imageUrl)
      .then(res => res.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = (imageUrl.split('/').pop() || 'image').split('?')[0]
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      })
      .catch(() => {
        // fallback: open in new tab
        window.open(imageUrl, '_blank', 'noopener,noreferrer')
      })
  }

  if (!visible) {
    return null
  }

  return (
    <div className="nim-preview-image-container">
      <img src={imageUrl} className="nim-preview-image" alt="" />
      <button className="nim-preview-close-btn" onClick={handleClose} type="button" aria-label="关闭">
        <CloseIcon />
      </button>
      <button className="nim-preview-download-btn" onClick={handleDownload} type="button" aria-label="下载">
        <DownloadIcon />
      </button>
    </div>
  )
}

export default PreviewImage
