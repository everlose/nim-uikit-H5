// NIM SDK 的 appkey 配置
// 从环境变量读取，必须在 .env.local 中配置
export const NIM_APP_KEY = process.env.NIM_APP_KEY || ''

// 启动时检查必要的环境变量
if (!NIM_APP_KEY) {
  console.error(
    '[Config Error] NIM_APP_KEY 未配置！\n' +
    '请复制 .env.local.example 为 .env.local 并填入 NIM_APP_KEY'
  )
}

// NIM 的日志输出等级
export const NIM_DEBUG_LEVEL = 'debug'
// NIM 的 LBS 负载均衡服务地址
export const NIM_LBS_URLS = ['https://lbs.netease.im/lbs/webconf.jsp']
// NIM 的 兜底 TCP 连接地址
export const NIM_LINK_URL = 'weblink.netease.im'

// 用户中心 API 基础路径
// 从环境变量读取，有默认值
export const USER_CENTER_BASE_URL = process.env.USER_CENTER_BASE_URL || 'https://yiyong-user-center.netease.im'