Component({
    properties: {
        blocks: {
            type: Array,
            value: [],
        },
        // normal | small
        size: {
            type: String,
            value: 'normal',
        },
    },

    data: {
        rows: [],
    },

    observers: {
        blocks(list) {
            const arr = Array.isArray(list) ? list : [];
            // 预先整理成带稳定 key 的结构，避免 WXML 里做复杂计算
            const rows = arr.map((b, bi) => {
                const base = {
                    key: 'b' + bi,
                    t: b.t,
                    v: b.v || '',
                    sub: b.sub || '',
                };
                if (b.t === 'mx') {
                    base.bar = b.bar === '[' ? '[' : '|';
                    base.barRight = b.bar === '[' ? ']' : '|';
                    base.grid = (b.rows || []).map((row, ri) => ({
                        key: 'r' + ri,
                        cells: (row || []).map((cell, ci) => ({
                            key: 'c' + ci,
                            v: cell,
                        })),
                    }));
                }
                if (b.t === 'fr') {
                    base.n = b.n || '';
                    base.d = b.d || '';
                }
                return base;
            });
            this.setData({ rows: rows });
        },
    },
});
