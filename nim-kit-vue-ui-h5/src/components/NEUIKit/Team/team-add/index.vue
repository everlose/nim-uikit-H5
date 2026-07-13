<template>
  <div class="team-add-wrapper">
    <NavBar :title="t('friendSelectText')" showLeft>
      <template v-slot:left>
        <div class="nav-cancel-btn" @click="router.back()">{{ t('cancelText') }}</div>
      </template>
      <template v-slot:right>
        <div
          :class="['add-button', { disabled: newTeamMember.length === 0 }]"
          @click="newTeamMember.length > 0 && addTeamMember()"
        >
          {{ newTeamMember.length > 0 ? `${t('yesText')}(${newTeamMember.length})` : t('yesText') }}
        </div>
      </template>
    </NavBar>
    <div class="team-member-select">
      <PersonSelect
        :personList="friendList"
        :showBtn="false"
        @checkboxChange="checkboxChange"
        @maxExceeded="toast.info(t('maxSelectedText'))"
        :max="200"
      >
      </PersonSelect>
    </div>
  </div>
</template>

<script lang="ts" setup>
import PersonSelect, {
  PersonSelectItem,
} from "../../CommonComponents/PersonSelect.vue";
import { onMounted, ref, getCurrentInstance, onUnmounted } from "vue";
import NavBar from "../../CommonComponents/NavBar.vue";
import { t } from "../../utils/i18n";
import { debounce } from "@xkit-yx/utils";
import { toast } from "../../utils/toast";
import { useRouter } from "vue-router";
import { useTeamNotification } from "../../composables/useTeamNotification";

const router = useRouter();

const friendList = ref<PersonSelectItem[]>([]);
let teamId = "";
const newTeamMember = ref<string[]>([]);

const { proxy } = getCurrentInstance()!; // 获取组件实例
const store = proxy?.$UIKitStore;
useTeamNotification(() => teamId);

onMounted(() => {
  teamId = (router.currentRoute.value.query.teamId as string) || "";

  const _friendList =
    store?.uiStore.friends.filter(
      (item) => !store?.relationStore.blacklist.includes(item.accountId)
    ) || [];

  const res = store?.teamMemberStore.getTeamMember(teamId) || [];
  const _teamMembers = res.map((item) => {
    return item.accountId;
  });
  friendList.value = _friendList.map((item) => {
    if (_teamMembers.includes(item.accountId)) {
      return { accountId: item.accountId, disabled: true };
    } else {
      return { accountId: item.accountId };
    }
  });
});

const checkboxChange = (selectList) => {
  if (selectList.length > 200) {
    toast.info(t("maxSelectedText"));
    return;
  }
  newTeamMember.value = selectList;
};
// 添加群成员
const addTeamMember = debounce(() => {
  // 群成员数量存在限制
  if (newTeamMember.value.length > 200) {
    toast.info(t("maxSelectedText"));
    return;
  }
  if (newTeamMember.value.length == 0) {
    toast.info(t("friendSelect"));
    return;
  }

  store?.teamMemberStore
    .addTeamMemberActive({ teamId, accounts: newTeamMember.value })
    .then(async () => {
      router.back();
    })
    .catch((err: any) => {
      switch (err ? err.code : "") {
        case 109306:
          toast.info(t("noPermission"));
          break;
        default:
          toast.info(t("addTeamMemberFailText"));
          break;
      }
    });
}, 800);
</script>

<style scoped>
.team-add-wrapper {
  height: 100%;
  box-sizing: border-box;
  background-color: #fff;
  overflow: hidden;
}

.team-member-select {
  height: calc(100% - 44px);
  overflow: hidden;
}

.add-button {
  color: #337eff;
  font-size: 16px;
  cursor: pointer;
}

.add-button.disabled {
  color: #b3cff7;
  cursor: not-allowed;
}

.nav-cancel-btn {
  font-size: 16px;
  color: #333;
  cursor: pointer;
}
</style>
