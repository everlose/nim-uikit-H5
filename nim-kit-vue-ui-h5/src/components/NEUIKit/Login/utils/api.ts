// 从环境变量读取配置
// baseUrl: 默认值在 .env 中定义，可在 .env.local 中覆盖
// appKey: 必须在 .env.local 中配置（npm run dev 会检查）
const baseUrl = import.meta.env.VITE_USER_CENTER_BASE_URL || 'https://yiyong-user-center-qa.netease.im'
const appKey = import.meta.env.VITE_NIM_APP_KEY || ''

const loginByCodeHeader = {
  appKey,
  parentScope: 2,
  scope: 7,
};
const urlMap = {
  getLoginSmsCode: "/userCenter/v1/auth/sendLoginSmsCode",
  loginRegisterByCode: "/userCenter/v1/auth/loginRegisterByCode",
  loginRegisterByToken: "/userCenter/v1/auth/loginByToken",
  logout: "/userCenter/v1/auth/logout",
};
type LoginSmsCodeRes = {
  isFirstRegister: boolean;
};
export const getLoginSmsCode = (data: {
  mobile: string;
}): Promise<LoginSmsCodeRes> => {
  const url = baseUrl + urlMap.getLoginSmsCode;

  return fetch(url, {
    method: "POST",
    //@ts-ignore
    headers: {
      "Content-Type": "application/json",
      ...loginByCodeHeader,
    },
    body: JSON.stringify(data),
  }).then(async (response) => {
    const responseData = await response.json();
    if (responseData.code !== 200) {
      throw responseData;
    }
    return responseData.data as LoginSmsCodeRes;
  });
};

export const loginRegisterByCode = (data: {
  mobile: string;
  smsCode: string;
}): Promise<LoginRegisterByCodeRes> => {
  const url = baseUrl + urlMap.loginRegisterByCode;

  return fetch(url, {
    method: "POST",
    //@ts-ignore
    headers: {
      "Content-Type": "application/json",
      ...loginByCodeHeader,
    },
    body: JSON.stringify(data),
  }).then(async (response) => {
    const responseData = await response.json();
    if (responseData.code !== 200) {
      throw responseData;
    }
    return responseData.data as LoginRegisterByCodeRes;
  });
};

type LoginRegisterByCodeRes = {
  accessToken: string;
  imAccid: string;
  imToken: string;
};
