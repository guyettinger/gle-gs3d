import { Camera, Quaternion, Scene, Vector3, WebGLRenderer } from "three";

export interface ViewerParams {
    cameraUp?: [number, number, number]
    initialCameraPosition?: [number, number, number]
    initialCameraLookAt?: [number, number, number]
    selfDrivenMode?: boolean
    useBuiltInControls?: boolean
    scene?: Scene
    simpleScene?: Scene
    renderer?: WebGLRenderer
    camera?: Camera
    rootElement?: HTMLDivElement
}

export interface LoadFileOptions {
    position?: [number, number, number] | Vector3
    orientation?: [number, number, number] | Quaternion
    splatAlphaRemovalThreshold?: number
    halfPrecisionCovariancesOnGPU?: boolean
}