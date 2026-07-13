import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { observer } from 'mobx-react-lite'
import FullScreenModal from '@/NEUIKit/common/components/FullScreenModal'
import Avatar from '@/NEUIKit/common/components/Avatar'
import Appellation from '@/NEUIKit/common/components/Appellation'
import MessageForwardModal from '@/NEUIKit/chat/message/message-forward-modal'
import { useTranslation } from '@/NEUIKit/common/hooks/useTranslate'
import { useStateContext } from '@/NEUIKit/common/hooks/useStateContext'
import { toast } from '@/NEUIKit/common/utils/toast'
import searchIcon from '../../../static/icons/icon-sousuo.png'
import { V2NIMConst } from 'nim-web-sdk-ng/dist/esm/nim'
import type { V2NIMTeam } from 'nim-web-sdk-ng/dist/esm/nim/src/V2NIMTeamService'
import type { V2NIMMessageForUI } from '@xkit-yx/im-store-v2/dist/types/src/types'
import { sendMergedForwardMessage } from '../merged-forward/utils'
import { friendGroupByPy } from '@/NEUIKit/common/utils/friend'
import './index.less'

const EMPTY_IMG_URL = 'https://yx-web-nosdn.netease.im/common/e0f58096f06c18cdd101f2614e6afb09/empty.png'

const RECENT_FORWARDS_KEY = 'nim_recent_forwards_v2'
const MAX_RECENT_FORWARDS = 5

interface RecentForwardItem {
  id: string
  type: 'p2p' | 'team'
  name: string
}

function getRecentForwards(accountId?: string): RecentForwardItem[] {
  try {
    const key = accountId ? `${RECENT_FORWARDS_KEY}_${accountId}` : RECENT_FORWARDS_KEY
    const data = localStorage.getItem(key)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function addRecentForward(item: RecentForwardItem, accountId?: string) {
  const list = getRecentForwards(accountId).filter((f) => f.id !== item.id)
  list.unshift(item)
  if (list.length > MAX_RECENT_FORWARDS) list.pop()
  const key = accountId ? `${RECENT_FORWARDS_KEY}_${accountId}` : RECENT_FORWARDS_KEY
  localStorage.setItem(key, JSON.stringify(list))
}

type TabKey = 'recent' | 'friend' | 'team'

interface ForwardTarget {
  id: string
  type: number
  name: string
  avatar?: string
  memberCount?: number
}

const MessageForward: React.FC<{
  visible: boolean
  msgIdClient: string
  onClose: () => void
  conversationId?: string
  msg?: V2NIMMessageForUI
  msgs?: V2NIMMessageForUI[]
  forwardMode?: 'normal' | 'oneByOne' | 'merge'
  onForwardSuccess?: () => void
}> = observer(({ visible, msgIdClient, onClose, conversationId: propConversationId, msg: propMsg, msgs: propMsgs, forwardMode, onForwardSuccess }) => {
  const { t } = useTranslation()
  const { store, nim } = useStateContext()
  const myAccountId = store.userStore.myUserInfo?.accountId || ''

  const [searchText, setSearchText] = useState('')
  const [currentTab, setCurrentTab] = useState<TabKey>('recent')
  const [multiSelect, setMultiSelect] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // 转发确认弹窗
  const [forwardModalVisible, setForwardModalVisible] = useState(false)
  const [forwardTo, setForwardTo] = useState('')
  const [forwardMsg, setForwardMsg] = useState<any>()
  const [forwardConversationType, setForwardConversationType] = useState<V2NIMConst.V2NIMConversationType>(
    V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_P2P
  )
  const [forwardToTeamInfo, setForwardToTeamInfo] = useState<V2NIMTeam>()

  // 多选目标列表（用户在多选模式下选了目标后，弹出二次确认时使用）
  const [forwardTargets, setForwardTargets] = useState<ForwardTarget[]>([])

  // 已选详情弹窗
  const [showSelectedModal, setShowSelectedModal] = useState(false)

  // 最近会话数据：通过 API 主动拉取，存到 state 中
  const [conversationList, setConversationList] = useState<any[]>([])

  const conversationId = propConversationId || store.uiStore.selectedConversation
  const forwardMsgs = propMsgs?.length ? propMsgs : forwardMsg ? [forwardMsg] : []
  const isMergeForward = forwardMode === 'merge'
  const isOneByOneForward = forwardMode === 'oneByOne' || (!!propMsgs?.length && !isMergeForward)

  // 好友列表（过滤黑名单，按拼音排序，与通讯录顺序一致）
  const friendList = useMemo(() => {
    const data = store.uiStore.friends
      .filter((item: { accountId: string }) => !store.relationStore.blacklist.includes(item.accountId))
      .map((item: { accountId: string }) => ({
        id: item.accountId,
        type: V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_P2P as number,
        name: store.uiStore.getAppellation({ account: item.accountId })
      }))
    return friendGroupByPy(data, { firstKey: 'name' }, false).flatMap(g => g.data) as ForwardTarget[]
  }, [store.uiStore.friends, store.relationStore.blacklist])

  // 群聊列表
  const teamList = useMemo(() => {
    return (store.uiStore.teamList || []).map((team: V2NIMTeam) => ({
      id: team.teamId,
      type: V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM as number,
      name: team.name,
      avatar: team.avatar,
      memberCount: team.memberCount,
    }))
  }, [store.uiStore.teamList])

  // 最近会话列表：用 parseConversationTargetId 解析出 targetId 作为 id，后续转发/头像/名称都基于此
  const recentList: ForwardTarget[] = useMemo(() => {
    return conversationList.map((conv: any) => {
      const targetId = nim.V2NIMConversationIdUtil.parseConversationTargetId(conv.conversationId)
      const isTeam = conv.type === V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM
      return {
        id: targetId,
        type: conv.type as number,
        name: conv.name || '',
        avatar: conv.avatar,
        memberCount: isTeam ? store.teamStore.teams.get(targetId)?.memberCount : undefined,
      }
    })
  }, [conversationList, nim])

  // 最近转发：纯 localStorage，用 API 拉取到的 conversationList 匹配并补充名称
  const recentForwards: ForwardTarget[] = useMemo(() => {
    const rawList = getRecentForwards(myAccountId)
    return rawList.map((rf) => {
      const conv = conversationList.find((c: any) =>
        nim.V2NIMConversationIdUtil.parseConversationTargetId(c.conversationId) === rf.id
      )
      return {
        id: rf.id,
        type: conv?.type != null
          ? (conv.type as number)
          : rf.type === 'team'
            ? V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM
            : V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_P2P,
        name: rf.name || conv?.name || '',
        avatar: conv?.avatar,
      }
    })
  }, [conversationList, nim])

  // 过滤后的列表
  const filteredFriends = useMemo(() => {
    if (!searchText) return friendList
    const kw = searchText.toLowerCase()
    return friendList.filter((f) => f.name?.toLowerCase().includes(kw))
  }, [friendList, searchText])

  const filteredTeams = useMemo(() => {
    if (!searchText) return teamList
    const kw = searchText.toLowerCase()
    return teamList.filter((t) => t.name?.toLowerCase().includes(kw))
  }, [teamList, searchText])

  const filteredRecent = useMemo(() => {
    if (!searchText) return recentList
    const kw = searchText.toLowerCase()
    return recentList.filter((r) => r.name?.toLowerCase().includes(kw))
  }, [recentList, searchText])

  // 重置状态 & 主动加载会话列表（对齐 Android getConversationList）
  // 根据配置选择云端或本地会话接口
  useEffect(() => {
    if (visible) {
      setSearchText('')
      setCurrentTab('recent')
      setMultiSelect(false)
      setSelectedIds([])
      const loaderPromise = store.sdkOptions?.enableV2CloudConversation
        ? store.conversationStore?.getConversationListActive(0, 100)
        : store.localConversationStore?.getConversationListActive?.(0, 100)
      if (loaderPromise) {
        loaderPromise.then((res: any) => {
          setConversationList(res?.conversationList || [])
        })
      }
    }
  }, [visible])

  const forwardListRef = useRef<HTMLDivElement>(null)

  // 切换标签（不清空已选项，跨 tab 保留选中状态）
  const switchTab = useCallback((tab: TabKey) => {
    setCurrentTab(tab)
    forwardListRef.current?.scrollTo(0, 0)
  }, [])

  // 切换多选模式（退出时清空选中）
  const toggleMultiSelect = useCallback(() => {
    setMultiSelect((v) => {
      if (v) {
        setSelectedIds([])
      }
      return !v
    })
  }, [])

  // 点击多选模式下的条目
  const toggleSelectItem = useCallback((id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter(i => i !== id)
      }
      return [...prev, id]
    })
  }, [])

  // 点击条目 - 触发转发确认
  const handleItemClick = useCallback((target: ForwardTarget) => {
    if (multiSelect) {
      if (selectedIds.length >= 9 && !selectedIds.includes(target.id)) {
        toast.info(t('forwardMultiSelectLimitText'))
        return
      }
      toggleSelectItem(target.id)
      return
    }

    setForwardTo(target.id)
    setForwardConversationType(target.type as V2NIMConst.V2NIMConversationType)

    const msg = propMsgs?.[0] || propMsg || store.msgStore.getMsg(conversationId, [msgIdClient])?.[0]
    setForwardMsg(msg)
    setForwardModalVisible(true)

    if (target.type === V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM) {
      const teamInfo = store.teamStore.teams.get(target.id)
      setForwardToTeamInfo(teamInfo)
    }
  }, [multiSelect, selectedIds, propMsgs, propMsg, conversationId, msgIdClient, store, toggleSelectItem])

  // 处理转发确认
  const handleForwardConfirm = useCallback((forwardComment: string) => {
    setForwardModalVisible(false)

    if (!forwardMsgs.length) {
      toast.info(t('getForwardMessageFailed'))
      return
    }

    // 多选模式：发送给多个目标
    if (forwardTargets.length > 0) {
      const targets = forwardTargets
      const sendPromises = targets.map((target) => {
        const methodName = target.type === V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_P2P
          ? 'p2pConversationId' : 'teamConversationId'
        const targetConversationId = nim.V2NIMConversationIdUtil[methodName](target.id)

        if (isMergeForward) {
          return sendMergedForwardMessage({
            store,
            nim,
            msgs: forwardMsgs,
            conversationId: targetConversationId,
            sourceConversationId: conversationId,
            appVersion: process.env.APP_VERSION || '',
            chatHistoryText: t('chatHistoryText'),
            comment: forwardComment
          })
        }
        return Promise.all(forwardMsgs.map((msg: any) => store.msgStore.forwardMsgActive(msg, targetConversationId)).concat(
          forwardComment
            ? [store.msgStore.sendMessageActive({ msg: nim.V2NIMMessageCreator.createTextMessage(forwardComment), conversationId: targetConversationId })]
            : []
        ))
      })

      Promise.all(sendPromises)
        .then(() => {
          toast.info(t('forwardSuccessText'))
          onForwardSuccess?.()
          targets.forEach((target) => {
            addRecentForward({
              id: target.id,
              type: target.type === V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_P2P ? 'p2p' : 'team',
              name: target.name
            }, myAccountId)
          })
        })
        .catch(() => {
          toast.info(t('forwardFailedText'))
        })
        .finally(() => {
          setForwardTargets([])
          onClose()
        })
      return
    }

    // 单选模式
    const methodName = forwardConversationType === V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_P2P
      ? 'p2pConversationId' : 'teamConversationId'

    const forwardConversationId = nim.V2NIMConversationIdUtil[methodName](forwardTo)

    const forwardPromise = isMergeForward
      ? sendMergedForwardMessage({
          store,
          nim,
          msgs: forwardMsgs,
          conversationId: forwardConversationId,
          sourceConversationId: conversationId,
          appVersion: process.env.APP_VERSION || '',
          chatHistoryText: t('chatHistoryText'),
          comment: forwardComment
        })
      : Promise.all(forwardMsgs.map((msg: any) => store.msgStore.forwardMsgActive(msg, forwardConversationId)).concat(
          forwardComment
            ? [store.msgStore.sendMessageActive({ msg: nim.V2NIMMessageCreator.createTextMessage(forwardComment), conversationId: forwardConversationId })]
            : []
        ))

    Promise.resolve(forwardPromise)
      .then(() => {
        toast.info(t('forwardSuccessText'))
        onForwardSuccess?.()
        addRecentForward({
          id: forwardTo,
          type: forwardConversationType === V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_P2P ? 'p2p' : 'team',
          name: ''
        }, myAccountId)
      })
      .catch(() => {
        toast.info(t('forwardFailedText'))
      })
      .finally(() => {
        onClose()
      })
  }, [forwardMsgs, forwardConversationType, forwardTo, forwardTargets, isMergeForward, conversationId, store, nim, t, onForwardSuccess, onClose])

  // 处理转发取消
  const handleForwardCancel = useCallback(() => {
    setForwardModalVisible(false)
  }, [])

  // 多选：从所有 tab 收集已选目标，弹出二次确认框
  const handleMultiSend = useCallback(() => {
    if (selectedIds.length === 0) return

    // 从所有 tab 收集已选目标，按选择顺序排列
    const allTargets = [...recentList, ...friendList, ...teamList]
    const targetMap = new Map(allTargets.map(t => [t.id, t]))
    const seen = new Set<string>()
    const targets: ForwardTarget[] = []
    selectedIds.forEach((id) => {
      if (!seen.has(id)) {
        seen.add(id)
        const target = targetMap.get(id)
        if (target) targets.push(target)
      }
    })

    if (!targets.length) return

    // 确保消息已获取
    const msg = propMsgs?.[0] || propMsg || store.msgStore.getMsg(conversationId, [msgIdClient])?.[0]
    if (msg) {
      setForwardMsg(msg)
    }

    setForwardTargets(targets)
    setForwardModalVisible(true)
  }, [selectedIds, recentList, friendList, teamList, propMsgs, propMsg, conversationId, msgIdClient, store])

  // 头部右侧按钮
  const rightContent = multiSelect ? (
    <button className="forward-multi-send-btn" type="button" onClick={handleMultiSend} disabled={selectedIds.length === 0}>
      {t('yesText')}
    </button>
  ) : (
    <button className="forward-multi-select-btn" type="button" onClick={toggleMultiSelect}>
      {t('multiSelectText')}
    </button>
  )

  // 多选模式下，已选项的头像列表（展示在搜索框下方）
  const selectedAvatars = useMemo(() => {
    if (!multiSelect || selectedIds.length === 0) return []
    const result: ForwardTarget[] = []
    const allTargets = [...recentList, ...friendList, ...teamList]
    const targetMap = new Map(allTargets.map(t => [t.id, t]))
    selectedIds.forEach((id) => {
      const target = targetMap.get(id)
      if (target) result.push(target)
    })
    return result
  }, [multiSelect, selectedIds, recentList, friendList, teamList])

  // 渲染水平小头像（最近转发）
  const renderRecentForwardItem = (item: ForwardTarget) => {
    const isSelected = multiSelect && selectedIds.includes(item.id)
    return (
      <div
        key={`rf-${item.id}`}
        className={`forward-recent-item${isSelected ? ' forward-recent-item-selected' : ''}`}
        onClick={() => handleItemClick(item)}
      >
        <Avatar account={item.id} avatar={item.avatar} size="36" />
        <div className="forward-recent-name">
          {item.type === V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_P2P ? (
            <Appellation account={item.id} />
          ) : (
            <span>{item.name}</span>
          )}
        </div>
        {multiSelect && (
          <div className={`forward-checkbox forward-checkbox-small${isSelected ? ' forward-checkbox-checked' : ''}`}>
            {isSelected && <span className="forward-checkbox-icon">✓</span>}
          </div>
        )}
      </div>
    )
  }

  // 渲染列表项
  const renderItem = (item: ForwardTarget) => {
    const isSelected = multiSelect && selectedIds.includes(item.id)
    return (
      <div
        key={item.id}
        className={`forward-list-item${isSelected ? ' forward-list-item-selected' : ''}`}
        onClick={() => handleItemClick(item)}
      >
        {multiSelect && (
          <div className={`forward-checkbox${isSelected ? ' forward-checkbox-checked' : ''}`}>
            {isSelected && <span className="forward-checkbox-icon">✓</span>}
          </div>
        )}
        <Avatar account={item.id} avatar={item.avatar} size="40" />
        <div className="forward-item-name">
          {item.type === V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_P2P ? (
            <Appellation account={item.id} />
          ) : (
            <>
              <span className="forward-item-name-text">{item.name}</span>
              {item.memberCount != null && (
                <span className="forward-item-count">({item.memberCount})</span>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'recent', label: t('recentSessionText') },
    { key: 'friend', label: t('myFriendText') },
    { key: 'team', label: t('teamChooseText') }
  ]

  return (
    <>
      <FullScreenModal
        visible={visible}
        title={t('chooseText')}
        onBack={onClose}
        leftContent={<span>{t('cancelText')}</span>}
        rightContent={rightContent}
        backAriaLabel={t('cancelText')}
        contentClassName="forward-fullscreen-content"
      >
        {/* 搜索框 */}
        <div className="forward-search-wrapper">
          <div className="forward-search-box">
            <img className="forward-search-icon" src={searchIcon} alt="" />
            <input
              className="forward-search-input"
              type="text"
              placeholder={t('searchText')}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
            {searchText && (
              <span className="forward-search-clear" onClick={() => setSearchText('')}>✕</span>
            )}
          </div>
        </div>

        {/* 多选模式下，已选头像展示区 */}
        {multiSelect && selectedAvatars.length > 0 && (
          <div className="forward-selected-bar" onClick={() => setShowSelectedModal(true)}>
            <div className="forward-selected-scroll">
              {selectedAvatars.map((item) => (
                <Avatar key={item.id} account={item.id} avatar={item.avatar} size="36" />
              ))}
            </div>
            <span className="forward-selected-arrow">›</span>
          </div>
        )}

        {/* 最近转发 水平滚动栏（在 tab 之上，搜索时隐藏） */}
        {!searchText && recentForwards.length > 0 && (
          <div className="forward-recent-bar">
            <div className="forward-recent-label">{t('recentForwardText')}</div>
            <div className="forward-recent-scroll">
              {recentForwards.map(renderRecentForwardItem)}
            </div>
          </div>
        )}

        {/* 标签栏 */}
        <div className="forward-tabs">
          {tabs.map((tab) => (
            <div
              key={tab.key}
              className={`forward-tab-item${currentTab === tab.key ? ' forward-tab-active' : ''}`}
              onClick={() => switchTab(tab.key)}
            >
              {tab.label}
            </div>
          ))}
        </div>

        {/* 列表 */}
        <div className="forward-list" ref={forwardListRef}>
          {currentTab === 'recent' && (
            <>
              {recentList.length === 0 ? (
                <div className="forward-empty">{t('conversationEmptyText')}</div>
              ) : searchText && filteredRecent.length === 0 ? (
                <div className="forward-search-empty">
                  <img className="forward-search-empty-img" src={EMPTY_IMG_URL} alt="empty" />
                  <div className="forward-search-empty-text">
                    {t('searchNoResultPrefix')}<span className="forward-search-empty-keyword">{searchText}</span>{t('searchNoResultSuffix')}
                  </div>
                </div>
              ) : (
                <div className="forward-list-section">
                  {filteredRecent.map(renderItem)}
                </div>
              )}
            </>
          )}
          {currentTab === 'friend' && (
            <>
              {friendList.length === 0 ? (
                <div className="forward-empty">{t('noFriendText')}</div>
              ) : searchText && filteredFriends.length === 0 ? (
                <div className="forward-search-empty">
                  <img className="forward-search-empty-img" src={EMPTY_IMG_URL} alt="empty" />
                  <div className="forward-search-empty-text">
                    {t('searchNoResultPrefix')}<span className="forward-search-empty-keyword">{searchText}</span>{t('searchNoResultSuffix')}
                  </div>
                </div>
              ) : (
                <div className="forward-list-section">
                  {filteredFriends.map(renderItem)}
                </div>
              )}
            </>
          )}
          {currentTab === 'team' && (
            <>
              {teamList.length === 0 ? (
                <div className="forward-empty">{t('teamEmptyText')}</div>
              ) : searchText && filteredTeams.length === 0 ? (
                <div className="forward-search-empty">
                  <img className="forward-search-empty-img" src={EMPTY_IMG_URL} alt="empty" />
                  <div className="forward-search-empty-text">
                    {t('searchNoResultPrefix')}<span className="forward-search-empty-keyword">{searchText}</span>{t('searchNoResultSuffix')}
                  </div>
                </div>
              ) : (
                <div className="forward-list-section">
                  {filteredTeams.map(renderItem)}
                </div>
              )}
            </>
          )}
        </div>
      </FullScreenModal>

      {/* 已选详情弹窗 */}
      <FullScreenModal
        visible={showSelectedModal}
        title={`${t('selectedText')}(${selectedAvatars.length})`}
        onBack={() => setShowSelectedModal(false)}
        leftContent={<span>{t('cancelText')}</span>}
      >
        <div className="forward-selected-detail-list">
          {selectedAvatars.map((item) => {
            const memberCount = item.type === V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM
              ? store.teamStore.teams.get(item.id)?.memberCount
              : undefined
            return (
              <div key={item.id} className="forward-selected-detail-item">
                <Avatar account={item.id} avatar={item.avatar} size="40" />
                <div className="forward-selected-detail-name">
                  {item.type === V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_P2P ? (
                    <Appellation account={item.id} />
                  ) : (
                    <span>{item.name}</span>
                  )}
                  {memberCount !== undefined && (
                    <span className="forward-selected-detail-count">({memberCount})</span>
                  )}
                </div>
                <span
                  className="forward-selected-detail-remove"
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleSelectItem(item.id)
                  }}
                >✕</span>
              </div>
            )
          })}
        </div>
      </FullScreenModal>

      <MessageForwardModal
        forwardModalVisible={forwardModalVisible}
        forwardTo={forwardTo}
        forwardMsg={forwardMsg}
        sourceConversationId={conversationId}
        forwardConversationType={forwardConversationType}
        forwardToTeamInfo={forwardToTeamInfo}
        isOneByOneForward={isOneByOneForward}
        isMergeForward={isMergeForward}
        forwardTargets={forwardTargets}
        onConfirm={handleForwardConfirm}
        onCancel={handleForwardCancel}
      />
    </>
  )
})

export default MessageForward
