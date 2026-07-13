<template>
  <div class="wrapper">
    <NavBar :title="t('setText')" backgroundColor="transparent" />
    <div class="setting-item-wrapper">
      <div class="setting-item">
        <div class="item-left">{{ t("enableV2CloudConversationText") }}</div>
        <div class="item-right">
          <Switch
            :checked="enableV2CloudConversation"
            @change="onChangeEnableV2CloudConversation"
          />
        </div>
      </div>
      <div class="setting-item">
        <div class="item-left">{{ t("SwitchToEnglishText") }}</div>
        <div class="item-right">
          <Switch
            :checked="switchToEnglishFlag"
            @change="onChangeSwitchToEnglishFlag"
          />
        </div>
      </div>
    </div>
    <div class="logout-btn" @click="handleLogout">{{ t("logoutText") }}</div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, getCurrentInstance } from "vue";
import NavBar from "../CommonComponents/NavBar.vue";
import Switch from "../CommonComponents/Switch.vue";
import { t } from "../utils/i18n";
import { showToast } from "../utils/toast";
import { useRouter } from "vue-router";
import { neUiKitRouterPath } from "../utils/uikitRouter";
import { showModal } from "../utils/modal";

const router = useRouter();
const enableV2CloudConversation = ref(false);
const switchToEnglishFlag = ref(false);
const { proxy } = getCurrentInstance()!;
const store = proxy?.$UIKitStore;

onMounted(() => {
  const storedCloudConv = localStorage.getItem("enableV2CloudConversation");
  const storedLanguage = localStorage.getItem("switchToEnglishFlag");
  enableV2CloudConversation.value = storedCloudConv === "on";
  switchToEnglishFlag.value = storedLanguage === "en";
});

const onChangeEnableV2CloudConversation = (value) => {
  enableV2CloudConversation.value = value;
  localStorage.setItem("enableV2CloudConversation", value ? "on" : "off");
  showToast({
    message: "切换后刷新页面生效",
    type: "info",
  });
};

const onChangeSwitchToEnglishFlag = (value) => {
  switchToEnglishFlag.value = value;
  localStorage.setItem("switchToEnglishFlag", value ? "en" : "zh");
  showToast({
    message: "切换后刷新页面生效",
    type: "info",
  });
};

const handleLogout = () => {
  showModal({
    content: t("logoutConfirmText"),
    title: t("tipText"),
    onCancel: () => {},
    onConfirm: async () => {
      localStorage.removeItem("__yx_im_options__h5");
      const nim = proxy?.$NIM;
      if (nim) {
        await nim.V2NIMLoginService.logout();
      }
      store?.resetState();
      router.push(neUiKitRouterPath.login);
    },
  });
};
</script>

<style scoped>
.wrapper {
  background-color: #E9EFF5;
  width: 100%;
  min-height: 100vh;
  box-sizing: border-box;
}

.setting-item-wrapper {
  margin: 16px 20px 0 20px;
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 16px;
  height: 46px;
  color: #000;
  position: relative;
}

.setting-item:not(:last-child)::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 16px;
  right: 20px;
  height: 1px;
  background-color: #F5F8FC;
}

.item-left {
  font-size: 16px;
}

.logout-btn {
  margin: 16px 20px 0 20px;
  background-color: #fff;
  border-radius: 12px;
  height: 46px;
  line-height: 46px;
  text-align: center;
  color: #F24957;
  font-size: 16px;
}
</style>
