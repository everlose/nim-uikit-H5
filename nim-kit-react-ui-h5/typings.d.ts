declare module 'browser-md5-file' {
  export default class BMF {
    md5(file: File, callback: (error: unknown, md5: string) => void): void
  }
}

declare module '*.png' {
  const src: string
  export default src
}

declare module '*.svg' {
  const src: string
  export default src
}

declare module '*.less'
