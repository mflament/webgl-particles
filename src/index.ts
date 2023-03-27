import {createRoot} from "react-dom/client";
import {RendererController} from "webgl-support";
import {Particles} from "./particles/Particles";
import "./index.scss"
import {Controls} from "./particles/Controls";
import {createElement} from "react";

function createDOM() {
    const rootElement = document.createElement("div");
    rootElement.className = "fullscreen root";
    document.body.append(rootElement);

    const canvas = document.createElement('canvas');
    canvas.className = "fullscreen glcanvas";
    rootElement.append(canvas);

    const overlay = document.createElement('div');
    overlay.className = "overlay";
    rootElement.append(overlay);

    return {canvas, overlay};
}

function createControls(overlay: HTMLElement, controller: RendererController<Particles>) {
    const root = createRoot(overlay);
    root.render(createElement(Controls, {controller}));
}

function parseParam(params: Record<string, string>, name: string, def: number) :number {
    if (params[name]) {
        const res = parseInt(params[name]);
        if (!isNaN(res))
            return res;
    }
    return def;
}

function start() {
    const {canvas, overlay} = createDOM();
    let search = location.search;
    let textureSize = [1024, 512];
    if (search) {
        const split = search.substring(1).split('&');
        const param: Record<string, string> = {};
        split.map(p => p.split('=')).forEach(p => param[p[0]] = decodeURIComponent(p[1]));
        textureSize[0] = parseParam(param, 'w', textureSize[0]);
        textureSize[1] = parseParam(param, 'h', textureSize[1]);
    }
    const controller = new RendererController(canvas, Particles.factory(textureSize));
    createControls(overlay, controller);
    controller.paused = false;
}


start();
