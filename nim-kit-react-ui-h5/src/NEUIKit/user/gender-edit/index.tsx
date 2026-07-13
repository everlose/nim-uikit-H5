import React from 'react'
import { useNavigate } from '@/utils/router'
import { observer } from 'mobx-react-lite'
import NavBar from '@/NEUIKit/common/components/NavBar'
import Icon from '@/NEUIKit/common/components/Icon'
import { useTranslation } from '@/NEUIKit/common/hooks/useTranslate'
import { useStateContext } from '@/NEUIKit/common/hooks/useStateContext'
import { toast } from '@/NEUIKit/common/utils/toast'
import './index.less'

/**
 * 性别编辑页面 —— 男/女两个选项平铺，当前已选项带蓝色勾，点击已勾选项无效
 */
const GenderEdit: React.FC = observer(() => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { store } = useStateContext()
  const myUserInfo = store.userStore.myUserInfo
  const currentGender = myUserInfo?.gender ?? 0 // 0 未知 1 男 2 女

  const handleSelect = async (gender: number) => {
    if (gender === currentGender) return // 点击已选项无效
    if (!myUserInfo) return
    try {
      await store.userStore.updateSelfUserProfileActive({ ...myUserInfo, gender })
      navigate(-1)
    } catch {
      toast.info(`${t('saveText')}${t('failText')}`)
    }
  }

  return (
    <div className="gender-edit-wrapper">
      <NavBar title={t('genderText')} backgroundColor="transparent" />
      <div className="gender-options">
        <div className="gender-option" onClick={() => handleSelect(1)}>
          <span className="gender-label">{t('man')}</span>
          {currentGender === 1 && <Icon type="icon-select-blue" size={16} />}
        </div>
        <div className="gender-option-divider" />
        <div className="gender-option" onClick={() => handleSelect(2)}>
          <span className="gender-label">{t('woman')}</span>
          {currentGender === 2 && <Icon type="icon-select-blue" size={16} />}
        </div>
      </div>
    </div>
  )
})

export default GenderEdit
