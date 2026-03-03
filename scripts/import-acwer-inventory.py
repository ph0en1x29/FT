#!/usr/bin/env python3
"""
ACWER Full Inventory Import Script
Parses CSV, auto-categorizes, and prepares for FT database import.
"""

import csv
import re
import json
import sys
from collections import defaultdict

CSV_PATH = "/home/jay/.openclaw/media/inbound/Stock_03.03.26_8.53am---1039385c-dacb-472a-aa98-fc224e74cc7f.csv"
OUTPUT_PATH = "/home/jay/FT/data/acwer-inventory-cleaned.json"
SUMMARY_PATH = "/home/jay/FT/data/acwer-category-summary.txt"

# Category rules: (keywords_in_description, category_name)
# Order matters - first match wins
CATEGORY_RULES = [
    # Lubricants first (simple)
    (lambda d, g: g == "LUBRICAN", "Oils & Fluids"),
    
    # Lithium/Battery specific
    (lambda d, g: any(k in d for k in ["LITHIUM", "LI-ION", "BMS", "REMA", "BATTERY PACK", "BATTERY METER"]), "Lithium Battery Parts"),
    (lambda d, g: any(k in d for k in ["BATTERY CONNECTOR", "BATTERY TERMINAL", "BATTERY CABLE", "BATTERY BRACKET", "BATTERY STAND", "BATTERY COVER"]), "Batteries & Power"),
    
    # Fire/Safety
    (lambda d, g: any(k in d for k in ["FIRE EXTINGUISHER", "SAFETY BELT", "SAFETY LIGHT"]), "Safety & Accessories"),
    
    # Carbon brushes
    (lambda d, g: "CARBON BRUSH" in d or "CARBON HOLDER" in d, "Carbon Brushes & Motors"),
    
    # Bearings
    (lambda d, g: any(k in d for k in ["BEARING", "ROLLER BEARING", "BALL BEARING", "TAPERED ROLLER", "MAST BEARING", "THRUST BEARING", "NILOS RING"]), "Bearings"),
    
    # Seals & Gaskets
    (lambda d, g: any(k in d for k in ["SEAL ", "SEAL,", "U SEAL", "OIL SEAL", "DUST SEAL", "WIPER SEAL", "GASKET", "O-RING", "ORING", "O RING", "PACKING", "BACK UP RING"]), "Seals & Gaskets"),
    
    # Seal kits / Cylinder kits
    (lambda d, g: any(k in d for k in ["SEAL KIT", "CYLINDER KIT", "OVERHAUL KIT", "O/H KIT", "REPAIR KIT", "CVSK"]), "Seal Kits & Repair Kits"),
    
    # Brakes
    (lambda d, g: any(k in d for k in ["BRAKE", "PARKING", "HAND BRAKE"]), "Brakes & Clutch"),
    
    # Chains
    (lambda d, g: any(k in d for k in ["CHAIN ", "CHAIN,", "CHAIN WHEEL", "CHAIN CLIP", "CHAIN PIN", "CHAIN BOLT", "ROLLER CHAIN", "SPROCKET"]), "Chains & Sprockets"),
    
    # Springs
    (lambda d, g: any(k in d for k in ["SPRING ", "SPRING,", "COMPRESSION SPRING"]) and "GAS SPRING" not in d, "Springs"),
    
    # Lighting
    (lambda d, g: any(k in d for k in ["LAMP", "BULB", "LED ", "BEACON", "HEAD LIGHT", "REAR LIGHT", "WARNING LIGHT", "LENS"]), "Lights & Bulbs"),
    
    # Fans
    (lambda d, g: d.startswith("FAN ") or "FAN DC" in d or "FAN AC" in d or "PANEL FAN" in d, "Cooling Fans"),
    
    # Filters
    (lambda d, g: any(k in d for k in ["FILTER", "STRAINER", "ELEMENT"]) and "BRACKET" not in d, "Filters"),
    
    # Fuses
    (lambda d, g: "FUSE " in d or "FUSE," in d or "FUSIBLE" in d, "Fuses"),
    
    # Electrical - switches, relays, sensors, contactors, wiring
    (lambda d, g: any(k in d for k in ["SWITCH", "RELAY", "SENSOR", "CONTACTOR", "SOLENOID", "HORN ", "HORN,",
                                         "BUZZER", "DIODE", "RECTIFIER", "TRANSISTOR", "POTENTIOMETER",
                                         "CURRENT SENSOR", "WIRE HARNESS", "CABLE LOOM", "WIRING",
                                         "DIRECTION SWITCH", "IGNITION", "KEY SWITCH", "JOYSTICK",
                                         "PUSH BUTTON", "EMERGENCY BUTTON", "MICRO SWITCH",
                                         "HOUR METER", "TACHOMETER", "DISPLAY", "METER ASSY",
                                         "METER INDICATOR", "LOG-ON UNIT", "KEYPAD", "KEY PAD"]), "Electrical"),
    
    # Hydraulic
    (lambda d, g: any(k in d for k in ["HYDRAULIC", "HYD ", "CONTROL VALVE", "LIFTING VALVE", "PUMP ASSY",
                                         "PUMP SUB", "PUMP MOTOR", "SOLENOID VALVE"]) and "SEAL" not in d and "KIT" not in d, "Hydraulic"),
    
    # Steering
    (lambda d, g: any(k in d for k in ["STEERING", "KNUCKLE", "TIE ROD", "KING PIN", "AXLE PIN",
                                         "POWER STEERING"]), "Steering"),
    
    # Engine
    (lambda d, g: any(k in d for k in ["WATER PUMP", "ALTERNATOR", "STARTER", "TIMING", "VALVE COVER",
                                         "INTAKE VALVE", "EXHAUST VALVE", "OIL PUMP", "DISTRIBUTOR",
                                         "SPARK PLUG", "GLOW PLUG", "HEATER PLUG", "RADIATOR",
                                         "THERMOSTAT", "GOVERNOR", "CARBURATOR", "CARBURETOR",
                                         "ENGINE MOUNTING", "ENGINE OIL", "FLYWHEEL", "PULLEY",
                                         "HEAD GASKET", "MANIFOLD", "EXHAUST", "MUFFER", "EX PIPE"]), "Engine Parts"),
    
    # Transmission
    (lambda d, g: any(k in d for k in ["TRANSMISSION", "GEAR SET", "GEAR,", "GEAR NO", "BEVEL GEAR",
                                         "CROWN WHEEL", "PINION", "CLUTCH", "TORQUE CONVERTER",
                                         "DISC PLATE", "STEEL PLATE", "DRUM ", "COUPLING",
                                         "GEAR BOX", "GEARBOX"]) and "OIL SEAL" not in d, "Transmission"),
    
    # Wheels & Tyres
    (lambda d, g: any(k in d for k in ["LOAD WHEEL", "DRIVE WHEEL", "SUPPORT WHEEL", "WHEEL FORK",
                                         "WHEEL HOLDER", "WHEEL BRACKET", "FORK LOCK", "TYRE",
                                         "HUB BOLT", "HUB SEAL", "HUB CAP", "HUB NUT"]), "Wheels & Tyres"),
    
    # Hoses & Fittings
    (lambda d, g: any(k in d for k in ["HOSE ", "HOSE,", "FITTING", "NIPPLE", "ELBOW", "CONNECTOR",
                                         "ADAPTOR", "PIPE ", "PIPING", "CLAMP"]) and "BRACKET" not in d, "Hoses & Fittings"),
    
    # Controllers
    (lambda d, g: any(k in d for k in ["CONTROLLER", "ENCODER", "DC CONVERTER", "BMS BOARD",
                                         "ACCELERATOR ASSY", "COMBINATION SWITCH"]), "Controllers & Electronics"),
    
    # Covers & Panels
    (lambda d, g: any(k in d for k in ["COVER ", "COVER,", "PROTECTION COVER", "PILLAR COVER",
                                         "PANEL ", "PANEL,", "BONNET", "BONET"]) and "GASKET" not in d, "Covers & Panels"),
    
    # Bushings & Shims
    (lambda d, g: any(k in d for k in ["BUSH", "SHIM ", "SHIM,", "WEAR PAD", "LINER", "NYLON PAD",
                                         "STOPPER"]) and "SEAL" not in d, "Bushings & Shims"),
    
    # Brackets & Mounting
    (lambda d, g: any(k in d for k in ["BRACKET", "MOUNTING", "MOUNT RUBBER", "DAMPER", "GAS SPRING",
                                         "GAS SUSPENSION", "CUSHION"]), "Brackets & Mounting"),
    
    # Fasteners
    (lambda d, g: any(k in d for k in ["CLIP ", "CLIP,", "SCREW", "BOLT", "NUT ", "NUT,", "WASHER",
                                         "CABLE LUG", "PIN ", "PIN,", "LOCK PIN", "RETAINING RING",
                                         "CABLE TIE"]), "Fasteners & Hardware"),
    
    # Cables & Controls
    (lambda d, g: any(k in d for k in ["CABLE ", "CABLE,", "ACCELATOR", "ACCELERATOR", "PEDAL",
                                         "LEVER ", "LEVER,", "HANDLE", "KNOB", "PADDLE", "BOOT",
                                         "RUBBER PROTECTION"]), "Cables & Controls"),
    
    # Spray & Consumables
    (lambda d, g: any(k in d for k in ["SPRAY", "COOLANT", "BRAKE FLUID", "GREASE", "EPOXY",
                                         "SILICONE", "PLUG TOP"]), "Consumables"),
    
    # LPG specific
    (lambda d, g: any(k in d for k in ["LPG", "PROPANE", "GAS CHAMBER", "VAPORISER", "VAPORIZER",
                                         "DIAPHRAGM", "IMPCO"]), "LPG Parts"),
    
    # Mirrors
    (lambda d, g: "MIRROR" in d, "Safety & Accessories"),
    
    # Catch-all
    (lambda d, g: True, "Miscellaneous"),
]


def parse_cost(cost_str):
    """Parse cost string, handling commas and empty values."""
    if not cost_str or cost_str.strip() == "":
        return None
    # Remove commas from numbers like "1,750.00"
    cleaned = cost_str.strip().replace(",", "")
    try:
        return float(cleaned)
    except ValueError:
        return None


def parse_qty(qty_str):
    """Parse quantity, handling empty and decimal values."""
    if not qty_str or qty_str.strip() == "":
        return 0
    try:
        val = float(qty_str.strip())
        return val
    except ValueError:
        return 0


def categorize(description, item_group):
    """Auto-categorize based on description keywords."""
    desc_upper = description.upper().strip()
    for rule_fn, category in CATEGORY_RULES:
        if rule_fn(desc_upper, item_group.strip().upper()):
            return category
    return "Miscellaneous"


def main():
    items = []
    skipped = 0
    duplicates = 0
    seen_codes = set()
    
    with open(CSV_PATH, 'r', encoding='utf-8', errors='replace') as f:
        reader = csv.reader(f)
        
        # Skip header rows (3 rows + column header)
        for i in range(4):
            next(reader)
        
        for row_num, row in enumerate(reader, start=5):
            if len(row) < 7:
                continue
            
            bin_loc, item_code, description, desc2, qty_str, cost_str, item_group = row[:7]
            
            # Skip empty bins
            if "EMPTY BIN" in description.upper():
                skipped += 1
                continue
            
            # Skip completely empty rows
            if not item_code.strip() and not description.strip():
                skipped += 1
                continue
            
            # Skip "LOOSE PARTS" placeholder entries
            if description.strip().startswith("LOOSE PARTS") and not item_code.strip():
                skipped += 1
                continue
            
            # Parse values
            cost = parse_cost(cost_str)
            qty = parse_qty(qty_str)
            category = categorize(description, item_group)
            
            # Check for duplicate item codes
            code = item_code.strip()
            is_duplicate = code in seen_codes
            if is_duplicate:
                duplicates += 1
            seen_codes.add(code)
            
            # Determine if liquid
            is_liquid = item_group.strip().upper() == "LUBRICAN"
            
            items.append({
                "bin": bin_loc.strip(),
                "item_code": code,
                "part_name": description.strip(),
                "description_2": desc2.strip(),
                "quantity": qty,
                "cost": cost,
                "category": category,
                "item_group": item_group.strip(),
                "is_liquid": is_liquid,
            })
    
    # Generate summary
    cat_stats = defaultdict(lambda: {"count": 0, "total_value": 0.0})
    for item in items:
        cat = item["category"]
        cat_stats[cat]["count"] += 1
        if item["cost"] is not None and item["quantity"]:
            cat_stats[cat]["total_value"] += item["cost"] * item["quantity"]
    
    grand_total_items = len(items)
    grand_total_value = sum(s["total_value"] for s in cat_stats.values())
    
    # Sort categories by count
    sorted_cats = sorted(cat_stats.items(), key=lambda x: -x[1]["count"])
    
    # Write summary
    with open(SUMMARY_PATH, 'w') as f:
        f.write("=" * 70 + "\n")
        f.write("ACWER INVENTORY - CATEGORY SUMMARY\n")
        f.write("=" * 70 + "\n\n")
        f.write(f"{'Category':<35} {'Items':>6} {'Total Value (RM)':>16}\n")
        f.write("-" * 60 + "\n")
        for cat, stats in sorted_cats:
            f.write(f"{cat:<35} {stats['count']:>6} {stats['total_value']:>16,.2f}\n")
        f.write("-" * 60 + "\n")
        f.write(f"{'TOTAL':<35} {grand_total_items:>6} {grand_total_value:>16,.2f}\n")
        f.write("\n")
        f.write(f"Skipped entries (empty bins, loose parts): {skipped}\n")
        f.write(f"Duplicate item codes: {duplicates}\n")
        f.write(f"Unique item codes: {len(seen_codes)}\n")
        f.write(f"Total categories: {len(cat_stats)}\n")
    
    # Write JSON
    import os
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, 'w') as f:
        json.dump(items, f, indent=2)
    
    # Print summary to stdout
    with open(SUMMARY_PATH) as f:
        print(f.read())
    
    print(f"\nOutput: {OUTPUT_PATH}")
    print(f"Summary: {SUMMARY_PATH}")


if __name__ == "__main__":
    main()
