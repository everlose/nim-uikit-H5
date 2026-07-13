import React from 'react'
import BottomPopup from '../BottomPopup'
import { useTranslation } from '../../hooks/useTranslate'
import './index.less'

export interface ActionSheetAction {
  text: string
  onClick: () => void
}

export interface ActionSheetProps {
  visible: boolean
  actions: ActionSheetAction[]
  onClose: () => void
}

const ActionSheet: React.FC<ActionSheetProps> = ({ visible, actions, onClose }) => {
  const { t } = useTranslation()

  return (
    <BottomPopup
      visible={visible}
      showHeader={false}
      showCancel={false}
      showConfirm={false}
      onCancel={onClose}
      onClose={onClose}
      className="action-sheet-popup"
    >
      <div className="action-sheet">
        <div className="action-sheet-group">
          {actions.map((action, index) => (
            <div
              key={index}
              className="action-sheet-item"
              onClick={action.onClick}
            >
              {action.text}
            </div>
          ))}
        </div>
        <div className="action-sheet-cancel" onClick={onClose}>
          {t('cancelText')}
        </div>
      </div>
    </BottomPopup>
  )
}

export default ActionSheet
