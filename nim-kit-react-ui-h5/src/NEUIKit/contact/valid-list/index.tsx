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

  // 本地更新验证消息的处理状态
  // 同意/拒绝后服务端不会把状态变更推给操作端（同意只推 onTeamJoined，拒绝只推给群主/管理员端），
  // 不做本地更新的话按钮不会消失
  const updateTeamJoinActionStatus = (
    msg: V2NIMTeamJoinActionInfoForUI,
    actionStatus: V2NIMTeamJoinActionInfoForUI['actionStatus']
  ) => {
    // 对齐 store 处理好友申请的方式（_onFriendAdded 写的是 status + isRead + read 三件套）：
    // 用户已经处理过这条记录了，一起把未读清掉，否则返回联系人页红点还在
    store.sysMsgStore.updateTeamJoinActionMsg([{ ...msg, actionStatus, isRead: true, read: true }])
  }

  // 服务端已读：UIKit 的 isRead 只存在本端内存里，不写服务端的话，
  // 重登或其它端拉回来的记录仍旧是未读，红点会复活
  const markTeamJoinActionReadOnServer = (msg: V2NIMTeamJoinActionInfoForUI) => {
    store.nim.V2NIMTeamService.setTeamJoinActionInfoRead(msg).catch(() => {})
  }

  // 10w~19w 是服务端返回的业务错误码区间（19w 起是客户端本地错误码，例如超时 191005），
  // 命中说明这次同意/拒绝没有被服务端接受：通常是这条记录已经被处理或已失效
  // （典型是 109313 邀请/申请不存在，例如被同账号的其它端同意/拒绝过），本地按已过期处理
  const isJoinActionExpiredError = (error: unknown) => {
    const code = (error as { code?: number })?.code
    return typeof code === 'number' && code > 100000 && code < 190000
  }

  // 主动把这条验证消息置为已过期，避免失效的按钮留在界面上
  const markJoinActionExpired = (msg: V2NIMTeamJoinActionInfoForUI) => {
    updateTeamJoinActionStatus(
      msg,
      V2NIMConst.V2NIMTeamJoinActionStatus.V2NIM_TEAM_JOIN_ACTION_STATUS_EXPIRED
    )
    toast.info(t('expiredText'))
  }

  // 好友侧与群侧的跨端差异（群侧为什么只能靠错误码兜底，注释留存，勿删）：
  // 1. 好友申请/添加有服务端按账号下发的通知协议：同账号任意一端处理完，服务端会把
  //    onFriendAdded / onFriendAddRejected 推给该账号的其它端（SDK 侧由 processSysNotification
  //    解析后 append 到申请列表并 emit），store 的 _onFriendAdded / _onFriendAddRejected 据此把
  //    记录写成 status + isRead + read，所以好友侧各端天然联动，不需要本端兜底；
  // 2. 群侧没有等价通知：同意只回 onTeamJoined（成员变更，store 只做 addTeam，不动验证消息记录），
  //    拒绝只推给群主/管理员，自己拒绝不会发通知给自己其它端；且不开启
  //    enableServerV2TeamJoinActionInfo 时 getTeamJoinActionInfoList 只读本端 SDK 内存里的
  //    本地模型（无网络请求），所以"主动拉一次"也拿不到另一端的结果 → 只能在本端操作失败、
  //    拿到 10w~19w 业务错误码（如 109313 邀请/申请不存在）时把本地状态兜底置为已过期。
  // 好友申请：本地更新处理状态 + 清未读（和 store 里 _onFriendAdded 的写法一致）
  const updateFriendApplyStatus = (
    msg: V2NIMFriendAddApplicationForUI,
    status: V2NIMFriendAddApplicationForUI['status']
  ) => {
    store.sysMsgStore.updateFriendApplyMsg([{ ...msg, status, isRead: true, read: true }])
  }

  // 好友申请的服务端已读
  const markFriendApplyReadOnServer = (msg: V2NIMFriendAddApplicationForUI) => {
    store.nim.V2NIMFriendService.setAddApplicationReadEx(msg).catch(() => {})
  }

  // 主动把这条好友申请置为已过期（申请已被处理或已失效）
  const markFriendApplyExpired = (msg: V2NIMFriendAddApplicationForUI) => {
    updateFriendApplyStatus(
      msg,
      V2NIMConst.V2NIMFriendAddApplicationStatus.V2NIM_FRIEND_ADD_APPLICATION_STATUS_EXPIRED
    )
    toast.info(t('expiredText'))
  }

  // 主动拉取一次最新的申请/邀请状态，用于多端同步：
  // 同账号其它端同意/拒绝后本端收不到推送，需要自己重新拉取。
  // 注意拉回来的记录不带本地 isRead（addTeamJoinActionMsg 是整体覆盖，且群这边没有好友那种
  // timestamp 守护），而用户人已经在验证消息页就等于已读，所以拉完重新标记一次本地已读，
  // 避免红点被拉取重新点亮
  const refreshValidMsgs = async () => {
    try {
      const res = await store.teamStore.getTeamJoinActionInfoListActive({ offset: 0, limit: 100 })
      // store 写入是无条件 map.set，key = teamId_operatorAccountId。
      // 同一个邀请人重复邀请时会返回多条同 key 记录（旧的已失效 + 新的待处理），
      // 数组顺序会让旧记录盖掉新记录（好友那边 addFriendApplyMsg 有 timestamp 守护，群这边没有），
      // 所以这里按 key 取时间戳最新的一条写回
      const newest = new Map<string, V2NIMTeamJoinActionInfoForUI>()
      const infos = res?.infos || []
      infos.forEach((info) => {
        const key = store.sysMsgStore.createTeamJoinActionMsgKey(info)
        const existed = newest.get(key)
        if (!existed || info.timestamp >= existed.timestamp) {
          newest.set(key, info)
        }
      })
      store.sysMsgStore.addTeamJoinActionMsg([...newest.values()])
    } catch (error) {
      // 拉取失败不阻塞页面
    }

    await store.friendStore
      .getAddApplicationListActive({ status: [], offset: 0, limit: 100 })
      .catch(() => {})

    // 本地已读 + 服务端已读一起补，重登/其它端才不会又变回未读
    store.sysMsgStore.setAllApplyMsgRead()
    store.nim.V2NIMTeamService.setTeamJoinActionInfoRead().catch(() => {})
    store.nim.V2NIMFriendService.setAddApplicationRead().catch(() => {})
  }

  // 进入页面时同步一次；页面从后台/其它端切回来重新可见时再同步一次
  useEffect(() => {
    refreshValidMsgs()
    const handleVisible = () => {
      if (document.visibilityState === 'visible') {
        refreshValidMsgs()
      }
    }
    document.addEventListener('visibilitychange', handleVisible)
    return () => {
      document.removeEventListener('visibilitychange', handleVisible)
    }
  }, [store])

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
      updateFriendApplyStatus(
        msg,
        V2NIMConst.V2NIMFriendAddApplicationStatus.V2NIM_FRIEND_ADD_APPLICATION_STATUS_REJECTED
      )
      markFriendApplyReadOnServer(msg)
      toast.info(t('rejectedText'))
    } catch (error) {
      // 服务端拒绝了这次操作（申请已被处理或已失效）：置为已过期
      if (isJoinActionExpiredError(error)) {
        markFriendApplyExpired(msg)
        return
      }
      toast.info(t('rejectFailedText'))
    }
  }

  // 接受好友申请
  const handleAcceptApplyFriendClick = async (msg: V2NIMFriendAddApplicationForUI) => {
    try {
      try {
        await store.friendStore.acceptAddApplicationActive(msg)
        updateFriendApplyStatus(
          msg,
          V2NIMConst.V2NIMFriendAddApplicationStatus.V2NIM_FRIEND_ADD_APPLICATION_STATUS_AGREED
        )
        markFriendApplyReadOnServer(msg)
        toast.info(t('acceptedText'))
      } catch (error) {
        // 服务端拒绝了这次操作（申请已被处理或已失效）：置为已过期
        if (isJoinActionExpiredError(error)) {
          markFriendApplyExpired(msg)
          return
        }
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
      updateTeamJoinActionStatus(
        msg,
        V2NIMConst.V2NIMTeamJoinActionStatus.V2NIM_TEAM_JOIN_ACTION_STATUS_AGREED
      )
      markTeamJoinActionReadOnServer(msg)
      toast.info(t('acceptedText'))
    } catch (error) {
      // 服务端拒绝了这次操作（记录已被处理或已失效）：置为已过期
      if (isJoinActionExpiredError(error)) {
        markJoinActionExpired(msg)
        return
      }
      toast.info(t('acceptFailedText'))
    }
  }

  // 拒绝群组邀请
  const handleRejectTeamInvite = async (msg: V2NIMTeamJoinActionInfoForUI) => {
    try {
      await store.teamStore.rejectTeamInviteActive(msg)
      updateTeamJoinActionStatus(
        msg,
        V2NIMConst.V2NIMTeamJoinActionStatus.V2NIM_TEAM_JOIN_ACTION_STATUS_REJECTED
      )
      markTeamJoinActionReadOnServer(msg)
      toast.info(t('rejectedText'))
    } catch (error) {
      // 服务端拒绝了这次操作（记录已被处理或已失效）：置为已过期
      if (isJoinActionExpiredError(error)) {
        markJoinActionExpired(msg)
        return
      }
      toast.info(t('rejectFailedText'))
    }
  }

  // 同意入群申请
  const handleAcceptTeamApply = async (msg: V2NIMTeamJoinActionInfoForUI) => {
    try {
      await store.teamStore.acceptJoinApplicationActive(msg)
      updateTeamJoinActionStatus(
        msg,
        V2NIMConst.V2NIMTeamJoinActionStatus.V2NIM_TEAM_JOIN_ACTION_STATUS_AGREED
      )
      markTeamJoinActionReadOnServer(msg)
      toast.info(t('acceptedText'))
    } catch (error) {
      // 服务端拒绝了这次操作（记录已被处理或已失效）：置为已过期
      if (isJoinActionExpiredError(error)) {
        markJoinActionExpired(msg)
        return
      }
      toast.info(t('acceptFailedText'))
    }
  }

  // 拒绝入群申请
  const handleRejectTeamApply = async (msg: V2NIMTeamJoinActionInfoForUI) => {
    try {
      await store.teamStore.rejectTeamApplyActive(msg)
      updateTeamJoinActionStatus(
        msg,
        V2NIMConst.V2NIMTeamJoinActionStatus.V2NIM_TEAM_JOIN_ACTION_STATUS_REJECTED
      )
      markTeamJoinActionReadOnServer(msg)
      toast.info(t('rejectedText'))
    } catch (error) {
      // 服务端拒绝了这次操作（记录已被处理或已失效）：置为已过期
      if (isJoinActionExpiredError(error)) {
        markJoinActionExpired(msg)
        return
      }
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
