import { Job,JobStatus,MediaCategory } from '../../types';

// Checklist categories for the forklift condition check
export const CHECKLIST_CATEGORIES = [
  {
    name: 'Drive System',
    items: [
      { key: 'drive_front_axle', label: 'Front Axle' },
      { key: 'drive_rear_axle', label: 'Rear Axle' },
      { key: 'drive_motor_engine', label: 'Motor/Engine' },
      { key: 'drive_controller_transmission', label: 'Controller/Transmission' },
    ]
  },
  {
    name: 'Hydraulic System',
    items: [
      { key: 'hydraulic_pump', label: 'Pump' },
      { key: 'hydraulic_control_valve', label: 'Control Valve' },
      { key: 'hydraulic_hose', label: 'Hose' },
      { key: 'hydraulic_oil_level', label: 'Oil Level' },
    ]
  },
  {
    name: 'Braking System',
    items: [
      { key: 'braking_brake_pedal', label: 'Brake Pedal' },
      { key: 'braking_parking_brake', label: 'Parking Brake' },
      { key: 'braking_fluid_pipe', label: 'Fluid/Pipe' },
      { key: 'braking_master_pump', label: 'Master Pump' },
    ]
  },
  {
    name: 'Electrical System',
    items: [
      { key: 'electrical_ignition', label: 'Ignition' },
      { key: 'electrical_battery', label: 'Battery' },
      { key: 'electrical_wiring', label: 'Wiring' },
      { key: 'electrical_instruments', label: 'Instruments' },
    ]
  },
  {
    name: 'Steering System',
    items: [
      { key: 'steering_wheel_valve', label: 'Wheel/Valve' },
      { key: 'steering_cylinder', label: 'Cylinder' },
      { key: 'steering_motor', label: 'Motor' },
      { key: 'steering_knuckle', label: 'Knuckle' },
    ]
  },
  {
    name: 'Load Handling',
    items: [
      { key: 'load_fork', label: 'Fork' },
      { key: 'load_mast_roller', label: 'Mast/Roller' },
      { key: 'load_chain_wheel', label: 'Chain/Wheel' },
      { key: 'load_cylinder', label: 'Cylinder' },
    ]
  },
  {
    name: 'Tyres',
    items: [
      { key: 'tyres_front', label: 'Front Tyres' },
      { key: 'tyres_rear', label: 'Rear Tyres' },
      { key: 'tyres_rim', label: 'Rim' },
      { key: 'tyres_screw_nut', label: 'Screw/Nut' },
    ]
  },
  {
    name: 'Wheels',
    items: [
      { key: 'wheels_drive', label: 'Drive Wheel' },
      { key: 'wheels_load', label: 'Load Wheel' },
      { key: 'wheels_support', label: 'Support Wheel' },
      { key: 'wheels_hub_nut', label: 'Hub Nut' },
    ]
  },
  {
    name: 'Safety Devices',
    items: [
      { key: 'safety_overhead_guard', label: 'Overhead Guard' },
      { key: 'safety_cabin_body', label: 'Cabin/Body' },
      { key: 'safety_backrest', label: 'Backrest' },
      { key: 'safety_seat_belt', label: 'Seat Belt' },
    ]
  },
  {
    name: 'Lighting',
    items: [
      { key: 'lighting_beacon_light', label: 'Beacon Light' },
      { key: 'lighting_horn', label: 'Horn' },
      { key: 'lighting_buzzer', label: 'Buzzer' },
      { key: 'lighting_rear_view_mirror', label: 'Rear View Mirror' },
    ]
  },
  {
    name: 'Fuel/Engine',
    items: [
      { key: 'fuel_engine_oil_level', label: 'Engine Oil Level' },
      { key: 'fuel_line_leaks', label: 'Line Leaks' },
      { key: 'fuel_radiator', label: 'Radiator' },
      { key: 'fuel_exhaust_piping', label: 'Exhaust/Piping' },
    ]
  },
  {
    name: 'Transmission',
    items: [
      { key: 'transmission_fluid_level', label: 'Fluid Level' },
      { key: 'transmission_inching_valve', label: 'Inching Valve' },
      { key: 'transmission_air_cleaner', label: 'Air Cleaner' },
      { key: 'transmission_lpg_regulator', label: 'LPG Regulator' },
    ]
  },
];

// Photo categories for ACWER workflow
export const PHOTO_CATEGORIES = [
  { value: 'before', label: 'Before', color: 'bg-blue-500' },
  { value: 'after', label: 'After', color: 'bg-green-500' },
  { value: 'spare_part', label: 'Parts', color: 'bg-amber-500' },
  { value: 'condition', label: 'Condition', color: 'bg-purple-500' },
  { value: 'evidence', label: 'Evidence', color: 'bg-red-500' },
  { value: 'other', label: 'Other', color: 'bg-slate-500' },
];

/**
 * Get the default photo category based on job status
 */
export const getDefaultPhotoCategory = (job: Job | null): MediaCategory => {
  if (!job) return 'other';
  const status = job.status;
  if (status === JobStatus.NEW || status === JobStatus.ASSIGNED) return 'before';
  if (status === JobStatus.IN_PROGRESS) {
    const startTime = job.started_at ? new Date(job.started_at) : null;
    if (startTime) {
      const now = new Date();
      const minutesSinceStart = (now.getTime() - startTime.getTime()) / (1000 * 60);
      if (minutesSinceStart <= 30) return 'before';
    }
    return 'other';
  }
  if (status === JobStatus.AWAITING_FINALIZATION) return 'after';
  return 'other';
};
