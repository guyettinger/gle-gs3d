import { PlyParser } from './PlyParser';
import { fetchWithProgress } from './Util';
import { SplatBuffer } from "./SplatBuffer";

export class PlyLoader {
    splatBuffer: SplatBuffer | null;

    constructor() {
        this.splatBuffer = null;
    }

    fetchFile(fileName: string, onProgress: (progress: number, progressMessage: string, chunk?: Uint8Array) => void): Promise<ArrayBuffer> {
        return new Promise((resolve, reject) => {
            fetchWithProgress(fileName, onProgress)
                .then((data) => {
                    resolve(data);
                })
                .catch((err) => {
                    reject(err);
                });
        });
    }

    loadFromFile(fileName: string, onProgress: (progress: number, progressMessage: string, chunk?: Uint8Array) => void, compressionLevel: number = 0, minimumAlpha: number = 1): Promise<SplatBuffer> {
        return new Promise((resolve, reject) => {
            const loadPromise = this.fetchFile(fileName, onProgress);
            loadPromise
                .then((plyFileData) => {
                    const plyParser = new PlyParser(plyFileData);
                    const splatBuffer = plyParser.parseToSplatBuffer(compressionLevel, minimumAlpha);
                    this.splatBuffer = splatBuffer;
                    resolve(splatBuffer);
                })
                .catch((err) => {
                    reject(err);
                });
        });
    }
}
