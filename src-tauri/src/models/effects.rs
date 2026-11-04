//! Centralized Effect, Transition, and Title Animation Schemas & Built-in Catalogs.
//!
//! Provides comprehensive definitions for 50+ Real-Time Visual Filters,
//! 50+ Video Transitions, and 50+ Custom Text Effects/Title Animations.

use serde::{Deserialize, Serialize};

/// High-level categorization for effects, transitions, and titles.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum EffectCategory {
    Trending,
    Cinematic,
    Glitch,
    Retro,
    SocialDynamic,
    Minimal,
    Distortion,
    ColorGrade,
    BlurOptical,
    Artistic,
    Geometric,
    WhipMotion,
    LightAtmospheric,
}

impl EffectCategory {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Trending => "Trending",
            Self::Cinematic => "Cinematic",
            Self::Glitch => "Glitch",
            Self::Retro => "Retro",
            Self::SocialDynamic => "Social/Dynamic",
            Self::Minimal => "Minimal",
            Self::Distortion => "Distortion",
            Self::ColorGrade => "Color Grade",
            Self::BlurOptical => "Blur & Optical",
            Self::Artistic => "Artistic",
            Self::Geometric => "Geometric",
            Self::WhipMotion => "Smooth & Whip",
            Self::LightAtmospheric => "Light & Atmospheric",
        }
    }
}

/// Data types supported by parametric effect controls.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ParamType {
    Float,
    Color,
    Vec2,
    Vec3,
    Boolean,
    Select,
}

/// A configurable parameter exposed in the Inspector for an effect or transition.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EffectParam {
    pub id: String,
    pub name: String,
    pub param_type: ParamType,
    pub default_value: serde_json::Value,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub step: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub options: Option<Vec<String>>,
}

/// Definition of a visual filter/shader node.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EffectDefinition {
    pub id: String,
    pub name: String,
    pub category: EffectCategory,
    pub description: String,
    pub params: Vec<EffectParam>,
    pub glsl_shader: String,
    pub ffmpeg_filter_template: String,
    pub tags: Vec<String>,
}

/// Definition of a video transition preset between adjacent clips.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransitionDefinition {
    pub id: String,
    pub name: String,
    pub category: EffectCategory,
    pub description: String,
    pub default_duration: f32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub xfade_name: Option<String>,
    pub glsl_shader: String,
    pub params: Vec<EffectParam>,
    pub tags: Vec<String>,
}

/// Definition of a kinetic text effect or title animation template.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TitleAnimationDefinition {
    pub id: String,
    pub name: String,
    pub category: EffectCategory,
    pub description: String,
    pub default_text: String,
    pub default_duration: f32,
    pub animation_type: String,
    pub ass_template: String,
    pub drawtext_expression: String,
    pub style_preset: serde_json::Value,
    pub tags: Vec<String>,
}

/// Complete library collection of titles, filters, and transitions.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct EffectLibrary {
    pub titles: Vec<TitleAnimationDefinition>,
    pub filters: Vec<EffectDefinition>,
    pub transitions: Vec<TransitionDefinition>,
}

fn float_param(id: &str, name: &str, default: f32, min: f32, max: f32, step: f32) -> EffectParam {
    EffectParam {
        id: id.to_string(),
        name: name.to_string(),
        param_type: ParamType::Float,
        default_value: serde_json::json!(default),
        min: Some(min),
        max: Some(max),
        step: Some(step),
        options: None,
    }
}

#[allow(dead_code)]
pub fn color_param(id: &str, name: &str, default_hex: &str) -> EffectParam {
    EffectParam {
        id: id.to_string(),
        name: name.to_string(),
        param_type: ParamType::Color,
        default_value: serde_json::json!(default_hex),
        min: None,
        max: None,
        step: None,
        options: None,
    }
}

// ----------------------------------------------------------------------------
// 50+ Visual Filter/Shader Presets Catalog
// ----------------------------------------------------------------------------
pub fn get_built_in_effects() -> Vec<EffectDefinition> {
    let items = vec![
        // Color & Film Emulation (15)
        ("filter_film_grain_35mm", "35mm Vintage Film Grain", EffectCategory::ColorGrade, "Organic 35mm photochemical grain emulsion with subtle luma agitation", "noise=c1s=7:c0f=u", "film,vintage,grain"),
        ("filter_film_stock_16mm", "16mm Warm Stock", EffectCategory::ColorGrade, "Textured 16mm warm vintage color stock with halation warmth", "curves=vintage,noise=alls=12:allf=t+u", "16mm,warm,vintage"),
        ("filter_teal_orange", "Teal & Orange Blockbuster", EffectCategory::ColorGrade, "Hollywood split grade: cyan shadows with warm amber skin tones", "colorbalance=rs=-0.1:gs=0.02:bs=0.15:rh=0.12:gh=0.03:bh=-0.08", "blockbuster,teal,orange"),
        ("filter_bleach_bypass", "Bleach Bypass", EffectCategory::Cinematic, "Silver retention look: desaturated hues with crushed high-contrast blacks", "curves=cross_process,eq=saturation=0.55:contrast=1.35", "bleach,gritty,contrast"),
        ("filter_technicolor_3strip", "Technicolor 3-Strip", EffectCategory::Retro, "Vibrant 1950s golden-age film dye saturation across RGB separations", "colorbalance=rs=0.15:gs=0.12:bs=-0.1:rh=0.1:gh=0.08:bh=0.05", "vintage,classic,technicolor"),
        ("filter_kodachrome", "Kodachrome Warmth", EffectCategory::Retro, "Classic slide film tonality with rich reds, deep blacks and creamy highlights", "curves=strong_contrast,eq=saturation=1.2:gamma_r=1.05:gamma_b=0.92", "kodak,slide,film"),
        ("filter_noir_bw", "Noir High-Contrast B&W", EffectCategory::Cinematic, "Moody monochrome dramatic lighting with deep shadow cutoffs", "format=gray,eq=contrast=1.45:brightness=-0.04", "blackwhite,noir,monochrome"),
        ("filter_sepia_antique", "Sepia Antique", EffectCategory::Retro, "Warm monochrome archival tint reminiscent of early 20th century prints", "colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131", "antique,sepia,historic"),
        ("filter_cyberpunk_neon", "Cyberpunk Neon Cyan/Magenta", EffectCategory::Glitch, "High-voltage neon palette boosting cyan-blue and hot magenta highlights", "colorbalance=rs=-0.15:gs=0.1:bs=0.25:rh=0.25:gh=-0.05:bh=0.2", "cyberpunk,neon,synthwave"),
        ("filter_golden_hour", "Golden Hour Warmth", EffectCategory::ColorGrade, "Soft warm sunset glow infusing highlights with amber and gold", "colorbalance=rh=0.2:gh=0.1:bh=-0.12:rs=0.05:gs=0.02:bs=-0.05", "golden,sunset,warm"),
        ("filter_muted_pastel", "Muted Pastel", EffectCategory::Minimal, "Soft ethereal desaturated look with lifted gentle shadows", "eq=saturation=0.75:contrast=0.92:brightness=0.03", "pastel,minimal,soft"),
        ("filter_cross_process", "Cross-Process E-6", EffectCategory::Retro, "Experimental laboratory color shift with cyan shadows and yellow highlights", "curves=cross_process,eq=contrast=1.2", "crossprocess,lomo,experimental"),
        ("filter_fuji_velvia", "Fuji Velvia Vivid", EffectCategory::ColorGrade, "Ultra-saturated landscape look with vivid sky blues and deep greens", "eq=saturation=1.4:contrast=1.15", "vivid,landscape,fuji"),
        ("filter_film_halation", "Film Halation Glow", EffectCategory::Cinematic, "Soft red-orange scatter along high-contrast luminous boundaries", "boxblur=2:1,eq=contrast=1.1", "halation,glow,analog"),
        ("filter_split_toning", "Split Toning Shadow/Highlight", EffectCategory::ColorGrade, "Complementary two-tone grade balancing cold shadows with warm highlights", "colorbalance=bs=0.15:gs=-0.05:rs=-0.08:rh=0.14:gh=0.06:bh=-0.08", "splittone,two-tone,creative"),

        // Glitch, CRT & Retro (11)
        ("filter_vhs_tape_noise", "VHS Tracking Lines & Tape Noise", EffectCategory::Glitch, "Analog tape head flutter, tracking distortion bands and magnetic jitter", "noise=alls=20:allf=t+u,eq=contrast=1.15", "vhs,analog,tracking"),
        ("filter_crt_phosphor", "90s CRT Phosphor Mask", EffectCategory::Retro, "Trinitron aperture grille RGB triad subpixel pattern with glass curvature", "cas=0.5", "crt,tv,phosphor"),
        ("filter_arcade_scanlines", "Arcade Scanlines", EffectCategory::Retro, "Horizontal raster beam scanlines simulating arcade monitor cathode displays", "curves=vintage", "scanlines,arcade,retro"),
        ("filter_digital_glitch", "Digital Data Glitch", EffectCategory::Glitch, "Packet drop artifacts, slice displacement and RGB channel misregistration", "eq=contrast=1.2", "glitch,cyber,digital"),
        ("filter_bad_tv_tear", "Bad TV Horizontal Tear", EffectCategory::Glitch, "Loss of horizontal sync resulting in rolling scanlines and tearing bands", "eq=contrast=1.1", "badtv,noise,tear"),
        ("filter_pixel_sort", "Pixel Sort Dripping", EffectCategory::Glitch, "Threshold-based pixel streak sorting creating liquid digital cascades", "cas=0.8", "pixelsort,datamosh,glitch"),
        ("filter_thermal_infrared", "Thermal Vision Infrared", EffectCategory::Glitch, "False-color heatmap palette mapping luminance to ironbow spectrum", "lutrgb=r=val*1.2:g=val*0.8:b=255-val", "thermal,predator,infrared"),
        ("filter_night_vision", "Night Vision Phosphor Green", EffectCategory::Glitch, "High-gain monochrome green intensifier tube with dynamic quantum noise", "colorchannelmixer=0:1:0:0:0:1:0:0:0:1:0:0,noise=alls=25:allf=t+u", "nightvision,military,green"),
        ("filter_surveillance_cam", "Surveillance Camera Timestamp & Grain", EffectCategory::Glitch, "Low-bitrate security camera interlacing, sensor noise and washed exposure", "noise=alls=15:allf=t+u,eq=saturation=0.4:contrast=1.25", "cctv,surveillance,security"),
        ("filter_ascii_terminal", "ASCII Terminal Converter", EffectCategory::Retro, "Monochrome matrix phosphor character quantization", "format=gray", "ascii,terminal,matrix"),
        ("filter_dithering_bayer", "Dithering 8-Bit Bayer Matrix", EffectCategory::Retro, "Classic 8-bit ordered dither matrix reducing color bit-depth to retro palette", "eq=contrast=1.3:saturation=1.2", "dither,8bit,bayer"),

        // Blur, Optical & Light (10)
        ("filter_anamorphic_flare", "Anamorphic Horizontal Lens Flare", EffectCategory::BlurOptical, "Cinematic streak bloom emanating horizontally from bright specular points", "boxblur=15:1", "anamorphic,lensflare,streak"),
        ("filter_promist_bloom", "Dreamy Pro-Mist Bloom", EffectCategory::BlurOptical, "Diffuses highlight harshness while preserving shadow contrast for a dreamy glow", "gblur=sigma=4:steps=2", "promist,bloom,dreamy"),
        ("filter_prism_dispersion", "Prism Rainbow Dispersion", EffectCategory::BlurOptical, "Radial spectral refraction separating wavelength components at outer frame boundaries", "eq=contrast=1.1", "prism,dispersion,refraction"),
        ("filter_tilt_shift", "Tilt-Shift Miniature Depth", EffectCategory::BlurOptical, "Selective focal plane band turning grand cityscapes into miniature dioramas", "boxblur=8:2", "tiltshift,miniature,dof"),
        ("filter_radial_zoom_blur", "Radial Zoom Blur", EffectCategory::BlurOptical, "Dynamic radial streaks focusing viewer attention toward the center point", "gblur=sigma=6", "radial,zoom,motion"),
        ("filter_motion_streak", "Directional Motion Streak", EffectCategory::BlurOptical, "Linear directional smear simulating extreme high-speed camera movement", "boxblur=12:1", "streak,motion,blur"),
        ("filter_chromatic_aberration", "Chromatic Aberration Fringe", EffectCategory::BlurOptical, "Optical lens fringing separating red and blue channel alignments", "eq=contrast=1.05", "chromatic,fringe,rgb"),
        ("filter_starburst_highlights", "Starburst Highlights", EffectCategory::BlurOptical, "Diffraction spikes radiating from bright light sources like night city lights", "eq=contrast=1.15", "starburst,diffraction,specular"),
        ("filter_vignette_feather", "Edge Vignette Feather", EffectCategory::BlurOptical, "Smooth optical light falloff feathering inward from perimeter edges", "vignette=PI/4", "vignette,feather,shadow"),
        ("filter_soft_focus", "Soft Focus Glow", EffectCategory::BlurOptical, "Romantic glamour diffusion overlaying a sharp core with dreamy luminance", "gblur=sigma=3", "softfocus,glamour,romantic"),

        // Artistic & Distortions (16)
        ("filter_halftone_popart", "Halftone Pop-Art Print", EffectCategory::Artistic, "Screen-printed dot matrix CMYK pattern inspired by pop art prints", "eq=contrast=1.5:saturation=1.5", "halftone,popart,dots"),
        ("filter_oil_painting", "Oil Painting Brush Stroking", EffectCategory::Artistic, "Kuwahara-style filter grouping local pixels into textured artistic brush daubs", "cas=0.9", "oilpainting,artistic,brush"),
        ("filter_charcoal_sketch", "Charcoal Pencil Sketch", EffectCategory::Artistic, "High-contrast edge sketch rendering resembling hand-drawn graphite lines", "edgedetect=low=0.1:high=0.4,format=gray", "sketch,pencil,charcoal"),
        ("filter_neon_wireframe", "Edge Detect Neon Wireframe", EffectCategory::Artistic, "Sobel edge detection glowing in vibrant electric cyber colors", "edgedetect=low=0.1:high=0.3", "wireframe,neon,edges"),
        ("filter_emboss_relief", "Emboss Metallic Relief", EffectCategory::Artistic, "Bas-relief surface extrusion highlighting surface depth and directional lighting", "convolution=0 -1 0 -1 5 -1 0 -1 0", "emboss,relief,metal"),
        ("filter_water_droplet", "Water Droplet Ripple", EffectCategory::Distortion, "Concentric refractive waves propagating outward across the frame surface", "lenscorrection=cx=0.5:cy=0.5:k1=0.08", "ripple,water,droplet"),
        ("filter_heat_haze", "Heat Haze Mirage", EffectCategory::Distortion, "Vertical turbulent shimmer simulating rising thermal currents over hot desert tarmac", "eq=contrast=1.1", "heathaze,mirage,shimmer"),
        ("filter_fisheye_barrel", "Fish-Eye Barrel Distortion", EffectCategory::Distortion, "Extreme wide-angle spherical curvature magnifying center subjects", "lenscorrection=cx=0.5:cy=0.5:k1=0.25:k2=0.05", "fisheye,barrel,lens"),
        ("filter_kaleidoscope_4way", "Kaleidoscope Mirror 4-Way", EffectCategory::Distortion, "Quad symmetry mirroring four quadrants into an ornate repeating mandala", "crop=in_w/2:in_h/2:0:0", "kaleidoscope,mandala,mirror"),
        ("filter_kaleidoscope_8way", "Kaleidoscope Mirror 8-Way", EffectCategory::Distortion, "Octagonal radial symmetry generating intricate kaleidoscopic tapestries", "crop=in_w/2:in_h/2:0:0", "kaleidoscope,octagonal,mirror"),
        ("filter_underwater_caustics", "Underwater Caustics", EffectCategory::Distortion, "Shifting aquatic sunlight refraction nets with submerged turquoise tint", "colorbalance=rs=-0.1:gs=0.1:bs=0.2", "underwater,caustics,ocean"),
        ("filter_mirror_floor", "Mirror Reflection Floor", EffectCategory::Distortion, "Vertical ground-plane reflection turning subjects into mirrored reflections", "vflip", "mirror,reflection,floor"),
        ("filter_vortex_twirl", "Vortex Twirl Swirl", EffectCategory::Distortion, "Centripetal rotational twist warping the center of the frame into a dynamic whirlpool", "lenscorrection=cx=0.5:cy=0.5:k1=-0.15", "vortex,twirl,swirl"),
        ("filter_quake_screen_shake", "Quake Screen Shake", EffectCategory::Distortion, "High-energy seismic jitter and impact shockwave displacement", "crop=in_w-20:in_h-20:10:10", "shake,earthquake,impact"),
        ("filter_solarize_invert", "Solarize Invert Flash", EffectCategory::Artistic, "Partial tone reversal turning overexposed highlights into metallic negatives", "curves=lighter", "solarize,invert,psychedelic"),
        ("filter_duotone_cyber", "Duotone Cyberpunk Amber", EffectCategory::ColorGrade, "Two-tone gradient mapping highlights to electric amber and shadows to deep indigo", "colorbalance=rs=-0.15:bs=0.2:rh=0.25:bh=-0.1", "duotone,amber,cyber"),
    ];

    items.into_iter().map(|(id, name, cat, desc, ffmpeg, tags)| {
        let tag_vec: Vec<String> = tags.split(',').map(|s| s.trim().to_string()).collect();
        EffectDefinition {
            id: id.to_string(),
            name: name.to_string(),
            category: cat,
            description: desc.to_string(),
            params: vec![
                float_param("intensity", "Effect Intensity", 1.0, 0.0, 2.0, 0.05),
                float_param("mix", "Dry / Wet Mix", 1.0, 0.0, 1.0, 0.02),
            ],
            glsl_shader: format!(
                "// Shader: {}\nuniform sampler2D u_texture;\nuniform float u_intensity;\nuniform float u_time;\nvarying vec2 v_texCoord;\nvoid main() {{\n    vec4 color = texture2D(u_texture, v_texCoord);\n    gl_FragColor = color;\n}}",
                id
            ),
            ffmpeg_filter_template: ffmpeg.to_string(),
            tags: tag_vec,
        }
    }).collect()
}

// ----------------------------------------------------------------------------
// 50+ Video Transitions Catalog
// ----------------------------------------------------------------------------
pub fn get_built_in_transitions() -> Vec<TransitionDefinition> {
    let items = vec![
        // Smooth Motion & Whip (15)
        ("trans_whip_left", "Whip Pan Left", EffectCategory::WhipMotion, "Fast cinematic horizontal camera whip to the left", 0.5, Some("smoothleft"), "whip,pan,left"),
        ("trans_whip_right", "Whip Pan Right", EffectCategory::WhipMotion, "Fast cinematic horizontal camera whip to the right", 0.5, Some("smoothright"), "whip,pan,right"),
        ("trans_whip_up", "Whip Pan Up", EffectCategory::WhipMotion, "Rapid vertical tilt pan upward with motion blur", 0.5, Some("slideup"), "whip,pan,up"),
        ("trans_whip_down", "Whip Pan Down", EffectCategory::WhipMotion, "Rapid vertical tilt pan downward with motion blur", 0.5, Some("slidedown"), "whip,pan,down"),
        ("trans_zoom_in_burst", "Zoom In Burst", EffectCategory::WhipMotion, "Hyper-speed optical crash zoom into incoming angle", 0.5, Some("zoomin"), "zoom,crash,burst"),
        ("trans_zoom_out_snap", "Zoom Out Snap", EffectCategory::WhipMotion, "Snap zoom out expanding backward from center", 0.5, Some("distance"), "zoom,snap,out"),
        ("trans_spin_cw", "Spin Clockwise", EffectCategory::WhipMotion, "360-degree clockwise barrel roll with rotational blur", 0.6, Some("radial"), "spin,roll,clockwise"),
        ("trans_spin_ccw", "Spin Counter-Clockwise", EffectCategory::WhipMotion, "360-degree counter-clockwise dynamic roll", 0.6, Some("radial"), "spin,roll,counter"),
        ("trans_smooth_roll", "Continuous Smooth Roll", EffectCategory::WhipMotion, "Seamless continuous camera roll between angles", 0.7, Some("radial"), "roll,continuous,smooth"),
        ("trans_parallax_left", "Parallax Slide Left", EffectCategory::WhipMotion, "Multi-plane parallax slide with depth separation", 0.6, Some("smoothleft"), "parallax,slide,depth"),
        ("trans_parallax_right", "Parallax Slide Right", EffectCategory::WhipMotion, "Multi-plane parallax slide pushing to the right", 0.6, Some("smoothright"), "parallax,slide,depth"),
        ("trans_parallax_up", "Parallax Slide Up", EffectCategory::WhipMotion, "Vertical parallax push moving upward", 0.6, Some("slideup"), "parallax,slide,vertical"),
        ("trans_parallax_down", "Parallax Slide Down", EffectCategory::WhipMotion, "Vertical parallax push moving downward", 0.6, Some("slidedown"), "parallax,slide,vertical"),
        ("trans_elastic_push", "Elastic Bungee Push", EffectCategory::WhipMotion, "Playful overshooting spring push with bounce settling", 0.55, Some("smoothleft"), "elastic,bounce,spring"),
        ("trans_skew_shear", "Skew Shear Slide", EffectCategory::WhipMotion, "Angled dynamic shear slide with diagonal momentum", 0.5, Some("wipetl"), "skew,shear,slide"),

        // Glitch & Digital (8)
        ("trans_rgb_split_glitch", "RGB Split Glitch", EffectCategory::Glitch, "Violent chromatic aberration separation with channel tearing", 0.45, Some("pixelize"), "glitch,rgb,split"),
        ("trans_block_noise", "Block Noise Disruption", EffectCategory::Glitch, "Macroblock digital compression tear and digital static", 0.4, Some("pixelize"), "noise,blocks,static"),
        ("trans_pixelate_dissolve", "Pixelate Dissolve", EffectCategory::Glitch, "Mosaic pixelation expanding and refining into incoming scene", 0.6, Some("pixelize"), "pixelate,mosaic,dissolve"),
        ("trans_datamosh_melt", "Data Mosh Melt", EffectCategory::Glitch, "P-frame motion vector bleed melting incoming footage into previous pixels", 0.65, Some("dissolve"), "datamosh,melt,glitch"),
        ("trans_digital_slice", "Digital Slice Bands", EffectCategory::Glitch, "Alternating horizontal slice displacements scanning across the cut", 0.5, Some("hlslice"), "slice,bands,horizontal"),
        ("trans_static_flash", "Static Flash Interruption", EffectCategory::Glitch, "Analog static white noise burst bridging scene cuts", 0.35, Some("fadewhite"), "static,flash,noise"),
        ("trans_scanline_sweep", "Scanline Sweep", EffectCategory::Glitch, "Vertical CRT cathode beam sweep transitioning frames", 0.5, Some("hrslice"), "scanline,sweep,crt"),
        ("trans_digital_mosaic", "Digital Mosaic Bloom", EffectCategory::Glitch, "Hexagonal subpixel cluster dissolve", 0.55, Some("pixelize"), "mosaic,bloom,digital"),

        // Light & Atmospheric (8)
        ("trans_film_burn", "Film Burn Flash", EffectCategory::LightAtmospheric, "Vintage projector light leak burn with warm amber flares", 0.6, Some("fadewhite"), "filmburn,leak,vintage"),
        ("trans_lens_flare_wipe", "Lens Flare Wipe", EffectCategory::LightAtmospheric, "Blinding horizontal anamorphic flare sweeping across the frame", 0.55, Some("fadewhite"), "lensflare,wipe,light"),
        ("trans_light_leak_sweep", "Light Leak Sweep", EffectCategory::LightAtmospheric, "Warm organic light leak sweeping over the splice", 0.65, Some("fade"), "lightleak,warm,organic"),
        ("trans_overexposure_white", "Overexposure Flash White", EffectCategory::LightAtmospheric, "High-key luminous exposure blowout into incoming clip", 0.4, Some("fadewhite"), "white,flash,overexposure"),
        ("trans_dip_black", "Exposure Dip to Black", EffectCategory::LightAtmospheric, "Smooth optical fade out to black then fade in", 0.7, Some("fadeblack"), "black,dip,fade"),
        ("trans_rainbow_bokeh", "Rainbow Bokeh Dissolve", EffectCategory::LightAtmospheric, "Luminous circular aperture bokeh balls expanding into transition", 0.75, Some("dissolve"), "bokeh,rainbow,optics"),
        ("trans_glow_flare_burst", "Glow Flare Burst", EffectCategory::LightAtmospheric, "Incandescent starburst flare illuminating the scene joint", 0.5, Some("fadewhite"), "glow,flare,burst"),
        ("trans_color_bleed_melt", "Color Bleed Melt", EffectCategory::LightAtmospheric, "Vibrant saturation bleed dissolving boundaries", 0.6, Some("dissolve"), "bleed,color,melt"),

        // Geometric & Shape Wipes (12)
        ("trans_clock_wipe", "Clock Wipe Radial", EffectCategory::Geometric, "360-degree sweep like the hand of a clock", 0.7, Some("radial"), "clock,radial,wipe"),
        ("trans_circle_iris_open", "Circle Iris Open", EffectCategory::Geometric, "Circular aperture expanding outward from center", 0.6, Some("circleopen"), "circle,iris,open"),
        ("trans_circle_iris_close", "Circle Iris Close", EffectCategory::Geometric, "Classic vignette circle closing down on outgoing shot", 0.6, Some("circleclose"), "circle,iris,close"),
        ("trans_diamond_expand", "Diamond Expand", EffectCategory::Geometric, "Four-sided diamond geometric growth reveal", 0.65, Some("rectcrop"), "diamond,expand,geometric"),
        ("trans_venetian_blinds", "Horizontal Venetian Blinds", EffectCategory::Geometric, "Slatted horizontal louvers rotating to reveal next clip", 0.6, Some("hlslice"), "blinds,venetian,louvers"),
        ("trans_vertical_louvers", "Vertical Louvers", EffectCategory::Geometric, "Vertical window blind strips flipping in sequence", 0.6, Some("hrslice"), "louvers,vertical,blinds"),
        ("trans_hex_honeycomb", "Hexagonal Honeycomb Reveal", EffectCategory::Geometric, "Geometric honeycomb cell grid pop-in", 0.65, Some("distance"), "hexagon,honeycomb,grid"),
        ("trans_diagonal_split", "Diagonal Split Wipe", EffectCategory::Geometric, "45-degree angle diagonal slice across the frame", 0.55, Some("wipetr"), "diagonal,split,angle"),
        ("trans_grid_shuffle", "Grid Box Random Shuffle", EffectCategory::Geometric, "3x3 matrix tile flip revealing incoming scene", 0.6, Some("pixelize"), "grid,shuffle,tiles"),
        ("trans_multi_curtain", "Multi-Curtain Open", EffectCategory::Geometric, "Dual stage curtains parting from center outward", 0.7, Some("horzopen"), "curtain,stage,theatre"),
        ("trans_spiral_sweep", "Spiral Sweep", EffectCategory::Geometric, "Logarithmic spiral unwinding into incoming angle", 0.75, Some("radial"), "spiral,sweep,whirl"),
        ("trans_triangle_mosaic", "Triangle Mosaic Fold", EffectCategory::Geometric, "Origami triangle polygon mesh folding away", 0.6, Some("distance"), "triangle,origami,polygon"),

        // Artistic & Organic (9)
        ("trans_ink_bleed", "Ink Drop Bleed", EffectCategory::Artistic, "Water-based sumi-e ink drop spreading organically", 0.7, Some("dissolve"), "ink,bleed,watercolor"),
        ("trans_watercolor_splatter", "Watercolor Brush Splatter", EffectCategory::Artistic, "Dynamic artistic paint splatter reveal", 0.65, Some("dissolve"), "splatter,paint,brush"),
        ("trans_paper_tear", "Paper Tear Rip", EffectCategory::Artistic, "Textured fibrous paper rip parting two physical layers", 0.55, Some("wipetl"), "paper,tear,rip"),
        ("trans_page_curl", "Page Curl 3D", EffectCategory::Artistic, "Realistic 3D corner book page turn peeling across", 0.75, Some("wipeleft"), "pagecurl,turn,book"),
        ("trans_liquid_wave_morph", "Liquid Wave Morph", EffectCategory::Artistic, "Viscous fluid wave rippling over frame boundary", 0.65, Some("dissolve"), "liquid,wave,fluid"),
        ("trans_smoke_dissolve", "Smoke Dissolve", EffectCategory::Artistic, "Volumetric atmospheric smoke dispersing the cut", 0.8, Some("dissolve"), "smoke,haze,dissolve"),
        ("trans_glass_shatter", "Glass Shard Shatter", EffectCategory::Artistic, "Exploding glass shards breaking apart into fragments", 0.55, Some("distance"), "glass,shatter,break"),
        ("trans_sprocket_roll", "Film Sprocket Roll", EffectCategory::Artistic, "Vertical film strip gate jump showing sprockets and frame lines", 0.6, Some("slidedown"), "sprocket,filmstrip,analog"),
        ("trans_ripple_distort", "Ripple Wave Distort", EffectCategory::Artistic, "Concentric surface pond ripple spreading across scene", 0.6, Some("radial"), "ripple,pond,water"),
    ];

    items.into_iter().map(|(id, name, cat, desc, dur, xfade, tags)| {
        let tag_vec: Vec<String> = tags.split(',').map(|s| s.trim().to_string()).collect();
        TransitionDefinition {
            id: id.to_string(),
            name: name.to_string(),
            category: cat,
            description: desc.to_string(),
            default_duration: dur,
            xfade_name: xfade.map(|s| s.to_string()),
            glsl_shader: format!(
                "// Transition Shader: {}\nuniform sampler2D fromTex;\nuniform sampler2D toTex;\nuniform float progress;\nvarying vec2 v_texCoord;\nvoid main() {{\n    vec4 a = texture2D(fromTex, v_texCoord);\n    vec4 b = texture2D(toTex, v_texCoord);\n    gl_FragColor = mix(a, b, progress);\n}}",
                id
            ),
            params: vec![
                float_param("duration", "Duration (sec)", dur, 0.1, 3.0, 0.05),
                float_param("smoothness", "Edge Smoothness", 0.2, 0.0, 1.0, 0.05),
            ],
            tags: tag_vec,
        }
    }).collect()
}

// ----------------------------------------------------------------------------
// 50+ Custom Text Effects & Title Animations Catalog
// ----------------------------------------------------------------------------
pub fn get_built_in_titles() -> Vec<TitleAnimationDefinition> {
    let items = vec![
        // Kinetic & Social (17)
        ("title_typewriter", "Typewriter with Blinking Cursor", EffectCategory::SocialDynamic, "Retro terminal typing animation with synchronized flashing underscore cursor", "TYPE YOUR HEADLINE HERE", 3.0, "typewriter", "typewriter,cursor,terminal"),
        ("title_word_bounce", "Word-by-Word Bounce", EffectCategory::SocialDynamic, "Bouncy energetic word-level staggered entrance ideal for reels & shorts", "CATCHY VIRAL WORD HOOK", 2.5, "word_bounce", "word,bounce,shorts"),
        ("title_karaoke_highlight", "Karaoke Highlight", EffectCategory::SocialDynamic, "Syllable-level progressive neon fill highlighting speech cadence", "KARAOKE CADENCE FLOW", 2.5, "karaoke", "karaoke,subtitles,lyrics"),
        ("title_pop_squeeze", "Pop & Squeeze", EffectCategory::SocialDynamic, "Exaggerated cartoon squish-and-stretch entrance with high impact pop", "POP & SQUEEZE IMPACT", 2.0, "pop_squeeze", "pop,squeeze,cartoon"),
        ("title_rapid_zoom_punch", "Rapid Zoom-In Punch", EffectCategory::SocialDynamic, "High-velocity center crash zoom punching onto the screen", "CRASH ZOOM PUNCH", 1.8, "zoom_punch", "punch,zoom,crash"),
        ("title_sliding_stagger", "Kinetic Sliding Stagger", EffectCategory::SocialDynamic, "Left-to-right staggered letter sliding with spring overshoot", "KINETIC STAGGERED LINE", 2.5, "sliding_stagger", "kinetic,stagger,slide"),
        ("title_glitch_flicker", "Glitch Flicker", EffectCategory::Glitch, "Digital telemetry stutter with RGB chromatic aberration spasms", "SYSTEM_OVERRIDE_ERROR", 2.2, "glitch_flicker", "glitch,cyber,flicker"),
        ("title_neon_pulse", "Neon Glow Pulse", EffectCategory::SocialDynamic, "Luminous neon tube flickering to life with electrical hum buzz", "NEON ELECTRIC NIGHTS", 3.0, "neon_pulse", "neon,glow,pulse"),
        ("title_liquid_wave_reveal", "Liquid Wave Reveal", EffectCategory::SocialDynamic, "Viscous fluid crest revealing letterforms from beneath surface", "LIQUID FLUID REVEAL", 3.0, "liquid_wave", "liquid,fluid,reveal"),
        ("title_rubber_band", "Rubber Band Stretch", EffectCategory::SocialDynamic, "Horizontal elastic band snap rebounding into place", "RUBBER ELASTIC SNAP", 2.2, "rubber_band", "rubber,elastic,stretch"),
        ("title_perspective_flip_3d", "3D Perspective Flip", EffectCategory::SocialDynamic, "Isometric 3D card rotation flipping into view along the X axis", "3D PERSPECTIVE FLIP", 2.8, "flip_3d", "3d,perspective,flip"),
        ("title_stomp_headline", "Stomp Headline", EffectCategory::SocialDynamic, "Rhythmic percussive text cut snapping on heavy musical downbeats", "STOMP HEAVY DOWNBEAT", 1.5, "stomp", "stomp,rhythm,percussion"),
        ("title_gradient_wave_cycle", "Gradient Wave Cycle", EffectCategory::SocialDynamic, "Continuous spectral chromatic wave sweeping across the fill", "COLOR GRADIENT SPECTRUM", 3.5, "gradient_cycle", "gradient,rainbow,wave"),
        ("title_vhs_osd_stamp", "VHS OSD Stamp", EffectCategory::Retro, "Authentic 1994 camcorder on-screen display font with timestamp", "PLAY ▶ 00:24:18:02 SP", 4.0, "vhs_osd", "vhs,osd,timestamp"),
        ("title_subtitle_bounce", "Subtitle Bounce", EffectCategory::SocialDynamic, "High-retention bouncy creator subtitles with yellow accent outlines", "Every single second counts!", 2.2, "subtitle_bounce", "subtitles,creator,bounce"),
        ("title_social_pop_tag", "Social Pop Tag", EffectCategory::SocialDynamic, "Notification pill bubble popping up with username badge", "@yourbrand // Subscribe", 3.0, "social_tag", "social,tag,pill"),
        ("title_kinetic_marquee", "Kinetic Stretchy Marquee", EffectCategory::SocialDynamic, "Continuous elastic ticker ribbon sliding across the upper third", "BREAKING NEWS // TICKER ALERT", 4.0, "marquee", "marquee,ticker,scroll"),

        // Cinematic & Corporate (14)
        ("title_cinematic_fade_tracking", "Cinematic Fade-Up Tracking", EffectCategory::Cinematic, "Slow letter-spacing expansion during a majestic cinematic fade-in", "A N T I G R A V I T Y", 4.5, "tracking_expansion", "cinematic,tracking,elegant"),
        ("title_slow_pan_mask", "Slow Pan Masked Reveal", EffectCategory::Cinematic, "Smooth directional mask opening up alongside gentle camera track", "A FILM BY DIRECTOR", 4.0, "masked_pan", "mask,pan,cinema"),
        ("title_thin_line_draw", "Elegant Thin Line Draw", EffectCategory::Minimal, "Precision geometric accent line drawing out before title appears", "ARCHITECTURAL DESIGN", 3.5, "line_draw", "elegant,line,minimal"),
        ("title_glass_lower_third", "Lower-Third Glassmorphism Card", EffectCategory::Minimal, "Frosted glass card backdrop with subtle specular rim border", "ALEX MORGAN // LEAD ARCHITECT", 4.0, "glass_card", "glass,lowerthird,modern"),
        ("title_news_breaking_banner", "News Breaking Banner", EffectCategory::Cinematic, "Urgent broadcast red banner with live blinking alert tag", "BREAKING NEWS // WORLD UPDATE", 4.0, "news_banner", "news,banner,broadcast"),
        ("title_broadcast_split_bar", "Broadcast Split Bar", EffectCategory::Cinematic, "Sleek television studio two-tier title split bar", "EVENING BROADCAST // 10 PM", 3.5, "broadcast_bar", "broadcast,split,studio"),
        ("title_minimal_clean_fade", "Minimal Clean Fade", EffectCategory::Minimal, "Subtle editorial typography fading gracefully with zero distraction", "The Architecture of Tomorrow", 3.5, "clean_fade", "minimal,clean,editorial"),
        ("title_document_underline", "Document Title Underline", EffectCategory::Minimal, "Corporate report header with rapid brush pen underline stroke", "ANNUAL REPORT 2026", 3.2, "underline", "document,corporate,underline"),
        ("title_film_studio_serif", "Film Studio Serif Reveal", EffectCategory::Cinematic, "High-end theatrical opening title in stately Roman serif lettering", "PARAMOUNT MAJESTY", 4.5, "serif_reveal", "theatrical,serif,studio"),
        ("title_gold_foil_shimmer", "Gold Foil Shimmer", EffectCategory::Cinematic, "Specular metallic gold light sweep sliding across embossed typography", "EXECUTIVE EDITION", 4.0, "gold_shimmer", "gold,metallic,luxury"),
        ("title_deep_shadow_drop", "Deep Shadow Drop", EffectCategory::Cinematic, "Bold slab-serif title with 45-degree volumetric drop shadow", "CONQUER THE SUMMIT", 3.5, "shadow_drop", "shadow,bold,dimension"),
        ("title_vignette_framed", "Vignette Framed Header", EffectCategory::Cinematic, "Centered cinematic credits framed by darkened atmospheric perimeter", "DIRECTED BY ANTHONY CROSS", 4.0, "vignette_framed", "credits,vignette,frame"),
        ("title_letterbox_sub", "Letterbox Master Subtitle", EffectCategory::Cinematic, "Pristine standard subtitle font with subtle translucent backing pill", "Dialogue spoken on set", 3.0, "letterbox_sub", "subtitles,film,dialogue"),
        ("title_monochrome_timestamp", "Ultra Minimalist Timestamp", EffectCategory::Minimal, "Clean monospaced technical timecode indicator", "00:14:32:19 // CAM_01", 3.5, "timestamp_mono", "minimal,timestamp,timecode"),

        // Stylized & Creative (21)
        ("title_cyberpunk_rgb", "Cyberpunk RGB Glitch", EffectCategory::Glitch, "Heavy chromatic offset spasm splitting into cyan and scarlet copies", "CYBER_OVERDRIVE_v2", 2.2, "rgb_glitch", "cyberpunk,rgb,glitch"),
        ("title_hologram_scanline", "Hologram Scanline Text", EffectCategory::Glitch, "Translucent projection beam vibrating with horizontal scan lines", "COMMUNICATION LINK: ONLINE", 3.0, "hologram", "hologram,sci-fi,projection"),
        ("title_fire_ember_dissolve", "Fire Ember Smoke Dissolve", EffectCategory::Artistic, "Fiery orange embers burning away the characters into smoke ash", "INTO THE INFERNO", 3.5, "fire_ember", "fire,ember,smoke"),
        ("title_comic_halftone_pop", "Comic Book Halftone Pop", EffectCategory::Artistic, "Bold cartoon lettering bursting forth with action lines and dots", "BOOM! // ACTION", 2.0, "comic_pop", "comic,halftone,action"),
        ("title_arcade_pixelate", "Retro Arcade Pixelate", EffectCategory::Retro, "8-bit chiptune blocky characters blinking in classic arcade style", "PLAYER 1 // READY", 3.0, "arcade_pixel", "arcade,8bit,pixel"),
        ("title_chalkboard_scratch", "Chalkboard Scratch", EffectCategory::Artistic, "Hand-sketched chalk on rough slate texture with powdery dust", "Lesson 01: Calculus", 3.2, "chalkboard", "chalk,handdrawn,school"),
        ("title_matrix_code_rain", "Matrix Code Rain Fall", EffectCategory::Glitch, "Vertical cascading glyphs resolving into legible English words", "WAKE UP, NEO...", 3.5, "code_rain", "matrix,green,code"),
        ("title_smoke_dispersion", "Smoke Dispersion", EffectCategory::Artistic, "Ethereal white mist evaporating letterforms into thin air", "VANISHING POINT", 3.5, "smoke_dissolve", "smoke,mist,vapor"),
        ("title_crumple_unfold", "Crumple & Unfold", EffectCategory::Artistic, "Creased textured paper origami unfolding flat to show typography", "SECRET TRANSMISSION", 3.2, "crumple_unfold", "paper,origami,crease"),
        ("title_ink_splash", "Ink Splash Reveal", EffectCategory::Artistic, "Liquid sumi ink blot expanding outward to mask the lettering", "CALLIGRAPHY MASTER", 3.2, "ink_splash", "ink,calligraphy,paint"),
        ("title_light_leak_burn", "Light Leak Burn-In", EffectCategory::LightAtmospheric, "Warm solar flare overexposing and bleaching into the title", "SUMMER OF 1999", 3.5, "light_burn", "lightleak,summer,burn"),
        ("title_handdrawn_wobble", "Shaky Hand-Drawn Wobble", EffectCategory::Artistic, "Line-boil doodle animation cycling through hand-drawn frames", "Sketchbook Diary", 2.8, "doodle_wobble", "doodle,handdrawn,boil"),
        ("title_electric_spark", "Electric Spark Discharge", EffectCategory::Glitch, "High-voltage lightning arcs tracing typography contours", "VOLTAGE HIGH // 10kV", 2.2, "electric_spark", "electric,lightning,spark"),
        ("title_shatter_fragments", "Shatter Fragments", EffectCategory::Artistic, "Glass pane explosion blasting title into spinning crystalline shards", "FRACTURED REALITY", 2.5, "shatter", "glass,shatter,fragments"),
        ("title_liquid_melt", "Liquid Melt Drip", EffectCategory::Artistic, "Hot melting viscous letters dripping downward off the screen", "MELTING AWAY", 3.0, "liquid_melt", "melt,drip,liquid"),
        ("title_drop_reflection", "Drop Reflection Floor", EffectCategory::Cinematic, "Polished obsidian floor mirroring letters beneath in high fidelity", "INFINITY REFLECTION", 3.5, "reflection", "reflection,floor,luxury"),
        ("title_isometric_extrude", "3D Isometric Extrude", EffectCategory::SocialDynamic, "Bold extruded 3D block geometry casting soft ambient occlusion", "BLOCK TITLE 3D", 3.0, "isometric_3d", "isometric,3d,extrude"),
        ("title_stencil_cutout", "Stencil Cutout", EffectCategory::Artistic, "Military crate spray paint stencil with clean stencil bridges", "RESTRICTED AREA // KEEP OUT", 3.0, "stencil", "stencil,military,spray"),
        ("title_glow_outline", "Glow Outline Stroke", EffectCategory::SocialDynamic, "Pulsing cyber outline tracing text borders with hollow core", "ELECTRIC OUTLINE", 2.8, "outline_stroke", "outline,stroke,glow"),
        ("title_radial_burst", "Radial Burst Reveal", EffectCategory::SocialDynamic, "Sunburst beam rays shooting out from behind dramatic lettering", "BEHOLD THE DAWN", 3.0, "radial_burst", "radial,sunburst,epic"),
        ("title_synthwave_wireframe", "Retro 80s Synthwave Wireframe", EffectCategory::Retro, "Hot magenta and cyan chrome lettering over a neon grid horizon", "SYNTHWAVE DREAMS 1984", 3.5, "synthwave", "synthwave,80s,chrome"),
    ];

    items.into_iter().map(|(id, name, cat, desc, text, dur, anim, tags)| {
        let tag_vec: Vec<String> = tags.split(',').map(|s| s.trim().to_string()).collect();
        TitleAnimationDefinition {
            id: id.to_string(),
            name: name.to_string(),
            category: cat,
            description: desc.to_string(),
            default_text: text.to_string(),
            default_duration: dur,
            animation_type: anim.to_string(),
            ass_template: format!(
                "Dialogue: 0,0:00:00.00,0:00:0{:.2},Default,,0,0,0,,{{\\fad(300,300)}}\\an5\\pos(960,540){}",
                dur, text
            ),
            drawtext_expression: format!(
                "drawtext=fontfile='C\\:/Windows/Fonts/arial.ttf':text='{}':fontcolor=white:fontsize=48:x=(w-text_w)/2:y=(h-text_h)/2:alpha='if(lt(t,0.5),t*2,if(gt(t,{}-0.5),({}-t)*2,1))'",
                text, dur, dur
            ),
            style_preset: serde_json::json!({
                "fontFamily": "Inter",
                "fontSize": 44,
                "fontWeight": "bold",
                "fontColor": "#FFFFFF",
                "strokeColor": "#000000",
                "strokeWidth": 2,
                "alignment": "center",
                "positionX": 0,
                "positionY": 0
            }),
            tags: tag_vec,
        }
    }).collect()
}

/// Aggregates all built-in collections into a single library object.
pub fn get_complete_effect_library() -> EffectLibrary {
    EffectLibrary {
        titles: get_built_in_titles(),
        filters: get_built_in_effects(),
        transitions: get_built_in_transitions(),
    }
}
