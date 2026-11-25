const nav = require('../../utils/nav');
const scans = require('../../utils/scans');
const imgProc = require('../../utils/image-proc');

const MODES = [
    { key: 'original', name: '原图' },
    { key: 'enhance', name: '增强' },
    { key: 'binary', name: '黑白' },
];

const MAX_EDGE = 1600;

Page({
    data: {
        padTop: 64,
        modes: MODES,
        mode: 'enhance',
        hasImage: false,
        busy: false,
        busyText: '',
        canvasW: 300,
        canvasH: 200,
        bitmapW: 0,
        bitmapH: 0,
        sourcePath: '',
        scans: [],
        previewSrc: '',
        showPreview: false,
    },

    onLoad() {
        this.setData({ padTop: nav.getNavMetrics().totalHeight });
        this.loadScans();
    },

    onReady() {
        this.initCanvas();
    },

    onShow() {
        this.loadScans();
    },

    loadScans() {
        const res = scans.list();
        const list = res.error ? [] : res.data;
        this.setData({
            scans: list.map((it) => Object.assign({}, it, {
                timeText: this.formatTime(it.createdAt),
            })),
        });
    },

    formatTime(ts) {
        const d = new Date(ts);
        const p = (n) => (n < 10 ? '0' + n : String(n));
        return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + p(d.getHours()) + ':' + p(d.getMinutes());
    },

    /* ---------------- canvas ---------------- */

    initCanvas() {
        if (this.readyPromise) return this.readyPromise;
        this.readyPromise = new Promise((resolve) => {
            const query = wx.createSelectorQuery();
            query
                .select('#scan-canvas')
                .fields({ node: true, size: true })
                .exec((res) => {
                    const item = res && res[0];
                    if (!item || !item.node) {
                        this.canvasFailed = true;
                        resolve(null);
                        return;
                    }
                    this.canvas = item.node;
                    this.ctx = this.canvas.getContext('2d');
                    resolve(this.canvas);
                });
        });
        return this.readyPromise;
    },

    /** 拍照 / 相册 */
    chooseImage() {
        const onOk = (path) => this.loadImage(path);
        const fail = (err) => {
            const msg = (err && err.errMsg) || '';
            if (msg.indexOf('cancel') >= 0) return;
            wx.showToast({ title: '未能获取图片', icon: 'none' });
        };

        if (wx.chooseMedia) {
            wx.chooseMedia({
                count: 1,
                mediaType: ['image'],
                sourceType: ['camera', 'album'],
                sizeType: ['original', 'compressed'],
                success: (res) => {
                    const file = res.tempFiles && res.tempFiles[0];
                    if (file && file.tempFilePath) onOk(file.tempFilePath);
                },
                fail: fail,
            });
            return;
        }
        // 老版本回退
        wx.chooseImage({
            count: 1,
            sizeType: ['original', 'compressed'],
            sourceType: ['camera', 'album'],
            success: (res) => {
                if (res.tempFilePaths && res.tempFilePaths[0]) onOk(res.tempFilePaths[0]);
            },
            fail: fail,
        });
    },

    loadImage(path) {
        this.setData({ busy: true, busyText: '正在载入图片' });
        this.initCanvas().then((canvas) => {
            if (!canvas) {
                this.setData({ busy: false });
                wx.showModal({
                    title: '无法使用扫描',
                    content: '当前环境不支持画布处理，请升级微信后重试。',
                    showCancel: false,
                });
                return;
            }
            const img = canvas.createImage();
            img.onload = () => {
                const maxEdge = Math.max(img.width, img.height) || 1;
                const scale = Math.min(1, MAX_EDGE / maxEdge);
                const bw = Math.max(1, Math.round(img.width * scale));
                const bh = Math.max(1, Math.round(img.height * scale));

                canvas.width = bw;
                canvas.height = bh;
                // 改尺寸会重置上下文，重新取一次
                this.ctx = canvas.getContext('2d');
                this.sourceImg = img;
                this.sourcePath = path;

                let winW = 375;
                try {
                    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
                    winW = (info && info.windowWidth) || 375;
                } catch (e) {
                    winW = 375;
                }
                // 左右各留 28px 边距
                const cssW = Math.max(120, winW - 56);
                const cssH = Math.round((cssW * bh) / bw);

                this.setData({
                    hasImage: true,
                    canvasW: cssW,
                    canvasH: cssH,
                    bitmapW: bw,
                    bitmapH: bh,
                    sourcePath: path,
                    mode: 'enhance',
                }, () => {
                    this.render('enhance');
                    this.setData({ busy: false });
                });
            };
            img.onerror = () => {
                this.setData({ busy: false });
                wx.showToast({ title: '图片读取失败', icon: 'none' });
            };
            img.src = path;
        });
    },

    /** 切换处理方式 */
    switchMode(e) {
        if (this.data.busy) return;
        const mode = e.currentTarget.dataset.mode;
        if (mode === this.data.mode) return;
        this.setData({ mode: mode, busy: true, busyText: '正在处理' });
        setTimeout(() => {
            this.render(mode);
            this.setData({ busy: false });
        }, 20);
    },

    render(mode) {
        const ctx = this.ctx;
        const img = this.sourceImg;
        if (!ctx || !img) return;
        const w = this.data.bitmapW;
        const h = this.data.bitmapH;

        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        if (mode === 'original') return;

        let imageData;
        try {
            imageData = ctx.getImageData(0, 0, w, h);
        } catch (e) {
            wx.showToast({ title: '图像处理失败', icon: 'none' });
            return;
        }
        const processed = imgProc.processRGBA(imageData.data, mode);
        imageData.data.set(processed);
        ctx.putImageData(imageData, 0, 0);
    },

    /** 重新选一张 */
    replaceImage() {
        this.chooseImage();
    },

    /** 保存到我的扫描 */
    saveScan() {
        if (this.data.busy || !this.data.hasImage) return;
        if (this.canvasFailed) {
            wx.showToast({ title: '当前环境不支持保存', icon: 'none' });
            return;
        }
        this.setData({ busy: true, busyText: '正在保存' });

        wx.canvasToTempFilePath({
            canvas: this.canvas,
            destWidth: this.data.bitmapW,
            destHeight: this.data.bitmapH,
            fileType: 'jpg',
            quality: 0.92,
            success: (res) => {
                this.persist(res.tempFilePath);
            },
            fail: () => {
                this.setData({ busy: false });
                wx.showToast({ title: '导出图片失败', icon: 'none' });
            },
        });
    },

    persist(tempFilePath) {
        const done = (path) => {
            const r = scans.add({
                path: path,
                mode: this.data.mode,
                width: this.data.bitmapW,
                height: this.data.bitmapH,
            });
            this.setData({ busy: false });
            if (r.error) {
                wx.showToast({ title: '保存失败，请重试', icon: 'none' });
                return;
            }
            wx.showToast({ title: '已保存到我的扫描', icon: 'none' });
            this.loadScans();
        };

        try {
            wx.getFileSystemManager().saveFile({
                tempFilePath: tempFilePath,
                success: (res) => done(res.savedFilePath),
                fail: () => {
                    // saveFile 失败时退回临时路径，至少本次可见
                    done(tempFilePath);
                },
            });
        } catch (e) {
            done(tempFilePath);
        }
    },

    /* ---------------- 预览与删除 ---------------- */

    openPreview(e) {
        const src = e.currentTarget.dataset.path;
        if (!src) return;
        this.setData({ previewSrc: src, showPreview: true });
    },

    closePreview() {
        this.setData({ showPreview: false, previewSrc: '' });
    },

    deleteScan(e) {
        const id = e.currentTarget.dataset.id;
        wx.showModal({
            title: '删除扫描件',
            content: '删除后该图片将从本机移除，不可恢复。',
            confirmText: '删除',
            confirmColor: '#d94f4f',
            success: (res) => {
                if (!res.confirm) return;
                const r = scans.remove(id);
                if (r.error) {
                    wx.showToast({ title: '删除失败', icon: 'none' });
                    return;
                }
                this.setData({ showPreview: false, previewSrc: '' });
                this.loadScans();
            },
        });
    },

    /** 阻止弹层点击穿透 */
    noop() {},

    backHome() {
        const pages = getCurrentPages();
        if (pages.length > 1) wx.navigateBack();
        else wx.switchTab({ url: '/pages/index/index' });
    },

    previewDelete() {
        const item = this.data.scans.filter((it) => it.path === this.data.previewSrc)[0];
        if (!item) {
            this.closePreview();
            return;
        }
        this.deleteScan({ currentTarget: { dataset: { id: item.id } } });
    },

    onShareAppMessage() {
        return {
            title: '黎曼考研刷题 · 拍照扫描纸质题，直接在手机上复盘',
            path: '/pages/index/index',
        };
    },
});
