import { DataUtils, Matrix3, Matrix4, Quaternion, Vector3, Vector4 } from "three";
import { clamp } from "./Util";

const tempVector3A = new Vector3();
const tempVector3B = new Vector3();
const tempVector4A = new Vector4();
const tempVector4B = new Vector4();
const tempQuaternion4A = new Quaternion();
const tempQuaternion4B = new Quaternion();

export interface CompressionLevel {
    BytesPerPosition: number
    BytesPerScale: number
    BytesPerColor: number
    BytesPerRotation: number
    ScaleRange: number
}

export class SplatBuffer {
    // Row format:
    //     Center position (XYZ) - Float32 * 3
    //     Scale (XYZ)  - Float32 * 3
    //     Color (RGBA) - Uint8 * 4
    //     Rotation (IJKW) - Float32 * 4

    static PositionComponentCount = 3;
    static ScaleComponentCount = 3;
    static RotationComponentCount = 4;
    static ColorComponentCount = 4

    static CompressionLevels: { [index: number]: CompressionLevel } = {
        0: {
            BytesPerPosition: 12,
            BytesPerScale: 12,
            BytesPerColor: 4,
            BytesPerRotation: 16,
            ScaleRange: 1
        },
        1: {
            BytesPerPosition: 6,
            BytesPerScale: 6,
            BytesPerColor: 4,
            BytesPerRotation: 8,
            ScaleRange: 32767
        }
    };

    static CovarianceSizeFloats = 6;
    static CovarianceSizeBytes = 24;

    static HeaderSizeBytes = 1024;

    bucketBlockSize: number;
    bucketCount: number;
    bucketSize: number;
    bucketsBase?: number;
    bytesPerBucket: number;
    bytesPerColor: number;
    bytesPerPosition: number;
    bytesPerRotation: number;
    bytesPerScale: number;
    bytesPerSplat: number;
    colorArray?: Uint8Array;
    compressionLevel: number;
    compressionScaleFactor: number;
    compressionScaleRange: number;
    halfBucketBlockSize: number;
    headerArray: Uint8Array;
    headerBufferData: ArrayBuffer;
    positionArray?: Float32Array | Uint16Array;
    precomputedCovarianceBufferData: ArrayBuffer | null;
    rotationArray?: Float32Array | Uint16Array;
    scaleArray?: Float32Array | Uint16Array;
    splatBufferData: ArrayBuffer;
    splatCount: number;

    constructor(bufferData: ArrayBuffer) {
        this.headerBufferData = new ArrayBuffer(SplatBuffer.HeaderSizeBytes);
        this.headerArray = new Uint8Array(this.headerBufferData);
        this.headerArray.set(new Uint8Array(bufferData, 0, SplatBuffer.HeaderSizeBytes));
        this.compressionLevel = this.headerArray[0];
        this.splatCount = (new Uint32Array(this.headerBufferData, 4, 1))[0];

        this.bucketSize = (new Uint32Array(this.headerBufferData, 8, 1))[0];
        this.bucketCount = (new Uint32Array(this.headerBufferData, 12, 1))[0];
        this.bucketBlockSize = (new Float32Array(this.headerBufferData, 16, 1))[0];
        this.halfBucketBlockSize = this.bucketBlockSize / 2.0;
        this.bytesPerBucket = (new Uint32Array(this.headerBufferData, 20, 1))[0];

        this.compressionScaleRange = SplatBuffer.CompressionLevels[this.compressionLevel].ScaleRange;
        this.compressionScaleFactor = this.halfBucketBlockSize / this.compressionScaleRange;

        const dataBufferSizeBytes = bufferData.byteLength - SplatBuffer.HeaderSizeBytes;
        this.splatBufferData = new ArrayBuffer(dataBufferSizeBytes);
        new Uint8Array(this.splatBufferData).set(new Uint8Array(bufferData, SplatBuffer.HeaderSizeBytes, dataBufferSizeBytes));

        this.bytesPerPosition = SplatBuffer.CompressionLevels[this.compressionLevel].BytesPerPosition;
        this.bytesPerScale = SplatBuffer.CompressionLevels[this.compressionLevel].BytesPerScale;
        this.bytesPerColor = SplatBuffer.CompressionLevels[this.compressionLevel].BytesPerColor;
        this.bytesPerRotation = SplatBuffer.CompressionLevels[this.compressionLevel].BytesPerRotation;

        this.bytesPerSplat = this.bytesPerPosition + this.bytesPerScale + this.bytesPerColor + this.bytesPerRotation;

        this.linkBufferArrays();

        this.precomputedCovarianceBufferData = null;
    }

    linkBufferArrays() {
        if (this.compressionLevel === 0) {
            this.positionArray = new Float32Array(this.splatBufferData, 0, this.splatCount * SplatBuffer.PositionComponentCount);
            this.scaleArray = new Float32Array(this.splatBufferData, this.bytesPerPosition * this.splatCount,
                this.splatCount * SplatBuffer.ScaleComponentCount);
            this.colorArray = new Uint8Array(this.splatBufferData, (this.bytesPerPosition + this.bytesPerScale) * this.splatCount,
                this.splatCount * SplatBuffer.ColorComponentCount);
            this.rotationArray = new Float32Array(this.splatBufferData,
                (this.bytesPerPosition + this.bytesPerScale + this.bytesPerColor) * this.splatCount,
                this.splatCount * SplatBuffer.RotationComponentCount);
        } else {
            this.positionArray = new Uint16Array(this.splatBufferData, 0, this.splatCount * SplatBuffer.PositionComponentCount);
            this.scaleArray = new Uint16Array(this.splatBufferData, this.bytesPerPosition * this.splatCount,
                this.splatCount * SplatBuffer.ScaleComponentCount);
            this.colorArray = new Uint8Array(this.splatBufferData, (this.bytesPerPosition + this.bytesPerScale) * this.splatCount,
                this.splatCount * SplatBuffer.ColorComponentCount);
            this.rotationArray = new Uint16Array(this.splatBufferData,
                (this.bytesPerPosition + this.bytesPerScale + this.bytesPerColor) * this.splatCount,
                this.splatCount * SplatBuffer.RotationComponentCount);
        }
        this.bucketsBase = this.splatCount * this.bytesPerSplat;
    }

    fbf(f: any) {
        if (this.compressionLevel === 0) {
            return f;
        } else {
            return DataUtils.fromHalfFloat(f);
        }
    }

    tbf(f: any) {
        if (this.compressionLevel === 0) {
            return f;
        } else {
            return DataUtils.toHalfFloat(f);
        }
    }

    buildPreComputedBuffers() {
        const splatCount = this.splatCount;

        this.precomputedCovarianceBufferData = new ArrayBuffer(SplatBuffer.CovarianceSizeBytes * splatCount);
        const covarianceArray = new Float32Array(this.precomputedCovarianceBufferData);

        const scale = new Vector3();
        const rotation = new Quaternion();
        const rotationMatrix = new Matrix3();
        const scaleMatrix = new Matrix3();
        const covarianceMatrix = new Matrix3();
        const tempMatrix4 = new Matrix4();

        const fbf = this.fbf.bind(this);

        for (let i = 0; i < splatCount; i++) {
            const scaleBase = i * SplatBuffer.ScaleComponentCount;
            if (this.scaleArray) {
                scale.set(fbf(this.scaleArray[scaleBase]), fbf(this.scaleArray[scaleBase + 1]), fbf(this.scaleArray[scaleBase + 2]));
                tempMatrix4.makeScale(scale.x, scale.y, scale.z);
                scaleMatrix.setFromMatrix4(tempMatrix4);
            }

            const rotationBase = i * SplatBuffer.RotationComponentCount;
            if (this.rotationArray) {
                rotation.set(fbf(this.rotationArray[rotationBase + 1]),
                    fbf(this.rotationArray[rotationBase + 2]),
                    fbf(this.rotationArray[rotationBase + 3]),
                    fbf(this.rotationArray[rotationBase]));
                tempMatrix4.makeRotationFromQuaternion(rotation);
                rotationMatrix.setFromMatrix4(tempMatrix4);
            }

            covarianceMatrix.copy(rotationMatrix).multiply(scaleMatrix);
            const M = covarianceMatrix.elements;
            covarianceArray[SplatBuffer.CovarianceSizeFloats * i] = M[0] * M[0] + M[3] * M[3] + M[6] * M[6];
            covarianceArray[SplatBuffer.CovarianceSizeFloats * i + 1] = M[0] * M[1] + M[3] * M[4] + M[6] * M[7];
            covarianceArray[SplatBuffer.CovarianceSizeFloats * i + 2] = M[0] * M[2] + M[3] * M[5] + M[6] * M[8];
            covarianceArray[SplatBuffer.CovarianceSizeFloats * i + 3] = M[1] * M[1] + M[4] * M[4] + M[7] * M[7];
            covarianceArray[SplatBuffer.CovarianceSizeFloats * i + 4] = M[1] * M[2] + M[4] * M[5] + M[7] * M[8];
            covarianceArray[SplatBuffer.CovarianceSizeFloats * i + 5] = M[2] * M[2] + M[5] * M[5] + M[8] * M[8];
        }
    }

    getHeaderBufferData() {
        return this.headerBufferData;
    }

    getSplatBufferData() {
        return this.splatBufferData;
    }

    getPosition(index: number, outPosition = new Vector3()) {
        let bucket = [0, 0, 0];
        const positionBase = index * SplatBuffer.PositionComponentCount;
        if (this.compressionLevel > 0) {
            const sf = this.compressionScaleFactor;
            const sr = this.compressionScaleRange;
            const bucketIndex = Math.floor(index / this.bucketSize);
            if (this.bucketsBase !== undefined) {
                const bucketArray = new Float32Array(this.splatBufferData, this.bucketsBase + bucketIndex * this.bytesPerBucket, 3);
                bucket = [bucketArray[0], bucketArray[1], bucketArray[2]]
            }
            if (this.positionArray) {
                outPosition.x = (this.positionArray[positionBase] - sr) * sf + bucket[0];
                outPosition.y = (this.positionArray[positionBase + 1] - sr) * sf + bucket[1];
                outPosition.z = (this.positionArray[positionBase + 2] - sr) * sf + bucket[2];
            }
        } else {
            if (this.positionArray) {
                outPosition.x = this.positionArray[positionBase];
                outPosition.y = this.positionArray[positionBase + 1];
                outPosition.z = this.positionArray[positionBase + 2];
            }
        }
        return outPosition;
    }

    setPosition(index: number, position: Vector3) {
        let bucket = [0, 0, 0];
        const positionBase = index * SplatBuffer.PositionComponentCount;
        if (this.compressionLevel > 0) {
            const sf = 1.0 / this.compressionScaleFactor;
            const sr = this.compressionScaleRange;
            const maxR = sr * 2 + 1;
            const bucketIndex = Math.floor(index / this.bucketSize);
            if (this.bucketsBase !== undefined) {
                const bucketArray = new Float32Array(this.splatBufferData, this.bucketsBase + bucketIndex * this.bytesPerBucket, 3);
                bucket = [bucketArray[0], bucketArray[1], bucketArray[2]]
            }
            if (this.positionArray) {
                this.positionArray[positionBase] = clamp(Math.round((position.x - bucket[0]) * sf) + sr, 0, maxR);
                this.positionArray[positionBase + 1] = clamp(Math.round((position.y - bucket[1]) * sf) + sr, 0, maxR);
                this.positionArray[positionBase + 2] = clamp(Math.round((position.z - bucket[2]) * sf) + sr, 0, maxR);
            }
        } else {
            if (this.positionArray) {
                this.positionArray[positionBase] = position.x;
                this.positionArray[positionBase + 1] = position.y;
                this.positionArray[positionBase + 2] = position.z;
            }
        }
    }

    getScale(index: number, outScale = new Vector3()): Vector3 {
        const fbf = this.fbf.bind(this);
        const scaleBase = index * SplatBuffer.ScaleComponentCount;
        if (this.scaleArray) {
            outScale.set(fbf(this.scaleArray[scaleBase]), fbf(this.scaleArray[scaleBase + 1]), fbf(this.scaleArray[scaleBase + 2]));
        }
        return outScale;
    }

    setScale(index: number, scale: Vector3) {
        const tbf = this.tbf.bind(this);
        const scaleBase = index * SplatBuffer.ScaleComponentCount;
        if (this.scaleArray) {
            this.scaleArray[scaleBase] = tbf(scale.x);
            this.scaleArray[scaleBase + 1] = tbf(scale.y);
            this.scaleArray[scaleBase + 2] = tbf(scale.z);
        }
    }

    getRotation(index: number, outRotation = new Quaternion()): Quaternion {
        const fbf = this.fbf.bind(this);
        const rotationBase = index * SplatBuffer.RotationComponentCount;
        if (this.rotationArray) {
            outRotation.set(fbf(this.rotationArray[rotationBase + 1]), fbf(this.rotationArray[rotationBase + 2]),
                fbf(this.rotationArray[rotationBase + 3]), fbf(this.rotationArray[rotationBase]));
        }
        return outRotation;
    }

    setRotation(index: number, rotation: Quaternion) {
        const tbf = this.tbf.bind(this);
        const rotationBase = index * SplatBuffer.RotationComponentCount;
        if (this.rotationArray) {
            this.rotationArray[rotationBase] = tbf(rotation.w);
            this.rotationArray[rotationBase + 1] = tbf(rotation.x);
            this.rotationArray[rotationBase + 2] = tbf(rotation.y);
            this.rotationArray[rotationBase + 3] = tbf(rotation.z);
        }
    }

    getColor(index: number, outColor = new Vector4()): Vector4 {
        const colorBase = index * SplatBuffer.ColorComponentCount;
        if (this.colorArray) {
            outColor.set(this.colorArray[colorBase], this.colorArray[colorBase + 1],
                this.colorArray[colorBase + 2], this.colorArray[colorBase + 3]);
        }
        return outColor;
    }

    setColor(index: number, color: Vector4) {
        const colorBase = index * SplatBuffer.ColorComponentCount;
        if (this.colorArray) {
            this.colorArray[colorBase] = color.x;
            this.colorArray[colorBase + 1] = color.y;
            this.colorArray[colorBase + 2] = color.z;
            this.colorArray[colorBase + 3] = color.w;
        }
    }

    getPrecomputedCovarianceBufferData() {
        return this.precomputedCovarianceBufferData;
    }

    getSplatCount() {
        return this.splatCount;
    }

    fillPositionArray(outPositionArray: Float32Array | Uint16Array) {
        const splatCount = this.splatCount;
        let bucket = [0, 0, 0];
        for (let i = 0; i < splatCount; i++) {
            const positionBase = i * SplatBuffer.PositionComponentCount;
            if (this.compressionLevel > 0) {
                const bucketIndex = Math.floor(i / this.bucketSize);
                if (this.bucketsBase) {
                    const bucketArray = new Float32Array(this.splatBufferData, this.bucketsBase + bucketIndex * this.bytesPerBucket, 3);
                    bucket = [bucketArray[0], bucketArray[1], bucketArray[2]]
                }
                const sf = this.compressionScaleFactor;
                const sr = this.compressionScaleRange;
                if (this.positionArray) {
                    outPositionArray[positionBase] = (this.positionArray[positionBase] - sr) * sf + bucket[0];
                    outPositionArray[positionBase + 1] = (this.positionArray[positionBase + 1] - sr) * sf + bucket[1];
                    outPositionArray[positionBase + 2] = (this.positionArray[positionBase + 2] - sr) * sf + bucket[2];
                }
            } else {
                if (this.positionArray) {
                    outPositionArray[positionBase] = this.positionArray[positionBase];
                    outPositionArray[positionBase + 1] = this.positionArray[positionBase + 1];
                    outPositionArray[positionBase + 2] = this.positionArray[positionBase + 2];
                }
            }
        }
    }

    fillScaleArray(outScaleArray: Float32Array | Uint16Array) {
        const fbf = this.fbf.bind(this);
        const splatCount = this.splatCount;
        for (let i = 0; i < splatCount; i++) {
            const scaleBase = i * SplatBuffer.ScaleComponentCount;
            if (this.scaleArray) {
                outScaleArray[scaleBase] = fbf(this.scaleArray[scaleBase]);
                outScaleArray[scaleBase + 1] = fbf(this.scaleArray[scaleBase + 1]);
                outScaleArray[scaleBase + 2] = fbf(this.scaleArray[scaleBase + 2]);
            }
        }
    }

    fillRotationArray(outRotationArray: Float32Array | Uint16Array) {
        const fbf = this.fbf.bind(this);
        const splatCount = this.splatCount;
        for (let i = 0; i < splatCount; i++) {
            const rotationBase = i * SplatBuffer.RotationComponentCount;
            if (this.rotationArray) {
                outRotationArray[rotationBase] = fbf(this.rotationArray[rotationBase]);
                outRotationArray[rotationBase + 1] = fbf(this.rotationArray[rotationBase + 1]);
                outRotationArray[rotationBase + 2] = fbf(this.rotationArray[rotationBase + 2]);
                outRotationArray[rotationBase + 3] = fbf(this.rotationArray[rotationBase + 3]);
            }
        }
    }

    fillColorArray(outColorArray: Uint8Array) {
        const splatCount = this.splatCount;
        for (let i = 0; i < splatCount; i++) {
            const colorBase = i * SplatBuffer.ColorComponentCount;
            if (this.colorArray) {
                outColorArray[colorBase] = this.colorArray[colorBase];
                outColorArray[colorBase + 1] = this.colorArray[colorBase + 1];
                outColorArray[colorBase + 2] = this.colorArray[colorBase + 2];
                outColorArray[colorBase + 3] = this.colorArray[colorBase + 3];
            }
        }
    }

    swapVertices(indexA: number, indexB: number) {

        this.getPosition(indexA, tempVector3A);
        this.getPosition(indexB, tempVector3B);
        this.setPosition(indexB, tempVector3A);
        this.setPosition(indexA, tempVector3B);

        this.getScale(indexA, tempVector3A);
        this.getScale(indexB, tempVector3B);
        this.setScale(indexB, tempVector3A);
        this.setScale(indexA, tempVector3B);

        this.getRotation(indexA, tempQuaternion4A);
        this.getRotation(indexB, tempQuaternion4B);
        this.setRotation(indexB, tempQuaternion4A);
        this.setRotation(indexA, tempQuaternion4B);

        this.getColor(indexA, tempVector4A);
        this.getColor(indexB, tempVector4B);
        this.setColor(indexB, tempVector4A);
        this.setColor(indexA, tempVector4B);

    }
}
