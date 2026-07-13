<template>
  <div class="emoji-panel-wrapper">
    <div class="emoji-pages" ref="scrollRef" @scroll="handleScroll">
      <div
        class="emoji-page"
        v-for="(page, pageIdx) in pages"
        :key="pageIdx"
      >
        <div
          class="msg-face-row"
          v-for="(row, rowIdx) in page"
          :key="rowIdx"
        >
          <template v-for="colIdx in COLS" :key="colIdx">
            <div
              v-if="rowIdx === lastItemRowIdx(page) && colIdx === COLS"
              class="msg-face-item msg-face-delete"
              @click="handleEmojiDelete"
            >
              <Icon type="icon-delete-light" :size="27" />
            </div>
            <div
              v-else-if="row[colIdx - 1]"
              class="msg-face-item"
              @click="handleEmojiClick(row[colIdx - 1])"
            >
              <Icon :size="27" :type="emojiMap[row[colIdx - 1]]" />
            </div>
            <div v-else class="msg-face-item msg-face-placeholder" />
          </template>
        </div>
      </div>
    </div>

    <!-- 页面指示器 -->
    <div v-if="pages.length > 1" class="emoji-indicator">
      <div
        v-for="(_, idx) in pages"
        :key="idx"
        class="emoji-dot"
        :class="{ active: idx === activePage }"
      />
    </div>

    <!-- 底部操作栏 -->
    <div class="msg-face-control">
      <div class="msg-send-btn" @click="handleEmojiSend">
        {{ t("sendText") }}
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed } from "vue";
import { emojiMap } from "../../utils/emoji";
import Icon from "../../CommonComponents/Icon.vue";
import { t } from "../../utils/i18n";

const ROWS_PER_PAGE = 3;
const COLS = 7;
const ITEMS_PER_PAGE = ROWS_PER_PAGE * COLS - 1; // 每页留最后一位给删除按钮

const emojiArr = Object.keys(emojiMap);
const emit = defineEmits(["emojiClick", "emojiSend", "emojiDelete"]);

// 按每页 ITEMS_PER_PAGE 个表情拆分，末位留给删除按钮
const pages = computed(() => {
  const result: string[][][] = [];
  let offset = 0;
  while (offset < emojiArr.length) {
    const pageItems = emojiArr.slice(offset, offset + ITEMS_PER_PAGE);
    offset += ITEMS_PER_PAGE;
    const page: string[][] = [];
    for (let i = 0; i < pageItems.length; i += COLS) {
      page.push(pageItems.slice(i, i + COLS));
    }
    while (page.length < ROWS_PER_PAGE) {
      page.push([]);
    }
    result.push(page);
  }
  return result;
});

const scrollRef = ref<HTMLDivElement>();
const activePage = ref(0);

const handleScroll = () => {
  if (scrollRef.value) {
    const pageWidth = scrollRef.value.clientWidth;
    const page = Math.round(scrollRef.value.scrollLeft / pageWidth);
    activePage.value = page;
  }
};

const lastItemRowIdx = (page: string[][]) => {
  return page.reduce((acc, r, i) => (r.length > 0 ? i : acc), 0);
};

const handleEmojiClick = (key: string) => {
  emit("emojiClick", { key, type: emojiMap[key] });
};

const handleEmojiDelete = () => {
  emit("emojiDelete");
};

const handleEmojiSend = () => {
  emit("emojiSend");
};
</script>

<style scoped>
.emoji-panel-wrapper {
  background: #fff;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.emoji-pages {
  flex: 1;
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
}

.emoji-pages::-webkit-scrollbar {
  display: none;
}

.emoji-page {
  flex: 0 0 100%;
  scroll-snap-align: start;
  display: flex;
  flex-direction: column;
}

.msg-face-row {
  display: flex;
  justify-content: space-around;
  padding: 4px 0;
}

.msg-face-item {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.msg-face-placeholder {
  visibility: hidden;
}

.emoji-indicator {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 4px 0 6px;
  gap: 6px;
}

.emoji-dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #ccc;
  transition: background 0.2s;
}

.emoji-dot.active {
  background: #8f8f8f;
}

.msg-face-control {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  border-top: 1px solid #f0f0f0;
}

.msg-face-delete {
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.msg-send-btn {
  padding: 6px 16px;
  background: #337eff;
  color: #fff;
}
</style>
