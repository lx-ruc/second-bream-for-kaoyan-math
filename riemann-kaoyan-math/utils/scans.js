/**
 * 扫描件本地存储
 * 图片文件保存在小程序本地目录，元数据存在 Storage。
 */

const KEY = 'riemann_scans_v1';

const OK = (data) => ({ data: data, error: null });
const FAIL = (error) => ({ data: null, error: error });

function list() {
    let arr;
    try {
        arr = wx.getStorageSync(KEY);
    } catch (e) {
        return FAIL('CLIENT_EXCEPTION');
    }
    if (!Array.isArray(arr)) return OK([]);
    return OK(arr);
}

function save(listArr) {
    try {
        wx.setStorageSync(KEY, listArr);
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * 新增一条扫描件
 * @param {{ path:string, mode:string, width:number, height:number }} item
 */
function add(item) {
    if (!item || !item.path) return FAIL('INVALID_PAYLOAD');
    const res = list();
    if (res.error) return FAIL('CLIENT_EXCEPTION');
    const arr = res.data.slice();
    const record = {
        id: 'scan_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        path: item.path,
        mode: item.mode || 'enhance',
        width: item.width || 0,
        height: item.height || 0,
        note: item.note || '',
        createdAt: Date.now(),
    };
    arr.unshift(record);
    if (!save(arr)) return FAIL('CLIENT_EXCEPTION');
    return OK(record);
}

/** 删除一条扫描件，同时清理本地图片文件 */
function remove(id) {
    if (!id) return FAIL('INVALID_ID');
    const res = list();
    if (res.error) return FAIL('CLIENT_EXCEPTION');
    const arr = res.data;
    const target = arr.filter((it) => it.id === id)[0];
    if (!target) return FAIL('NOT_FOUND_OR_FORBIDDEN');
    const next = arr.filter((it) => it.id !== id);
    if (!save(next)) return FAIL('CLIENT_EXCEPTION');
    try {
        wx.getFileSystemManager().unlink({
            filePath: target.path,
            fail: () => {},
        });
    } catch (e) {
        // 文件已被清理时忽略
    }
    return OK(next);
}

function clear() {
    const res = list();
    const arr = res.error ? [] : res.data;
    arr.forEach((it) => {
        try {
            wx.getFileSystemManager().unlink({ filePath: it.path, fail: () => {} });
        } catch (e) {
            // 忽略
        }
    });
    if (!save([])) return FAIL('CLIENT_EXCEPTION');
    return OK([]);
}

function count() {
    const res = list();
    return res.error ? 0 : res.data.length;
}

module.exports = {
    list: list,
    add: add,
    remove: remove,
    clear: clear,
    count: count,
};
