// 云函数入口文件
const cloud = require('wx-server-sdk');
const moment = require('moment');
const _ = require('lodash');

cloud.init()
const db = cloud.database();
const command = db.command

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const time = moment().subtract(30, 'minutes').format('YYYY-MM-DD HH:mm:ss')
  const whereParams = { created_time: command.lte(time) };
  const fileRes = await db.collection('p_fileid').orderBy('created_time', 'asc').where(whereParams).limit(50).get();
  const fileIds = _.map(fileRes.data, 'download_url');
  if (fileIds.length <= 0) return { delete_total: 0 };
  // 删除云存储数据
  const removeRes = await cloud.deleteFile({ fileList: fileIds });
  // console.log(removeRes.fileList);
  // 删除数据库数据
  const list = _.filter(removeRes.fileList, { status: 0 }) || [];
  const remove_fileIds = _.map(list, 'fileID');
  if (remove_fileIds.length > 0) {
    db.collection('p_fileid').where({ download_url: command.in(remove_fileIds) }).remove().catch(err => console.error(err));
  }

  return { fileIds_totla: fileIds.length, delete_total: removeRes.fileList.length }
}