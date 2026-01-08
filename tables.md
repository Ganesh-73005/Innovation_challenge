
---

# 📘 Dataset Documentation – Autonomous Service Orchestration System

This document describes the **synthetic datasets** used in the **AI-driven dealership service orchestration system**.
All datasets are generated programmatically using **GPT-OSS-120B** and are designed to be:

* Referentially consistent
* MongoDB-ready
* RAG-compatible (Langflow / FAISS / Chroma)
* Deterministic and review-safe

---

## 📂 Dataset Overview

| Table Name                 | Description                               | Records |
| -------------------------- | ----------------------------------------- | ------- |
| `service_problems`         | Canonical list of service issues/problems | 200     |
| `parts_model`              | Parts catalog with cost & availability    | 200     |
| `labour`                   | Technician & labour cost details          | 200     |
| `bay_area`                 | Service bay availability details          | 200     |
| `insurance_warranty_rules` | Insurance & warranty discount rules       | 200     |

---

## 🔗 Entity Relationships (High-Level)

```
service_problems
 ├── parts_needed ─────────▶ parts_model.part_id
 ├── labour_category ──────▶ labour.labour_category
 └── scheduling depends on ─▶ bay_area + labour availability

insurance_warranty_rules
 └── part_id ──────────────▶ parts_model.part_id
```

---

## 1️⃣ `service_problems`

Represents **diagnosable automotive service issues** derived from customer complaints.

### Purpose

* Used for **problem matching**
* Drives **RAG-based cost & service estimation**
* Input for **LLM-generated follow-up questions**

### Schema

```json
{
  "problem_id": "SP001",
  "problem_name": "Brake Pad Wear",
  "detailed_description": [
    "Squeaking noise while braking",
    "Reduced braking efficiency",
    "Brake warning light"
  ],
  "parts_needed": ["PART_028"],
  "labour_category": "General Maintenance",
  "estimated_labour_hours": 0.8,
  "estimated_service_time_minutes": 48
}
```

### Notes

* `problem_id` is unique
* `parts_needed` references `parts_model.part_id`
* `labour_category` references `labour.labour_category`
* No hard-coded follow-up questions (generated dynamically by LLM)

---

## 2️⃣ `parts_model`

Represents **vehicle parts catalog** with pricing and availability.

### Purpose

* RAG lookup for **cost estimation**
* Used by **insurance/warranty rules engine**
* Used in **parts availability checks**

### Schema

```json
{
  "part_id": "PART_028",
  "part_name": "Engine Oil Filter",
  "vehicle_models": ["Hyundai i20", "Hyundai i10"],
  "cost": 450,
  "in_stock": true,
  "eta_if_not_available_days": 2,
  "warranty_applicable": true,
  "insurance_applicable": false
}
```

### Notes

* `part_id` is globally unique
* Costs are synthetic but realistic
* `eta_if_not_available_days` used during scheduling

---

## 3️⃣ `labour`

Represents **technician workforce and labour costs**.

### Purpose

* Labour cost calculation
* Scheduling (availability & ETA)
* Skill-based technician assignment

### Schema

```json
{
  "labour_category": "General Maintenance",
  "technician_id": "T104",
  "skill_level": "Senior",
  "hourly_rate": 750,
  "availability": true,
  "eta_if_unavailable_hours": 4
}
```

### Notes

* Multiple technicians can share the same `labour_category`
* `hourly_rate` used in total cost calculation
* Availability affects scheduling logic

---

## 4️⃣ `bay_area`

Represents **service bays** within a dealership.

### Purpose

* Resource allocation
* Scheduling constraints
* ETA calculation when bays are busy

### Schema

```json
{
  "bay_id": "BAY_12",
  "bay_type": "Mechanical",
  "availability": false,
  "eta_if_unavailable_minutes": 30
}
```

### Notes

* `bay_type` maps to service requirements
* Used by scheduling engine to compute earliest slot

---

## 5️⃣ `insurance_warranty_rules`

Represents **deterministic discount rules** applied to parts.

### Purpose

* Warranty & insurance cost adjustments
* Claim generation
* Regulatory-safe decision logic (non-LLM)

### Schema

```json
{
  "rule_id": "RULE_087",
  "coverage_type": "WARRANTY",
  "part_id": "PART_028",
  "max_vehicle_age_months": 24,
  "discount_percentage": 100
}
```

### Notes

* Evaluated inside **Spring Boot rules engine**
* No probabilistic logic
* Fully auditable

---

## 🧠 How These Tables Are Used Together

1. **Customer input** → predicts candidate `service_problems`
2. **LLM dynamically asks follow-up questions**
3. One `service_problem` is finalized
4. System retrieves:

   * Required `parts_model`
   * Applicable `labour`
   * Available `bay_area`
5. **Cost estimation** = parts + labour − discounts
6. **Scheduling** assigns date, time, bay, technician
7. **Insurance/Warranty rules** applied deterministically

---

## ⚙️ Data Generation Notes

* All data is **synthetic**
* Generated using **GPT-OSS-120B via Groq**
* Batched generation ensures:

  * Referential integrity
  * Consistent IDs
  * Token & rate limit safety

---

## 📌 Intended Usage

* MongoDB ingestion
* RAG pipelines (Langflow)
* Workflow orchestration (n8n)
* Cost estimation services
* Scheduling & rules engines

---

## ✅ Review & Compliance Notes

* No proprietary OEM data
* No real customer data
* Deterministic logic for insurance & pricing
* Suitable for academic, PoC, and enterprise demos

---


