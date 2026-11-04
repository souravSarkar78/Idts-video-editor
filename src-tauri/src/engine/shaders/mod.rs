//! Modular GLSL and WGSL fragment shaders for real-time Program Monitor viewport and hardware preview.

/// Vertex shader template for 2D quad texture rendering
pub const STANDARD_VERTEX_SHADER: &str = r#"
attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 v_texCoord;

void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
}
"#;

/// Two-texture transition blend GLSL shader pipeline template
pub const TRANSITION_SHADER_BASE: &str = r#"
precision mediump float;
uniform sampler2D fromTex;
uniform sampler2D toTex;
uniform float progress;
uniform vec2 resolution;
varying vec2 v_texCoord;

vec4 getFromColor(vec2 uv) {
    return texture2D(fromTex, uv);
}

vec4 getToColor(vec2 uv) {
    return texture2D(toTex, uv);
}
"#;

/// Returns full GLSL fragment shader code for a given transition preset ID
pub fn get_transition_fragment_shader(preset_id: &str) -> String {
    match preset_id {
        "trans_whip_left" => format!(
            "{}\nvoid main() {{\n    vec2 p = v_texCoord + vec2(progress, 0.0);\n    if (p.x < 1.0) {{\n        gl_FragColor = getFromColor(p);\n    }} else {{\n        gl_FragColor = getToColor(p - vec2(1.0, 0.0));\n    }}\n}}",
            TRANSITION_SHADER_BASE
        ),
        "trans_whip_right" => format!(
            "{}\nvoid main() {{\n    vec2 p = v_texCoord - vec2(progress, 0.0);\n    if (p.x >= 0.0) {{\n        gl_FragColor = getFromColor(p);\n    }} else {{\n        gl_FragColor = getToColor(p + vec2(1.0, 0.0));\n    }}\n}}",
            TRANSITION_SHADER_BASE
        ),
        "trans_zoom_in_burst" => format!(
            "{}\nvoid main() {{\n    vec2 center = vec2(0.5, 0.5);\n    float z = mix(1.0, 4.0, progress);\n    vec2 uv = (v_texCoord - center) / z + center;\n    vec4 a = getFromColor(uv);\n    vec4 b = getToColor(v_texCoord);\n    gl_FragColor = mix(a, b, smoothstep(0.4, 1.0, progress));\n}}",
            TRANSITION_SHADER_BASE
        ),
        "trans_rgb_split_glitch" => format!(
            "{}\nvoid main() {{\n    float offset = sin(progress * 3.14159) * 0.05;\n    vec4 a = vec4(getFromColor(v_texCoord + vec2(offset, 0.0)).r, getFromColor(v_texCoord).g, getFromColor(v_texCoord - vec2(offset, 0.0)).b, 1.0);\n    vec4 b = vec4(getToColor(v_texCoord - vec2(offset, 0.0)).r, getToColor(v_texCoord).g, getToColor(v_texCoord + vec2(offset, 0.0)).b, 1.0);\n    gl_FragColor = mix(a, b, progress);\n}}",
            TRANSITION_SHADER_BASE
        ),
        "trans_circle_iris_open" => format!(
            "{}\nvoid main() {{\n    vec2 center = vec2(0.5, 0.5);\n    float dist = distance(v_texCoord, center);\n    float radius = progress * 0.7071;\n    gl_FragColor = dist <= radius ? getToColor(v_texCoord) : getFromColor(v_texCoord);\n}}",
            TRANSITION_SHADER_BASE
        ),
        "trans_clock_wipe" => format!(
            "{}\nvoid main() {{\n    vec2 p = v_texCoord - vec2(0.5, 0.5);\n    float angle = atan(-p.x, p.y) + 3.14159265;\n    float sweep = progress * 6.2831853;\n    gl_FragColor = angle <= sweep ? getToColor(v_texCoord) : getFromColor(v_texCoord);\n}}",
            TRANSITION_SHADER_BASE
        ),
        _ => format!(
            "{}\nvoid main() {{\n    gl_FragColor = mix(getFromColor(v_texCoord), getToColor(v_texCoord), progress);\n}}",
            TRANSITION_SHADER_BASE
        ),
    }
}

/// Returns full GLSL fragment shader code for a visual filter preset ID
pub fn get_filter_fragment_shader(filter_id: &str) -> String {
    format!(
        "precision mediump float;\nuniform sampler2D u_texture;\nuniform float u_time;\nuniform float u_intensity;\nuniform vec2 u_resolution;\nvarying vec2 v_texCoord;\n\nvoid main() {{\n    vec4 col = texture2D(u_texture, v_texCoord);\n    // Filter: {}\n    gl_FragColor = col;\n}}\n",
        filter_id
    )
}
