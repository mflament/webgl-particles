import {ChangeEvent, ChangeEventHandler, Component, FocusEventHandler} from "react";
import {RendererController} from "webgl-support";
import {Particles} from "./Particles";
import "./Controls.scss"

export interface ControlsProps {
    controller: RendererController<Particles>
}

interface ControlsState {
    fps: number;
}

const defaultTextureSizes = [
    [256, 256],
    [512, 512],
    [1024, 512],
    [1024, 1024],
    [2048, 1024],
    [2048, 2048],
    [4096, 1024],
    [4096, 2048],
    [4096, 4096],
]

export class Controls extends Component<ControlsProps, ControlsState> {
    private intervalId?: number;
    private textureSizes: number[][];

    constructor(props: ControlsProps) {
        super(props);
        this.state = {fps: props.controller.renderState.fps};
        this.updateFPS = this.updateFPS.bind(this);
        this.textureSizes = [...defaultTextureSizes];
        const textureSizeIndex = this.textureSizeIndex;
        if (textureSizeIndex < 0) {
            const renderer = this.props.controller.renderer;
            if (renderer)
                this.textureSizes.push(renderer.textureSize);
        }

    }

    componentDidMount() {
        this.intervalId = self.setInterval(this.updateFPS, 1000);
    }

    componentWillUnmount() {
        if (this.intervalId !== undefined)
            self.clearInterval(this.intervalId);
    }

    private readonly updateFPS = () => {
        const {controller} = this.props;
        this.setState({fps: controller.renderState.fps});
    }

    render() {
        const {controller} = this.props;
        const updateTextureSize = this.updateTextureSize;
        const {fps} = this.state;
        const renderer = controller.renderer;
        const particles = renderer?.particlesCount || 0;
        const textureSizeIndex = this.textureSizeIndex;
        const textureSize = renderer?.textureSize || this.textureSizes[textureSizeIndex] || [0, 0];
        return <div className={"Controls"}>
            <label>FPS</label>
            <strong>{fps.toFixed(0)}</strong>

            <label>Particles</label>
            <strong>{particles.toLocaleString()}</strong>

            <label>Texture dim</label>
            <select value={textureSizeIndex} onChange={updateTextureSize}>{this.renderTextureSizes()}</select>

            <label>Texture size</label>
            <strong>{(textureSize[0] * textureSize[1] * 4 * 4 / 1024).toLocaleString()} KB</strong>
        </div>;
    }

    private get textureSizeIndex() {
        const renderer = this.props.controller.renderer;
        if (!renderer)
            return 0;
        const textureSize = renderer.textureSize;
        return this.textureSizes.findIndex(ts => ts[0] === textureSize[0] && ts[1] === textureSize[1]);
    }

    private renderTextureSizes() {
        return this.textureSizes.map(s => s[0] + 'x' + s[1]).map((s, i) => <option key={i} value={i}>{s}</option>);
    }

    private updateTextureSize: ChangeEventHandler<HTMLSelectElement> = e => {
        const textureIndex = parseInt(e.target.value);
        const textureSize = this.textureSizes[textureIndex];
        location.search = `?w=${textureSize[0]}&h=${textureSize[1]}`;
    }

}