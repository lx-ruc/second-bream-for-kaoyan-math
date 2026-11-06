/**
 * 题目图片：拍照 / 相册截图 / 微信里的图，统一处理成可上传、可留存的小图。
 *
 * 两个必须处理的现实问题：
 * 1. chooseMedia 给的是临时路径，小程序重启就失效 —— 想在看诊断时还能翻出原图，
 *    必须复制到 USER_DATA_PATH。
 * 2. 原始照片动辄 3~8MB，base64 之后更大，直接喂给模型会超时。先压到 1200px / q60。
 */
const FS = wx.getFileSystemManager();
const DIR = wx.env.USER_DATA_PATH + '/qimg';

const SOURCE = {
  camera: { label: '拍照', tip: '对着题目拍，光线亮一点，别拍到手指' },
  album: { label: '相册截图', tip: '手机截图会存到相册，选那张就行' },
  message: { label: '微信里的图', tip: '从聊天记录里选别人发来的题' },
};

function ensureDir() {
  try {
    FS.accessSync(DIR);
  } catch (e) {
    try { FS.mkdirSync(DIR, true); } catch (e2) { /* 已存在或无权限，后面 copyFile 会报错 */ }
  }
}

/** 选图，返回临时路径 */
function pick(source) {
  return new Promise(function (resolve, reject) {
    if (source === 'message') {
      wx.chooseMessageFile({
        count: 1,
        type: 'image',
        success: function (res) {
          const f = res.tempFiles && res.tempFiles[0];
          if (!f) return reject(new Error('没选到图片'));
          resolve(f.path || f.tempFilePath);
        },
        fail: function (err) { reject(err); },
      });
      return;
    }
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: [source === 'camera' ? 'camera' : 'album'],
      sizeType: ['compressed'],
      success: function (res) {
        const f = res.tempFiles && res.tempFiles[0];
        if (!f) return reject(new Error('没选到图片'));
        resolve(f.tempFilePath);
      },
      fail: function (err) { reject(err); },
    });
  });
}

/** 压缩。压不动就原样返回，不能因为压缩失败挡住识别。 */
function compress(src) {
  return new Promise(function (resolve) {
    if (!wx.compressImage) return resolve(src);
    wx.compressImage({
      src: src,
      quality: 60,
      compressedWidth: 1200,
      success: function (res) { resolve(res.tempFilePath || src); },
      fail: function () { resolve(src); },
    });
  });
}

/** 复制到用户目录，返回长期可用的路径片段（只存文件名，便于换设备后自然失效） */
function persist(src) {
  ensureDir();
  const name = 'q' + Date.now() + '_' + Math.floor(Math.random() * 1000) + '.jpg';
  const dest = DIR + '/' + name;
  return new Promise(function (resolve) {
    try {
      FS.copyFileSync(src, dest);
      resolve(name);
    } catch (e) {
      resolve('');
    }
  });
}

function abs(name) {
  return name ? DIR + '/' + name : '';
}

function toBase64(src) {
  return new Promise(function (resolve, reject) {
    FS.readFile({
      filePath: src,
      encoding: 'base64',
      success: function (res) { resolve(res.data); },
      fail: function (err) { reject(err); },
    });
  });
}

function sizeOf(src) {
  return new Promise(function (resolve) {
    try { resolve(FS.statSync(src).size || 0); } catch (e) { resolve(0); }
  });
}

function remove(name) {
  if (!name) return;
  try { FS.unlinkSync(abs(name)); } catch (e) { /* 已经没了就算了 */ }
}

/** 清掉没有被任何记录引用的图，避免本地空间越用越满 */
function prune(keepNames) {
  ensureDir();
  let files = [];
  try { files = FS.readdirSync(DIR); } catch (e) { return 0; }
  const keep = {};
  (keepNames || []).forEach(function (n) { if (n) keep[n] = 1; });
  let n = 0;
  files.forEach(function (f) {
    if (!keep[f]) { remove(f); n++; }
  });
  return n;
}

module.exports = {
  SOURCE: SOURCE,
  pick: pick,
  compress: compress,
  persist: persist,
  abs: abs,
  toBase64: toBase64,
  sizeOf: sizeOf,
  remove: remove,
  prune: prune,
};
