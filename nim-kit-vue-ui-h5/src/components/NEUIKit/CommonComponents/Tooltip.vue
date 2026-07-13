<template>
  <div
    class="chat-tooltip"
    :style="{
      '--theme-bg-color': color,
    }"
  >
    <div
      class="chat_tooltip_content"
      ref="tooltipContent"
      @touchstart="_lpTouchStart"
      @touchend="_lpTouchEnd"
      @touchmove="_lpTouchMove"
      @touchcancel="_lpTouchCancel"
      @contextmenu.prevent="_lpContextMenu"
    >
      <slot></slot>
      <div
        class="chat_tooltip__mask"
        v-show="isShow"
        @touchstart.stop="close"
      ></div>
      <div
        class="chat_tooltip__popper"
        v-if="popperRendered"
        ref="popperRef"
        @click.stop="() => {}"
        :style="[
          style,
          {
            visibility: isShow ? 'visible' : 'hidden',
            color: color === 'white' ? '' : '#fff',
            boxShadow:
              color === 'white'
                ? '0 3px 6px -4px #0000001f, 0 6px 16px #00000014, 0 9px 28px 8px #0000000d'
                : '',
          },
        ]"
      >
        <slot name="content">{{ content }}</slot>
      </div>
    </div>
  </div>
</template>

<script>
import { longPressMixin } from "../utils/longPress";

export default {
  name: "Tooltip",
  mixins: [longPressMixin],
  props: {
    visible: Boolean,
    align: Boolean,
    color: {
      type: String,
      default: "#303133",
    },
    content: {
      type: String,
      default: "",
    },
    show: {
      type: Boolean,
      default: false,
    },
  },

  data() {
    return {
      isShow: this.visible,
      popperRendered: this.visible,
      title: "Hello",
      arrowLeft: 0,
      query: null,
      style: {},
      arrowStyle: {},
      placement: "top",
      longPressOptions: {
        duration: 500,
        moveThreshold: 30,
      },
    };
  },
  onLoad() {},
  watch: {
    isShow: {
      handler(val) {
        this.$emit("update:visible", val);
      },
      immediate: true,
    },
    visible: {
      handler(val) {
        if (val) {
          this.popperRendered = true;
          this.$nextTick(() => {
            this.getPosition();
          });
        } else {
          this.popperRendered = false;
        }
        this.isShow = val;
      },
      immediate: true,
    },
  },
  mounted() {
    // #ifdef H5
    this.longPressOptions.onLongPress = this.handleClick;
    this._lpInit(this.$refs.tooltipContent);

    window.addEventListener("click", () => {
      // Android: 长按打开菜单后 touchend 会触发 click，短暂忽略
      if (this._lpActive) {
        this._lpActive = false;
        return;
      }
      this.isShow = false;
      this.popperRendered = false;
    });
    // #endif
    if (this.popperRendered) {
      this.getPosition();
    }
  },
  methods: {
    close() {
      this.isShow = false;
      this.popperRendered = false;
    },
    fixedWrap() {
      this.isShow = false;
      this.popperRendered = false;
    },
    async handleClick() {
      if (this.isShow) {
        this.popperRendered = false;
        return (this.isShow = false);
      }
      this.popperRendered = true;
      await new Promise((resolve) => {
        requestAnimationFrame(resolve);
      });
      await this.getPosition();
      this.isShow = true;
    },
    getPosition() {
      return new Promise((resolve) => {
        const tooltipContent = this.$el.querySelector(".chat_tooltip_content");
        const tooltipPopper = this.$refs.popperRef;

        if (tooltipContent && tooltipPopper) {
          const popperRect = tooltipPopper.getBoundingClientRect();
          const contentRect = tooltipContent.getBoundingClientRect();
          const windowWidth = window.innerWidth;
          const windowHeight = window.innerHeight;
          const margin = 10;
          const gap = 8;
          const touchPoint = this._lpStartPosition;
          const anchorX =
            touchPoint?.x || contentRect.left + contentRect.width / 2;
          const anchorY =
            touchPoint?.y || contentRect.top + contentRect.height / 2;
          let objStyle = {};
          let objStyle1 = {};

          const popperWidth = popperRect.width;
          const popperHeight = popperRect.height;
          const hasEnoughSpaceAbove = anchorY - popperHeight - gap >= margin;
          const hasEnoughSpaceBelow =
            anchorY + popperHeight + gap <= windowHeight - margin;

          if (!hasEnoughSpaceAbove && hasEnoughSpaceBelow) {
            this.placement = "bottom";
          } else {
            this.placement = "top";
          }

          switch (this.placement) {
            case "top":
              objStyle.top = `${Math.max(
                margin,
                anchorY - popperHeight - gap
              )}px`;
              break;

            case "bottom":
              objStyle.top = `${Math.min(
                windowHeight - popperHeight - margin,
                anchorY + gap
              )}px`;
              break;
          }
          objStyle.left = `${Math.min(
            windowWidth - popperWidth - margin,
            Math.max(margin, anchorX - popperWidth / 2)
          )}px`;

          this.style = objStyle;
          this.arrowStyle = objStyle1;
          resolve();
        } else {
          resolve();
        }
      });
    },
  },
};
</script>

<style scoped>
/* $theme-bg-color: var(--theme-bg-color);*/

.chat-tooltip {
  position: relative;
  -webkit-touch-callout: none; /* iOS Safari */
  -webkit-user-select: none; /* Safari */
  -khtml-user-select: none; /* Konqueror HTML */
  -moz-user-select: none; /* Firefox */
  -ms-user-select: none; /* Internet Explorer/Edge */
  user-select: none; /* Non-prefixed version */
  -webkit-tap-highlight-color: transparent; /* 移除触摸高亮效果 */
}

.chat_tooltip_content {
  height: 100%;
  line-height: 150%;
  position: relative;
  display: inline-block;
  vertical-align: top;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  -khtml-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.chat_tooltip__popper {
  /* transform-origin: center top; */
  /* background: $theme-bg-color; */

  visibility: hidden;

  position: fixed;
  border-radius: 4px;
  font-size: 12px;
  padding: 10px;
  min-width: 10px;
  max-width: calc(100vw - 20px); /* 限制最大宽度，两边留10px边距 */
  overflow-wrap: break-word;  /* 允许长单词换行 */
  white-space: normal;  /* 允许文本换行 */
  display: inline-block;
  white-space: nowrap;
  z-index: 99;
  background-color: #fff;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
}

.chat_tooltip__mask {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background-color: rgba(256, 256, 256, 0);
  z-index: 8;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
}

.chat_popper__icon {
  width: 0;
  height: 0;
  z-index: 9;
  position: absolute;
}

.chat_popper__arrow {
  bottom: -5px;
  /* transform-origin: center top; */
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  /* border-top: 6px solid $theme-bg-color;*/
}

.chat_popper__right {
  border-top: 6px solid transparent;
  border-bottom: 6px solid transparent;
  /* border-right: 6px solid $theme-bg-color;*/
  left: -5px;
}

.chat_popper__left {
  border-top: 6px solid transparent;
  border-bottom: 6px solid transparent;
  /* border-left: 6px solid $theme-bg-color;*/
  right: -5px;
}

.chat_popper__up {
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  /*border-bottom: 6px solid $theme-bg-color;*/
  top: -5px;
}

.fixed {
  position: absolute;
  width: 100vw;
  height: 100vh;
  position: fixed;
  left: 0;
  top: 0;
  pointer-events: auto;
  background: red;
  z-index: -1;
}
</style>
