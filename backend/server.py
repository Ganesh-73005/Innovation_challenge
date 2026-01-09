from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
from pymongo import MongoClient
from sentence_transformers import SentenceTransformer
import faiss
import numpy as np
from groq import Groq
from google import genai
from google.genai import types
from PIL import Image
import io
import json
import base64

app = FastAPI()

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Environment variables
MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME')
GROQ_API_KEY = os.environ.get('GROQ_API_KEY')
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')
SENTENCE_TRANSFORMER_MODEL = os.environ.get('SENTENCE_TRANSFORMER_MODEL', 'all-MiniLM-L6-v2')

# Initialize clients
mongo_client = MongoClient(MONGO_URL)
db = mongo_client[DB_NAME]
groq_client = Groq(api_key=GROQ_API_KEY)
gemini_client = genai.Client(api_key=GEMINI_API_KEY)

# Initialize SentenceTransformer
embedder = SentenceTransformer(SENTENCE_TRANSFORMER_MODEL)

# Global FAISS index
faiss_index = None
problem_ids = []

def initialize_faiss():
    """Initialize FAISS index with service problems"""
    global faiss_index, problem_ids
    
    problems = list(db.service_problems.find({}, {"_id": 0}))
    if not problems:
        return
    
    # Create embeddings for all problems
    texts = []
    for p in problems:
        text = f"{p['problem_name']} {' '.join(p['detailed_description'])}"
        texts.append(text)
        problem_ids.append(p['problem_id'])
    
    embeddings = embedder.encode(texts)
    embeddings = np.array(embeddings).astype('float32')
    
    # Create FAISS index
    dimension = embeddings.shape[1]
    faiss_index = faiss.IndexFlatL2(dimension)
    faiss_index.add(embeddings)

# Initialize on startup
@app.on_event("startup")
async def startup_event():
    initialize_faiss()

# Pydantic models
class LoginRequest(BaseModel):
    email: str
    password: str

class DiagnoseRequest(BaseModel):
    customer_id: str
    vehicle_id: str
    text: Optional[str] = None
    conversation_id: Optional[str] = None

class AnswerRequest(BaseModel):
    conversation_id: str
    customer_id: str
    answer: str

class BookingRequest(BaseModel):
    customer_id: str
    vehicle_id: str
    dealership_id: str
    conversation_id: str
    top_problems: List[Dict]

class UpdateServiceRequest(BaseModel):
    service_request_id: str
    status: Optional[str] = None
    selected_problem_id: Optional[str] = None
    allocated_labour: Optional[str] = None
    allocated_parts: Optional[List[str]] = None
    final_cost: Optional[float] = None
    final_time_minutes: Optional[int] = None

# Helper functions
def get_rag_retrieval(symptom_text: str, top_k: int = 10) -> List[Dict]:
    """RAG retrieval: Get top-k similar problems"""
    if not faiss_index:
        return []
    
    query_embedding = embedder.encode([symptom_text])
    query_embedding = np.array(query_embedding).astype('float32')
    
    distances, indices = faiss_index.search(query_embedding, top_k)
    
    results = []
    for idx, dist in zip(indices[0], distances[0]):
        if idx < len(problem_ids):
            problem_id = problem_ids[idx]
            problem = db.service_problems.find_one({"problem_id": problem_id}, {"_id": 0})
            if problem:
                results.append({
                    "problem_id": problem['problem_id'],
                    "problem_name": problem['problem_name'],
                    "description": problem['detailed_description'][0],
                    "similarity_score": float(1 / (1 + dist))
                })
    
    return results

def generate_clarification_questions(top_problems: List[Dict], asked_questions: List[str], question_num: int = 1) -> str:
    """Generate a single clarification question using Groq"""
    prompt = f"""You are an automotive diagnostic assistant. Based on these top potential problems, generate exactly 1 discriminating question to narrow down the diagnosis.

Top Problems:
{json.dumps(top_problems[:5], indent=2)}

Already Asked Questions:
{json.dumps(asked_questions, indent=2)}

Question Number: {question_num} of 3

Generate 1 NEW question that:
1. Helps distinguish between these specific problems
2. Is NOT a yes/no question
3. Asks about observable symptoms, sounds, behaviors, or conditions
4. Has NOT been asked before
5. Is specific to these potential problems

Return ONLY the question as a plain string, nothing else.
Example: "When does the noise occur - during acceleration, idling, or braking?"""

    try:
        response = groq_client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=200
        )
        
        question = response.choices[0].message.content.strip()
        # Remove quotes if present
        if question.startswith('"') and question.endswith('"'):
            question = question[1:-1]
        if question.startswith("'") and question.endswith("'"):
            question = question[1:-1]
        return question
    except Exception as e:
        print(f"Error generating questions: {e}")
        fallback_questions = [
            "When does the problem occur most frequently?",
            "Have you noticed any unusual sounds or smells?",
            "Does the issue affect vehicle performance or handling?"
        ]
        return fallback_questions[min(question_num - 1, len(fallback_questions) - 1)]

def calculate_cost_and_eta(problem_id: str, dealership_id: str) -> Dict:
    """Calculate cost and ETA for a problem at a specific dealership"""
    problem = db.service_problems.find_one({"problem_id": problem_id}, {"_id": 0})
    if not problem:
        return {"serviceable": False, "reason": "Problem not found"}
    
    # Check labour availability
    labour = db.labour.find_one({
        "dealership_id": dealership_id,
        "labour_category": problem['labour_category']
    }, {"_id": 0})
    
    if not labour:
        return {"serviceable": False, "reason": "No labour available"}
    
    # Check bay availability
    bay = db.bays.find_one({
        "dealership_id": dealership_id,
        "availability": True
    }, {"_id": 0})
    
    if not bay:
        return {"serviceable": False, "reason": "No bay available"}
    
    # Calculate parts cost
    parts_cost = 0
    parts_available = True
    total_parts_eta = 0
    
    for part_id in problem.get('parts_needed', []):
        part = db.parts.find_one({
            "dealership_id": dealership_id,
            "part_id": part_id
        }, {"_id": 0})
        
        if part:
            parts_cost += part['cost']
            if not part['in_stock']:
                parts_available = False
                total_parts_eta = max(total_parts_eta, part['eta_if_not_available_days'])
    
    # Calculate labour cost
    labour_hours = problem.get('estimated_labour_hours', 0)
    labour_cost = labour_hours * labour['hourly_rate']
    
    # Total cost
    total_cost = parts_cost + labour_cost
    
    # Calculate ETA
    base_time = problem.get('estimated_service_time_minutes', 0)
    if not labour['availability']:
        base_time += labour['eta_if_unavailable_hours'] * 60
    if not parts_available:
        base_time += total_parts_eta * 24 * 60  # Convert days to minutes
    
    return {
        "serviceable": True,
        "estimated_cost": round(total_cost, 2),
        "estimated_time_minutes": base_time,
        "parts_cost": round(parts_cost, 2),
        "labour_cost": round(labour_cost, 2),
        "parts_available": parts_available
    }

def apply_warranty_insurance(vehicle_age_months: int, problem_id: str, cost: float) -> Dict:
    """Apply warranty/insurance discounts"""
    problem = db.service_problems.find_one({"problem_id": problem_id}, {"_id": 0})
    if not problem:
        return {"discount": 0, "final_cost": cost}
    
    total_discount = 0
    
    for part_id in problem.get('parts_needed', []):
        rule = db.insurance_rules.find_one({
            "part_id": part_id,
            "max_vehicle_age_months": {"$gte": vehicle_age_months}
        }, {"_id": 0})
        
        if rule:
            part = db.parts.find_one({"part_id": part_id}, {"_id": 0})
            if part:
                discount_amount = (part['cost'] * rule['discount_percentage']) / 100
                discount_amount = min(discount_amount, part['cost'])
                total_discount += discount_amount
    
    final_cost = max(0, cost - total_discount)
    return {
        "discount": round(total_discount, 2),
        "final_cost": round(final_cost, 2)
    }

# API Endpoints

@app.get("/api/health")
def health_check():
    return {"status": "healthy", "faiss_initialized": faiss_index is not None}

@app.post("/api/auth/login")
def login(request: LoginRequest):
    """Customer login"""
    customer = db.customers.find_one(
        {"email": request.email, "password": request.password},
        {"_id": 0}
    )
    
    if not customer:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Get customer vehicles
    vehicles = list(db.vehicles.find({"customer_id": customer['customer_id']}, {"_id": 0}))
    
    return {
        "success": True,
        "customer": customer,
        "vehicles": vehicles
    }

@app.post("/api/auth/dealer-login")
def dealer_login(dealership_id: str = Form(...), password: str = Form(...)):
    """Dealer login"""
    # Simple auth - in production use proper authentication
    if password != "dealer123":
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    dealer = db.dealerships.find_one({"dealership_id": dealership_id}, {"_id": 0})
    if not dealer:
        raise HTTPException(status_code=404, detail="Dealership not found")
    
    return {"success": True, "dealer": dealer}

@app.get("/api/customers/{customer_id}/vehicles")
def get_customer_vehicles(customer_id: str):
    """Get customer vehicles"""
    vehicles = list(db.vehicles.find({"customer_id": customer_id}, {"_id": 0}))
    return {"vehicles": vehicles}

@app.post("/api/diagnose/voice")
async def diagnose_voice(
    customer_id: str = Form(...),
    vehicle_id: str = Form(...),
    conversation_id: str = Form(None),
    audio: UploadFile = File(...)
):
    """Voice input diagnosis using Whisper"""
    try:
        audio_bytes = await audio.read()
        
        # Transcribe using Groq Whisper
        transcription = groq_client.audio.transcriptions.create(
            file=("audio.m4a", audio_bytes),
            model="whisper-large-v3",
            temperature=0,
            response_format="json"
        )
        
        text = transcription.text
        
        # Process as text
        return diagnose_text(DiagnoseRequest(
            customer_id=customer_id,
            vehicle_id=vehicle_id,
            text=text,
            conversation_id=conversation_id
        ))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/diagnose/image")
async def diagnose_image(
    customer_id: str = Form(...),
    vehicle_id: str = Form(...),
    conversation_id: str = Form(None),
    image: UploadFile = File(...),
    text: str = Form(None)
):
    """Image input diagnosis using Gemini (with optional text)"""
    try:
        # Read image bytes
        image_bytes = await image.read()
        
        # Determine MIME type from filename
        filename_lower = image.filename.lower() if image.filename else ''
        if filename_lower.endswith(('.jpg', '.jpeg')):
            mime_type = "image/jpeg"
        elif filename_lower.endswith('.png'):
            mime_type = "image/png"
        elif filename_lower.endswith('.webp'):
            mime_type = "image/webp"
        elif filename_lower.endswith('.gif'):
            mime_type = "image/gif"
        else:
            # Default to JPEG
            mime_type = "image/jpeg"
        
        # Build prompt
        prompt = "Analyze this vehicle issue image and describe the visible damage, symptoms, and possible problems. Be specific and detailed."
        if text:
            prompt = f"{text}\n\n{prompt}"
        
        # Call Gemini API with new format
        response = gemini_client.models.generate_content(
            model="gemini-2.0-flash-exp",
            contents=[
                types.Part.from_bytes(
                    data=image_bytes,
                    mime_type=mime_type
                ),
                prompt
            ]
        )
        
        analysis_text = response.text
        
        # If text was provided, combine it with image analysis
        if text:
            combined_text = f"{text}\n\nBased on the image: {analysis_text}"
        else:
            combined_text = analysis_text
        
        # Process as text diagnosis
        return diagnose_text(DiagnoseRequest(
            customer_id=customer_id,
            vehicle_id=vehicle_id,
            text=combined_text,
            conversation_id=conversation_id
        ))
    except Exception as e:
        import traceback
        print(f"Error in diagnose_image: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Image diagnosis failed: {str(e)}")

@app.post("/api/diagnose/text")
def diagnose_text(request: DiagnoseRequest):
    """Text input diagnosis"""
    # Get or create conversation
    if request.conversation_id:
        conversation = db.conversations.find_one({"conversation_id": request.conversation_id}, {"_id": 0})
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        # This shouldn't happen - text endpoint should only be called for initial symptom
        # Answers should go through /api/diagnose/answer
        question_count = conversation.get('question_count', 0)
        if question_count >= 3:
            # All questions answered, return estimation
            sorted_problems = sorted(
                conversation['top_problems'],
                key=lambda x: conversation.get('problem_weights', {}).get(x['problem_id'], 0),
                reverse=True
            )
            top_3 = sorted_problems[:3]
            
            db.conversations.update_one(
                {"conversation_id": conversation['conversation_id']},
                {"$set": {"narrowed_problems": top_3}}
            )
            
            return {
                "conversation_id": conversation['conversation_id'],
                "stage": "estimation",
                "top_problems": top_3
            }
        else:
            # Return current question (shouldn't normally happen)
            asked_questions = conversation.get('asked_questions', [])
            question = generate_clarification_questions(
                conversation['top_problems'][:5],
                asked_questions,
                question_count + 1
            )
            return {
                "conversation_id": conversation['conversation_id'],
                "stage": "clarification",
                "question": question,
                "question_number": question_count + 1,
                "total_questions": 3
            }
    else:
        # New conversation
        conversation_id = f"CONV_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}"
        
        # RAG retrieval for initial query - get top 10
        top_10 = get_rag_retrieval(request.text, 10)
        
        if not top_10:
            return {
                "conversation_id": conversation_id,
                "stage": "error",
                "message": "Could not identify any potential problems. Please provide more details."
            }
        
        # Initialize weights for all problems
        problem_weights = {}
        for problem in top_10:
            problem_weights[problem['problem_id']] = problem['similarity_score']
        
        conversation = {
            "conversation_id": conversation_id,
            "customer_id": request.customer_id,
            "vehicle_id": request.vehicle_id,
            "symptom_text": request.text,
            "top_problems": top_10,
            "problem_weights": problem_weights,
            "asked_questions": [],
            "answers": [],
            "question_count": 0,
            "created_at": datetime.now(timezone.utc)
        }
        db.conversations.insert_one(conversation)
        
        # Generate first question
        question = generate_clarification_questions(top_10[:5], [], 1)
        
        return {
            "conversation_id": conversation_id,
            "stage": "clarification",
            "question": question,
            "question_number": 1,
            "total_questions": 3,
            "top_10_problems": [p['problem_name'] for p in top_10[:10]]
        }

@app.post("/api/diagnose/answer")
def answer_question(request: AnswerRequest):
    """Store answer and continue diagnosis with weight adjustment"""
    conversation = db.conversations.find_one({"conversation_id": request.conversation_id}, {"_id": 0})
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Store answer
    asked_questions = conversation.get('asked_questions', [])
    answers = conversation.get('answers', [])
    problem_weights = conversation.get('problem_weights', {})
    
    # Get the current question to store it
    current_question_count = len(asked_questions)
    current_question = generate_clarification_questions(
        conversation['top_problems'][:5],
        asked_questions,
        current_question_count + 1
    )
    
    # Use LLM to analyze answer and adjust weights
    try:
        prompt = f"""Analyze this customer answer and determine which problems are more likely.

Top Problems:
{json.dumps(conversation['top_problems'][:5], indent=2)}

Question: {current_question}
Customer Answer: {request.answer}

Return a JSON object with problem_ids as keys and weight adjustments as values (between -0.2 to +0.3).
Only include problems that are affected by this answer. Be specific based on the answer.

Example: {{"SP001": 0.2, "SP002": -0.1}}"""

        response = groq_client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=200
        )
        
        # Parse weight adjustments
        response_text = response.choices[0].message.content.strip()
        start = response_text.find('{')
        end = response_text.rfind('}') + 1
        if start >= 0 and end > start:
            adjustments = json.loads(response_text[start:end])
            for prob_id, adjustment in adjustments.items():
                if prob_id in problem_weights:
                    problem_weights[prob_id] = max(0, problem_weights[prob_id] + adjustment)
    except Exception as e:
        print(f"Error adjusting weights: {e}")
    
    # Update conversation - store both question and answer
    asked_questions.append(current_question)
    answers.append(request.answer)
    question_count = len(asked_questions)
    
    db.conversations.update_one(
        {"conversation_id": request.conversation_id},
        {"$set": {
            "asked_questions": asked_questions,
            "answers": answers,
            "question_count": question_count,
            "problem_weights": problem_weights
        }}
    )
    
    # Check if we need more questions
    if question_count < 3:
        next_question = generate_clarification_questions(
            conversation['top_problems'][:5],
            asked_questions,
            question_count + 1
        )
        
        return {
            "conversation_id": request.conversation_id,
            "stage": "clarification",
            "question": next_question,
            "question_number": question_count + 1,
            "total_questions": 3
        }
    
    # Calculate top 3 based on weights
    sorted_problems = sorted(
        conversation['top_problems'],
        key=lambda x: problem_weights.get(x['problem_id'], 0),
        reverse=True
    )
    top_3 = sorted_problems[:3]
    
    # Update conversation with narrowed problems
    db.conversations.update_one(
        {"conversation_id": request.conversation_id},
        {"$set": {"narrowed_problems": top_3}}
    )
    
    return {
        "conversation_id": request.conversation_id,
        "stage": "estimation",
        "top_problems": top_3
    }

@app.get("/api/estimate/{conversation_id}")
def get_estimates(conversation_id: str):
    """Get multi-dealer estimates for top 3 problems"""
    conversation = db.conversations.find_one({"conversation_id": conversation_id}, {"_id": 0})
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    vehicle = db.vehicles.find_one({"vehicle_id": conversation['vehicle_id']}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    dealerships = list(db.dealerships.find({}, {"_id": 0}))
    
    # Get top 3 from narrowed_problems if available, else from top_problems
    top_3 = conversation.get('narrowed_problems') or conversation.get('top_problems', [])[:3]
    
    if not top_3:
        raise HTTPException(status_code=404, detail="No problems identified")
    
    estimates = []
    for problem in top_3:
        problem_estimates = {
            "problem_id": problem['problem_id'],
            "problem_name": problem['problem_name'],
            "description": problem.get('description', ''),
            "dealerships": []
        }
        
        for dealer in dealerships:
            cost_eta = calculate_cost_and_eta(problem['problem_id'], dealer['dealership_id'])
            
            if cost_eta['serviceable']:
                # Apply warranty/insurance
                warranty_info = apply_warranty_insurance(
                    vehicle['vehicle_age_months'],
                    problem['problem_id'],
                    cost_eta['estimated_cost']
                )
                
                location = dealer.get("location", {})

                problem_estimates['dealerships'].append({
    "dealership_id": dealer['dealership_id'],
    "name": dealer['name'],
    "location": location,
    "coordinates": {
        "lat": location.get("lat"),
        "lng": location.get("lng")
    },
    "rating": dealer.get('rating', 0),
    "estimated_cost": cost_eta['estimated_cost'],
    "final_cost": warranty_info['final_cost'],
    "discount": warranty_info['discount'],
    "estimated_time_minutes": cost_eta['estimated_time_minutes'],
    "parts_available": cost_eta['parts_available']
})

        
        estimates.append(problem_estimates)
    
    return {"estimates": estimates}

@app.post("/api/bookings")
def create_booking(request: BookingRequest):
    """Create service booking with top 3 problems"""
    service_request_id = f"SR_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}"
    
    # Get vehicle info
    vehicle = db.vehicles.find_one({"vehicle_id": request.vehicle_id}, {"_id": 0})
    
    # Calculate estimates for selected dealer
    problem_details = []
    total_cost = 0
    max_time = 0
    
    for problem in request.top_problems:
        cost_eta = calculate_cost_and_eta(problem['problem_id'], request.dealership_id)
        if cost_eta.get('serviceable'):
            # Apply warranty/insurance
            warranty_info = apply_warranty_insurance(
                vehicle['vehicle_age_months'],
                problem['problem_id'],
                cost_eta['estimated_cost']
            )
            
            problem_details.append({
                "problem_id": problem['problem_id'],
                "problem_name": problem['problem_name'],
                "estimated_cost": warranty_info['final_cost'],
                "estimated_time_minutes": cost_eta['estimated_time_minutes'],
                "discount": warranty_info['discount']
            })
            
            total_cost += warranty_info['final_cost']
            max_time = max(max_time, cost_eta['estimated_time_minutes'])
    
    service_request = {
        "service_request_id": service_request_id,
        "customer_id": request.customer_id,
        "vehicle_id": request.vehicle_id,
        "dealership_id": request.dealership_id,
        "conversation_id": request.conversation_id,
        "top_problems": problem_details,
        "selected_problem": None,  # Dealer will select
        "allocated_labour": None,
        "allocated_parts": [],
        "final_cost": total_cost,
        "final_time_minutes": max_time,
        "status": "Requested",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    db.service_requests.insert_one(service_request)
    
    return {"success": True, "service_request_id": service_request_id}


@app.get("/api/customers/{customer_id}/services")
def get_customer_services(customer_id: str):
    """Get customer service requests"""
    services = list(db.service_requests.find({"customer_id": customer_id}, {"_id": 0}).sort("created_at", -1))
    
    # Enrich with dealer info
    for service in services:
        dealer = db.dealerships.find_one({"dealership_id": service['dealership_id']}, {"_id": 0})
        if dealer:
            service['dealership_name'] = dealer['name']
            service['dealership_location'] = dealer.get('location', {})
        
        # Get vehicle info
        vehicle = db.vehicles.find_one({"vehicle_id": service['vehicle_id']}, {"_id": 0})
        if vehicle:
            service['vehicle_model'] = vehicle['model']
            service['vehicle_registration'] = vehicle['registration_number']
    
    return {"services": services}

@app.get("/api/dealers/{dealership_id}/services")
def get_dealer_services(dealership_id: str):
    """Get dealer service requests"""
    services = list(db.service_requests.find({"dealership_id": dealership_id}, {"_id": 0}).sort("created_at", -1))
    
    # Enrich with customer and vehicle info
    for service in services:
        customer = db.customers.find_one({"customer_id": service['customer_id']}, {"_id": 0})
        vehicle = db.vehicles.find_one({"vehicle_id": service['vehicle_id']}, {"_id": 0})
        if customer:
            service['customer_name'] = customer['name']
            service['customer_phone'] = customer['phone']
        if vehicle:
            service['vehicle_model'] = vehicle['model']
            service['vehicle_registration'] = vehicle['registration_number']
    
    return {"services": services}

@app.get("/api/services/{service_request_id}")
def get_service_detail(service_request_id: str):
    """Get service request detail by ID"""
    service = db.service_requests.find_one({"service_request_id": service_request_id}, {"_id": 0})
    if not service:
        raise HTTPException(status_code=404, detail="Service request not found")
    
    # Enrich with customer, vehicle, and dealer info
    customer = db.customers.find_one({"customer_id": service['customer_id']}, {"_id": 0})
    vehicle = db.vehicles.find_one({"vehicle_id": service['vehicle_id']}, {"_id": 0})
    dealer = db.dealerships.find_one({"dealership_id": service['dealership_id']}, {"_id": 0})
    
    if customer:
        service['customer_name'] = customer['name']
        service['customer_phone'] = customer['phone']
        service['customer_email'] = customer.get('email', '')
    if vehicle:
        service['vehicle_model'] = vehicle['model']
        service['vehicle_registration'] = vehicle['registration_number']
        service['vehicle_year'] = vehicle.get('year', '')
        service['vehicle_color'] = vehicle.get('color', '')
    if dealer:
        service['dealership_name'] = dealer['name']
        service['dealership_location'] = dealer.get('location', {})
    
    return {"service": service}

@app.get("/api/problems/search")
def search_problems(query: str, limit: int = 20):
    """Search problems by name, description, or problem_id"""
    # Check if query is a problem_id
    problem_id_match = None
    if query.startswith("SP") or query.startswith("PROB_"):
        problem_id_match = db.service_problems.find_one({"problem_id": query}, {"_id": 0})
    
    # Build search query
    search_query = {
        "$or": [
            {"problem_name": {"$regex": query, "$options": "i"}},
            {"detailed_description": {"$regex": query, "$options": "i"}},
            {"problem_id": {"$regex": query, "$options": "i"}}
        ]
    }
    
    problems = list(db.service_problems.find(search_query, {"_id": 0}).limit(limit))
    
    # If exact problem_id match found, prioritize it
    if problem_id_match and problem_id_match not in problems:
        problems.insert(0, problem_id_match)
    
    return {"problems": problems[:limit]}

@app.get("/api/dealers/{dealership_id}/labour")
def get_dealer_labour(dealership_id: str):
    """Get available labour for dealer"""
    labour = list(db.labour.find({"dealership_id": dealership_id}, {"_id": 0}))
    return {"labour": labour}

@app.get("/api/dealers/{dealership_id}/parts")
def get_dealer_parts(dealership_id: str, problem_id: str = None):
    """Get available parts for dealer"""
    if problem_id:
        problem = db.service_problems.find_one({"problem_id": problem_id}, {"_id": 0})
        if problem:
            part_ids = problem.get('parts_needed', [])
            parts = list(db.parts.find({
                "dealership_id": dealership_id,
                "part_id": {"$in": part_ids}
            }, {"_id": 0}))
            return {"parts": parts}
    
    parts = list(db.parts.find({"dealership_id": dealership_id}, {"_id": 0}).limit(50))
    return {"parts": parts}

@app.put("/api/services/{service_request_id}")
def update_service(service_request_id: str, request: UpdateServiceRequest):
    """Dealer updates service request"""
    update_data = {"updated_at": datetime.now(timezone.utc)}
    
    if request.status:
        update_data['status'] = request.status
    if request.selected_problem_id:
        # Get problem details
        problem = db.service_problems.find_one({"problem_id": request.selected_problem_id}, {"_id": 0})
        if problem:
            update_data['selected_problem'] = {
                "problem_id": problem['problem_id'],
                "problem_name": problem['problem_name'],
                "description": problem.get('detailed_description', [''])[0] if problem.get('detailed_description') else ''
            }
            # Auto-calculate cost and time if not provided
            if request.final_cost is None or request.final_time_minutes is None:
                service = db.service_requests.find_one({"service_request_id": service_request_id}, {"_id": 0})
                if service:
                    vehicle = db.vehicles.find_one({"vehicle_id": service['vehicle_id']}, {"_id": 0})
                    if vehicle:
                        cost_eta = calculate_cost_and_eta(problem['problem_id'], service['dealership_id'])
                        if request.final_cost is None:
                            warranty_info = apply_warranty_insurance(
                                vehicle['vehicle_age_months'],
                                problem['problem_id'],
                                cost_eta['estimated_cost']
                            )
                            update_data['final_cost'] = warranty_info['final_cost']
                        if request.final_time_minutes is None:
                            update_data['final_time_minutes'] = cost_eta['estimated_time_minutes']
    if request.allocated_labour:
        update_data['allocated_labour'] = request.allocated_labour
    if request.allocated_parts:
        update_data['allocated_parts'] = request.allocated_parts
    if request.final_cost is not None:
        update_data['final_cost'] = request.final_cost
    if request.final_time_minutes is not None:
        update_data['final_time_minutes'] = request.final_time_minutes
    
    result = db.service_requests.update_one(
        {"service_request_id": service_request_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Service request not found")
    
    return {"success": True}

@app.get("/api/dealerships")
def get_dealerships():
    """Get all dealerships"""
    dealerships = list(db.dealerships.find({}, {"_id": 0}))
    return {"dealerships": dealerships}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)