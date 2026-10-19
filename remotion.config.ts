import {Config} from '@remotion/cli/config';

Config.setEntryPoint('src/index.ts');
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(92);
Config.setOverwriteOutput(true);
// The outro visualizer is a WebGL shader. "angle" uses the GPU when available;
// if your machine renders the outro black, try 'swangle' (CPU, slower).
Config.setChromiumOpenGlRenderer('angle');
// Final-delivery encode settings (bilibili / YouTube friendly)
Config.setCodec('h264');
Config.setCrf(16);
Config.setPixelFormat('yuv420p');
