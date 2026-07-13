import React, { useState, useRef, useEffect, useMemo } from 'react'
import { observer } from 'mobx-react-lite'
import Icon from '@/NEUIKit/common/components/Icon'
import { events } from '@/NEUIKit/common/utils/constants'
import emitter from '@/NEUIKit/common/utils/eventBus'
import type { V2NIMMessageForUI } from '@xkit-yx/im-store-v2/dist/types/src/types'
import type { V2NIMMessageAudioAttachment } from 'nim-web-sdk-ng/dist/esm/nim/src/V2NIMMessageService'
import './index.less'

interface MessageAudioProps {
  msg: V2NIMMessageForUI
  mode?: 'audio-in' | 'audio-out'
  broadcastNewAudioSrc?: string
  /**
   * 语音转文字结果
   */
  voiceText?: string
}

/**
 * 音频消息组件
 */
const MessageAudio: React.FC<MessageAudioProps> = observer(({ msg, mode, broadcastNewAudioSrc, voiceText }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [audioIconType, setAudioIconType] = useState('icon-yuyin3')
  const animationFlagRef = useRef(false)
  const [isAudioPlaying, setIsAudioPlaying] = useState(false)
  const isAudioPlayingRef = useRef(false)

  // 同步 ref 以便在事件回调中读取最新值
  useEffect(() => {
    isAudioPlayingRef.current = isAudioPlaying
  }, [isAudioPlaying])

  // 获取音频源
  const audioSrc = useMemo(() => {
    //@ts-ignore
    return msg?.attachment?.url || ''
  }, [msg])

  // 格式化音频时长
  const formatDuration = (duration: number) => {
    return Math.round(duration / 1000) || 1
  }

  // 音频消息宽度
  const audioContainerWidth = useMemo(() => {
    //@ts-ignore
    const duration = formatDuration(msg.attachment?.duration)
    const maxWidth = 180
    return 50 + 8 * (duration - 1) > maxWidth ? maxWidth : 50 + 8 * (duration - 1)
  }, [msg])

  // 音频时长
  const duration = useMemo(() => {
    return formatDuration((msg.attachment as V2NIMMessageAudioAttachment)?.duration)
  }, [msg])

  // 切换播放状态
  const togglePlay = () => {
    if (!audioRef.current) return

    if (isAudioPlaying) {
      // 暂停并用 load() 强制重置音频元素
      audioRef.current.pause()
      audioRef.current.load()
      animationFlagRef.current = false
      setIsAudioPlaying(false)
    } else {
      // 每次播放都从头开始（暂停时已用 load 重置过）
      emitter.emit(events.AUDIO_PLAY_CHANGE, msg.messageClientId)
      audioRef.current.play().catch((error) => {
        console.warn('播放音频失败:', error)
      })
    }
  }

  // 播放事件处理
  const onAudioPlay = () => {
    setIsAudioPlaying(true)
    playAudioAnimation()
  }

  const onAudioStop = () => {
    animationFlagRef.current = false
    setIsAudioPlaying(false)
  }

  const onAudioEnded = () => {
    animationFlagRef.current = false
    setIsAudioPlaying(false)
  }

  const onAudioError = () => {
    animationFlagRef.current = false
    console.warn('音频播放出错')
  }

  // 播放音频动画
  const playAudioAnimation = () => {
    try {
      animationFlagRef.current = true
      let audioIcons = ['icon-yuyin1', 'icon-yuyin2', 'icon-yuyin3']

      const handler = () => {
        const icon = audioIcons.shift()
        if (icon) {
          setAudioIconType(icon)

          if (!audioIcons.length && animationFlagRef.current) {
            audioIcons = ['icon-yuyin1', 'icon-yuyin2', 'icon-yuyin3']
          }

          if (audioIcons.length) {
            setTimeout(handler, 300)
          }
        }
      }

      handler()
    } catch (error) {
      console.log('动画播放出错:', error)
    }
  }

  // 监听其他音频的播放事件，实现互斥播放：同一时间只能有一条语音在播放
  useEffect(() => {
    const handleAudioPlayChange = (messageId: any) => {
      if (messageId !== msg.messageClientId && isAudioPlayingRef.current) {
        if (audioRef.current) {
          audioRef.current.pause()
          audioRef.current.load()
          setIsAudioPlaying(false)
          animationFlagRef.current = false
        }
      }
    }

    emitter.on(events.AUDIO_PLAY_CHANGE, handleAudioPlayChange)

    return () => {
      emitter.off(events.AUDIO_PLAY_CHANGE, handleAudioPlayChange)
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      }
    }
  }, [msg.messageClientId])

  // 停止播放的通用方法
  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.load()
      setIsAudioPlaying(false)
      animationFlagRef.current = false
    }
  }

  // 监听全局停止音频事件（进入其他页面时停止播放）
  useEffect(() => {
    emitter.on(events.AUDIO_STOP_ALL, stopAudio)
    return () => {
      emitter.off(events.AUDIO_STOP_ALL, stopAudio)
    }
  }, [msg.messageClientId])

  // 监听页面可见性变化（进入录制、拍照、图库等系统级页面时停止播放）
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopAudio()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [msg.messageClientId])

  const containerClass = !msg.isSelf || mode === 'audio-in' ? 'audio-in' : 'audio-out'

  return (
    <div className="message-audio-container">
      <div className={containerClass} style={{ width: audioContainerWidth + 'px' }} onClick={togglePlay}>
        <div className="audio-dur">{duration}s</div>
        <div className="audio-icon-wrapper">
          <Icon size={24} type={audioIconType} />
        </div>
        <audio src={audioSrc} ref={audioRef} onPlay={onAudioPlay} onPause={onAudioStop} onEnded={onAudioEnded} onError={onAudioError} />
      </div>
      {voiceText && (
        <div className="voice-text-container">
          <div className="voice-text-divider" />
          <div className="voice-text-content">{voiceText}</div>
        </div>
      )}
    </div>
  )
})

export default MessageAudio
