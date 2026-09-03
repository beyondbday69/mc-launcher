declare module 'ogl' {
  export class Renderer {
    constructor(options?: any);
    gl: WebGLRenderingContext | any;
    setSize(width: number, height: number): void;
    render(options: { scene: any; camera?: any }): void;
  }
  export class Geometry {
    constructor(gl: any, attributes?: any);
  }
  export class Program {
    constructor(gl: any, options: { vertex: string; fragment: string; uniforms?: any; transparent?: boolean; cullFace?: any });
    uniforms: Record<string, { value: any }>;
    program: any;
  }
  export class Mesh {
    constructor(gl: any, options: { geometry: any; program: any });
  }
  export class Texture {
    constructor(gl: any, options?: any);
    image: any;
    texture: any;
  }
}
