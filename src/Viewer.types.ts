import { Camera, Quaternion, Scene, Vector3, Vector3Tuple, Vector4Tuple, WebGLRenderer } from "three";

export interface ViewerParams {
    cameraUp?: Vector3Tuple
    initialCameraPosition?: Vector3Tuple
    initialCameraLookAt?: Vector3Tuple
    selfDrivenMode?: boolean
    useBuiltInControls?: boolean
    scene?: Scene
    simpleScene?: Scene
    renderer?: WebGLRenderer
    camera?: Camera
    rootElement?: HTMLDivElement
}

export interface LoadFileOptions {
    position?: Vector3Tuple
    positionVector?: Vector3
    orientation?: Vector4Tuple
    orientationQuaternion?: Quaternion
    splatAlphaRemovalThreshold?: number
    halfPrecisionCovariancesOnGPU?: boolean
}