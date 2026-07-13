<template>
  <div v-if="showUiKit" class="app-container">
    <router-view v-slot="{ Component, route }">
      <div class="page-transition-wrapper">
        <Transition :name="pageTransitionName">
          <div :key="getPageTransitionKey(route.path)" class="page-transition-page">
            <div v-if="isTabBarPath(route.path)" class="tab-page-shell">
              <div class="tab-page-content">
                <component :is="Component" />
              </div>
              <TabBar />
            </div>
            <component v-else :is="Component" />
          </div>
        </Transition>
      </div>
    </router-view>
  </div>
</template>

<script lang="ts">
import TabBar from "./components/TabBar.vue";

import { init } from "./components/NEUIKit/utils/init";
import { setupFriendSubscription } from "./components/NEUIKit/composables/useSubscription";
import { getCurrentInstance } from "vue";
import { setLanguage } from "./components/NEUIKit/utils/i18n";
import { showToast } from "./components/NEUIKit/utils/toast";

type TransitionName = "page-forward" | "page-back" | "page-none";

const tabBarPaths = ["/", "/conversation", "/contacts", "/my"];

const routeDepthMap: Record<string, number> = {
  "/": 0,
  "/login": 0,
  "/conversation": 0,
  "/contacts": 0,
  "/my": 0,

  "/chat": 1,
  "/conversation/search": 1,
  "/contacts/teamlist": 1,
  "/contacts/blacklist": 1,
  "/contacts/validlist": 1,
  "/user/my-detail": 1,
  "/user/setting": 1,
  "/user/collection": 1,
  "/user/aboutNetease": 1,
  "/friend/friend-card": 1,
  "/friend/add": 1,
  "/team/create": 1,

  "/chat/message-read-info": 2,
  "/chat/pin-list": 2,
  "/p2p-setting": 2,
  "/friend/edit": 2,
  "/user/my-detail-edit": 2,
  "/team/setting": 2,
  "/team/add": 2,
  "/team/member": 2,
  "/team/info-edit": 2,

  "/team/info/avatar-edit": 3,
  "/team/info/introduce-edit": 3,
  "/team/nick": 3,
};

const getRouteDepth = (pathname: string) => {
  const normalizedPath = pathname === "/" ? "/" : pathname.replace(/\/$/, "");
  return routeDepthMap[normalizedPath] ?? 1;
};

const getTransitionName = (fromPath: string, toPath: string): TransitionName => {
  const fromDepth = getRouteDepth(fromPath);
  const toDepth = getRouteDepth(toPath);

  if (toDepth > fromDepth) return "page-forward";
  if (toDepth < fromDepth) return "page-back";
  return "page-none";
};

const isTabBarPath = (pathname: string) => tabBarPaths.includes(pathname);

const getPageTransitionKey = (pathname: string) => {
  return isTabBarPath(pathname) ? "tab-root" : pathname;
};

export default {
  name: "App",
  components: {
    TabBar,
  },
  data() {
    return {
      showUiKit: false,
      disposeSubscription: null as (() => void) | null,
      pageTransitionName: "page-none" as TransitionName,
    };
  },
  computed: {
    showTabBar() {
      return isTabBarPath(this.$route.path);
    },
  },
  watch: {
    $route(to, from) {
      this.pageTransitionName = getTransitionName(from.path, to.path);
    },
  },

  methods: {
    isTabBarPath,
    getPageTransitionKey,

    initIMUiKit(opts: { account: string; token: string }) {
      setLanguage(
        localStorage.getItem("switchToEnglishFlag") == "en" ? "en" : "zh"
      );

      const { nim, store } = init();
      const app = getCurrentInstance();

      if (app) {
        app.appContext.app.config.globalProperties.$NIM = nim;
        app.appContext.app.config.globalProperties.$UIKitStore = store;
      }

      const handelKickedOffline = () => {
        showToast({
          message: "您已被踢下线",
          type: "info",
        });

        // 清理订阅监听
        this.disposeSubscription?.();
        this.disposeSubscription = null;

        localStorage.removeItem("__yx_im_options__h5");
        this.$router.push("/login");
        store.destroy();
        nim.V2NIMLoginService.off("onKickedOffline", handelKickedOffline);
      };

      nim.V2NIMLoginService.login(opts.account, opts.token)
        .then(() => {
          // IM 登录成功后跳转到会话页面
          this.$router.push("/conversation");
          this.showUiKit = true;
          nim.V2NIMLoginService.on("onKickedOffline", handelKickedOffline);

          // 启动好友在线状态订阅
          this.disposeSubscription = setupFriendSubscription(store);
        })
        .catch((error) => {
          this.showUiKit = true;
          if (error.code === 102422) {
            // 账号被封禁
            showToast({
              message: "当前账号已被封禁",
              type: "info",
            });
            // 登录信息无效，清除并跳转到登录页
            localStorage.removeItem("__yx_im_options__h5");
            this.$router.push("/login");
          }
        });
    },

    checkLoginStatus() {
      const loginInfo = localStorage.getItem("__yx_im_options__h5");
      if (!loginInfo) {
        // 未登录，跳转到登录页
        this.$router.push("/login");
        this.showUiKit = true;
        return;
      }

      try {
        const { account, token } = JSON.parse(loginInfo);
        // 重新初始化 IM
        this.initIMUiKit({
          account,
          token,
        });
      } catch (error) {
        console.error("解析登录信息失败", error);
        // 登录信息无效，清除并跳转到登录页
        localStorage.removeItem("imLoginInfo");
        this.$router.push("/login");
      }
    },
  },
  mounted() {
    // 检查登录状态
    this.checkLoginStatus();
  },
  beforeUnmount() {
    // 组件销毁时清理订阅监听
    this.disposeSubscription?.();
    this.disposeSubscription = null;
  },
};
</script>

<style>
.app-container {
  height: 100%;
  width: 100%;
  box-sizing: border-box;
  overflow: hidden;
  background-color: #fff;
}

.page-transition-wrapper {
  position: relative;
  height: 100%;
  width: 100%;
  overflow: hidden;
  background-color: #fff;
}

.page-transition-page {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  background-color: #fff;
  transform: translate3d(0, 0, 0);
  will-change: transform;
}

.tab-page-shell {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tab-page-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.page-forward-enter-active,
.page-forward-leave-active,
.page-back-enter-active,
.page-back-leave-active {
  transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1);
}

.page-forward-enter-active,
.page-back-leave-active {
  z-index: 2;
}

.page-forward-leave-active,
.page-back-enter-active {
  z-index: 1;
}

.page-forward-enter-from {
  transform: translate3d(100%, 0, 0);
}

.page-forward-enter-to,
.page-forward-leave-from,
.page-back-enter-to,
.page-back-leave-from {
  transform: translate3d(0, 0, 0);
}

.page-forward-leave-to,
.page-back-enter-from {
  transform: translate3d(-24%, 0, 0);
}

.page-back-leave-to {
  transform: translate3d(100%, 0, 0);
}
</style>
