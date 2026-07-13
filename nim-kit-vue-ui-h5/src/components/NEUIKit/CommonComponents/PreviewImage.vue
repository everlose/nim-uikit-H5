<template>
  <div v-if="visible" class="preview-image-container">
    <img :src="imageUrl" class="preview-image" alt="" />
    <button class="preview-close-btn" @click="handleClose" type="button" aria-label="关闭">
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
        <circle cx="14" cy="14" r="14" fill="#4C4C4C"/>
        <line x1="9" y1="9" x2="18.5" y2="18.5" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
        <line x1="19" y1="9" x2="9.5" y2="18.5" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </button>
    <button class="preview-download-btn" @click="handleDownload" type="button" aria-label="下载">
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
        <circle cx="14" cy="14" r="14" fill="#4C4C4C"/>
        <path d="M14.5,6 C15.0523,6 15.5,6.4477 15.5,7 V10 H13.5 V7 C13.5,6.4477 13.9477,6 14.5,6 Z M13.5,10 H10 C8.8954,10 8,10.8954 8,12 V20 C8,21.1046 8.8954,22 10,22 H19 C20.1046,22 21,21.1046 21,20 V12 C21,10.8954 20.1046,10 19,10 H15.5 V16.0858 L17.2929,14.2929 C17.6834,13.9024 18.3166,13.9024 18.7071,14.2929 C19.0976,14.6834 19.0976,15.3166 18.7071,15.7071 L15.2071,19.2071 C14.8166,19.5976 14.1834,19.5976 13.7929,19.2071 L10.2929,15.7071 C9.9024,15.3166 9.9024,14.6834 10.2929,14.2929 C10.6834,13.9024 11.3166,13.9024 11.7071,14.2929 L13.5,16.0858 V10 Z" fill="#fff" fill-rule="evenodd"/>
      </svg>
    </button>
  </div>
</template>

<script lang="ts" setup>
const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  imageUrl: {
    type: String,
    required: true,
  },
  onClose: {
    type: Function,
    default: undefined,
  },
});

const handleClose = () => {
  if (props.onClose) {
    props.onClose();
  }
};

const handleDownload = () => {
  fetch(props.imageUrl)
    .then((res) => res.blob())
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = (props.imageUrl.split("/").pop() || "image").split("?")[0];
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    })
    .catch(() => {
      window.open(props.imageUrl, "_blank", "noopener,noreferrer");
    });
};
</script>

<style scoped>
.preview-image-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #000;
  z-index: 9999;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
}

.preview-image {
  max-width: 100vw;
  max-height: 100vh;
  object-fit: contain;
}

.preview-close-btn {
  position: fixed;
  left: 20px;
  bottom: 20px;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-download-btn {
  position: fixed;
  right: 20px;
  bottom: 20px;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
