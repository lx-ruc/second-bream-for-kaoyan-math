/**
 * 扫描件图像处理（纯函数，不依赖 wx / canvas）
 *
 * 输入都是 Uint8ClampedArray 形式的灰度数组（每个像素 0-255），
 * 或者 canvas 的 RGBA 像素数组，方便在页面里直接复用。
 */

/** RGBA → 灰度 */
function toGray(data) {
    const len = data.length;
    const gray = new Uint8ClampedArray(len / 4);
    for (let i = 0, j = 0; i < len; i += 4, j += 1) {
        gray[j] = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) | 0;
    }
    return gray;
}

/** 灰度 → RGBA，统一不透明 */
function toRGBA(gray) {
    const out = new Uint8ClampedArray(gray.length * 4);
    for (let i = 0, j = 0; i < gray.length; i += 1, j += 4) {
        const g = gray[i];
        out[j] = g;
        out[j + 1] = g;
        out[j + 2] = g;
        out[j + 3] = 255;
    }
    return out;
}

function histogram(gray) {
    const hist = new Uint32Array(256);
    for (let i = 0; i < gray.length; i += 1) hist[gray[i]] += 1;
    return hist;
}

/**
 * 对比度拉伸（去灰底、去阴影）
 * 统计直方图，裁掉两端各 ratio 比例的极端像素，再把中间区间线性拉到 0-255。
 */
function stretch(gray, ratio) {
    const cut = (ratio === undefined ? 0.02 : ratio) * gray.length;
    const hist = histogram(gray);
    let low = 0;
    let high = 255;
    let acc = 0;
    for (let v = 0; v < 256; v += 1) {
        acc += hist[v];
        if (acc > cut) {
            low = v;
            break;
        }
    }
    acc = 0;
    for (let v = 255; v >= 0; v -= 1) {
        acc += hist[v];
        if (acc > cut) {
            high = v;
            break;
        }
    }
    const span = Math.max(1, high - low);
    for (let i = 0; i < gray.length; i += 1) {
        const v = ((gray[i] - low) * 255) / span;
        gray[i] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
    return gray;
}

/** 大津法求阈值 */
function otsu(gray) {
    const hist = histogram(gray);
    const total = gray.length;
    let sum = 0;
    for (let v = 0; v < 256; v += 1) sum += v * hist[v];

    let sumB = 0;
    let wB = 0;
    let best = 0;
    let threshold = 128;
    for (let v = 0; v < 256; v += 1) {
        wB += hist[v];
        if (!wB) continue;
        const wF = total - wB;
        if (!wF) break;
        sumB += v * hist[v];
        const mB = sumB / wB;
        const mF = (sum - sumB) / wF;
        const between = wB * wF * (mB - mF) * (mB - mF);
        if (between > best) {
            best = between;
            threshold = v;
        }
    }
    return threshold;
}

/** 二值化：纸面变白、字迹变黑 */
function binarize(gray, threshold) {
    const t = typeof threshold === 'number' ? threshold : otsu(gray);
    for (let i = 0; i < gray.length; i += 1) {
        gray[i] = gray[i] > t ? 255 : 0;
    }
    return gray;
}

/**
 * 一步到位：输入 RGBA 像素数组与模式，返回处理后的 RGBA
 * mode: 'original' | 'enhance' | 'binary'
 */
function processRGBA(data, mode) {
    if (mode === 'original') return data;
    const gray = toGray(data);
    if (mode === 'binary') binarize(gray);
    else stretch(gray);
    return toRGBA(gray);
}

module.exports = {
    toGray: toGray,
    toRGBA: toRGBA,
    stretch: stretch,
    otsu: otsu,
    binarize: binarize,
    processRGBA: processRGBA,
};
