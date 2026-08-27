import { useEffect, useRef } from 'react';

/**
 * CyberShaderBackground
 * High-performance WebGL cyber grid & pulsing data node canvas
 * Based on the Neural Agent OS shader specification from StitchMCP
 */
export default function CyberShaderBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animId;
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return;

    const vs = `
      attribute vec2 a_position;
      varying vec2 v_texCoord;
      void main() {
        v_texCoord = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const fs = `
      precision highp float;
      varying vec2 v_texCoord;
      uniform float u_time;
      uniform vec2 u_resolution;
      uniform vec2 u_mouse;

      float random (vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
      }

      void main() {
        vec2 uv = v_texCoord;
        
        // Cyber-grid scanning effect
        float grid = 0.0;
        vec2 grid_uv = uv * 24.0;
        grid += smoothstep(0.98, 1.0, fract(grid_uv.x));
        grid += smoothstep(0.98, 1.0, fract(grid_uv.y));
        
        // Pulsing "data" nodes
        vec2 node_uv = floor(grid_uv);
        float node = step(0.96, random(node_uv + floor(u_time * 0.4)));
        
        // Base Deep Obsidian Canvas (#08090e)
        vec3 color = vec3(0.031, 0.035, 0.055);
        
        // Primary Accent (Emerald #00ff87)
        vec3 emerald = vec3(0.0, 1.0, 0.529);
        // Secondary Accent (Electric Cyan #00f1fd)
        vec3 cyan = vec3(0.0, 0.945, 0.992);
        
        // Add subtle grid and pulsing nodes
        color += grid * emerald * 0.045;
        color += node * cyan * 0.18 * (0.5 + 0.5 * sin(u_time * 2.0));
        
        // Mouse proximity glow
        vec2 mouse_uv = u_mouse / u_resolution;
        float mouse_dist = distance(uv, mouse_uv);
        color += emerald * smoothstep(0.3, 0.0, mouse_dist) * 0.06;

        // Vignette
        float d = distance(uv, vec2(0.5));
        color *= smoothstep(1.3, 0.35, d);

        gl_FragColor = vec4(color, 1.0);
      }
    `;

    function createShader(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.warn('Shader error:', gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    }

    const vertShader = createShader(gl.VERTEX_SHADER, vs);
    const fragShader = createShader(gl.FRAGMENT_SHADER, fs);
    if (!vertShader || !fragShader) return;

    const prog = gl.createProgram();
    gl.attachShader(prog, vertShader);
    gl.attachShader(prog, fragShader);
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );

    const pos = gl.getAttribLocation(prog, 'a_position');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(prog, 'u_time');
    const uRes = gl.getUniformLocation(prog, 'u_resolution');
    const uMouse = gl.getUniformLocation(prog, 'u_mouse');

    let mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

    const handleMouseMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = window.innerHeight - e.clientY;
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    const handleResize = () => {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    const render = (t) => {
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (uTime) gl.uniform1f(uTime, t * 0.001);
      if (uRes) gl.uniform2f(uRes, canvas.width, canvas.height);
      if (uMouse) gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
        opacity: 0.85,
      }}
    />
  );
}
