import { DataTexture, Vector2 } from "three";

export interface SpatDataTextureCovariances {
    data: Float32Array | Uint16Array
    texture: DataTexture
    size: Vector2
}

export interface SplatDataTextureCenterColors {
    data: Uint32Array
    texture: DataTexture
    size: Vector2
}

export interface SplatDataTextures {
    covariances: SpatDataTextureCovariances
    centerColors: SplatDataTextureCenterColors
}