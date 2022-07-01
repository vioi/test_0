import axios from 'axios';
import intl from 'react-intl-universal';
// import JSONbig from 'json-bigint';
import { message } from 'antd';
import Qs from 'qs';
// import history from '../routes/history';
//现在放宽到180秒供开发环境调试规则调用使用现在放宽到180秒供开发环境调试规则调用使用现在放宽到180秒供开发环境调试规则调用使用
// axios 配置
// 20190802 默认超时时间应当是60秒，现在放宽到180秒供开发环境调试规则调用使用
axios.defaults.timeout = 180000;
// 页面地址： http://10.45.47.54:8089/portal-web/kite-react/#/
// 接口地址： http://10.45.47.54:8089/portal-web/kite-web/
axios.defaults.baseURL = '../kite-web';
axios.defaults.withCredentials = true;
// axios 处理大数据时会造成精度不准确，使用此方法先转换
// axios.defaults.transformResponse = [data => (JSONbig.parse(data))];


// axios.defaults.transformRequest = function (data) {
//   // 这里可以在发送请求之前对请求数据做处理，比如form-data格式化等，这里可以使用开头引入的Qs（这个模块在安装axios的时候就已经安装了，不需要另外安装）
//   return data instanceof FormData ? data : Qs.stringify(data);
// }
// axios.defaults.paramsSerializer = function (data) {
//   return data instanceof FormData ? data : Qs.stringify(data);
// }
// 成功状态码
const successCode = ['0'];


// 40341505 :没有客户  40301001:没有登录
const redirectCode = ['40341505'];

const responseMap = {
  code: 'resultCode',
  msg: 'resultMsg',
  data: 'resultObject',
};
// 拦截响应response，并做一些错误处理
axios.interceptors.response.use(response => response,
  (err) => {
  // 失败
    if (err && err.response) {
      switch (err.response.status) {
        case 400:
          err.message = intl.get('HTTP_RESCODE_400');
          break;

        case 401:
          err.message = intl.get('HTTP_RESCODE_401');
          break;

        case 403:
          err.message = intl.get('HTTP_RESCODE_403');
          break;

        case 404:
          err.message = `${intl.get('HTTP_RESCODE_400')}: ${err.response.config.url}`;
          break;

        case 408:
          err.message = intl.get('HTTP_RESCODE_408');
          break;

        case 500:
          err.message = err.response.data.message || intl.get('HTTP_RESCODE_500');
          err.stack = err.response.data.stack || '';
          err.code = err.response.data.code || ''; // 500错误的时候希望输出错误编码供查询
          err.transactionId = err.response.data.transactionId || '';
          break;

        case 501:
          err.message = intl.get('HTTP_RESCODE_501');
          break;

        case 502:
          err.message = intl.get('HTTP_RESCODE_502');
          break;

        case 503:
          err.message = intl.get('HTTP_RESCODE_503');
          break;

        case 504:
          err.message = intl.get('HTTP_RESCODE_504');
          break;

        case 505:
          err.message = intl.get('HTTP_RESCODE_505');
          break;

        default:
      }
    }
    window.showMessage(err.code, err.message, err.stack, err.transactionId);
    return Promise.reject(err);
  });

const ajax = (options) => {
  const {
    type, url, data, headers, isUrlencoded, isRow, useDataUpdateMsg, isRuleCheck,
  } = Object.assign({
    headers: {
      'content-type': 'application/json',
    },
  }, options);
  // 统一打印接口入参
  // if (window.location.href !== 'http://10.45.46.226:8083/portal-web/#') {
  //   console.log(url, JSON.stringify(data));
  // }
  const datas = type === 'get' ? { params: { ...data, v: Math.random(10) } }
    : { data: isRow ? JSON.stringify(data) : Qs.stringify(data) };
  let reqUrl = url;
  if (type !== 'get' && isUrlencoded) {
    headers['content-type'] = 'application/x-www-form-urlencoded';
    if (type === 'delete') {
      const noUrlParam = url.indexOf('?') < 0;
      reqUrl = `${url}${noUrlParam ? '?' : '&'}${Qs.stringify(data)}`;
    }
  }

  const cd = window.localStorage.getItem('cd');
  if (cd) {
    headers.cd = cd;
  }

  // 安全漏洞扫描必须添加在headers
  let signKey = '';
  if (window.parent && window.parent._gcp_orderCenter_signRequest) {
    signKey = window.parent._gcp_orderCenter_signRequest(type, reqUrl, type === 'get' ? {} : data);
  }
  if (signKey) {
    headers.signKey = signKey;
  }

  const authorization = window.localStorage.getItem('_gcp_orderCenter_jwtToken') || window.parent.localStorage.getItem('_gcp_orderCenter_jwtToken');
  if (authorization) {
    headers.authorization = authorization;
  }

  return new Promise((resolve, reject) => axios({
    url: reqUrl,
    method: type,
    ...datas,
    headers,
  }).then((res) => {
    let code = res.data[responseMap.code] || res.data.code;
    let msg = res.data[responseMap.msg] || res.data.message;
    let repData = res.data[responseMap.data];
    const { dataRuleResult, dataUpdateMsg } = res.data;
    // 判断是否重定向
    // if (typeof redirectCode.find(el => el === code) !== 'undefined') {
    //   window.location.href = repData.redirectUrl;
    // }
    if (dataRuleResult && dataRuleResult.resultObject) {
      const {
        msgList, yesOrNoMsgList, rejectMsgList, promptMsgInstList, rejectPromptMessages,
      } = dataRuleResult.resultObject;
      // dataRuleResult是规则校验的结果，如果这个结果存在，要打开规则弹窗
      if (msgList || yesOrNoMsgList || rejectMsgList || promptMsgInstList || rejectPromptMessages) {
        window.showRuleModal(dataRuleResult.resultObject);
      }
      if (!dataRuleResult.resultObject.checkFlag) {
        // 如果这个规则返回的是拒绝类，那么修改返回结果作为错误回调
        code = '-1';// 这里强制为-1
        msg = intl.get('HTTP_RESCODE_RULE_ERROR');
        repData = dataRuleResult.resultObject;
        if (isRuleCheck) {
          // 如果这个方法是一个规则校验专用方法，作为正常结果返回，否则的话，到后面触发reject
          return resolve(repData);
        }
      }
    } else if (dataRuleResult && dataRuleResult.resultCode === '9999') {
      // 规则执行失败的系统错误，视为错误回调
      code = dataRuleResult.resultCode;
      msg = dataRuleResult.resultMsg;
    }

    if (typeof successCode.find(el => el === code) !== 'undefined') {
      if (useDataUpdateMsg) { // 数据更新信息，用于通知前端刷新，0或空不需要刷新，1需要刷新
        // useDataUpdateMsg是打开状态的话，返回的格式为{ dataUpdateMsg刷新flag, repData该接口原来的返回值 }
        // 需要具体的api方法加开关处理
        return resolve({ dataUpdateMsg, repData });
      }
      return resolve(repData);
    }
    // 调用错误回调
    let errorMsg = `[${code}]${msg}`;
    if (errorMsg.length > 400) {
      errorMsg = `${errorMsg.slice(0, 400)}...`;
    }
    message.warn(errorMsg);
    return reject(msg);
  }).catch((err, a, b) => {
    let errStr = String(err);
    if (typeof err === 'object') {
      if (errStr.match('timeout')) {
        errStr = '请求超时';
      } else if (err.message) {
        errStr = err.message;
      }
    }
    return reject(errStr);
  }));
};

const methods = ['get', 'post', 'put', 'delete'];

const Fetch = {};

methods.forEach((n) => {
  Fetch[n] = (url, data, isUrlencoded = false, isRow = false, useDataUpdateMsg = false, isRuleCheck = false) => ajax({
    type: n,
    url,
    data,
    isUrlencoded,
    isRow,
    useDataUpdateMsg,
    isRuleCheck,
  });
});


export default Fetch;
