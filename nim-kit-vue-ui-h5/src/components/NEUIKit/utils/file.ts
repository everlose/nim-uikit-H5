/**
 * JS 静默下载：fetch → blob → 临时 a 标签触发下载，不跳转页面
 * @param url 文件 CDN URL
 * @param name 下载文件名
 */
export const downloadFile = async (url: string, name: string) => {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = name
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    // 延迟释放 blob URL，确保浏览器已开始下载
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
  } catch {
    // CORS 限制或网络异常，兜底：新标签页打开
    window.open(url, '_blank')
  }
}
