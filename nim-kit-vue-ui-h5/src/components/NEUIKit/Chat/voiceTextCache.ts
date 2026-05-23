const voiceTextCache = new Map<string, Record<string, string>>();

export const getVoiceTextMap = (conversationId: string) => {
  return { ...(voiceTextCache.get(conversationId) || {}) };
};

export const setVoiceText = (
  conversationId: string,
  messageClientId: string,
  text: string
) => {
  const current = voiceTextCache.get(conversationId) || {};
  const next = {
    ...current,
    [messageClientId]: text,
  };

  voiceTextCache.set(conversationId, next);
  return { ...next };
};

export const clearVoiceTextCache = () => {
  voiceTextCache.clear();
};
