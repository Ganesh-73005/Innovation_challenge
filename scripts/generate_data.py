import json
import random
from datetime import datetime, timedelta
from pymongo import MongoClient
import os
from bson import ObjectId
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/backend/.env')

# MongoDB connection
MONGODB_URI = os.environ.get('MONGODB_URI')
DB_NAME = os.environ.get('MONGODB_DB_NAME', 'automotive_db')

print(f"Connecting to MongoDB: {MONGODB_URI}")
print(f"Database: {DB_NAME}")

client = MongoClient(MONGODB_URI)
db = client[DB_NAME]

# Load base data from files
with open('/app/data/service_problems.json', 'r') as f:
    BASE_PROBLEMS = json.load(f)

with open('/app/data/parts_model.json', 'r') as f:
    BASE_PARTS = json.load(f)

with open('/app/data/labour.json', 'r') as f:
    BASE_LABOUR = json.load(f)

with open('/app/data/bay_area.json', 'r') as f:
    BASE_BAYS = json.load(f)

with open('/app/data/insurance_rules.json', 'r') as f:
    BASE_INSURANCE = json.load(f)

# Dealership data
DEALERSHIPS = [
    {
        "dealership_id": "DEALER_001",
        "name": "AutoCare Mumbai Central",
        "location": {"lat": 19.0760, "lng": 72.8777, "address": "123 Marine Drive, Mumbai, MH 400020"},
        "phone": "+91-22-2345-6789",
        "email": "mumbai@autocare.in",
        "rating": 4.5
    },
    {
        "dealership_id": "DEALER_002",
        "name": "ServiceMax Delhi",
        "location": {"lat": 28.6139, "lng": 77.2090, "address": "456 Connaught Place, New Delhi, DL 110001"},
        "phone": "+91-11-2345-6789",
        "email": "delhi@servicemax.in",
        "rating": 4.7
    },
    {
        "dealership_id": "DEALER_003",
        "name": "Elite Motors Bangalore",
        "location": {"lat": 12.9716, "lng": 77.5946, "address": "789 MG Road, Bangalore, KA 560001"},
        "phone": "+91-80-2345-6789",
        "email": "bangalore@elitemotors.in",
        "rating": 4.8
    },
    {
        "dealership_id": "DEALER_004",
        "name": "SpeedTech Hyderabad",
        "location": {"lat": 17.3850, "lng": 78.4867, "address": "321 Banjara Hills, Hyderabad, TG 500034"},
        "phone": "+91-40-2345-6789",
        "email": "hyderabad@speedtech.in",
        "rating": 4.6
    },
    {
        "dealership_id": "DEALER_005",
        "name": "ProService Chennai",
        "location": {"lat": 13.0827, "lng": 80.2707, "address": "654 Anna Salai, Chennai, TN 600002"},
        "phone": "+91-44-2345-6789",
        "email": "chennai@proservice.in",
        "rating": 4.4
    }
]

# Vehicle models
VEHICLE_MODELS = [
    "Model A", "Model B", "Model C", "Model D", "Model E", "Model F",
    "Model G", "Model H", "Model I", "Model J", "Model K", "Model L"
]

def generate_dealership_data():
    """Generate dealership-specific data with variations"""
    print("Generating dealership data...")
    
    for dealer in DEALERSHIPS:
        dealer_id = dealer['dealership_id']
        
        # Vary parts availability and pricing per dealer (±15%)
        dealer_parts = []
        for part in BASE_PARTS[:100]:  # Use first 100 unique parts
            dealer_part = part.copy()
            dealer_part['dealership_id'] = dealer_id
            dealer_part['cost'] = round(part['cost'] * random.uniform(0.85, 1.15), 2)
            dealer_part['in_stock'] = random.choice([True, False]) if random.random() > 0.3 else True
            dealer_part['eta_if_not_available_days'] = random.randint(2, 10) if not dealer_part['in_stock'] else 0
            dealer_parts.append(dealer_part)
        
        # Vary labour rates per dealer (±10%)
        dealer_labour = []
        for labour in BASE_LABOUR[:50]:  # Use first 50 unique labour entries
            dealer_labour_entry = labour.copy()
            dealer_labour_entry['dealership_id'] = dealer_id
            dealer_labour_entry['hourly_rate'] = round(labour['hourly_rate'] * random.uniform(0.90, 1.10), 2)
            dealer_labour_entry['availability'] = random.choice([True, False]) if random.random() > 0.25 else True
            dealer_labour_entry['eta_if_unavailable_hours'] = random.randint(2, 8) if not dealer_labour_entry['availability'] else 0
            dealer_labour.append(dealer_labour_entry)
        
        # Distribute bays per dealer
        dealer_bays = []
        for bay in BASE_BAYS[:20]:  # 20 bays per dealer
            dealer_bay = bay.copy()
            dealer_bay['dealership_id'] = dealer_id
            dealer_bay['availability'] = random.choice([True, False]) if random.random() > 0.3 else True
            dealer_bay['eta_if_unavailable_minutes'] = random.randint(15, 60) if not dealer_bay['availability'] else 0
            dealer_bays.append(dealer_bay)
        
        # Insert dealer-specific data
        if dealer_parts:
            db.parts.insert_many(dealer_parts)
        if dealer_labour:
            db.labour.insert_many(dealer_labour)
        if dealer_bays:
            db.bays.insert_many(dealer_bays)
    
    # Insert dealerships
    db.dealerships.insert_many(DEALERSHIPS)
    print(f"✓ Inserted {len(DEALERSHIPS)} dealerships")
    print(f"✓ Inserted parts, labour, and bays for all dealers")

def generate_service_problems():
    """Insert service problems (shared across all dealers)"""
    print("Generating service problems...")
    db.service_problems.insert_many(BASE_PROBLEMS)
    print(f"✓ Inserted {len(BASE_PROBLEMS)} service problems")

def generate_insurance_rules():
    """Insert insurance rules"""
    print("Generating insurance rules...")
    db.insurance_rules.insert_many(BASE_INSURANCE[:100])  # Use first 100
    print(f"✓ Inserted insurance rules")

def generate_customers_and_vehicles():
    """Generate synthetic customers and their vehicles"""
    print("Generating customers and vehicles...")
    
    first_names = ["Rajesh", "Priya", "Amit", "Sneha", "Vikram", "Anita", "Suresh", "Divya", "Karan", "Pooja"]
    last_names = ["Sharma", "Kumar", "Patel", "Singh", "Reddy", "Gupta", "Joshi", "Mehta", "Iyer", "Nair"]
    
    customers = []
    vehicles = []
    
    for i in range(50):  # Generate 50 customers
        customer_id = f"CUST_{str(i+1).zfill(4)}"
        first_name = random.choice(first_names)
        last_name = random.choice(last_names)
        
        customer = {
            "customer_id": customer_id,
            "name": f"{first_name} {last_name}",
            "email": f"{first_name.lower()}.{last_name.lower()}{i}@email.com",
            "phone": f"+91-{random.randint(70,99)}{random.randint(1000,9999)}{random.randint(1000,9999)}",
            "password": "password123",  # In production, this should be hashed
            "created_at": datetime.utcnow()
        }
        customers.append(customer)
        
        # Each customer has 1-2 vehicles
        num_vehicles = random.randint(1, 2)
        for v in range(num_vehicles):
            vehicle_id = f"VEH_{str(i+1).zfill(4)}_{v+1}"
            purchase_date = datetime.utcnow() - timedelta(days=random.randint(30, 2000))
            vehicle_age_months = int((datetime.utcnow() - purchase_date).days / 30)
            
            vehicle = {
                "vehicle_id": vehicle_id,
                "customer_id": customer_id,
                "model": random.choice(VEHICLE_MODELS),
                "registration_number": f"{random.choice(['MH', 'DL', 'KA', 'TN', 'TG'])}{random.randint(1,99)} {random.choice(['A', 'B', 'C', 'D'])}{random.choice(['A', 'B', 'C', 'D'])} {random.randint(1000,9999)}",
                "year": 2024 - int(vehicle_age_months / 12),
                "color": random.choice(["White", "Black", "Silver", "Red", "Blue"]),
                "purchase_date": purchase_date,
                "vehicle_age_months": vehicle_age_months,
                "created_at": datetime.utcnow()
            }
            vehicles.append(vehicle)
    
    db.customers.insert_many(customers)
    db.vehicles.insert_many(vehicles)
    print(f"✓ Inserted {len(customers)} customers")
    print(f"✓ Inserted {len(vehicles)} vehicles")

def generate_sample_service_requests():
    """Generate some sample service requests for demo"""
    print("Generating sample service requests...")
    
    statuses = ["Requested", "Approved", "In Progress", "Completed"]
    vehicles = list(db.vehicles.find().limit(10))
    
    service_requests = []
    for i, vehicle in enumerate(vehicles):
        dealer = random.choice(DEALERSHIPS)
        problem = random.choice(BASE_PROBLEMS[:50])
        
        created_at = datetime.utcnow() - timedelta(days=random.randint(0, 30))
        status = random.choice(statuses)
        
        service_request = {
            "service_request_id": f"SR_{str(i+1).zfill(6)}",
            "customer_id": vehicle['customer_id'],
            "vehicle_id": vehicle['vehicle_id'],
            "dealership_id": dealer['dealership_id'],
            "problem_id": problem['problem_id'],
            "problem_name": problem['problem_name'],
            "symptoms": problem['detailed_description'][0],
            "estimated_cost": random.randint(3000, 25000),
            "estimated_time_minutes": random.randint(60, 300),
            "status": status,
            "created_at": created_at,
            "updated_at": datetime.utcnow()
        }
        service_requests.append(service_request)
    
    db.service_requests.insert_many(service_requests)
    print(f"✓ Inserted {len(service_requests)} sample service requests")

def main():
    """Main execution"""
    print("\n" + "="*60)
    print("AUTOMOTIVE SERVICE DATA GENERATION")
    print("="*60 + "\n")
    
    # Clear existing data
    print("Clearing existing data...")
    db.dealerships.delete_many({})
    db.parts.delete_many({})
    db.labour.delete_many({})
    db.bays.delete_many({})
    db.service_problems.delete_many({})
    db.insurance_rules.delete_many({})
    db.customers.delete_many({})
    db.vehicles.delete_many({})
    db.service_requests.delete_many({})
    db.conversations.delete_many({})
    print("✓ Cleared existing collections\n")
    
    # Generate all data
    generate_dealership_data()
    generate_service_problems()
    generate_insurance_rules()
    generate_customers_and_vehicles()
    generate_sample_service_requests()
    
    print("\n" + "="*60)
    print("DATA GENERATION COMPLETE")
    print("="*60)
    print(f"\nMongoDB: {DB_NAME}")
    print(f"Dealerships: {db.dealerships.count_documents({})}")
    print(f"Service Problems: {db.service_problems.count_documents({})}")
    print(f"Parts: {db.parts.count_documents({})}")
    print(f"Labour: {db.labour.count_documents({})}")
    print(f"Bays: {db.bays.count_documents({})}")
    print(f"Customers: {db.customers.count_documents({})}")
    print(f"Vehicles: {db.vehicles.count_documents({})}")
    print(f"Service Requests: {db.service_requests.count_documents({})}")
    print("\n" + "="*60 + "\n")

if __name__ == "__main__":
    main()
