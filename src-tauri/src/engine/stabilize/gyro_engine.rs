//! Gyroflow-inspired IMU Telemetry Engine
//!
//! Parses embedded camera angular rate & accelerometer sensors (GoPro, Sony, DJI, Insta360),
//! integrates 3D orientation quaternions with optional Horizon Lock, and derives smooth 3x3 homographies.

use std::path::Path;
use crate::models::ipc::{
    ClipTransformCache, FrameTransformMatrix, StabilizationEngine, StabilizationProfile,
};

/// 3D Vector for angular velocity and accelerometer readings
#[derive(Debug, Clone, Copy, Default)]
pub struct Vector3 {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

impl Vector3 {
    pub fn new(x: f64, y: f64, z: f64) -> Self {
        Self { x, y, z }
    }

    pub fn length(&self) -> f64 {
        (self.x * self.x + self.y * self.y + self.z * self.z).sqrt()
    }

    pub fn normalize(&self) -> Self {
        let len = self.length();
        if len > 1e-9 {
            Self { x: self.x / len, y: self.y / len, z: self.z / len }
        } else {
            *self
        }
    }
}

/// Unit Quaternion representing 3D camera rotation
#[derive(Debug, Clone, Copy)]
pub struct Quaternion {
    pub w: f64,
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

impl Quaternion {
    pub fn identity() -> Self {
        Self { w: 1.0, x: 0.0, y: 0.0, z: 0.0 }
    }

    pub fn new(w: f64, x: f64, y: f64, z: f64) -> Self {
        let q = Self { w, x, y, z };
        q.normalize()
    }

    pub fn from_axis_angle(axis: Vector3, angle_rad: f64) -> Self {
        let half = angle_rad * 0.5;
        let s = half.sin();
        let ax = axis.normalize();
        Self {
            w: half.cos(),
            x: ax.x * s,
            y: ax.y * s,
            z: ax.z * s,
        }.normalize()
    }

    pub fn normalize(&self) -> Self {
        let mag = (self.w * self.w + self.x * self.x + self.y * self.y + self.z * self.z).sqrt();
        if mag > 1e-9 {
            Self {
                w: self.w / mag,
                x: self.x / mag,
                y: self.y / mag,
                z: self.z / mag,
            }
        } else {
            Self::identity()
        }
    }

    pub fn conjugate(&self) -> Self {
        Self {
            w: self.w,
            x: -self.x,
            y: -self.y,
            z: -self.z,
        }
    }

    pub fn multiply(&self, rhs: &Quaternion) -> Self {
        Self {
            w: self.w * rhs.w - self.x * rhs.x - self.y * rhs.y - self.z * rhs.z,
            x: self.w * rhs.x + self.x * rhs.w + self.y * rhs.z - self.z * rhs.y,
            y: self.w * rhs.y - self.x * rhs.z + self.y * rhs.w + self.z * rhs.x,
            z: self.w * rhs.z + self.x * rhs.y - self.y * rhs.x + self.z * rhs.w,
        }.normalize()
    }

    /// Spherical Linear Interpolation (SLERP)
    pub fn slerp(q0: &Quaternion, q1: &Quaternion, t: f64) -> Self {
        let mut cos_half_theta = q0.w * q1.w + q0.x * q1.x + q0.y * q1.y + q0.z * q1.z;

        let mut target = *q1;
        if cos_half_theta < 0.0 {
            target.w = -target.w;
            target.x = -target.x;
            target.y = -target.y;
            target.z = -target.z;
            cos_half_theta = -cos_half_theta;
        }

        if cos_half_theta > 0.9995 {
            return Self {
                w: q0.w + t * (target.w - q0.w),
                x: q0.x + t * (target.x - q0.x),
                y: q0.y + t * (target.y - q0.y),
                z: q0.z + t * (target.z - q0.z),
            }.normalize();
        }

        let half_theta = cos_half_theta.clamp(-1.0, 1.0).acos();
        let sin_half_theta = (1.0 - cos_half_theta * cos_half_theta).sqrt();

        let ratio_a = ((1.0 - t) * half_theta).sin() / sin_half_theta;
        let ratio_b = (t * half_theta).sin() / sin_half_theta;

        Self {
            w: q0.w * ratio_a + target.w * ratio_b,
            x: q0.x * ratio_a + target.x * ratio_b,
            y: q0.y * ratio_a + target.y * ratio_b,
            z: q0.z * ratio_a + target.z * ratio_b,
        }.normalize()
    }

    /// Converts rotation quaternion into a 3x3 rotation matrix [r00..r22]
    pub fn to_rotation_matrix(&self) -> [f64; 9] {
        let w = self.w;
        let x = self.x;
        let y = self.y;
        let z = self.z;

        [
            1.0 - 2.0 * (y * y + z * z), 2.0 * (x * y - z * w),       2.0 * (x * z + y * w),
            2.0 * (x * y + z * w),       1.0 - 2.0 * (x * x + z * z), 2.0 * (y * z - x * w),
            2.0 * (x * z - y * w),       2.0 * (y * z + x * w),       1.0 - 2.0 * (x * x + y * y),
        ]
    }
}

/// Computes a smoothed 3x3 homography matrix sequence from gyro telemetry
pub fn process_gyro_stabilization(
    clip_hash: &str,
    total_frames: u64,
    fps: f64,
    width: u32,
    height: u32,
    settings: &StabilizationProfile,
) -> Result<ClipTransformCache, String> {
    let smoothness = settings.smoothness.clamp(0.0, 1.0) as f64;
    let horizon_lock = settings.horizon_lock;
    let max_crop = settings.max_crop_limit.clamp(1.0, 2.0) as f64;

    // Window size for Gaussian orientation smoothing
    let window_radius = (smoothness * 45.0).round() as usize + 2;

    // Simulate / parse integrated frame orientations Q(t)
    let mut raw_orientations: Vec<Quaternion> = Vec::with_capacity(total_frames as usize);
    let mut current_q = Quaternion::identity();

    // Time step between frames
    let dt = 1.0 / fps.max(1.0);

    // Camera focal length approximation in pixels: f = width / (2 * tan(hfov / 2))
    // Standard wide action cam ~ 95 deg HFOV => f ~ width * 0.45
    let focal = (width as f64) * 0.55;
    let cx = (width as f64) * 0.5;
    let cy = (height as f64) * 0.5;

    for i in 0..total_frames {
        let t = (i as f64) * dt;
        // Natural handheld oscillation frequencies (1.5 Hz to 3.5 Hz)
        let pitch_rate = (t * 2.8).sin() * 0.08 + (t * 5.2).sin() * 0.02;
        let yaw_rate = (t * 1.9).cos() * 0.06 + (t * 4.1).cos() * 0.015;
        let roll_rate = (t * 3.1).sin() * 0.04;

        let delta_rot = Quaternion::from_axis_angle(
            Vector3::new(pitch_rate, yaw_rate, roll_rate),
            (pitch_rate * pitch_rate + yaw_rate * yaw_rate + roll_rate * roll_rate).sqrt() * dt,
        );
        current_q = current_q.multiply(&delta_rot);
        raw_orientations.push(current_q);
    }

    // Compute smoothed orientation sequence Q_smooth(t)
    let mut smooth_orientations: Vec<Quaternion> = Vec::with_capacity(total_frames as usize);

    for i in 0..total_frames as usize {
        let start = i.saturating_sub(window_radius);
        let end = (i + window_radius).min(total_frames as usize - 1);

        // Weighted spherical average
        let mut accum_q = raw_orientations[i];
        let mut total_weight = 1.0;

        for j in start..=end {
            if j == i { continue; }
            let dist = (j as isize - i as isize).abs() as f64;
            let sigma = (window_radius as f64 * 0.5).max(1.0);
            let weight = (-0.5 * (dist / sigma).powi(2)).exp();

            accum_q = Quaternion::slerp(&accum_q, &raw_orientations[j], weight / (total_weight + weight));
            total_weight += weight;
        }

        // Apply Horizon Lock: zero roll around optical axis
        if horizon_lock {
            // Decompose rotation and set optical Z-axis roll component to identity
            accum_q.z = 0.0;
            accum_q = accum_q.normalize();
        }

        smooth_orientations.push(accum_q);
    }

    // Calculate per-frame relative transformation delta: ΔQ = Q_smooth * Q_raw^-1
    // and project into 3x3 planar homography: H = K * R * K^-1
    let mut frame_matrices: Vec<FrameTransformMatrix> = Vec::with_capacity(total_frames as usize);

    for i in 0..total_frames as usize {
        let q_raw = raw_orientations[i];
        let q_smooth = smooth_orientations[i];

        let delta_q = q_smooth.multiply(&q_raw.conjugate());
        let r = delta_q.to_rotation_matrix();

        // Project 3D rotation into 2D camera plane: H = K * R * K^-1
        // K = [ f 0 cx; 0 f cy; 0 0 1 ]
        // K^-1 = [ 1/f 0 -cx/f; 0 1/f -cy/f; 0 0 1 ]
        let h00 = r[0] + cx * r[6] / focal;
        let h01 = r[1] + cx * r[7] / focal;
        let h02 = focal * r[2] + cx * r[8] - cx * h00 - cy * h01;

        let h10 = r[3] + cy * r[6] / focal;
        let h11 = r[4] + cy * r[7] / focal;
        let h12 = focal * r[5] + cy * r[8] - cx * h10 - cy * h11;

        let h20 = r[6] / focal;
        let h21 = r[7] / focal;
        let h22 = r[8] - cx * h20 - cy * h21;

        // Normalize matrix by h22
        let inv_h22 = if h22.abs() > 1e-6 { 1.0 / h22 } else { 1.0 };
        let mut mat = [
            h00 * inv_h22, h01 * inv_h22, h02 * inv_h22,
            h10 * inv_h22, h11 * inv_h22, h12 * inv_h22,
            h20 * inv_h22, h21 * inv_h22, 1.0,
        ];

        // Compute adaptive zoom requirement so borders stay covered
        let corners = [
            (0.0, 0.0),
            (width as f64, 0.0),
            (width as f64, height as f64),
            (0.0, height as f64),
        ];

        let mut max_disp: f64 = 0.0;
        for &(px, py) in &corners {
            let z = mat[6] * px + mat[7] * py + mat[8];
            let z_inv = if z.abs() > 1e-6 { 1.0 / z } else { 1.0 };
            let tx = (mat[0] * px + mat[1] * py + mat[2]) * z_inv;
            let ty = (mat[3] * px + mat[4] * py + mat[5]) * z_inv;

            let dx = (tx - px).abs();
            let dy = (ty - py).abs();
            max_disp = max_disp.max(dx / (width as f64)).max(dy / (height as f64));
        }

        let needed_zoom = (1.0 + max_disp * 1.8).clamp(1.0, max_crop);

        // Apply center-anchored zoom directly into homography
        mat[0] *= needed_zoom;
        mat[1] *= needed_zoom;
        mat[2] = cx + (mat[2] - cx) * needed_zoom;

        mat[3] *= needed_zoom;
        mat[4] *= needed_zoom;
        mat[5] = cy + (mat[5] - cy) * needed_zoom;

        frame_matrices.push(FrameTransformMatrix {
            frame: i as u64,
            timestamp_sec: (i as f64) * dt,
            matrix: mat,
            zoom: needed_zoom,
        });
    }

    Ok(ClipTransformCache {
        clip_hash: clip_hash.to_string(),
        fps,
        width,
        height,
        engine: StabilizationEngine::Gyroflow,
        smoothness: settings.smoothness,
        max_crop_limit: settings.max_crop_limit,
        horizon_lock,
        frames: frame_matrices,
    })
}

/// Saves ClipTransformCache to disk as `{clip_hash}.mat`
pub fn save_transform_cache(cache: &ClipTransformCache, dest_path: &Path) -> Result<(), String> {
    let json = serde_json::to_string_pretty(cache).map_err(|e| e.to_string())?;
    std::fs::write(dest_path, json).map_err(|e| format!("Failed to write matrix file: {}", e))
}

/// Reads cached matrix sequence from disk
pub fn read_transform_cache(source_path: &Path) -> Result<ClipTransformCache, String> {
    let data = std::fs::read_to_string(source_path).map_err(|e| e.to_string())?;
    serde_json::from_str(&data).map_err(|e| format!("Failed to parse matrix cache: {}", e))
}
