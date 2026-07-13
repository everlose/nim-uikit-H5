import React, { useState, useRef, useEffect, useMemo } from 'react'
import { observer } from 'mobx-react-lite'
import Face from '@/NEUIKit/chat/message/face'
import Icon from '@/NEUIKit/common/components/Icon'
import Input, { InputRef } from '@/NEUIKit/common/components/Input'
import MessageOneLine from '@/NEUIKit/common/components/MessageOneLine'
import Appellation from '@/NEUIKit/common/components/Appellation'
import { useTranslation } from '@/NEUIKit/common/hooks/useTranslate'
import { useStateContext } from '@/NEUIKit/common/hooks/useStateContext'
import { events, REPLY_MSG_TYPE_MAP, AT_ALL_ACCOUNT, ALLOW_AT } from '@/NEUIKit/common/utils/constants'
import { emojiMap } from '@/NEUIKit/common/utils/emoji'
import { replaceEmoji } from '@/NEUIKit/common/utils'
import { toast } from '@/NEUIKit/common/utils/toast'
import emitter from '@/NEUIKit/common/utils/eventBus'
import { V2NIMConst } from 'nim-web-sdk-ng/dist/esm/nim'
import type { V2NIMMessageForUI, YxServerExt, YxAitMsg } from '@xkit-yx/im-store-v2/dist/types/src/types'
import type { V2NIMMessage } from 'nim-web-sdk-ng/dist/esm/nim/src/V2NIMMessageService'
import type { V2NIMTeam, V2NIMTeamChatBannedMode, V2NIMTeamMember } from 'nim-web-sdk-ng/dist/esm/nim/src/V2NIMTeamService'
import './index.less'
import BottomPopup from '@/NEUIKit/common/components/BottomPopup'
import ActionSheet from '@/NEUIKit/common/components/ActionSheet'
import MentionChooseList from '../mention-choose-list'
import { flushSync } from 'react-dom'

interface MessageInputProps {
  conversationType: V2NIMConst.V2NIMConversationType
  to: string
  replyMsgsMap?: {
    [key: string]: V2NIMMessageForUI
  }
  onSendMessage?: () => void
}

/**
 * 消息输入组件
 */
const MessageInput: React.FC<MessageInputProps> = observer(({ conversationType, to, replyMsgsMap = {}, onSendMessage }) => {
  const { t } = useTranslation()
  const { store, nim } = useStateContext()

  // 消息会话ID
  const conversationId = useMemo(() => {
    return conversationType === V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_P2P
      ? nim.V2NIMConversationIdUtil.p2pConversationId(to)
      : nim.V2NIMConversationIdUtil.teamConversationId(to)
  }, [conversationType, to])

  // 输入文本
  const [inputText, setInputText] = useState('')

  // 发送更多面板flag
  const [sendMoreVisible, setSendMoreVisible] = useState(false)
  // 表情面板flag
  const [emojiVisible, setEmojiVisible] = useState(false)
  // input框flag
  const inputVisible = useMemo(() => !sendMoreVisible, [sendMoreVisible])

  // 用于解决表情面板和键盘冲突，导致输入框滚动消失问题
  const [showFakeInput, setShowFakeInput] = useState(false)

  // 拍摄 ActionSheet 显示状态
  const [cameraSheetVisible, setCameraSheetVisible] = useState(false)

  // 回复消息相关
  const [isReplyMsg, setIsReplyMsg] = useState(false)
  const [isFocus, setIsFocus] = useState(false)
  const [replyMsg, setReplyMsg] = useState<V2NIMMessageForUI | undefined>()

  // @消息相关
  const [mentionPopupVisible, setMentionPopupVisible] = useState(false)
  const [cursorPosition, setCursorPosition] = useState(0)
  const [atPosition, setAtPosition] = useState(0)
  const [selectedAtMembers, setSelectedAtMembers] = useState<{ accountId: string; appellation: string }[]>([])
  // 修改为使用正确的类型
  const inputRef = useRef<InputRef>(null)

  // 群相关
  const team = store.teamStore.teams.get(to)
  const teamMembers = store.teamMemberStore.getTeamMember(to)
  const teamMute = team?.chatBannedMode || V2NIMConst.V2NIMTeamChatBannedMode.V2NIM_TEAM_CHAT_BANNED_MODE_UNBAN

  const [isTeamOwner, setIsTeamOwner] = useState(false)
  const [isTeamManager, setIsTeamManager] = useState(false)
  const isTeamMute = useMemo(() => {
    if (teamMute === V2NIMConst.V2NIMTeamChatBannedMode.V2NIM_TEAM_CHAT_BANNED_MODE_UNBAN) return false
    if (isTeamOwner || isTeamManager) return false
    return true
  }, [teamMute, isTeamOwner, isTeamManager])
  
  // 是否允许@所有人
  const allowAtAll = useMemo(() => {
    let ext: YxServerExt = {};
    try {
      ext = JSON.parse((team?.serverExtension || "{}"));
    } catch (error) {
      // 解析错误时使用默认值
    }
    
    if (ext[ALLOW_AT] === "manager") {
      return isTeamOwner || isTeamManager;
    }
    return true;
  }, [team?.serverExtension, isTeamOwner, isTeamManager]);

  // 图片输入引用（相册，支持图片和视频）
  const imageInputRef = useRef<HTMLInputElement>(null)
  // 文件输入引用
  const fileInputRef = useRef<HTMLInputElement>(null)
  // 拍照输入引用
  const cameraPhotoInputRef = useRef<HTMLInputElement>(null)
  // 摄像输入引用
  const cameraVideoInputRef = useRef<HTMLInputElement>(null)
  const FILE_SIZE_LIMIT = 200 * 1024 * 1024

  // 处理输入框聚焦
  const handleInputFocus = () => {
    setIsFocus(true)
  }

  // 点击表情输入框，隐藏表情面板，显示键盘
  const onHideFakeInput = () => {
    setShowFakeInput(false)
    // 先将表情面板和发送更多面板隐藏
    setEmojiVisible(false)
    setSendMoreVisible(false)

    // 延迟一小段时间后再聚焦输入框
    setTimeout(() => {
      try {
        const input = document.getElementById('msg-input')
        input?.focus()
      } catch (error) {
        // console.log('error', error)
      }
    }, 100)
  }

  // 处理输入框失焦
  const handleInputBlur = () => {
    setIsFocus(false)
  }

  // 滚动到底部
  const scrollBottom = () => {
    emitter.emit(events.ON_SCROLL_BOTTOM)
  }

  // 发送文本消息
  const handleSendTextMsg = () => {
    if (inputText.trim() === '') return
    onSendMessage?.()

    let text = replaceEmoji(inputText)
    const textMsg = nim.V2NIMMessageCreator.createTextMessage(text)
    const ext = onAtMembersExtHandler();

    store.msgStore
      .sendMessageActive({
        msg: textMsg as unknown as V2NIMMessage,
        conversationId,
        serverExtension: (selectedAtMembers.length ? ext : undefined) as any,
        sendBefore: () => {
          scrollBottom()
        }
      })
      .catch(() => {
        toast.info(t('sendMsgFailedText'))
      })
      .finally(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => scrollBottom())
        })
      })

    setInputText('')
    prevInputTextRef.current = '' // 同步重置，确保后续@检测正常工作
    setSelectedAtMembers([]) // 清除选中的@成员
    setIsReplyMsg(false)
  }

  /**
   * 处理选中的@ 成员，构建艾特消息的扩展字段
   */
  const onAtMembersExtHandler = () => {
    let ext: YxServerExt | undefined;
    
    // 如果有选中的@成员，处理扩展字段
    if (selectedAtMembers.length) {
      // 过滤掉不允许@所有人的情况
      const filteredMembers = selectedAtMembers.filter((member) => {
        if (!allowAtAll && member.accountId === AT_ALL_ACCOUNT) {
          return false;
        }
        return true;
      });
      
      // 遍历每个成员，构建艾特消息扩展字段
      filteredMembers.forEach((member) => {
        const substr = `@${member.appellation}`;
        const positions: number[] = [];
        
        // 查找所有@成员出现的位置
        let pos = inputText.indexOf(substr);
        while (pos !== -1) {
          positions.push(pos);
          pos = inputText.indexOf(substr, pos + 1);
        }
        
        // 如果找到了@成员出现的位置，构建扩展字段
        if (positions.length) {
          if (!ext) {
            ext = {
              yxAitMsg: {
                [member.accountId]: {
                  text: substr,
                  segments: [],
                }
              }
            };
          } else {
            (ext.yxAitMsg as YxAitMsg)[member.accountId] = {
              text: substr,
              segments: [],
            };
          }
          
          // 添加每个出现位置的信息
          positions.forEach((position) => {
            const start = position;
            (ext?.yxAitMsg as YxAitMsg)[member.accountId].segments.push({
              start,
              end: start + substr.length,
              broken: false,
            });
          });
        }
      });
    }
    
    return ext;
  };

  // 移除回复消息
  const removeReplyMsg = () => {
    store.msgStore.removeReplyMsgActive(replyMsg?.conversationId as string)
    setIsReplyMsg(false)
  }

  // 显示表情面板
  const handleEmojiVisible = () => {
    if (isTeamMute) return

    setEmojiVisible(true)
    setShowFakeInput(true)
    setSendMoreVisible(false)
    scrollBottom()
  }

  // 点击表情
  const handleEmoji = (emoji: { key: string; type: string }) => {
    setInputText((prev) => prev + emoji.key)
  }

  // 删除表情
  const handleEmojiDelete = () => {
    const isEmojiEnd = Object.keys(emojiMap).reduce((prev, cur) => {
      const isEnd = inputText.endsWith(cur)
      return prev || isEnd
    }, false)

    // 如果以emoji结尾，删除最后一个emoji
    if (isEmojiEnd) {
      let target = ''
      for (const key of Object.keys(emojiMap)) {
        if (inputText.endsWith(key)) {
          target = key
          break
        }
      }

      if (target) {
        setInputText((prev) => prev.slice(0, -target.length))
      }
    } else {
      // 否则删除最后一个字符
      setInputText((prev) => prev.slice(0, -1))
    }
  }

  /** 显示发送更多"+"面板 */
  const handleSendMoreVisible = () => {
    if (isTeamMute) return

    setEmojiVisible(false)
    setSendMoreVisible((prev) => !prev)
    setShowFakeInput(true)
    scrollBottom()
  }

  // 拍摄：显示 ActionSheet 选择拍照还是摄像
  const handleCameraClick = () => {
    if (isTeamMute) return
    setCameraSheetVisible(true)
  }

  // 拍摄：拍照
  const handleCameraPhoto = () => {
    cameraPhotoInputRef.current?.click()
  }

  // 拍摄：摄像
  const handleCameraVideo = () => {
    cameraVideoInputRef.current?.click()
  }

  const isFileSizeValid = (file: File, input?: HTMLInputElement | null) => {
    if (file.size <= FILE_SIZE_LIMIT) return true
    toast.info(t('fileSizeLimitText'))
    if (input) {
      input.value = ''
    }
    return false
  }

  // 处理相册选择（图片和视频）
  const onImageSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!isFileSizeValid(file, imageInputRef.current)) return
    onSendMessage?.()

    const isVideo = file.type.startsWith('video/')
    const fileMsg = isVideo
      ? nim.V2NIMMessageCreator.createVideoMessage(file)
      : file.size > 20 * 1024 * 1024
        ? nim.V2NIMMessageCreator.createFileMessage(file)
        : nim.V2NIMMessageCreator.createImageMessage(file)

    try {
      await store.msgStore.sendMessageActive({
        msg: fileMsg as unknown as V2NIMMessage,
        conversationId,
        progress: () => true,
        sendBefore: () => {
          scrollBottom()
        }
      })
      scrollBottom()
    } catch (err) {
      scrollBottom()
      toast.info(isVideo ? t('sendVideoFailedText') : t('sendImageFailedText'))
    } finally {
      if (imageInputRef.current) {
        imageInputRef.current.value = ''
      }
    }
  }

  const onFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) return
    if (!isFileSizeValid(file, fileInputRef.current)) return
    onSendMessage?.()

    // 补充: 若图片超过 20MB, 当作文件对象发送而不是图片发送.
    const fileMsg = nim.V2NIMMessageCreator.createFileMessage(file)

    try {
      await store.msgStore.sendMessageActive({
        msg: fileMsg as unknown as V2NIMMessage,
        conversationId,
        progress: () => true,
        sendBefore: () => {
          scrollBottom()
        }
      })

      scrollBottom()
    } catch (err) {
      scrollBottom()
      toast.info(t('sendFileFailedText'))
    } finally {
      // 清空 input 的值，这样用户可以重复选择同一个文件
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // 处理拍照选择
  const onCameraPhotoSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!isFileSizeValid(file, cameraPhotoInputRef.current)) return
    onSendMessage?.()

    const fileMsg = nim.V2NIMMessageCreator.createImageMessage(file)

    try {
      await store.msgStore.sendMessageActive({
        msg: fileMsg as unknown as V2NIMMessage,
        conversationId,
        progress: () => true,
        sendBefore: () => {
          scrollBottom()
        }
      })
      scrollBottom()
    } catch (err) {
      scrollBottom()
      toast.info(t('sendImageFailedText'))
    } finally {
      if (cameraPhotoInputRef.current) {
        cameraPhotoInputRef.current.value = ''
      }
    }
  }

  // 处理摄像选择
  const onCameraVideoSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!isFileSizeValid(file, cameraVideoInputRef.current)) return
    onSendMessage?.()

    const fileMsg = nim.V2NIMMessageCreator.createVideoMessage(file)

    try {
      await store.msgStore.sendMessageActive({
        msg: fileMsg as unknown as V2NIMMessage,
        conversationId,
        progress: () => true,
        sendBefore: () => {
          scrollBottom()
        }
      })
      scrollBottom()
    } catch (err) {
      scrollBottom()
      toast.info(t('sendVideoFailedText'))
    } finally {
      if (cameraVideoInputRef.current) {
        cameraVideoInputRef.current.value = ''
      }
    }
  }

  // 用于存储上一次输入的文本，用于检测@字符的输入
  const prevInputTextRef = useRef(inputText)

  /**
   * 查找新增@符号的位置
   * 通过比较新旧文本中@的数量和位置来确定新增@的位置
   */
  const findNewAtPosition = (newText: string, prevText: string): number => {
    const prevAtCount = (prevText.match(/@/g) || []).length
    const newAtCount = (newText.match(/@/g) || []).length
    
    // @数量没有增加，说明没有新输入@
    if (newAtCount <= prevAtCount) {
      return -1
    }
    
    // 遍历新文本，通过比较前缀中@的数量来找出新增@的位置
    let prevIdx = 0
    for (let i = 0; i < newText.length; i++) {
      if (newText[i] !== '@') {
        continue
      }
      
      // 检查这个@是否是新增的：比较前缀中@的数量
      const prefixInNew = newText.substring(0, i)
      const prefixAtCount = (prefixInNew.match(/@/g) || []).length
      const prefixInPrev = prevText.substring(0, Math.min(i, prevText.length))
      const prevPrefixAtCount = (prefixInPrev.match(/@/g) || []).length
      
      if (prefixAtCount > prevPrefixAtCount) {
        return i
      }
      
      // 更新 prevIdx 用于后续比较
      const prevAtPos = prevText.indexOf('@', prevIdx)
      prevIdx = prevAtPos !== -1 ? prevAtPos + 1 : prevIdx
    }
    
    // 备用逻辑：使用最后一个@的位置
    return newText.lastIndexOf('@')
  }

  /**
   * 显示@成员选择弹窗
   */
  const showMentionPopup = (atPos: number) => {
    setAtPosition(atPos)
    setCursorPosition(atPos + 1)
    
    // 延迟显示弹窗，确保输入框内容已更新
    setTimeout(() => {
      setMentionPopupVisible(true)
      // 让输入框失焦以便弹出成员列表
      try {
        document.getElementById('msg-input')?.blur()
      } catch {
        // ignore
      }
    }, 50)
  }

  // TODO: 暂时注释掉@成员整体删除相关逻辑，改为逐字删除
  // 原逻辑：删除@成员时整体删除"@王允"，因为做文本替换导致光标跳到末尾
  //
  // /**
  //  * 检测单个@成员是否被部分删除，如果是则返回删除残留后的文本
  //  */
  // const removeAtMemberResidue = (...) => { ... }
  //
  // /**
  //  * 检测@成员是否被部分删除，如果是则整体删除
  //  */
  // const handleAtMemberDelete = (...) => { ... }
  //
  // /**
  //  * 查找删除操作发生的位置
  //  */
  // const findDeletePosition = (...) => { ... }

  const handleInputChange = (value: string) => {
    const prevValue = prevInputTextRef.current

    // TODO: 暂时注释掉@成员整体删除逻辑，改为逐字删除
    // 原逻辑：删除@成员时整体删除"@王允"，导致光标跳到末尾
    // 现在作为普通input，逐字删除即可
    // if (value.length < prevValue.length && selectedAtMembers.length > 0) {
    //   const { text, membersToKeep } = handleAtMemberDelete(value, prevValue)
    //
    //   // 更新状态
    //   setInputText(text)
    //   prevInputTextRef.current = text
    //   setSelectedAtMembers(membersToKeep)
    //   return
    // }

    // 更新状态（无论如何都要执行）
    setInputText(value)
    prevInputTextRef.current = value
    
    // 以下是@检测逻辑，使用提前退出模式减少嵌套
    // 这种方式兼容 Android 真机，因为 Android 上 keydown 事件的 event.key 通常是 "Unidentified"
    
    // 非群聊场景，不需要@功能
    if (conversationType !== V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM) {
      return
    }
    
    // 弹窗已显示，不需要重复触发
    if (mentionPopupVisible) {
      return
    }
    
    // 文本长度没有增加（可能是删除操作），不需要检测@
    const lengthDiff = value.length - prevValue.length
    if (lengthDiff <= 0) {
      return
    }
    
    // 查找新增@的位置
    const atPos = findNewAtPosition(value, prevValue)
    if (atPos === -1) {
      return
    }
    
    // 找到新增的@，显示弹窗
    showMentionPopup(atPos)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    // 当前输入的是@ 展示群成员列表
    // 注意：此方法在 Android 真机上可能不触发（event.key 为 "Unidentified"）
    // 主要依赖 handleInputChange 中的检测逻辑，此处作为 iOS/桌面浏览器的快速响应后备
    if (
      event.key === "@" &&
      conversationType === V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM &&
      !mentionPopupVisible
    ) {
      const cursorPos = event.currentTarget.selectionStart || 0
      setCursorPosition(cursorPos)
      setAtPosition(cursorPos) // 注意：keydown 时@还没有被输入，所以位置是当前光标位置
      setMentionPopupVisible(true)
      event.currentTarget.blur()
    }
  }

  // 关闭mention（取消选择时）
  const handleCloseMention = () => {
    // 检查输入框中atPosition位置是否有@符号
    // 如果没有（可能是handleKeyDown中blur阻止了输入），则补上@符号
    if (inputText[atPosition] !== '@') {
      const beforeAt = inputText.substring(0, atPosition)
      const afterAt = inputText.substring(atPosition)
      const newText = beforeAt + '@' + afterAt
      setInputText(newText)
      prevInputTextRef.current = newText
    }
    setMentionPopupVisible(false)
  };

  const handleMentionSelect = (member) => {
    const nickInTeam = member.appellation;
    setSelectedAtMembers([...selectedAtMembers.filter(item => item.accountId !== member.accountId), member]);

    // 在@符号位置插入@xxx，而不是追加到末尾
    const currentText = inputText;
    const beforeAt = currentText.substring(0, atPosition);
    
    // 检查atPosition位置是否真的是@符号
    // 在handleKeyDown中，atPosition是@输入前的光标位置，blur()可能阻止@输入
    // 在handleInputChange中，atPosition是@在文本中的实际位置
    let afterAt;
    if (currentText[atPosition] === '@') {
      // @符号已在文本中，跳过它
      afterAt = currentText.substring(atPosition + 1);
    } else {
      // @符号不在文本中（handleKeyDown触发时blur阻止了输入，或state未更新）
      afterAt = currentText.substring(atPosition);
    }
    
    const newInputText = beforeAt + "@" + nickInTeam + " " + afterAt;

    // 同步更新 prevInputTextRef，避免触发重复的@检测
    prevInputTextRef.current = newInputText

    // 使用 flushSync 确保同步更新, 更新input框的内容
    // 注意：这里直接关闭弹窗，不调用handleCloseMention，因为handleCloseMention会检查并补@符号
    flushSync(() => {
      setInputText(newInputText);
      setMentionPopupVisible(false);
    })

    try {
      // 使用我们的 ref 来设置光标位置
      if (inputRef.current) {
        // 计算新的光标位置
        const newCursorPos = atPosition + nickInTeam.length + 2; // @xxx + 空格
        
        // 使用 ref 的 setSelectionRange 方法
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    } catch (error) {
      console.error('Error setting cursor position:', error);
    }
  }


  // 监听群组信息
  useEffect(() => {
    if (conversationType === V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM) {
      const myUser = store.userStore.myUserInfo
      setIsTeamOwner(team?.ownerAccountId === myUser?.accountId)
      setIsTeamManager(
        teamMembers
          .filter((item) => item.memberRole === V2NIMConst.V2NIMTeamMemberRole.V2NIM_TEAM_MEMBER_ROLE_MANAGER)
          .some((member) => member.accountId === myUser?.accountId)
      )
    }
  }, [conversationType, store.userStore.myUserInfo, to])

  // 监听消息重新编辑和回复
  useEffect(() => {
    // 撤回后，重新编辑消息
    const onReEditMsg = (_msg: any) => {
      const msg = _msg as V2NIMMessageForUI
      const _replyMsg = replyMsgsMap[msg.messageClientId]

      // 此处将 replyMsg 置空是为了解决：撤回普通消息1，撤回回复消息2，重新编辑消息2，再重新编辑消息1，
      // 输入框上方依然显示消息2的引用，消息1发送出去消息消息2的引用消息
      setReplyMsg(undefined)
      setIsReplyMsg(false)
      store.msgStore.removeReplyMsgActive(msg.conversationId)

      // 如果重新编辑的是回复消息，则需要将回复消息展示在输入框上方
      if (_replyMsg?.messageClientId) {
        _replyMsg && store.msgStore.replyMsgActive(_replyMsg)
        setReplyMsg(_replyMsg)
        setIsReplyMsg(true)
      }

      const oldText = msg?.oldText || ''
      
      // 同步更新 prevInputTextRef，避免后续输入时触发@检测
      prevInputTextRef.current = oldText
      setInputText(oldText)
      setIsFocus(true)
      
      // 从撤回消息的扩展字段中解析@成员信息，回填到 selectedAtMembers
      // 这样重新编辑后发送的消息仍然能正确识别为艾特消息
      if (msg?.serverExtension) {
        try {
          const ext = JSON.parse(msg.serverExtension) as YxServerExt
          if (ext?.yxAitMsg) {
            const atMembers: { accountId: string; appellation: string }[] = []
            
            // 遍历艾特消息扩展字段，提取成员信息
            for (const accountId of Object.keys(ext.yxAitMsg)) {
              const aitInfo = ext.yxAitMsg[accountId]
              if (aitInfo?.text) {
                // text 格式为 "@xxx"，需要去掉开头的@
                const appellation = aitInfo.text.startsWith('@') 
                  ? aitInfo.text.substring(1) 
                  : aitInfo.text
                atMembers.push({ accountId, appellation })
              }
            }
            
            if (atMembers.length > 0) {
              setSelectedAtMembers(atMembers)
            }
          }
        } catch {
          // 解析扩展字段失败，忽略
        }
      }
    }

    // 回复消息
    const onReplyMsg = (msg: any) => {
      const replyMessage = msg as V2NIMMessageForUI
      setIsReplyMsg(true)
      setIsFocus(true)
      setReplyMsg(replyMessage)
      
      // 群聊中自动@被回复人（非自己发送的消息）
      if (
        conversationType === V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM &&
        replyMessage.senderId !== store.userStore.myUserInfo?.accountId
      ) {
        const appellation = store.uiStore.getAppellation({
          account: replyMessage.senderId,
          teamId: to,
          ignoreAlias: true,
        })
        
        if (appellation) {
          // 将被回复人添加到@成员列表
          const newMember = { accountId: replyMessage.senderId, appellation }
          setSelectedAtMembers((prev) => {
            // 避免重复添加
            if (prev.some((m) => m.accountId === replyMessage.senderId)) {
              return prev
            }
            return [...prev, newMember]
          })
          
          // 在输入框中添加@被回复人
          setInputText((prev) => {
            const atText = `@${appellation} `
            const newText = prev + atText
            // 同步更新 prevInputTextRef，避免触发重复的@检测
            prevInputTextRef.current = newText
            return newText
          })
        }
      }
    }

    // 关闭面板
    const onClosePanel = () => {
      setEmojiVisible(false)
      setSendMoreVisible(false)
    }

    const onAitTeamMember = (member: any) => {
      const aitMember = member as { accountId: string; appellation: string }
      setSelectedAtMembers((prev) => [...prev.filter((item) => item.accountId !== aitMember.accountId), aitMember])
      setInputText((prev) => {
        const newText = `${prev}@${aitMember.appellation} `
        prevInputTextRef.current = newText
        return newText
      })
      setIsFocus(true)
    }

    emitter.on(events.ON_REEDIT_MSG, onReEditMsg)
    emitter.on(events.REPLY_MSG, onReplyMsg)
    emitter.on(events.AIT_TEAM_MEMBER, onAitTeamMember)
    emitter.on(events.CLOSE_PANEL, onClosePanel)

    return () => {
      emitter.off(events.ON_REEDIT_MSG, onReEditMsg)
      emitter.off(events.REPLY_MSG, onReplyMsg)
      emitter.off(events.AIT_TEAM_MEMBER, onAitTeamMember)
      emitter.off(events.CLOSE_PANEL, onClosePanel)
    }
  }, [replyMsgsMap])

  // 组件卸载时移除回复消息
  useEffect(() => {
    return () => {
      if (replyMsg?.conversationId) {
        store.msgStore.removeReplyMsgActive(replyMsg.conversationId)
      }
    }
  }, [replyMsg?.conversationId])

  return (
    <div className="input-root">
      {/* 回复消息显示区域 */}
      {isReplyMsg && (
        <div className="reply-message-wrapper">
          <div className="reply-message-close" onClick={removeReplyMsg}>
            <Icon style={{ color: '#929299', fontWeight: '200' }} size={13} type="icon-guanbi" />
          </div>
          <div className="reply-line">｜</div>
          <div className="reply-title">{t('replyText')}</div>
          {replyMsg && (
            <div className="reply-to">
              <Appellation
                account={replyMsg.senderId}
                teamId={conversationType === V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM ? to : ''}
                style={{ color: '#929299', fontSize: 13 }}
              />
            </div>
          )}
          <div className="reply-to-colon">:</div>

          {replyMsg && replyMsg.messageClientId === 'noFind' ? (
            <div className="reply-noFind">{t('replyNotFindText')}</div>
          ) : (
            <div className="reply-message">
              {replyMsg && replyMsg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_TEXT ? (
                <MessageOneLine text={replyMsg.text || ''} />
              ) : (
                <div>{replyMsg?.messageType ? `[${REPLY_MSG_TYPE_MAP[replyMsg.messageType] || 'Unsupported Type'}]` : '[Unknown]'}</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 输入区域 */}
      <div className="msg-input-wrapper">
        <div className="input-inner">
          {/*
            当从表情面板切换到文字输入时，直接唤起键盘，会导致input框滚动消失
            此处使用fake Input兼容，保证先隐藏表情/其他面板，再弹出键盘
          */}
          {showFakeInput ? (
            <div className="fake-input" onClick={onHideFakeInput}>
              {inputText ? (
                <div className="input-text">{inputText}</div>
              ) : (
                <div className="input-placeholder">{isTeamMute ? t('teamMutePlaceholder') : t('chatInputPlaceHolder')}</div>
              )}
            </div>
          ) : (
            <Input
              id="msg-input"
              className="msg-input-input"
              placeholder={isTeamMute ? t('teamMutePlaceholder') : t('chatInputPlaceHolder')}
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={isTeamMute}
              inputStyle={{
                padding: '0 10px'
              }}
              onConfirm={handleSendTextMsg}
              onBlur={handleInputBlur}
              onFocus={handleInputFocus}
              ref={inputRef}
            />
          )}
        </div>

        {/* 操作栏：四列布局，与 Android 对齐 */}
        <div className="input-action-bar">
          <div className="input-action-icon" onClick={handleEmojiVisible}>
            <Icon size={24} type={emojiVisible ? 'icon-emoji-active' : 'icon-emoji-normal'} />
          </div>
          <div className="input-action-icon">
            <input
              type="file"
              ref={imageInputRef}
              accept="image/*,video/*"
              className="file-input-overlay"
              style={{ pointerEvents: isTeamMute ? 'none' : 'auto' }}
              onChange={onImageSelected}
            />
            <Icon size={24} type="icon-tupian" />
          </div>
          <div className="input-action-icon input-action-empty" />
          <div className={`input-action-icon input-send-more ${sendMoreVisible ? 'active' : ''}`} onClick={handleSendMoreVisible}>
            <Icon type={sendMoreVisible ? 'icon-more-active' : 'icon-more-normal'} size={24} />
          </div>
        </div>

        {/* 更多操作扩展区 */}
        {sendMoreVisible && (
          <div className="send-more-expand" onClick={(e) => e.stopPropagation()}>
            <div className="send-more-expand-item" onClick={handleCameraClick}>
              <div className="send-more-expand-icon">
                <Icon size={26} type="icon-paishe" />
              </div>
              <div className="send-more-expand-label">拍摄</div>
            </div>
            <div className="send-more-expand-item">
              <input
                type="file"
                ref={fileInputRef}
                accept="*/*"
                className="file-input-overlay"
                style={{ pointerEvents: isTeamMute ? 'none' : 'auto' }}
                onChange={onFileSelected}
              />
              <div className="send-more-expand-icon">
                <Icon size={26} type="icon-wenjian" />
              </div>
              <div className="send-more-expand-label">{t('fileText')}</div>
            </div>
          </div>
        )}

        {/* 隐藏的拍照和摄像 input（由 ActionSheet 触发） */}
        <input type="file" ref={cameraPhotoInputRef} accept="image/*" capture="environment" style={{ display: 'none' }} onChange={onCameraPhotoSelected} />
        <input type="file" ref={cameraVideoInputRef} accept="video/*" capture="environment" style={{ display: 'none' }} onChange={onCameraVideoSelected} />
      </div>

      {/* 表情面板 */}
      {emojiVisible && (
        <div className="msg-emoji-panel" onClick={(e) => e.stopPropagation()}>
          <Face onEmojiClick={handleEmoji} onEmojiDelete={handleEmojiDelete} onEmojiSend={handleSendTextMsg} />
        </div>
      )}

      {/** 艾特消息弹出层 */}
      {
        <BottomPopup
          visible={mentionPopupVisible}
          onCancel={handleCloseMention}
          showConfirm={false}
          showCancel={true}
          title={t('chooseMentionText')}
        >
          <MentionChooseList teamId={to} onClose={handleCloseMention} onMemberClick={handleMentionSelect}></MentionChooseList>
        </BottomPopup>
      }

      {/* 拍摄 ActionSheet：选择拍照还是摄像 */}
      <ActionSheet
        visible={cameraSheetVisible}
        actions={[
          { text: '拍照', onClick: () => { setCameraSheetVisible(false); handleCameraPhoto() } },
          { text: '摄像', onClick: () => { setCameraSheetVisible(false); handleCameraVideo() } },
        ]}
        onClose={() => setCameraSheetVisible(false)}
      />
    </div>
  )
})

export default MessageInput
