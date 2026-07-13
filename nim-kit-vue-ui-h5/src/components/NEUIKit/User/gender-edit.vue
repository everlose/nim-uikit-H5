<template>
  <div class="gender-edit-wrapper">
    <NavBar :title="t('genderText')" backgroundColor="transparent" />
    <div class="gender-options">
      <div class="gender-option" @click="() => handleSelect(1)">
        <span class="gender-label">{{ t("man") }}</span>
        <Icon v-if="currentGender === 1" type="icon-select-blue" :size="16" />
      </div>
      <div class="gender-option-divider" />
      <div class="gender-option" @click="() => handleSelect(2)">
        <span class="gender-label">{{ t("woman") }}</span>
        <Icon v-if="currentGender === 2" type="icon-select-blue" :size="16" />
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, getCurrentInstance, onUnmounted } from "vue";
import NavBar from "../CommonComponents/NavBar.vue";
import Icon from "../CommonComponents/Icon.vue";
import { t } from "../utils/i18n";
import { showToast } from "../utils/toast";
import { autorun } from "mobx";
import type { V2NIMUser } from "nim-web-sdk-ng/dist/esm/nim/src/V2NIMUserService";
import RootStore from "@xkit-yx/im-store-v2";
import router from "@/router";

const myUserInfo = ref<V2NIMUser>();

const { proxy } = getCurrentInstance()!;
const store = proxy?.$UIKitStore as RootStore;

const uninstallMyUserInfoWatch = autorun(() => {
  myUserInfo.value = store?.userStore.myUserInfo;
});

const currentGender = computed(() => myUserInfo.value?.gender ?? 0);

const handleSelect = async (gender: number) => {
  if (gender === currentGender.value) return;
  if (!myUserInfo.value) return;
  try {
    await store?.userStore.updateSelfUserProfileActive({
      ...myUserInfo.value,
      gender,
    });
    router.back();
  } catch {
    showToast({
      message: `${t("saveText")}${t("failText")}`,
      type: "info",
    });
  }
};

onUnmounted(() => {
  uninstallMyUserInfoWatch();
});
</script>

<style scoped>
.gender-edit-wrapper {
  height: 100%;
  box-sizing: border-box;
  background-color: #e9eff5;
}

.gender-options {
  margin: 16px 20px 0 20px;
  overflow: hidden;
  border-radius: 12px;
  background-color: #fff;
}

.gender-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 46px;
  padding: 0 16px;
}

.gender-label {
  font-size: 16px;
  color: #333;
}

.gender-option-divider {
  height: 1px;
  background: #f5f8fc;
  margin: 0 16px;
}
</style>
