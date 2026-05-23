const voiceTextCache = new Map<string, Map<string, string>>()

export const getVoiceTextMap = (conversationId: string) => {
  return new Map(voiceTextCache.get(conversationId) || [])
}

export const setVoiceText = (conversationId: string, messageClientId: string, text: string) => {
  const current = voiceTextCache.get(conversationId) || new Map<string, string>()
  const next = new Map(current)

  next.set(messageClientId, text)
  voiceTextCache.set(conversationId, next)

  return new Map(next)
}

export const clearVoiceTextCache = () => {
  voiceTextCache.clear()
}
