import React, { useState, useEffect, useCallback } from 'react'
import { observer } from 'mobx-react-lite'
import { useNavigate, useLocation } from '@/utils/router'
import { useTranslation } from '@/NEUIKit/common/hooks/useTranslate'
import { useStateContext } from '@/NEUIKit/common/hooks/useStateContext'
import { toast } from '@/NEUIKit/common/utils/toast'
import { useTeamNotification } from '@/NEUIKit/common/hooks/useTeamNotification'

import NavBar from '@/NEUIKit/common/components/NavBar'
import Icon from '@/NEUIKit/common/components/Icon'

import './team-nick-edit.less'

/**
 * 群昵称编辑组件
 */
const TeamNickEdit: React.FC = observer(() => {
  const { t } = useTranslation()
  const { store } = useStateContext()
  const navigate = useNavigate()
  const location = useLocation()

  // 输入内容
  const [inputValue, setInputValue] = useState('')
  const params = new URLSearchParams(location.search)
  const id = params.get('teamId') || ''
  useTeamNotification(id)
  // 我的成员信息
  const myMemberInfo = store.teamMemberStore.getTeamMember(id, [store.userStore.myUserInfo.accountId])?.[0]

  // 输入变化
  const onInputChange = useCallback((value: string) => {
    setInputValue(value)
  }, [])

  // 输入框获取焦点
  const onInputFocus = useCallback(() => {}, [])

  // 清除输入内容
  const clearInputValue = useCallback(() => {
    setInputValue('')
  }, [])

  // 返回
  const back = useCallback(() => {
    navigate(-1)
  }, [])

  // 确认修改
  const onOk = useCallback(() => {
    store.teamMemberStore
      .updateMyMemberInfoActive({
        teamId: id,
        memberInfo: {
          teamNick: inputValue.trim()
        }
      })
      .then(() => {
        back()
      })
      .catch(() => {
        toast.info(t('saveFailedText'))
      })
  }, [id, inputValue])

  // 初始化数据和自动更新
  useEffect(() => {
    setInputValue(myMemberInfo?.teamNick || '')
  }, [myMemberInfo])

  return (
    <div className="team-nick-edit-wrapper">
      <NavBar
        title={t('nickInTeam')}
        leftContent={
          <div className="nav-bar-text" onClick={back}>
            {t('cancelText')}
          </div>
        }
        rightContent={<div onClick={onOk}>{t('okText')}</div>}
      />
      <div className="userInfo-item-wrapper">
        <textarea
          className="nick-textarea"
          onFocus={onInputFocus}
          maxLength={30}
          onChange={(e) => onInputChange(e.target.value)}
          value={inputValue}
          placeholder={t('nickInTeam')}
          rows={3}
        />
        {inputValue && (
          <div onClick={clearInputValue} className="clear-icon-wrapper">
            <Icon iconClassName="clear-icon" type="icon-shandiao" />
          </div>
        )}
      </div>
    </div>
  )
})

export default TeamNickEdit
