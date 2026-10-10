/**
 * 补全下载文件名的后缀
 * attachment.name 是"文件显示名称"，不一定带扩展名（例如其他端发来的文件消息），
 * 这种情况用 attachment.ext 补上，避免下载下来是没有后缀、打不开的文件。
 * 已经带后缀时原样返回，不会重复拼接。
 * @param name 文件显示名称
 * @param ext 文件扩展名，允许带或不带前导点
 */
export const withFileExtension = (name: string, ext: string) => {
  const value = name || ''
  const suffix = (ext || '').replace(/^\./, '').trim()
  if (!value || !suffix) return value
  return value.toLowerCase().endsWith(`.${suffix.toLowerCase()}`) ? value : `${value}.${suffix}`
}

/**
 * 拼接带下载文件名的 CDN 地址
 * NOS 通过 `download` 参数指定下载文件名，响应会带 Content-Disposition: attachment，
 * 所以必须带上该参数，浏览器下载下来才是正确的文件名。
 * @param url 文件 CDN URL
 * @param name 文件显示名称，非 ASCII 字符会被 URL 编码
 * @param ext 文件扩展名，文件名缺后缀时用它补全
 */
export const buildFileDownloadUrl = (url: string, name: string, ext = '') => {
  if (!url) return ''
  const downloadName = withFileExtension(name, ext)
  if (!downloadName) return url
  return `${url}${url.includes('?') ? '&' : '?'}download=${encodeURIComponent(downloadName)}`
}

/**
 * 触发浏览器原生下载：只把带 download 参数的地址交给浏览器，由浏览器自己完成下载。
 * 不再 fetch 整个文件到内存——那样大文件（例如 37MB）在整个传输过程中没有任何反馈，
 * 并且必须等文件全部下载完，浏览器的下载提示才会出现。
 * CDN 对带 download 参数的地址会返回 Content-Disposition: attachment，
 * 因此下载在当前页触发，不会跳走聊天页。
 * @param url 文件 CDN URL
 * @param name 文件显示名称
 * @param ext 文件扩展名，文件名缺后缀时用它补全
 */
export const downloadFile = (url: string, name: string, ext = '') => {
  if (!url) return
  const downloadName = withFileExtension(name, ext)
  const a = document.createElement('a')
  a.href = buildFileDownloadUrl(url, name, ext)
  // 同源时 download 生效；跨域文件名由 CDN 的 Content-Disposition 决定
  a.download = downloadName
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

const FILE_ICON_BY_EXTENSION: Record<string, string> = {
  doc: 'icon-aos-word',
  docx: 'icon-aos-word',
  xls: 'icon-aos-excel',
  xlsx: 'icon-aos-excel',
  csv: 'icon-aos-excel',
  ppt: 'icon-aos-ppt',
  pptx: 'icon-aos-ppt',
  jpg: 'icon-aos-image',
  jpeg: 'icon-aos-image',
  png: 'icon-aos-image',
  tiff: 'icon-aos-image',
  gif: 'icon-aos-image',
  webp: 'icon-aos-image',
  zip: 'icon-aos-rar',
  '7z': 'icon-aos-rar',
  tar: 'icon-aos-rar',
  rar: 'icon-aos-rar',
  gz: 'icon-aos-rar',
  pdf: 'icon-aos-pdf',
  rtf: 'icon-aos-pdf',
  txt: 'icon-aos-text',
  html: 'icon-aos-html',
  htm: 'icon-aos-html',
  mp4: 'icon-aos-video',
  avi: 'icon-aos-video',
  wmv: 'icon-aos-video',
  mpeg: 'icon-aos-video',
  m4v: 'icon-aos-video',
  mov: 'icon-aos-video',
  asf: 'icon-aos-video',
  flv: 'icon-aos-video',
  f4v: 'icon-aos-video',
  rmvb: 'icon-aos-video',
  rm: 'icon-aos-video',
  '3gp': 'icon-aos-video',
  mp3: 'icon-aos-mp3',
  aac: 'icon-aos-mp3',
  wav: 'icon-aos-mp3',
  wma: 'icon-aos-mp3',
  flac: 'icon-aos-mp3',
}

const normalizeExtension = (extension: string, name: string) => {
  const value = extension?.trim() || name.slice(name.lastIndexOf('.') + 1)
  return value.replace(/^\./, '').toLowerCase()
}

export const getMessageFileIconType = (extension = '', name = '') =>
  FILE_ICON_BY_EXTENSION[normalizeExtension(extension, name)] || 'icon-aos-unknown'
