from typing import Dict

BENCHMARKS = {
    "carbon": 50.0,
    "energy": 10000.0,
    "water": 50000.0,
    "waste_recycling": 60.0,
    "gender_diversity": 0.40,
    "safety_incidents": 2.0,
    "training_hours": 40.0,
    "board_independence": 0.50,
    "audit_meetings": 4.0,
}


def safe_div(numerator: float, denominator: float) -> float:
    if denominator == 0:
        return 0.0
    return numerator / denominator


def clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))


def environmental_score(env, social) -> Dict[str, float]:
    employees = max(1, getattr(social, "total_employees", 1))

    carbon_intensity = safe_div(env.carbon_emissions_tonnes, employees)
    carbon_score = clamp(100 - safe_div(carbon_intensity, BENCHMARKS["carbon"]) * 50)

    energy_per_employee = safe_div(env.energy_kwh, employees)
    energy_score = clamp(100 - safe_div(energy_per_employee, BENCHMARKS["energy"]) * 50)

    water_per_employee = safe_div(env.water_litres, employees)
    water_score = clamp(100 - safe_div(water_per_employee, BENCHMARKS["water"]) * 50)

    recycling_score = clamp(safe_div(env.recycled_waste_kg, max(1.0, env.waste_kg)) * 100)

    e_score = round((carbon_score + energy_score + water_score + recycling_score) / 4, 2)
    return {
        "e_score": e_score,
        "carbon_score": round(carbon_score, 2),
        "energy_score": round(energy_score, 2),
        "water_score": round(water_score, 2),
        "recycling_score": round(recycling_score, 2),
    }


def social_score(social) -> Dict[str, float]:
    gender_score = clamp(safe_div(social.female_employees, max(1, social.total_employees)) * 200)
    safety_score = clamp(100 - social.safety_incidents * 10)
    training_score = clamp(safe_div(social.training_hours, BENCHMARKS["training_hours"]) * 100)

    assumed_revenue = max(1.0, social.total_employees * 100000.0)
    target_community = assumed_revenue * 0.01
    community_score = clamp(safe_div(social.community_investment, target_community) * 100)

    s_score = round((gender_score + safety_score + training_score + community_score) / 4, 2)
    return {
        "s_score": s_score,
        "gender_score": round(gender_score, 2),
        "safety_score": round(safety_score, 2),
        "training_score": round(training_score, 2),
        "community_score": round(community_score, 2),
    }


def governance_score(gov) -> Dict[str, float]:
    board_independence_score = clamp(
        safe_div(gov.independent_directors, max(1, gov.board_members)) * 100
    )
    meeting_score = clamp(safe_div(gov.audit_meetings, BENCHMARKS["audit_meetings"]) * 100)
    whistleblower_score = 100.0 if gov.has_whistleblower_policy else 0.0
    security_score = clamp(100 - gov.data_breaches * 25)

    g_score = round(
        (board_independence_score + meeting_score + whistleblower_score + security_score) / 4, 2
    )
    return {
        "g_score": g_score,
        "board_independence_score": round(board_independence_score, 2),
        "meeting_score": round(meeting_score, 2),
        "whistleblower_score": round(whistleblower_score, 2),
        "security_score": round(security_score, 2),
    }


def total_esg_score(e_score: float, s_score: float, g_score: float) -> float:
    return round(e_score * 0.4 + s_score * 0.35 + g_score * 0.25, 2)


def rating_from_score(score: float) -> str:
    if score >= 85:
        return "AAA"
    if score >= 70:
        return "AA"
    if score >= 55:
        return "A"
    if score >= 40:
        return "BBB"
    if score >= 25:
        return "BB"
    return "B"
