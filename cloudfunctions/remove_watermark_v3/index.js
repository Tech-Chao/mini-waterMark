// 云函数入口文件
const cloud = require('wx-server-sdk');
const axios = require('axios');
const _ = require('lodash');
const qs = require('qs');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

// 云函数入口函数
exports.main = async (event, context) => {
  const { link_url } = event;
  console.log('link_url', link_url);
  const link = _parseUrl(link_url);
  console.log('link', link);
  const result = await xiuliwParse(link);
  console.log('parse res', result);
  if (result.code === -1) {
    const ignore_msg_list = [
      '作品不存在，可能已经被删除。',
      '转换失败,视频为私人视频或被删除',
      '暂不支持该平台',
      '请检查是否包含视频',
      '该视频已被删除',
    ];
    if (!ignore_msg_list.includes(result.msg)) {
      const tips_msg = `「AI水印小助手」收到视频解析接口错误信息：「${result.msg}」，请尽快排查。`;
      sendDingTalkMsg(tips_msg).catch(err => console.error(err));
    }
    return result;
  }

  // 解析结果
  if (result.content_type === 'VIDEO') {
    result.video_url = result.url;
  }
  return result;
}

/**
 * 解析 url
 * @param {*} text 
 */
function _parseUrl(text) {
  let startIndex = text.lastIndexOf("http://");
  startIndex = (startIndex === -1) ? text.lastIndexOf("https://") : startIndex;
  if (startIndex === -1) {
      console.log('请输入正确的视频链接');
      return;
  }
  //去掉前面的中文
  let link = text.substr(startIndex);
  const endIndex = link.indexOf(" ");
  if (endIndex !== -1) {
    link = link.substring(0, endIndex);
  }
  return link;
}

/**
 * 易推去水印服务解析视频 - 弃用
 * @param {String} link 分享的链接
 * @return {Promise} video_url
 */
// async function yituiParse(link) {
//   const { uid } = process.env;
//   const options = {
//     method: 'POST',
//     headers: { 'content-type': 'application/x-www-form-urlencoded' },
//     data: qs.stringify({ uid, text: link }),
//     url: 'http://bc.17dot.cn/Home/GetVideoUrl',
//   };
//   const result = await axios(options);
//   const { code, data, msg } = result.data;
//   // 网络异常
//   if (result.status !== 200) return { code: -1, msg: '解析异常' };
//   // 解析异常
//   if (code !== 0 || !_.isObject(data)) return { code: -1, msg: msg || '解析异常' };
//   const v_result = _.assign({}, { channel: 'yitui', code: 0 }, data);
//   // 内容类型映射
//   const type_map = { 0: 'VIDEO', 1: 'VIDEO', 2: 'PICS' };
//   v_result.content_type = type_map[v_result.video_type];
//   return v_result;
// }

/**
 * 推动钉钉消息
 */
async function sendDingTalkMsg(message) {
  const { ding_token, ding_at_mobile } = process.env;
  const api_url = `https://oapi.dingtalk.com/robot/send?access_token=${ding_token}`;
  const text_msg = {
    msgtype: 'text',
    text: { content: message },
    at: { isAtAll: false, atMobiles: [ ding_at_mobile ] },
  };
  const options = {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    data: text_msg,
    url: api_url,
  };
  const result = await axios(options);
  return result;
}

/**
 * 小爱网络解析
 * @param {String} link 分享的链接
 * @return {Promise} video_url
 */
async function xiuliwParse(link) {
  const { appid, appsecret } = process.env;
  const api_url = 'http://api.xiuliw.com/keyjx';
  const options = {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    data: qs.stringify({ appid, appsecret, url: link }),
    url: api_url,
  };
  const result = await axios(options);
  console.log('result', result);
  const { code, data } = result.data;
  const v_result = { video_type: -1 };
  if (code !== 100) return v_result;
  v_result.channel = 'xiuliw';
  v_result.code = 0;
  v_result.video_type = data.method;
  v_result.title = data.voidename;
  // 适配字段
  if (!_.isEmpty(data.pics)) {
    v_result.content_type = 'PICS';
    v_result.pics = data.pics;
  } else {
    v_result.content_type = 'VIDEO';
    v_result.url = data.voideurl;
    v_result.cover = data.photo;
  }
  return v_result;
}

/**
 * feeprint - 备用
 * @param {String} link 分享的链接
 * @return {Promise} video_url
 */
async function feeprintParse(link) {
  const { appid, appsecret } = process.env;
  const api_url = 'http://admin.feeprint.com/dsp';
  const options = {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    data: qs.stringify({ key: appid, token: appsecret, url: link }),
    url: api_url,
  };
  const result = await axios(options);
  const { status, data, msg } = result.data;
  const v_result = { video_type: -1, errmsg: msg };
  if (status !== '101') return v_result;
  v_result.channel = 'feeprint';
  v_result.code = 0;
  v_result.title = data.title;
  // 适配字段
  if (!_.isEmpty(data.imgs)) {
    v_result.video_type = 2;
    v_result.content_type = 'PICS';
    v_result.pics = data.imgs;
  } else {
    v_result.video_type = 1;
    v_result.content_type = 'VIDEO';
    v_result.url = data.url;
    v_result.cover = data.img;
  }
  return v_result;
}