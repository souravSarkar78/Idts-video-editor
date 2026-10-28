//! Built-in Filters and 3D LUTs Catalog for "idts video editor".
//!
//! Provides predefined filter categories, cinematic color grading presets,
//! 3D LUT profiles, shader recipes, and custom .cube LUT imports.

use serde::{Deserialize, Serialize};

/// Classification of filter technology.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FilterType {
    Lut3D,
    ColorGrade,
    Stylize,
    Vintage,
    Monochrome,
}

/// Shader parameter recipe for real-time WebGL / Canvas / CSS filter rendering.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShaderRecipe {
    pub brightness: f32,       // -1.0 to 1.0 (0.0 = default)
    pub contrast: f32,         // 0.0 to 3.0 (1.0 = default)
    pub saturation: f32,       // 0.0 to 3.0 (1.0 = default)
    pub temperature: f32,      // -100.0 to 100.0 (0.0 = neutral)
    pub tint: f32,             // -100.0 to 100.0 (0.0 = neutral)
    pub vignette: f32,         // 0.0 to 1.0 (0.0 = none)
    pub grain: f32,            // 0.0 to 1.0 (0.0 = none)
    pub sepia: f32,            // 0.0 to 1.0 (0.0 = none)
    pub hue_rotate_deg: f32,   // -180.0 to 180.0 (0.0 = none)
    pub color_tint_hex: Option<String>,
    pub rgb_balance: [f32; 3], // [R, G, B] multipliers, default [1.0, 1.0, 1.0]
    pub highlights: f32,       // -50.0 to 50.0
    pub shadows: f32,          // -50.0 to 50.0
    pub css_filter: String,    // Precomputed CSS filter expression for fast canvas rendering
}

impl Default for ShaderRecipe {
    fn default() -> Self {
        Self {
            brightness: 0.0,
            contrast: 1.0,
            saturation: 1.0,
            temperature: 0.0,
            tint: 0.0,
            vignette: 0.0,
            grain: 0.0,
            sepia: 0.0,
            hue_rotate_deg: 0.0,
            color_tint_hex: None,
            rgb_balance: [1.0, 1.0, 1.0],
            highlights: 0.0,
            shadows: 0.0,
            css_filter: "contrast(100%) saturate(100%)".to_string(),
        }
    }
}

/// A filter preset item in the catalog.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FilterPreset {
    pub id: String,
    pub name: String,
    pub category: String,
    pub category_label: String,
    pub description: String,
    pub filter_type: FilterType,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lut_path: Option<String>,
    pub shader_recipe: ShaderRecipe,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ffmpeg_filter: Option<String>,
    pub default_intensity: f32,
    pub is_custom: bool,
    pub preview_accent_color: String,
}

/// A category folder in the Filters Explorer navigation tree.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FilterCategory {
    pub id: String,
    pub name: String,
    pub icon: String,
    pub count: usize,
    pub description: String,
}

/// Generates the complete built-in filter preset hierarchy.
pub fn get_built_in_presets() -> Vec<FilterPreset> {
    vec![
        // =========================================================================
        // 1. 3D LUTs (Technical Log conversions + Film Emulations)
        // =========================================================================
        FilterPreset {
            id: "lut_rec709".to_string(),
            name: "Rec.709 Standard".to_string(),
            category: "luts".to_string(),
            category_label: "3D LUTs".to_string(),
            description: "Industry-standard natural broadcast color space conversion".to_string(),
            filter_type: FilterType::Lut3D,
            lut_path: Some("builtin://luts/rec709_standard.cube".to_string()),
            shader_recipe: ShaderRecipe {
                contrast: 1.08,
                saturation: 1.05,
                css_filter: "contrast(108%) saturate(105%)".to_string(),
                ..Default::default()
            },
            ffmpeg_filter: Some("eq=contrast=1.08:saturation=1.05".to_string()),
            default_intensity: 1.0,
            is_custom: false,
            preview_accent_color: "#00F0FF".to_string(),
        },
        FilterPreset {
            id: "lut_slog3_rec709".to_string(),
            name: "Sony S-Log3 to Rec.709".to_string(),
            category: "luts".to_string(),
            category_label: "3D LUTs".to_string(),
            description: "Sony S-Gamut3.Cine / S-Log3 technical transform with smooth roll-off".to_string(),
            filter_type: FilterType::Lut3D,
            lut_path: Some("builtin://luts/slog3_to_rec709.cube".to_string()),
            shader_recipe: ShaderRecipe {
                contrast: 1.35,
                saturation: 1.25,
                brightness: 0.05,
                css_filter: "contrast(135%) saturate(125%) brightness(105%)".to_string(),
                ..Default::default()
            },
            ffmpeg_filter: Some("eq=contrast=1.35:saturation=1.25:brightness=0.05".to_string()),
            default_intensity: 1.0,
            is_custom: false,
            preview_accent_color: "#38BDF8".to_string(),
        },
        FilterPreset {
            id: "lut_dlog_rec709".to_string(),
            name: "DJI D-Log-M to Rec.709".to_string(),
            category: "luts".to_string(),
            category_label: "3D LUTs".to_string(),
            description: "DJI drone and action camera D-Log-M contrast and saturation normalization".to_string(),
            filter_type: FilterType::Lut3D,
            lut_path: Some("builtin://luts/dlog_to_rec709.cube".to_string()),
            shader_recipe: ShaderRecipe {
                contrast: 1.28,
                saturation: 1.20,
                css_filter: "contrast(128%) saturate(120%)".to_string(),
                ..Default::default()
            },
            ffmpeg_filter: Some("eq=contrast=1.28:saturation=1.20".to_string()),
            default_intensity: 1.0,
            is_custom: false,
            preview_accent_color: "#0284C7".to_string(),
        },
        FilterPreset {
            id: "lut_flog_rec709".to_string(),
            name: "Fujifilm F-Log2 to ETERNA".to_string(),
            category: "luts".to_string(),
            category_label: "3D LUTs".to_string(),
            description: "Fujifilm F-Log2 tone curve with soft Eterna filmic shadow recovery".to_string(),
            filter_type: FilterType::Lut3D,
            lut_path: Some("builtin://luts/flog_to_eterna.cube".to_string()),
            shader_recipe: ShaderRecipe {
                contrast: 1.15,
                saturation: 1.10,
                temperature: 6.0,
                css_filter: "contrast(115%) saturate(110%) sepia(8%)".to_string(),
                ..Default::default()
            },
            ffmpeg_filter: Some("eq=contrast=1.15:saturation=1.10,colorbalance=rs=0.04:bs=-0.04".to_string()),
            default_intensity: 1.0,
            is_custom: false,
            preview_accent_color: "#14B8A6".to_string(),
        },
        FilterPreset {
            id: "lut_arri_logc".to_string(),
            name: "ARRI LogC3 Film Matrix".to_string(),
            category: "luts".to_string(),
            category_label: "3D LUTs".to_string(),
            description: "High dynamic range cinematic Alexa natural skin tone curve".to_string(),
            filter_type: FilterType::Lut3D,
            lut_path: Some("builtin://luts/arri_logc_rec709.cube".to_string()),
            shader_recipe: ShaderRecipe {
                contrast: 1.22,
                saturation: 1.18,
                temperature: 4.0,
                css_filter: "contrast(122%) saturate(118%)".to_string(),
                ..Default::default()
            },
            ffmpeg_filter: Some("eq=contrast=1.22:saturation=1.18".to_string()),
            default_intensity: 1.0,
            is_custom: false,
            preview_accent_color: "#F59E0B".to_string(),
        },
        FilterPreset {
            id: "lut_kodak_vision3".to_string(),
            name: "Kodak Vision3 5207".to_string(),
            category: "luts".to_string(),
            category_label: "3D LUTs".to_string(),
            description: "Rich organic motion picture negative film stock with amber warmth".to_string(),
            filter_type: FilterType::Lut3D,
            lut_path: Some("builtin://luts/kodak_vision3.cube".to_string()),
            shader_recipe: ShaderRecipe {
                contrast: 1.16,
                saturation: 1.15,
                temperature: 15.0,
                rgb_balance: [1.08, 1.01, 0.94],
                css_filter: "contrast(116%) saturate(115%) sepia(12%)".to_string(),
                ..Default::default()
            },
            ffmpeg_filter: Some("eq=contrast=1.16:saturation=1.15,colorbalance=rs=0.08:bs=-0.08".to_string()),
            default_intensity: 1.0,
            is_custom: false,
            preview_accent_color: "#EAB308".to_string(),
        },

        // =========================================================================
        // 2. Cinematic Presets
        // =========================================================================
        FilterPreset {
            id: "cine_teal_orange".to_string(),
            name: "Teal & Orange Blockbuster".to_string(),
            category: "cinematic".to_string(),
            category_label: "Cinematic".to_string(),
            description: "Hollywood complementary color contrast: cool teal shadows and warm orange skin tones".to_string(),
            filter_type: FilterType::ColorGrade,
            lut_path: None,
            shader_recipe: ShaderRecipe {
                contrast: 1.25,
                saturation: 1.22,
                temperature: 12.0,
                tint: -6.0,
                rgb_balance: [1.12, 0.98, 1.08],
                css_filter: "contrast(125%) saturate(122%) hue-rotate(-8deg)".to_string(),
                ..Default::default()
            },
            ffmpeg_filter: Some("eq=contrast=1.25:saturation=1.22,colorbalance=rs=0.12:rm=0.05:bs=-0.08:bm=0.08".to_string()),
            default_intensity: 1.0,
            is_custom: false,
            preview_accent_color: "#06B6D4".to_string(),
        },
        FilterPreset {
            id: "cine_2383_print".to_string(),
            name: "Kodak 2383 Print Film".to_string(),
            category: "cinematic".to_string(),
            category_label: "Cinematic".to_string(),
            description: "Iconic cinematic theatrical print look with deep velvety blacks and film halation".to_string(),
            filter_type: FilterType::ColorGrade,
            lut_path: None,
            shader_recipe: ShaderRecipe {
                contrast: 1.30,
                saturation: 1.12,
                temperature: 10.0,
                vignette: 0.25,
                grain: 0.15,
                css_filter: "contrast(130%) saturate(112%) brightness(96%)".to_string(),
                ..Default::default()
            },
            ffmpeg_filter: Some("eq=contrast=1.30:saturation=1.12:brightness=-0.03,colorbalance=rs=0.06:bs=-0.04".to_string()),
            default_intensity: 1.0,
            is_custom: false,
            preview_accent_color: "#D97706".to_string(),
        },
        FilterPreset {
            id: "cine_bleach_bypass".to_string(),
            name: "Bleach Bypass".to_string(),
            category: "cinematic".to_string(),
            category_label: "Cinematic".to_string(),
            description: "Desaturated gritty look retaining silver emulsion layer with high contrast shadows".to_string(),
            filter_type: FilterType::ColorGrade,
            lut_path: None,
            shader_recipe: ShaderRecipe {
                contrast: 1.45,
                saturation: 0.55,
                brightness: -0.05,
                css_filter: "contrast(145%) saturate(55%) brightness(95%)".to_string(),
                ..Default::default()
            },
            ffmpeg_filter: Some("eq=contrast=1.45:saturation=0.55:brightness=-0.05".to_string()),
            default_intensity: 1.0,
            is_custom: false,
            preview_accent_color: "#94A3B8".to_string(),
        },
        FilterPreset {
            id: "cine_golden_hour".to_string(),
            name: "Golden Hour Glow".to_string(),
            category: "cinematic".to_string(),
            category_label: "Cinematic".to_string(),
            description: "Soft sunset rays with warm amber highlights and gentle contrast roll-off".to_string(),
            filter_type: FilterType::ColorGrade,
            lut_path: None,
            shader_recipe: ShaderRecipe {
                contrast: 1.10,
                saturation: 1.20,
                temperature: 28.0,
                tint: 8.0,
                sepia: 0.15,
                vignette: 0.20,
                css_filter: "contrast(110%) saturate(120%) sepia(18%)".to_string(),
                ..Default::default()
            },
            ffmpeg_filter: Some("eq=contrast=1.10:saturation=1.20,colorbalance=rs=0.22:rm=0.15:gs=0.08:bs=-0.15".to_string()),
            default_intensity: 1.0,
            is_custom: false,
            preview_accent_color: "#F59E0B".to_string(),
        },
        FilterPreset {
            id: "cine_hollywood_warm".to_string(),
            name: "Hollywood Warm Drama".to_string(),
            category: "cinematic".to_string(),
            category_label: "Cinematic".to_string(),
            description: "Rich cinematic prestige drama grade with golden skin tones and soft cyan shadows".to_string(),
            filter_type: FilterType::ColorGrade,
            lut_path: None,
            shader_recipe: ShaderRecipe {
                contrast: 1.18,
                saturation: 1.14,
                temperature: 16.0,
                css_filter: "contrast(118%) saturate(114%) sepia(10%)".to_string(),
                ..Default::default()
            },
            ffmpeg_filter: Some("eq=contrast=1.18:saturation=1.14,colorbalance=rs=0.10:bs=-0.06".to_string()),
            default_intensity: 1.0,
            is_custom: false,
            preview_accent_color: "#EA580C".to_string(),
        },
        FilterPreset {
            id: "cine_midnight_blue".to_string(),
            name: "Cyber Midnight".to_string(),
            category: "cinematic".to_string(),
            category_label: "Cinematic".to_string(),
            description: "Moody night aesthetic with deep cobalt blues and punchy neon specular highlights".to_string(),
            filter_type: FilterType::ColorGrade,
            lut_path: None,
            shader_recipe: ShaderRecipe {
                contrast: 1.32,
                saturation: 1.10,
                temperature: -35.0,
                tint: -12.0,
                css_filter: "contrast(132%) saturate(110%) hue-rotate(185deg)".to_string(),
                ..Default::default()
            },
            ffmpeg_filter: Some("eq=contrast=1.32:saturation=1.10,colorbalance=bs=0.25:bm=0.15:rs=-0.18:gs=-0.08".to_string()),
            default_intensity: 1.0,
            is_custom: false,
            preview_accent_color: "#2563EB".to_string(),
        },

        // =========================================================================
        // 3. Retro & Vintage Presets
        // =========================================================================
        FilterPreset {
            id: "retro_90s_vhs".to_string(),
            name: "90s Camcorder VHS".to_string(),
            category: "vintage".to_string(),
            category_label: "Retro & Vintage".to_string(),
            description: "Analog magnetic tape look with color bleeding, scanlines, and crushed dynamic range".to_string(),
            filter_type: FilterType::Vintage,
            lut_path: None,
            shader_recipe: ShaderRecipe {
                contrast: 1.15,
                saturation: 1.35,
                brightness: 0.04,
                grain: 0.40,
                vignette: 0.30,
                css_filter: "contrast(115%) saturate(135%) brightness(104%) hue-rotate(5deg)".to_string(),
                ..Default::default()
            },
            ffmpeg_filter: Some("eq=contrast=1.15:saturation=1.35:brightness=0.04,noise=alls=20:allf=t+u".to_string()),
            default_intensity: 1.0,
            is_custom: false,
            preview_accent_color: "#EC4899".to_string(),
        },
        FilterPreset {
            id: "retro_sepia_tone".to_string(),
            name: "Classic Sepia Tone".to_string(),
            category: "vintage".to_string(),
            category_label: "Retro & Vintage".to_string(),
            description: "Timeless antique photographic warm monochrome with faded highlights".to_string(),
            filter_type: FilterType::Vintage,
            lut_path: None,
            shader_recipe: ShaderRecipe {
                contrast: 1.12,
                saturation: 0.85,
                sepia: 0.75,
                vignette: 0.35,
                css_filter: "sepia(75%) contrast(112%) brightness(95%)".to_string(),
                ..Default::default()
            },
            ffmpeg_filter: Some("colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131,eq=contrast=1.12".to_string()),
            default_intensity: 1.0,
            is_custom: false,
            preview_accent_color: "#B45309".to_string(),
        },
        FilterPreset {
            id: "retro_super8".to_string(),
            name: "Super 8mm Film".to_string(),
            category: "vintage".to_string(),
            category_label: "Retro & Vintage".to_string(),
            description: "Nostalgic home movie look with heavy organic film grain, warm tint, and edge vignette".to_string(),
            filter_type: FilterType::Vintage,
            lut_path: None,
            shader_recipe: ShaderRecipe {
                contrast: 1.24,
                saturation: 1.18,
                temperature: 22.0,
                grain: 0.50,
                vignette: 0.45,
                css_filter: "contrast(124%) saturate(118%) sepia(20%)".to_string(),
                ..Default::default()
            },
            ffmpeg_filter: Some("eq=contrast=1.24:saturation=1.18,colorbalance=rs=0.15:bs=-0.12,noise=alls=25:allf=t".to_string()),
            default_intensity: 1.0,
            is_custom: false,
            preview_accent_color: "#D97706".to_string(),
        },
        FilterPreset {
            id: "retro_halation".to_string(),
            name: "Film Halation & Glow".to_string(),
            category: "vintage".to_string(),
            category_label: "Retro & Vintage".to_string(),
            description: "Red rim scatter around bright specular light sources typical of vintage cinema lenses".to_string(),
            filter_type: FilterType::Vintage,
            lut_path: None,
            shader_recipe: ShaderRecipe {
                contrast: 1.14,
                saturation: 1.25,
                temperature: 14.0,
                tint: 10.0,
                css_filter: "contrast(114%) saturate(125%) hue-rotate(-4deg)".to_string(),
                ..Default::default()
            },
            ffmpeg_filter: Some("eq=contrast=1.14:saturation=1.25,colorbalance=rs=0.18:rm=0.08".to_string()),
            default_intensity: 1.0,
            is_custom: false,
            preview_accent_color: "#EF4444".to_string(),
        },
        FilterPreset {
            id: "retro_1975_polaroid".to_string(),
            name: "1975 Instant Polaroid".to_string(),
            category: "vintage".to_string(),
            category_label: "Retro & Vintage".to_string(),
            description: "Faded cyan-green tint with creamy pastel highlights and lifted matte shadows".to_string(),
            filter_type: FilterType::Vintage,
            lut_path: None,
            shader_recipe: ShaderRecipe {
                contrast: 0.95,
                saturation: 0.88,
                brightness: 0.06,
                temperature: -8.0,
                tint: 14.0,
                css_filter: "contrast(95%) saturate(88%) brightness(106%) hue-rotate(8deg)".to_string(),
                ..Default::default()
            },
            ffmpeg_filter: Some("eq=contrast=0.95:saturation=0.88:brightness=0.06,colorbalance=gs=0.06:bs=0.08:rs=-0.04".to_string()),
            default_intensity: 1.0,
            is_custom: false,
            preview_accent_color: "#10B981".to_string(),
        },

        // =========================================================================
        // 4. Monochrome & Noir Presets
        // =========================================================================
        FilterPreset {
            id: "mono_high_contrast".to_string(),
            name: "High-Contrast B&W".to_string(),
            category: "monochrome".to_string(),
            category_label: "Monochrome & Noir".to_string(),
            description: "Punchy, modern street photography black & white with razor-sharp tonal edges".to_string(),
            filter_type: FilterType::Monochrome,
            lut_path: None,
            shader_recipe: ShaderRecipe {
                contrast: 1.48,
                saturation: 0.0,
                brightness: 0.02,
                css_filter: "grayscale(100%) contrast(148%) brightness(102%)".to_string(),
                ..Default::default()
            },
            ffmpeg_filter: Some("hue=s=0,eq=contrast=1.48:brightness=0.02".to_string()),
            default_intensity: 1.0,
            is_custom: false,
            preview_accent_color: "#E2E8F0".to_string(),
        },
        FilterPreset {
            id: "mono_silver_gelatin".to_string(),
            name: "Silver Gelatin Classic".to_string(),
            category: "monochrome".to_string(),
            category_label: "Monochrome & Noir".to_string(),
            description: "Smooth 1950s darkroom print with rich full midtone gradation and fine silver grain".to_string(),
            filter_type: FilterType::Monochrome,
            lut_path: None,
            shader_recipe: ShaderRecipe {
                contrast: 1.18,
                saturation: 0.0,
                brightness: 0.0,
                grain: 0.20,
                css_filter: "grayscale(100%) contrast(118%)".to_string(),
                ..Default::default()
            },
            ffmpeg_filter: Some("hue=s=0,eq=contrast=1.18".to_string()),
            default_intensity: 1.0,
            is_custom: false,
            preview_accent_color: "#94A3B8".to_string(),
        },
        FilterPreset {
            id: "mono_moody_slate".to_string(),
            name: "Moody Slate & Shadows".to_string(),
            category: "monochrome".to_string(),
            category_label: "Monochrome & Noir".to_string(),
            description: "Cinematic brooding monochrome with cool graphite tint and deep crushed blacks".to_string(),
            filter_type: FilterType::Monochrome,
            lut_path: None,
            shader_recipe: ShaderRecipe {
                contrast: 1.35,
                saturation: 0.0,
                temperature: -18.0,
                vignette: 0.35,
                css_filter: "grayscale(100%) contrast(135%) hue-rotate(190deg)".to_string(),
                ..Default::default()
            },
            ffmpeg_filter: Some("hue=s=0,eq=contrast=1.35,colorbalance=bs=0.08:bm=0.04".to_string()),
            default_intensity: 1.0,
            is_custom: false,
            preview_accent_color: "#64748B".to_string(),
        },
        FilterPreset {
            id: "mono_noir_1940".to_string(),
            name: "Film Noir 1940".to_string(),
            category: "monochrome".to_string(),
            category_label: "Monochrome & Noir".to_string(),
            description: "Dramatic German Expressionism lighting with extreme chiaroscuro and heavy vignette".to_string(),
            filter_type: FilterType::Monochrome,
            lut_path: None,
            shader_recipe: ShaderRecipe {
                contrast: 1.60,
                saturation: 0.0,
                brightness: -0.06,
                vignette: 0.50,
                grain: 0.30,
                css_filter: "grayscale(100%) contrast(160%) brightness(94%)".to_string(),
                ..Default::default()
            },
            ffmpeg_filter: Some("hue=s=0,eq=contrast=1.60:brightness=-0.06".to_string()),
            default_intensity: 1.0,
            is_custom: false,
            preview_accent_color: "#475569".to_string(),
        },

        // =========================================================================
        // 5. Stylize & Pop Presets
        // =========================================================================
        FilterPreset {
            id: "style_cyberpunk_neon".to_string(),
            name: "Cyberpunk Neon".to_string(),
            category: "stylize".to_string(),
            category_label: "Stylize & Pop".to_string(),
            description: "Electric Tokyo night look: vivid hot magenta highlights and deep cyan reflections".to_string(),
            filter_type: FilterType::Stylize,
            lut_path: None,
            shader_recipe: ShaderRecipe {
                contrast: 1.38,
                saturation: 1.55,
                temperature: -15.0,
                tint: 28.0,
                css_filter: "contrast(138%) saturate(155%) hue-rotate(-22deg)".to_string(),
                ..Default::default()
            },
            ffmpeg_filter: Some("eq=contrast=1.38:saturation=1.55,colorbalance=rs=0.25:rm=0.10:bs=0.30:bm=0.15".to_string()),
            default_intensity: 1.0,
            is_custom: false,
            preview_accent_color: "#F43F5E".to_string(),
        },
        FilterPreset {
            id: "style_matrix_green".to_string(),
            name: "Cold Matrix Green".to_string(),
            category: "stylize".to_string(),
            category_label: "Stylize & Pop".to_string(),
            description: "Dystopian digital green cast with suppressed warm channels and high contrast".to_string(),
            filter_type: FilterType::Stylize,
            lut_path: None,
            shader_recipe: ShaderRecipe {
                contrast: 1.30,
                saturation: 1.10,
                temperature: -10.0,
                tint: -45.0,
                rgb_balance: [0.82, 1.25, 0.88],
                css_filter: "contrast(130%) saturate(110%) hue-rotate(65deg)".to_string(),
                ..Default::default()
            },
            ffmpeg_filter: Some("eq=contrast=1.30:saturation=1.10,colorbalance=gs=0.30:gm=0.20:rs=-0.15:bs=-0.15".to_string()),
            default_intensity: 1.0,
            is_custom: false,
            preview_accent_color: "#22C55E".to_string(),
        },
        FilterPreset {
            id: "style_sunset_glow".to_string(),
            name: "Sunset Peach Glow".to_string(),
            category: "stylize".to_string(),
            category_label: "Stylize & Pop".to_string(),
            description: "Dreamy peach warmth with soft pastel violet shadows and radiant glow".to_string(),
            filter_type: FilterType::Stylize,
            lut_path: None,
            shader_recipe: ShaderRecipe {
                contrast: 1.12,
                saturation: 1.30,
                temperature: 32.0,
                tint: 18.0,
                css_filter: "contrast(112%) saturate(130%) sepia(22%) hue-rotate(-12deg)".to_string(),
                ..Default::default()
            },
            ffmpeg_filter: Some("eq=contrast=1.12:saturation=1.30,colorbalance=rs=0.25:gs=0.08:bs=-0.12".to_string()),
            default_intensity: 1.0,
            is_custom: false,
            preview_accent_color: "#FB923C".to_string(),
        },
        FilterPreset {
            id: "style_vaporwave".to_string(),
            name: "Vaporwave Aesthetic".to_string(),
            category: "stylize".to_string(),
            category_label: "Stylize & Pop".to_string(),
            description: "80s synthwave dream: vibrant purple, turquoise gradients, and surreal saturation".to_string(),
            filter_type: FilterType::Stylize,
            lut_path: None,
            shader_recipe: ShaderRecipe {
                contrast: 1.28,
                saturation: 1.60,
                temperature: -20.0,
                tint: 38.0,
                css_filter: "contrast(128%) saturate(160%) hue-rotate(285deg)".to_string(),
                ..Default::default()
            },
            ffmpeg_filter: Some("eq=contrast=1.28:saturation=1.60,colorbalance=rs=0.20:bs=0.35:gs=-0.10".to_string()),
            default_intensity: 1.0,
            is_custom: false,
            preview_accent_color: "#A855F7".to_string(),
        },
    ]
}

/// Generates category definitions with dynamic item counts.
pub fn get_built_in_categories(custom_lut_count: usize) -> Vec<FilterCategory> {
    let presets = get_built_in_presets();
    let luts_count = presets.iter().filter(|p| p.category == "luts").count();
    let cine_count = presets.iter().filter(|p| p.category == "cinematic").count();
    let retro_count = presets.iter().filter(|p| p.category == "vintage").count();
    let mono_count = presets.iter().filter(|p| p.category == "monochrome").count();
    let style_count = presets.iter().filter(|p| p.category == "stylize").count();
    let all_count = presets.len() + custom_lut_count;

    vec![
        FilterCategory {
            id: "all".to_string(),
            name: "All Filters & LUTs".to_string(),
            icon: "Layers".to_string(),
            count: all_count,
            description: "Complete library of color grades, 3D LUTs, and film emulations".to_string(),
        },
        FilterCategory {
            id: "luts".to_string(),
            name: "3D LUTs".to_string(),
            icon: "Grid".to_string(),
            count: luts_count,
            description: "Technical Log conversions and creative .cube color profiles".to_string(),
        },
        FilterCategory {
            id: "cinematic".to_string(),
            name: "Cinematic".to_string(),
            icon: "Film".to_string(),
            count: cine_count,
            description: "Feature-film aesthetics, blockbuster teal & orange, and print stocks".to_string(),
        },
        FilterCategory {
            id: "vintage".to_string(),
            name: "Retro & Vintage".to_string(),
            icon: "Clock".to_string(),
            count: retro_count,
            description: "Analog tape VHS, sepia, Super 8 grain, and halation glows".to_string(),
        },
        FilterCategory {
            id: "monochrome".to_string(),
            name: "Monochrome & Noir".to_string(),
            icon: "Sun".to_string(),
            count: mono_count,
            description: "High-contrast black & white, silver gelatin, and 1940s film noir".to_string(),
        },
        FilterCategory {
            id: "stylize".to_string(),
            name: "Stylize & Pop".to_string(),
            icon: "Sparkles".to_string(),
            count: style_count,
            description: "Cyberpunk neon, cold matrix green, sunset peach, and vaporwave".to_string(),
        },
        FilterCategory {
            id: "custom".to_string(),
            name: "Custom / Imports".to_string(),
            icon: "FolderOpen".to_string(),
            count: custom_lut_count,
            description: "User-imported 3D LUT (.cube) files and custom presets".to_string(),
        },
    ]
}
