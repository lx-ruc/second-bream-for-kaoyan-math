/**
 * 本地记录存储。做题记录只存在这台手机上，不上传。
 */
const KEY = 'ekb.records.v1';

const MASTER = [
  { v: 1.0, k: 'solo', label: '独立做出', hint: '不看答案，一次做对' },
  { v: 0.6, k: 'hint', label: '提示后做出', hint: '卡了一下，看提示能接上' },
  { v: 0.2, k: 'read', label: '看答案才懂', hint: '思路没想出来' },
  { v: 0.0, k: 'none', label: '还是不会', hint: '看完答案也不明白' },
];

function load() {
  try {
    const v = wx.getStorageSync(KEY);
    return Array.isArray(v) ? v : [];
  } catch (e) {
    return [];
  }
}

function persist(list) {
  try {
    wx.setStorageSync(KEY, list);
  } catch (e) {
    wx.showToast({ title: '保存失败', icon: 'none' });
  }
}

function add(rec) {
  const list = load();
  const item = Object.assign({
    id: 'r' + Date.now() + Math.floor(Math.random() * 1000),
    ts: Date.now(),
  }, rec);
  list.unshift(item);
  persist(list);
  return item;
}

function remove(id) {
  const list = load().filter(function (r) { return r.id !== id; });
  persist(list);
  return list;
}

function clear() {
  persist([]);
}

module.exports = { MASTER: MASTER, load: load, add: add, remove: remove, clear: clear };
