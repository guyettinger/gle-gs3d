export const floatToHalf = function () {

    const floatView = new Float32Array(1);
    const int32View = new Int32Array(floatView.buffer);

    return function (val: number): number {
        floatView[0] = val;
        const x = int32View[0];

        let bits = (x >> 16) & 0x8000;
        let m = (x >> 12) & 0x07ff;
        const e = (x >> 23) & 0xff;

        if (e < 103) return bits;

        if (e > 142) {
            bits |= 0x7c00;
            bits |= ((e == 255) ? 0 : 1) && (x & 0x007fffff);
            return bits;
        }

        if (e < 113) {
            m |= 0x0800;
            bits |= (m >> (114 - e)) + ((m >> (113 - e)) & 1);
            return bits;
        }

        bits |= ((e - 112) << 10) | (m >> 1);
        bits += m & 1;
        return bits;
    };

}();

export const uintEncodedFloat = function () {

    const floatView = new Float32Array(1);
    const int32View = new Int32Array(floatView.buffer);

    return function (f: number): number {
        floatView[0] = f;
        return int32View[0];
    };

}();

export const rgbaToInteger = function (r: number, g: number, b: number, a: number): number {
    return r + (g << 8) + (b << 16) + (a << 24);
};

export const fetchWithProgress = function (path: any, onProgress: (progress: number, progressMessage: string, chunk?: Uint8Array) => void): Promise<ArrayBuffer> {

    return new Promise((resolve, reject) => {
        fetch(path)
            .then(async (data) => {
                // @ts-expect-error TS(2531): Object is possibly 'null'.
                const reader = data.body.getReader();
                let bytesDownloaded = 0;
                let _fileSize = data.headers.get('Content-Length');
                let fileSize = _fileSize ? parseInt(_fileSize) : undefined;

                const chunks: Uint8Array[] = [];

                while (true) {
                    try {
                        const {value: chunk, done} = await reader.read();
                        if (done) {
                            if (onProgress) {
                                onProgress(100, '100%', chunk);
                            }
                            const buffer = new Blob(chunks).arrayBuffer();
                            resolve(buffer);
                            break;
                        }
                        bytesDownloaded += chunk.length;
                        let percent = 0;
                        let percentLabel = '0%';
                        if (fileSize !== undefined) {
                            percent = bytesDownloaded / fileSize * 100;
                            percentLabel = `${percent.toFixed(2)}%`;
                        }
                        chunks.push(chunk);
                        if (onProgress) {
                            onProgress(percent, percentLabel, chunk);
                        }
                    } catch (error) {
                        reject(error);
                        break;
                    }
                }
            });
    });

};

export const clamp = function (val: number, min: number, max: number): number {
    return Math.max(Math.min(val, max), min)
}

export const isArrayOfNumber = (value: unknown): value is number[] => {
    return Array.isArray(value) && value.every(item => typeof item === "number")
}