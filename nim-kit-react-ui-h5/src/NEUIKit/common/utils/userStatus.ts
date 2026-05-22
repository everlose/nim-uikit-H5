/**
 * 判断用户是否在线
 * 
 * statusType 枚举值:
 *   - 0: 未知
 *   - 1: 登录（在线）
 *   - 2: 登出
 *   - 3: 断开连接
 * 
 * 判定规则:
 *   1. statusType === 1 → 在线
 *   2. statusType === 2 或 3 → 需要检查 serverExtension 中的 online 数组
 *      - serverExtension: "{\"online\":[1]}" 或 "{\"online\":[16,1]}" → 有端在线
 *      - serverExtension: "{\"online\":[]}" → 无端在线（离线）
 * 
 * @param userStatus 用户状态对象
 * @returns 是否在线
 */
export const checkUserOnline = (userStatus?: { statusType?: number; serverExtension?: string }): boolean => {
  if (!userStatus) return false
  
  // statusType === 1: 登录状态，一定在线
  if (userStatus.statusType === 1) {
    return true
  }
  
  // statusType === 2 (登出) 或 statusType === 3 (断开连接)
  // 需要进一步检查 serverExtension 中是否还有其他端在线
  if (userStatus.statusType === 2 || userStatus.statusType === 3) {
    // serverExtension 格式: "{\"online\":[clientTypes...]}"
    // 离线时: "{\"online\":[]}" (长度 13)
    // 在线时: "{\"online\":[1]}" 或 "{\"online\":[16,1]}" 等 (长度 > 13)
    const offlineExtension = '{"online":[]}'
    if (userStatus.serverExtension && userStatus.serverExtension.length > offlineExtension.length) {
      return true
    }
  }
  
  return false
}
