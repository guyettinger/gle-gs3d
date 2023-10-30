import { SplatBuffer } from './SplatBuffer';
import { fetchWithProgress } from './Util';

export class SplatLoader {
    downLoadLink: HTMLAnchorElement | null;
    splatBuffer: SplatBuffer | null;

    constructor(splatBuffer = null) {
        this.splatBuffer = splatBuffer;
        this.downLoadLink = null;
    }

    loadFromFile(fileName: string, onProgress: (progress: number, progressMessage: string, chunk?: Uint8Array) => void): Promise<SplatBuffer> {
        return new Promise((resolve, reject) => {
            fetchWithProgress(fileName, onProgress)
                .then((bufferData) => {
                    const splatBuffer = new SplatBuffer(bufferData);
                    resolve(splatBuffer);
                })
                .catch((err) => {
                    reject(err);
                });
        });
    }

    setFromBuffer(splatBuffer: SplatBuffer) {
        this.splatBuffer = splatBuffer;
    }

    saveToFile(fileName: string) {
        if (!this.splatBuffer) return;
        const headerData = new Uint8Array(this.splatBuffer.getHeaderBufferData());
        const splatData = new Uint8Array(this.splatBuffer.getSplatBufferData());
        const blob = new Blob([headerData.buffer, splatData.buffer], {
            type: 'application/octet-stream',
        });

        if (!this.downLoadLink) {
            this.downLoadLink = document.createElement('a');
            document.body.appendChild(this.downLoadLink);
        }
        this.downLoadLink.download = fileName;
        this.downLoadLink.href = URL.createObjectURL(blob);
        this.downLoadLink.click();
    }
}
