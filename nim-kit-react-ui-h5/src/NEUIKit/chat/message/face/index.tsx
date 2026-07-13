import React, { useState, useRef, useMemo, useCallback } from 'react'
import { observer } from 'mobx-react-lite'
import Icon from '@/NEUIKit/common/components/Icon'
import { useTranslation } from '@/NEUIKit/common/hooks/useTranslate'
import { emojiMap } from '@/NEUIKit/common/utils/emoji'
import './index.less'

interface FaceProps {
  /** 表情点击事件回调 */
  onEmojiClick?: (emoji: { key: string; type: string }) => void
  /** 删除表情事件回调 */
  onEmojiDelete?: () => void
  /** 发送表情事件回调 */
  onEmojiSend?: () => void
}

const ROWS_PER_PAGE = 3
const COLS = 7
const ITEMS_PER_PAGE = ROWS_PER_PAGE * COLS - 1 // 每页留最后一位给删除按钮

/**
 * 表情选择组件
 */
const Face: React.FC<FaceProps> = observer(({ onEmojiClick, onEmojiDelete, onEmojiSend }) => {
  const { t } = useTranslation()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [activePage, setActivePage] = useState(0)

  const emojiArr = useMemo(() => Object.keys(emojiMap), [])

  // 按每页 ITEMS_PER_PAGE 个表情拆分，末位留给删除按钮
  const pages = useMemo(() => {
    const result: string[][][] = []
    let offset = 0
    while (offset < emojiArr.length) {
      const pageItems = emojiArr.slice(offset, offset + ITEMS_PER_PAGE)
      offset += ITEMS_PER_PAGE
      const page: string[][] = []
      for (let i = 0; i < pageItems.length; i += COLS) {
        page.push(pageItems.slice(i, i + COLS))
      }
      while (page.length < ROWS_PER_PAGE) {
        page.push([])
      }
      result.push(page)
    }
    return result
  }, [emojiArr])

  const handleEmojiClick = useCallback(
    (key: string) => onEmojiClick?.({ key, type: emojiMap[key] }),
    [onEmojiClick]
  )

  const handleEmojiDelete = useCallback(() => onEmojiDelete?.(), [onEmojiDelete])
  const handleEmojiSend = useCallback(() => onEmojiSend?.(), [onEmojiSend])

  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      const pageWidth = scrollRef.current.clientWidth
      const page = Math.round(scrollRef.current.scrollLeft / pageWidth)
      setActivePage(page)
    }
  }, [])

  return (
    <div className="emoji-panel-wrapper">
      <div className="emoji-pages" ref={scrollRef} onScroll={handleScroll}>
        {pages.map((page, pageIdx) => (
          <div key={pageIdx} className="emoji-page">
            {(() => {
              const lastItemRowIdx = page.reduce((acc, r, i) => (r.length > 0 ? i : acc), 0)
              return page.map((row, rowIdx) => (
              <div key={rowIdx} className="msg-face-row">
                {Array.from({ length: COLS }).map((_, colIdx) => {
                  const isDeleteSlot = rowIdx === lastItemRowIdx && colIdx === COLS - 1
                  if (isDeleteSlot) {
                    return (
                      <div key="delete" className="msg-face-item msg-face-delete" onClick={handleEmojiDelete}>
                        <Icon type="icon-delete-light" size={27} />
                      </div>
                    )
                  }
                  const key = row[colIdx]
                  if (!key) {
                    return <div key={`ph-${colIdx}`} className="msg-face-item msg-face-placeholder" />
                  }
                  return (
                    <div key={key} className="msg-face-item" onClick={() => handleEmojiClick(key)}>
                      <Icon size={27} type={emojiMap[key]} />
                    </div>
                  )
                })}
              </div>
            ))})()}
          </div>
        ))}
      </div>

      {/* 页面指示器 */}
      {pages.length > 1 && (
        <div className="emoji-indicator">
          {pages.map((_, idx) => (
            <div key={idx} className={`emoji-dot ${idx === activePage ? 'active' : ''}`} />
          ))}
        </div>
      )}

      {/* 底部操作栏 */}
      <div className="msg-face-control">
        <div className="msg-send-btn" onClick={handleEmojiSend}>
          {t('sendText')}
        </div>
      </div>
    </div>
  )
})

export default Face
