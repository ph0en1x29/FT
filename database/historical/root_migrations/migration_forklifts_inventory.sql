-- =====================================================
-- FIELDPRO FORKLIFT SERVICE MANAGEMENT - DATABASE MIGRATION
-- Run this in Supabase SQL Editor
-- =====================================================

-- =====================================================
-- 1. CREATE FORKLIFTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS forklifts (
    forklift_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    serial_number VARCHAR(100) NOT NULL UNIQUE,
    make VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'Diesel', -- Electric, Diesel, LPG, Petrol
    hourmeter INTEGER NOT NULL DEFAULT 0,
    year INTEGER,
    capacity_kg INTEGER,
    location VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'Active', -- Active, Under Maintenance, Inactive
    last_service_date TIMESTAMPTZ,
    next_service_due TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster searches
CREATE INDEX IF NOT EXISTS idx_forklifts_serial ON forklifts(serial_number);
CREATE INDEX IF NOT EXISTS idx_forklifts_make ON forklifts(make);
CREATE INDEX IF NOT EXISTS idx_forklifts_type ON forklifts(type);
CREATE INDEX IF NOT EXISTS idx_forklifts_status ON forklifts(status);

-- =====================================================
-- 2. UPDATE JOBS TABLE - Add forklift reference
-- =====================================================
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS forklift_id UUID REFERENCES forklifts(forklift_id) ON DELETE SET NULL;

ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS hourmeter_reading INTEGER;

-- Create index for forklift lookups
CREATE INDEX IF NOT EXISTS idx_jobs_forklift ON jobs(forklift_id);

-- =====================================================
-- 3. CLEAR OLD INVENTORY & ADD FORKLIFT PARTS
-- =====================================================

-- First, delete existing parts (if you want fresh start)
-- WARNING: This will delete ALL existing parts!
DELETE FROM parts;

-- Insert forklift service parts organized by category
INSERT INTO parts (part_name, part_code, category, cost_price, sell_price, warranty_months, stock_quantity) VALUES

-- ENGINE & FUEL SYSTEM
('Engine Oil Filter', 'ENG-OIL-001', 'Engine & Fuel', 25.00, 45.00, 3, 50),
('Hydraulic Oil Filter', 'ENG-HYD-001', 'Engine & Fuel', 35.00, 65.00, 3, 40),
('Air Filter Element', 'ENG-AIR-001', 'Engine & Fuel', 40.00, 75.00, 6, 35),
('Fuel Filter', 'ENG-FUEL-001', 'Engine & Fuel', 30.00, 55.00, 3, 45),
('Diesel Injector', 'ENG-INJ-001', 'Engine & Fuel', 280.00, 450.00, 12, 15),
('Fuel Pump', 'ENG-PUMP-001', 'Engine & Fuel', 450.00, 750.00, 12, 8),
('Spark Plug (LPG/Petrol)', 'ENG-SPK-001', 'Engine & Fuel', 15.00, 35.00, 6, 60),
('Engine Gasket Set', 'ENG-GSK-001', 'Engine & Fuel', 180.00, 320.00, 12, 10),
('Radiator Cap', 'ENG-RAD-001', 'Engine & Fuel', 20.00, 45.00, 6, 25),
('Thermostat', 'ENG-THR-001', 'Engine & Fuel', 45.00, 85.00, 12, 20),
('Water Pump', 'ENG-WPM-001', 'Engine & Fuel', 220.00, 380.00, 12, 12),
('Fan Belt', 'ENG-FAN-001', 'Engine & Fuel', 35.00, 65.00, 6, 30),
('Alternator Belt', 'ENG-ALT-001', 'Engine & Fuel', 40.00, 75.00, 6, 25),
('Radiator Hose (Upper)', 'ENG-HOS-001', 'Engine & Fuel', 55.00, 95.00, 6, 20),
('Radiator Hose (Lower)', 'ENG-HOS-002', 'Engine & Fuel', 55.00, 95.00, 6, 20),

-- HYDRAULIC SYSTEM
('Hydraulic Pump', 'HYD-PMP-001', 'Hydraulic System', 1200.00, 1850.00, 12, 5),
('Hydraulic Cylinder Seal Kit', 'HYD-SEL-001', 'Hydraulic System', 85.00, 150.00, 6, 25),
('Lift Cylinder Seal Kit', 'HYD-LFT-001', 'Hydraulic System', 120.00, 200.00, 6, 20),
('Tilt Cylinder Seal Kit', 'HYD-TLT-001', 'Hydraulic System', 100.00, 175.00, 6, 20),
('Hydraulic Hose 1/2"', 'HYD-HOS-001', 'Hydraulic System', 45.00, 85.00, 6, 30),
('Hydraulic Hose 3/4"', 'HYD-HOS-002', 'Hydraulic System', 55.00, 100.00, 6, 25),
('Hydraulic Oil (20L)', 'HYD-OIL-001', 'Hydraulic System', 180.00, 280.00, 0, 20),
('Control Valve', 'HYD-VLV-001', 'Hydraulic System', 650.00, 980.00, 12, 6),
('Hydraulic Tank Breather', 'HYD-BRE-001', 'Hydraulic System', 25.00, 50.00, 3, 35),
('Pressure Relief Valve', 'HYD-PRV-001', 'Hydraulic System', 180.00, 300.00, 12, 10),

-- TRANSMISSION & DRIVETRAIN
('Transmission Filter', 'TRN-FIL-001', 'Transmission', 45.00, 85.00, 3, 30),
('Transmission Oil (5L)', 'TRN-OIL-001', 'Transmission', 95.00, 150.00, 0, 25),
('Drive Axle Seal', 'TRN-AXL-001', 'Transmission', 35.00, 65.00, 6, 20),
('Torque Converter', 'TRN-TRQ-001', 'Transmission', 1800.00, 2800.00, 12, 3),
('Clutch Disc', 'TRN-CLU-001', 'Transmission', 280.00, 450.00, 12, 8),
('Clutch Pressure Plate', 'TRN-PRS-001', 'Transmission', 320.00, 520.00, 12, 6),
('Differential Bearing', 'TRN-BRG-001', 'Transmission', 120.00, 200.00, 12, 12),

-- BRAKES
('Brake Shoe Set', 'BRK-SHO-001', 'Brakes', 180.00, 300.00, 12, 15),
('Brake Drum', 'BRK-DRM-001', 'Brakes', 220.00, 380.00, 12, 10),
('Brake Master Cylinder', 'BRK-MST-001', 'Brakes', 280.00, 450.00, 12, 8),
('Brake Wheel Cylinder', 'BRK-WHL-001', 'Brakes', 85.00, 150.00, 12, 20),
('Parking Brake Cable', 'BRK-CBL-001', 'Brakes', 65.00, 120.00, 6, 15),
('Brake Fluid (1L)', 'BRK-FLD-001', 'Brakes', 25.00, 45.00, 0, 40),

-- STEERING
('Steering Cylinder', 'STR-CYL-001', 'Steering', 450.00, 720.00, 12, 6),
('Steering Wheel', 'STR-WHL-001', 'Steering', 120.00, 200.00, 12, 10),
('Steering Column Bearing', 'STR-BRG-001', 'Steering', 55.00, 95.00, 12, 15),
('Power Steering Pump', 'STR-PMP-001', 'Steering', 380.00, 600.00, 12, 5),
('Tie Rod End', 'STR-TIE-001', 'Steering', 75.00, 130.00, 12, 20),
('Steering Knuckle', 'STR-KNU-001', 'Steering', 280.00, 450.00, 12, 6),

-- MAST & FORKS
('Fork (Pair)', 'MST-FRK-001', 'Mast & Forks', 850.00, 1350.00, 24, 4),
('Fork Extension (Pair)', 'MST-EXT-001', 'Mast & Forks', 450.00, 720.00, 24, 6),
('Mast Roller', 'MST-ROL-001', 'Mast & Forks', 85.00, 150.00, 12, 25),
('Mast Chain', 'MST-CHN-001', 'Mast & Forks', 320.00, 520.00, 12, 10),
('Chain Anchor Pin', 'MST-PIN-001', 'Mast & Forks', 25.00, 50.00, 6, 30),
('Carriage Roller', 'MST-CAR-001', 'Mast & Forks', 75.00, 130.00, 12, 20),
('Side Shifter Cylinder', 'MST-SHF-001', 'Mast & Forks', 480.00, 780.00, 12, 4),
('Fork Positioner Cylinder', 'MST-POS-001', 'Mast & Forks', 520.00, 850.00, 12, 4),

-- TYRES & WHEELS
('Pneumatic Tyre (Front)', 'TYR-PNF-001', 'Tyres & Wheels', 280.00, 450.00, 12, 12),
('Pneumatic Tyre (Rear)', 'TYR-PNR-001', 'Tyres & Wheels', 220.00, 380.00, 12, 12),
('Solid Tyre (Front)', 'TYR-SDF-001', 'Tyres & Wheels', 380.00, 600.00, 18, 8),
('Solid Tyre (Rear)', 'TYR-SDR-001', 'Tyres & Wheels', 320.00, 520.00, 18, 8),
('Wheel Rim', 'TYR-RIM-001', 'Tyres & Wheels', 180.00, 300.00, 24, 6),
('Wheel Stud', 'TYR-STD-001', 'Tyres & Wheels', 8.00, 18.00, 12, 100),
('Wheel Nut', 'TYR-NUT-001', 'Tyres & Wheels', 5.00, 12.00, 12, 150),

-- ELECTRICAL (Diesel/LPG/Petrol)
('Starter Motor', 'ELC-STR-001', 'Electrical', 380.00, 600.00, 12, 6),
('Alternator', 'ELC-ALT-001', 'Electrical', 320.00, 520.00, 12, 8),
('Ignition Switch', 'ELC-IGN-001', 'Electrical', 65.00, 120.00, 12, 15),
('Battery 12V', 'ELC-BAT-001', 'Electrical', 280.00, 420.00, 12, 10),
('Headlight Bulb', 'ELC-HLB-001', 'Electrical', 15.00, 35.00, 3, 50),
('Rear Light Assembly', 'ELC-RLT-001', 'Electrical', 85.00, 150.00, 6, 12),
('Horn', 'ELC-HRN-001', 'Electrical', 35.00, 65.00, 6, 20),
('Reverse Buzzer', 'ELC-BUZ-001', 'Electrical', 25.00, 50.00, 6, 25),
('Fuse Box', 'ELC-FUS-001', 'Electrical', 45.00, 85.00, 12, 15),
('Wiring Harness', 'ELC-WIR-001', 'Electrical', 280.00, 450.00, 12, 5),
('Neutral Safety Switch', 'ELC-NSS-001', 'Electrical', 55.00, 100.00, 12, 15),
('Seat Switch', 'ELC-SSW-001', 'Electrical', 45.00, 85.00, 12, 20),

-- ELECTRIC FORKLIFT SPECIFIC
('Drive Motor (Electric)', 'ELF-MOT-001', 'Electric Forklift', 2800.00, 4200.00, 24, 2),
('Pump Motor (Electric)', 'ELF-PMP-001', 'Electric Forklift', 1800.00, 2800.00, 24, 3),
('Motor Brush Set', 'ELF-BRS-001', 'Electric Forklift', 120.00, 200.00, 6, 20),
('Controller (Curtis/Zapi)', 'ELF-CTR-001', 'Electric Forklift', 1500.00, 2400.00, 12, 4),
('Contactor', 'ELF-CON-001', 'Electric Forklift', 180.00, 300.00, 12, 10),
('Battery Charger', 'ELF-CHG-001', 'Electric Forklift', 1200.00, 1850.00, 12, 3),
('Battery Cell', 'ELF-CEL-001', 'Electric Forklift', 350.00, 550.00, 12, 15),
('Battery Connector', 'ELF-BTC-001', 'Electric Forklift', 85.00, 150.00, 12, 12),
('Accelerator Potentiometer', 'ELF-ACC-001', 'Electric Forklift', 120.00, 200.00, 12, 10),
('DC/DC Converter', 'ELF-DCC-001', 'Electric Forklift', 280.00, 450.00, 12, 6),

-- SAFETY & OPERATOR COMFORT
('Seat Assembly', 'SAF-SEA-001', 'Safety & Comfort', 450.00, 720.00, 12, 5),
('Seat Belt', 'SAF-BLT-001', 'Safety & Comfort', 65.00, 120.00, 12, 15),
('Overhead Guard', 'SAF-OHG-001', 'Safety & Comfort', 850.00, 1350.00, 24, 3),
('Load Backrest', 'SAF-LBR-001', 'Safety & Comfort', 380.00, 600.00, 24, 4),
('Rear View Mirror', 'SAF-MIR-001', 'Safety & Comfort', 35.00, 65.00, 6, 25),
('Blue Safety Light', 'SAF-BSL-001', 'Safety & Comfort', 85.00, 150.00, 12, 15),
('Strobe Light', 'SAF-STB-001', 'Safety & Comfort', 55.00, 100.00, 12, 20),
('Fire Extinguisher Bracket', 'SAF-FEB-001', 'Safety & Comfort', 25.00, 50.00, 24, 30),

-- CONSUMABLES & FLUIDS
('Engine Oil 15W40 (5L)', 'CON-EO1-001', 'Consumables', 85.00, 130.00, 0, 30),
('Engine Oil 10W30 (5L)', 'CON-EO2-001', 'Consumables', 95.00, 145.00, 0, 25),
('Coolant (5L)', 'CON-COL-001', 'Consumables', 45.00, 75.00, 0, 35),
('Grease Cartridge', 'CON-GRS-001', 'Consumables', 15.00, 30.00, 0, 100),
('Chain Lubricant', 'CON-CLB-001', 'Consumables', 25.00, 45.00, 0, 40),
('Contact Cleaner', 'CON-CTC-001', 'Consumables', 18.00, 35.00, 0, 50),
('Battery Water (5L)', 'CON-BTW-001', 'Consumables', 12.00, 25.00, 0, 40),
('Gasket Maker', 'CON-GSM-001', 'Consumables', 22.00, 42.00, 0, 30),
('Thread Locker', 'CON-THL-001', 'Consumables', 18.00, 35.00, 0, 35);

-- =====================================================
-- 4. SAMPLE FORKLIFT DATA (Optional - for testing)
-- =====================================================
-- Uncomment the lines below to add sample forklifts

/*
INSERT INTO forklifts (serial_number, make, model, type, hourmeter, year, capacity_kg, location, status) VALUES
('FL-2024-001', 'Toyota', '8FGU25', 'LPG', 3450, 2020, 2500, 'Warehouse A', 'Active'),
('FL-2024-002', 'Toyota', '8FBE18', 'Electric', 2100, 2021, 1800, 'Warehouse A', 'Active'),
('FL-2024-003', 'Komatsu', 'FD25T-17', 'Diesel', 5200, 2018, 2500, 'Warehouse B', 'Active'),
('FL-2024-004', 'Hyster', 'H2.5FT', 'Diesel', 4800, 2019, 2500, 'Warehouse B', 'Active'),
('FL-2024-005', 'Crown', 'FC5245-50', 'Electric', 1800, 2022, 2250, 'Cold Storage', 'Active'),
('FL-2024-006', 'Nissan', '1F2A25U', 'LPG', 6100, 2017, 2500, 'Loading Bay', 'Under Maintenance'),
('FL-2024-007', 'Caterpillar', 'DP25N', 'Diesel', 7500, 2016, 2500, 'Outdoor Yard', 'Active'),
('FL-2024-008', 'Linde', 'H25D', 'Diesel', 4200, 2019, 2500, 'Warehouse C', 'Active'),
('FL-2024-009', 'Jungheinrich', 'EFG 220', 'Electric', 2800, 2020, 2000, 'Warehouse A', 'Active'),
('FL-2024-010', 'Toyota', '7FBE15', 'Electric', 1500, 2023, 1500, 'Office Warehouse', 'Active');
*/

-- =====================================================
-- 5. ENABLE ROW LEVEL SECURITY (RLS)
-- =====================================================
ALTER TABLE forklifts ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read forklifts
CREATE POLICY "Allow read access for authenticated users" ON forklifts
    FOR SELECT TO authenticated USING (true);

-- Allow all authenticated users to insert/update/delete forklifts
CREATE POLICY "Allow full access for authenticated users" ON forklifts
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =====================================================
-- 6. CREATE UPDATED_AT TRIGGER
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_forklifts_updated_at ON forklifts;
CREATE TRIGGER update_forklifts_updated_at
    BEFORE UPDATE ON forklifts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- DONE! Your database is now ready for forklift service management
-- =====================================================
