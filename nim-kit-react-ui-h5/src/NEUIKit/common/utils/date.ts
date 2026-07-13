import dayjs from 'dayjs'
import { t } from './i18n'

export function caculateTimeago(dateTimeStamp: number): string {
  const now = new Date()
  const msgDate = new Date(dateTimeStamp)

  // 不同年：YY年MM月DD日 HH:mm
  if (msgDate.getFullYear() !== now.getFullYear()) {
    return dayjs(dateTimeStamp).format(t('timeFormatDiffYear'))
  }
  // 不同月或不同日：MM月DD日 HH:mm
  if (msgDate.getMonth() !== now.getMonth() || msgDate.getDate() !== now.getDate()) {
    return dayjs(dateTimeStamp).format(t('timeFormatSameYear'))
  }
  // 同一天：HH:mm
  return dayjs(dateTimeStamp).format('HH:mm')
}

export const formatDateRange = (type: string) => {
  const date = new Date()
  let year = date.getFullYear()
  let month: string | number = date.getMonth() + 1
  let day: string | number = date.getDate()

  if (type === 'start') {
    year = year - 100
  } else if (type === 'end') {
    year = year
  }
  month = month > 9 ? month : '0' + month
  day = day > 9 ? day : '0' + day
  return `${year}-${month}-${day}`
}
