<template>
  <div class="wrapper">
    <NavBar :title="t('nickInTeam')">
      <template v-slot:left>
        <div class="nav-bar-text" @click="back">{{ t("cancelText") }}</div>
      </template>
      <template v-slot:right>
        <div @click="onOk">
          {{ t("okText") }}
        </div>
      </template>
    </NavBar>
    <div class="userInfo-item-wrapper">
      <textarea
        class="nick-textarea"
        :maxlength="30"
        v-model="inputValue"
        :placeholder="t('nickInTeam')"
        rows="3"
      />
      <div v-if="inputValue" @click="clearInputValue" class="clear-icon-wrapper">
        <Icon
          iconClassName="clear-icon"
          type="icon-shandiao"
        ></Icon>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
// 此组件用于修改群昵称
import { autorun } from "mobx";
import { onUnmounted, ref, getCurrentInstance } from "vue";
import Icon from "../../CommonComponents/Icon.vue";
import NavBar from "../../CommonComponents/NavBar.vue";
import { t } from "../../utils/i18n";
import type { V2NIMTeamMember } from "nim-web-sdk-ng/dist/esm/nim/src/V2NIMTeamService";
import { onMounted } from "vue";
import RootStore from "@xkit-yx/im-store-v2";
import { useRouter } from "vue-router";
import { toast } from "../../utils/toast";
import { useTeamNotification } from "../../composables/useTeamNotification";

const router = useRouter();
const inputValue = ref("");
const myMemberInfo = ref<V2NIMTeamMember>();
let teamId = "";
let uninstallTeamMemberWatch = () => {};
const { proxy } = getCurrentInstance()!;
const store = proxy?.$UIKitStore as RootStore;
useTeamNotification(() => teamId);

onMounted(() => {
  teamId = (router.currentRoute.value.query.teamId as string) || "";
  uninstallTeamMemberWatch = autorun(() => {
    const memberList = store?.teamMemberStore.getTeamMember(teamId, [
      store?.userStore.myUserInfo.accountId,
    ]);
    myMemberInfo.value = memberList?.[0];

    inputValue.value = myMemberInfo.value?.teamNick || "";
  });
});

const clearInputValue = () => {
  inputValue.value = "";
};

const onOk = () => {
  store?.teamMemberStore
    .updateMyMemberInfoActive({
      teamId,
      memberInfo: {
        teamNick: inputValue.value.trim(),
      },
    })
    .then(() => {
      back();
    })
    .catch(() => {
      toast.info(t("saveFailedText"));
    });
};

const back = () => {
  router.back();
};

onUnmounted(() => {
  uninstallTeamMemberWatch();
});
</script>

<style>
.wrapper {
  width: 100%;
  height: 100vh;
  box-sizing: border-box;
  background-color: rgb(245, 246, 247);
}
.nav-bar-text {
  color: rgb(20, 146, 209);
}

.userInfo-item-wrapper {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  background-color: #fff;
  border-radius: 8px;
  padding: 12px 16px 5px;
  margin: 10px 20px;
}
.nick-textarea {
  width: 100%;
  border: none;
  outline: none;
  resize: none;
  font-size: 16px;
  color: #000;
  line-height: 1.5;
  font-family: inherit;
  padding: 0;

  &::placeholder {
    color: #c0c4cc;
  }
}

.clear-icon-wrapper {
  flex-shrink: 0;
  cursor: pointer;
  margin-left: 8px;
  margin-top: 2px;
}
</style>
