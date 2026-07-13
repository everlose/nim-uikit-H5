import React, { useState, useEffect } from 'react'
import { observer } from 'mobx-react-lite'
import NavBar from '@/NEUIKit/common/components/NavBar'
import Empty from '@/NEUIKit/common/components/Empty'
import { modal } from '@/NEUIKit/common/utils/modal'
import Avatar from '@/NEUIKit/common/components/Avatar'
import Icon from '@/NEUIKit/common/components/Icon'
import Appellation from '@/NEUIKit/common/components/Appellation'
import { useTranslation } from '@/NEUIKit/common/hooks/useTranslate'
import { useStateContext } from '@/NEUIKit/common/hooks/useStateContext'
import { toast } from '@/NEUIKit/common/utils/toast'
import { V2NIMFriendAddApplicationForUI, V2NIMTeamJoinActionInfoForUI } from '@xkit-yx/im-store-v2/dist/types/src/types'
import { V2NIMConst } from 'nim-web-sdk-ng/dist/esm/nim'
import type { V2NIMTeam } from 'nim-web-sdk-ng/dist/esm/nim/src/V2NIMTeamService'
import { V2NIMMessage } from 'nim-web-sdk-ng/dist/esm/nim/src/V2NIMMessageService'
import './index.less'

type TabType = 'friend' | 'team'

/**
 * 验证消息列表页面
 */
const ValidList: React.FC = observer(() => {
  const { t } = useTranslation()
  const { store } = useStateContext()

  const [activeTab, setActiveTab] = useState<TabType>('friend')

  // 好友申请列表
  const [friendMsgList, setFriendMsgList] = useState<V2NIMFriendAddApplicationForUI[]>([])
  // 群组申请/邀请列表
  const [teamMsgList, setTeamMsgList] = useState<V2NIMTeamJoinActionInfoForUI[]>([])

  // 监听好友申请消息
  useEffect(() => {
    const friendApplyMsgs = store.sysMsgStore.friendApplyMsgs || []
    friendApplyMsgs.forEach((item) => {
      store.userStore.getUserActive(item.applicantAccountId)
    })
    setFriendMsgList(friendApplyMsgs)
  }, [store.sysMsgStore.friendApplyMsgs])

  // 群组名称缓存，用于显示验证消息中的群名称
  const [teamNameMap, setTeamNameMap] = useState<Record<string, string>>({})

  // 监听群组申请消息
  useEffect(() => {
    const teamMsgs = store.sysMsgStore.teamJoinActionMsgs || []
    teamMsgs.forEach((item) => {
      store.userStore.getUserActive(item.operatorAccountId)
      // 获取群名称，优先从已加入群列表查找，否则通过 SDK 查询
      if (!teamNameMap[item.teamId]) {
        const joinedTeam = (store.uiStore.teamList || []).find((t: V2NIMTeam) => t.teamId === item.teamId)
        if (joinedTeam?.name) {
          setTeamNameMap(prev => ({ ...prev, [item.teamId]: joinedTeam.name }))
        } else {
          store.teamStore.getTeamActive(item.teamId, item.teamType).then((team) => {
            if (team?.name) {
              setTeamNameMap(prev => ({ ...prev, [item.teamId]: team.name }))
            }
          })
        }
      }
    })
    setTeamMsgList(teamMsgs)
  }, [store.sysMsgStore.teamJoinActionMsgs])

  // 点击清空按钮，弹出确认弹窗
  const handleClearClick = () => {
    const isFriend = activeTab === 'friend'
    modal.confirm({
      title: isFriend ? t('clearFriendConfirmTitle') : t('clearTeamConfirmTitle'),
      content: isFriend ? t('clearFriendConfirmContent') : t('clearTeamConfirmContent'),
      confirmText: t('acceptText'),
      cancelText: t('cancelText'),
      onConfirm: async () => {
        if (isFriend) {
          store.sysMsgStore.deleteFriendApplyMsg(friendMsgList)
          store.nim.V2NIMFriendService.clearAllAddApplication().catch(() => {})
        } else {
          store.sysMsgStore.deleteTeamJoinActionMsg(teamMsgList)
          store.nim.V2NIMTeamService.clearAllTeamJoinActionInfo().catch(() => {})
        }
      }
    }).catch(() => {
      // 用户取消
    })
  }

  // 判断是否是自己发起的申请
  const isMeApplicant = (data: V2NIMFriendAddApplicationForUI) => {
    return data.applicantAccountId === store.userStore.myUserInfo.accountId
  }

  // 拒绝好友申请
  const handleRejectApplyFriendClick = async (msg: V2NIMFriendAddApplicationForUI) => {
    try {
      await store.friendStore.rejectAddApplicationActive(msg)
      toast.info(t('rejectedText'))
    } catch (error) {
      toast.info(t('rejectFailedText'))
    }
  }

  // 接受好友申请
  const handleAcceptApplyFriendClick = async (msg: V2NIMFriendAddApplicationForUI) => {
    try {
      try {
        await store.friendStore.acceptAddApplicationActive(msg)
        toast.info(t('acceptedText'))
      } catch (error) {
        toast.info(t('acceptFailedText'))
        return
      }

      const textMsg = store.nim.V2NIMMessageCreator.createTextMessage(t('passFriendAskText')) as unknown as V2NIMMessage
      await store.msgStore.sendMessageActive({
        msg: textMsg,
        conversationId: store.nim.V2NIMConversationIdUtil.p2pConversationId(msg.operatorAccountId)
      })
    } catch (error) {
      console.log('HandleAcceptApplyFriendClick error', error)
    }
  }

  // 接受群组邀请
  const handleAcceptTeamInvite = async (msg: V2NIMTeamJoinActionInfoForUI) => {
    try {
      await store.teamStore.acceptTeamInviteActive(msg)
      toast.info(t('acceptedText'))
    } catch (error) {
      toast.info(t('acceptFailedText'))
    }
  }

  // 拒绝群组邀请
  const handleRejectTeamInvite = async (msg: V2NIMTeamJoinActionInfoForUI) => {
    try {
      await store.teamStore.rejectTeamInviteActive(msg)
      toast.info(t('rejectedText'))
    } catch (error) {
      toast.info(t('rejectFailedText'))
    }
  }

  // 同意入群申请
  const handleAcceptTeamApply = async (msg: V2NIMTeamJoinActionInfoForUI) => {
    try {
      await store.teamStore.acceptJoinApplicationActive(msg)
      toast.info(t('acceptedText'))
    } catch (error) {
      toast.info(t('acceptFailedText'))
    }
  }

  // 拒绝入群申请
  const handleRejectTeamApply = async (msg: V2NIMTeamJoinActionInfoForUI) => {
    try {
      await store.teamStore.rejectTeamApplyActive(msg)
      toast.info(t('rejectedText'))
    } catch (error) {
      toast.info(t('rejectFailedText'))
    }
  }

  // 渲染好友验证消息项
  const renderFriendItem = (msg: V2NIMFriendAddApplicationForUI) => {
    if (msg.status === V2NIMConst.V2NIMFriendAddApplicationStatus.V2NIM_FRIEND_ADD_APPLICATION_STATUS_AGREED) {
      return (
        <>
          <div className="valid-item-left">
            <Avatar account={msg.applicantAccountId} />
            <div className="valid-name-container">
              <div className="valid-name">
                <Appellation account={msg.applicantAccountId} />
              </div>
              <div className="valid-action">{t('applyFriendText')}</div>
            </div>
          </div>
          <div className="valid-state">
            <Icon type="icon-yidu" />
            <span className="valid-state-text">{t('acceptResultText')}</span>
          </div>
        </>
      )
    } else if (msg.status === V2NIMConst.V2NIMFriendAddApplicationStatus.V2NIM_FRIEND_ADD_APPLICATION_STATUS_REJECTED) {
      if (isMeApplicant(msg)) {
        return (
          <div className="valid-item-left">
            <Avatar account={msg.recipientAccountId} />
            <div className="valid-name-container">
              <div className="valid-name">
                <Appellation account={msg.recipientAccountId} />
              </div>
              <div className="valid-action">{t('beRejectResultText')}</div>
            </div>
          </div>
        )
      } else {
        return (
          <>
            <div className="valid-item-left">
              <Avatar account={msg.applicantAccountId} />
              <div className="valid-name-container">
                <div className="valid-name">
                  <Appellation account={msg.applicantAccountId} />
                </div>
                <div className="valid-action">{t('applyFriendText')}</div>
              </div>
            </div>
            <div className="valid-state">
              <Icon type="icon-shandiao" />
              <span className="valid-state-text">{t('rejectResultText')}</span>
            </div>
          </>
        )
      }
    } else if (msg.status === V2NIMConst.V2NIMFriendAddApplicationStatus.V2NIM_FRIEND_ADD_APPLICATION_STATUS_EXPIRED) {
      if (isMeApplicant(msg)) {
        return (
          <div className="valid-item-left">
            <Avatar account={msg.recipientAccountId} />
            <div className="valid-name-container">
              <div className="valid-name">
                <Appellation account={msg.recipientAccountId} />
              </div>
              <div className="valid-action">{t('applyFriendText')}</div>
            </div>
          </div>
        )
      } else {
        return (
          <>
            <div className="valid-item-left">
              <Avatar account={msg.applicantAccountId} />
              <div className="valid-name-container">
                <div className="valid-name">
                  <Appellation account={msg.applicantAccountId} />
                </div>
                <div className="valid-action">{t('applyFriendText')}</div>
              </div>
            </div>
            <div className="valid-state">
              <Icon type="icon-shandiao" />
              <span className="valid-state-text">{t('expiredText')}</span>
            </div>
          </>
        )
      }
    } else if (msg.status === V2NIMConst.V2NIMFriendAddApplicationStatus.V2NIM_FRIEND_ADD_APPLICATION_STATUS_INIT) {
      if (!isMeApplicant(msg)) {
        return (
          <>
            <div className="valid-item-left">
              <Avatar account={msg.applicantAccountId} />
              <div className="valid-name-container">
                <div className="valid-name">
                  <Appellation account={msg.applicantAccountId} />
                </div>
                <div className="valid-action">{t('applyFriendText')}</div>
              </div>
            </div>
            <div className="valid-buttons">
              <div className="valid-button button-reject" onClick={() => handleRejectApplyFriendClick(msg)}>
                {t('rejectText')}
              </div>
              <div className="valid-button button-accept" onClick={() => handleAcceptApplyFriendClick(msg)}>
                {t('acceptText')}
              </div>
            </div>
          </>
        )
      }
    }
    return null
  }

  // 渲染群组验证消息项
  const renderTeamItem = (msg: V2NIMTeamJoinActionInfoForUI) => {
    const actionType = msg.actionType
    const actionStatus = msg.actionStatus
    const teamName = teamNameMap[msg.teamId] || msg.teamId

    // 申请入群
    if (actionType === V2NIMConst.V2NIMTeamJoinActionType.V2NIM_TEAM_JOIN_ACTION_TYPE_APPLICATION) {
      if (actionStatus === V2NIMConst.V2NIMTeamJoinActionStatus.V2NIM_TEAM_JOIN_ACTION_STATUS_INIT) {
        return (
          <>
            <div className="valid-item-left">
              <Avatar account={msg.operatorAccountId} />
              <div className="valid-name-container">
                <div className="valid-name">
                  <Appellation account={msg.operatorAccountId} />
                </div>
                <div className="valid-action">{t('applyTeamText')} {teamName}</div>
              </div>
            </div>
            <div className="valid-buttons">
              <div className="valid-button button-reject" onClick={() => handleRejectTeamApply(msg)}>
                {t('rejectText')}
              </div>
              <div className="valid-button button-accept" onClick={() => handleAcceptTeamApply(msg)}>
                {t('acceptText')}
              </div>
            </div>
          </>
        )
      } else if (actionStatus === V2NIMConst.V2NIMTeamJoinActionStatus.V2NIM_TEAM_JOIN_ACTION_STATUS_AGREED) {
        return (
          <>
            <div className="valid-item-left">
              <Avatar account={msg.operatorAccountId} />
              <div className="valid-name-container">
                <div className="valid-name">
                  <Appellation account={msg.operatorAccountId} />
                </div>
                <div className="valid-action">{t('applyTeamText')} {teamName}</div>
              </div>
            </div>
            <div className="valid-state">
              <Icon type="icon-yidu" />
              <span className="valid-state-text">{t('acceptResultText')}</span>
            </div>
          </>
        )
      } else if (actionStatus === V2NIMConst.V2NIMTeamJoinActionStatus.V2NIM_TEAM_JOIN_ACTION_STATUS_REJECTED) {
        return (
          <>
            <div className="valid-item-left">
              <Avatar account={msg.operatorAccountId} />
              <div className="valid-name-container">
                <div className="valid-name">
                  <Appellation account={msg.operatorAccountId} />
                </div>
                <div className="valid-action">{t('applyTeamText')} {teamName}</div>
              </div>
            </div>
            <div className="valid-state">
              <Icon type="icon-shandiao" />
              <span className="valid-state-text">{t('rejectResultText')}</span>
            </div>
          </>
        )
      } else if (actionStatus === V2NIMConst.V2NIMTeamJoinActionStatus.V2NIM_TEAM_JOIN_ACTION_STATUS_EXPIRED) {
        return (
          <>
            <div className="valid-item-left">
              <Avatar account={msg.operatorAccountId} />
              <div className="valid-name-container">
                <div className="valid-name">
                  <Appellation account={msg.operatorAccountId} />
                </div>
                <div className="valid-action">{t('applyTeamText')} {teamName}</div>
              </div>
            </div>
            <div className="valid-state">
              <Icon type="icon-shandiao" />
              <span className="valid-state-text">{t('expiredText')}</span>
            </div>
          </>
        )
      }
    }

    // 邀请入群
    if (actionType === V2NIMConst.V2NIMTeamJoinActionType.V2NIM_TEAM_JOIN_ACTION_TYPE_INVITATION) {
      if (actionStatus === V2NIMConst.V2NIMTeamJoinActionStatus.V2NIM_TEAM_JOIN_ACTION_STATUS_INIT) {
        return (
          <>
            <div className="valid-item-left">
              <Avatar account={msg.operatorAccountId} />
              <div className="valid-name-container">
                <div className="valid-name">
                  <Appellation account={msg.operatorAccountId} />
                </div>
                <div className="valid-action">{t('inviteTeamText')} {teamName}</div>
              </div>
            </div>
            <div className="valid-buttons">
              <div className="valid-button button-reject" onClick={() => handleRejectTeamInvite(msg)}>
                {t('rejectText')}
              </div>
              <div className="valid-button button-accept" onClick={() => handleAcceptTeamInvite(msg)}>
                {t('acceptText')}
              </div>
            </div>
          </>
        )
      } else if (actionStatus === V2NIMConst.V2NIMTeamJoinActionStatus.V2NIM_TEAM_JOIN_ACTION_STATUS_AGREED) {
        return (
          <>
            <div className="valid-item-left">
              <Avatar account={msg.operatorAccountId} />
              <div className="valid-name-container">
                <div className="valid-name">
                  <Appellation account={msg.operatorAccountId} />
                </div>
                <div className="valid-action">{t('inviteTeamText')} {teamName}</div>
              </div>
            </div>
            <div className="valid-state">
              <Icon type="icon-yidu" />
              <span className="valid-state-text">{t('acceptResultText')}</span>
            </div>
          </>
        )
      } else if (actionStatus === V2NIMConst.V2NIMTeamJoinActionStatus.V2NIM_TEAM_JOIN_ACTION_STATUS_REJECTED) {
        return (
          <>
            <div className="valid-item-left">
              <Avatar account={msg.operatorAccountId} />
              <div className="valid-name-container">
                <div className="valid-name">
                  <Appellation account={msg.operatorAccountId} />
                </div>
                <div className="valid-action">{t('rejectTeamInviteText')} {teamName}</div>
              </div>
            </div>
            <div className="valid-state">
              <Icon type="icon-shandiao" />
              <span className="valid-state-text">{t('rejectResultText')}</span>
            </div>
          </>
        )
      } else if (actionStatus === V2NIMConst.V2NIMTeamJoinActionStatus.V2NIM_TEAM_JOIN_ACTION_STATUS_EXPIRED) {
        return (
          <>
            <div className="valid-item-left">
              <Avatar account={msg.operatorAccountId} />
              <div className="valid-name-container">
                <div className="valid-name">
                  <Appellation account={msg.operatorAccountId} />
                </div>
                <div className="valid-action">{t('inviteTeamText')} {teamName}</div>
              </div>
            </div>
            <div className="valid-state">
              <Icon type="icon-shandiao" />
              <span className="valid-state-text">{t('expiredText')}</span>
            </div>
          </>
        )
      }
    }

    // 已处理的其他类型（accept_application, accept_invitation, reject_application, reject_invitation）
    // 这些是已经处理完的回执，只显示状态
    if (actionStatus === V2NIMConst.V2NIMTeamJoinActionStatus.V2NIM_TEAM_JOIN_ACTION_STATUS_AGREED) {
      const label = actionType === V2NIMConst.V2NIMTeamJoinActionType.V2NIM_TEAM_JOIN_ACTION_TYPE_ACCEPT_APPLICATION ||
        actionType === V2NIMConst.V2NIMTeamJoinActionType.V2NIM_TEAM_JOIN_ACTION_TYPE_ACCEPT_INVITATION
        ? t('acceptResultText')
        : t('rejectResultText')
      return (
        <>
          <div className="valid-item-left">
            <Avatar account={msg.operatorAccountId} />
            <div className="valid-name-container">
              <div className="valid-name">
                <Appellation account={msg.operatorAccountId} />
              </div>
              <div className="valid-action">{t('inviteTeamText')} {teamName}</div>
            </div>
          </div>
          <div className="valid-state">
            <Icon type="icon-yidu" />
            <span className="valid-state-text">{label}</span>
          </div>
        </>
      )
    }
    if (actionStatus === V2NIMConst.V2NIMTeamJoinActionStatus.V2NIM_TEAM_JOIN_ACTION_STATUS_EXPIRED) {
      return (
        <>
          <div className="valid-item-left">
            <Avatar account={msg.operatorAccountId} />
            <div className="valid-name-container">
              <div className="valid-name">
                <Appellation account={msg.operatorAccountId} />
              </div>
              <div className="valid-action">{t('inviteTeamText')} {teamName}</div>
            </div>
          </div>
          <div className="valid-state">
            <Icon type="icon-shandiao" />
            <span className="valid-state-text">{t('expiredText')}</span>
          </div>
        </>
      )
    }
    return null
  }

  const currentList = activeTab === 'friend' ? friendMsgList : teamMsgList
  const hasData = currentList.length > 0

  return (
    <div className="valid-list-container">
      <NavBar
        title={t('validMsgText')}
        rightContent={
          <div className="valid-clear-btn" onClick={handleClearClick}>
            {t('clearText')}
          </div>
        }
      />

      <div className="valid-tabs">
        <div
          className={`valid-tab ${activeTab === 'friend' ? 'valid-tab-active' : ''}`}
          onClick={() => setActiveTab('friend')}
        >
          {t('friendTabText')}
        </div>
        <div
          className={`valid-tab ${activeTab === 'team' ? 'valid-tab-active' : ''}`}
          onClick={() => setActiveTab('team')}
        >
          {t('teamTabText')}
        </div>
      </div>

      <div className="valid-list-content">
        {!hasData ? (
          <Empty text={t('validEmptyText')} />
        ) : activeTab === 'friend' ? (
          friendMsgList.map((msg) => (
            <div className="valid-item" key={msg.timestamp}>
              {renderFriendItem(msg)}
            </div>
          ))
        ) : (
          teamMsgList.map((msg) => (
            <div className="valid-item" key={msg.timestamp}>
              {renderTeamItem(msg)}
            </div>
          ))
        )}
      </div>
    </div>
  )
})

export default ValidList
